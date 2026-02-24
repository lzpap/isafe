mod api;
mod config;
mod db;
mod metrics;
mod worker;
mod events;

use anyhow::Result;
use clap::Parser;
use tokio::task::JoinSet;
use tokio_util::sync::CancellationToken;
use tracing::{error, info, warn};
use tracing_subscriber::{
    EnvFilter, fmt::format::FmtSpan, layer::SubscriberExt, util::SubscriberInitExt,
};

use crate::{
    api::start_api_server,
    config::IsafeIndexerConfig,
    db::pool::{DbConnectionPool, DbConnectionPoolConfig},
    metrics::PrometheusServer,
    worker::{IsafeWorker, run_isafe_reader},
};

// Define the `GIT_REVISION` and `VERSION` consts
bin_version::bin_version!();

#[derive(Parser)]
#[command(
    name = env!("CARGO_BIN_NAME"),
    about = env!("CARGO_PKG_DESCRIPTION"),
    author,
    version = VERSION,
    propagate_version = true,
)]
enum Command {
    Start {
        #[clap(flatten)]
        connection_pool_config: DbConnectionPoolConfig,
        /// The URL of an IOTA node with JSON API.
        #[arg(long, default_value = "http://localhost:9000")]
        node_url: String,
        /// The URL of an IOTA node with REST API enabled or a historical store.
        #[arg(long, default_value = "http://localhost:9000")]
        checkpoint_url: String,
        /// The number of workers to spawn in parallel.
        #[arg(long, default_value_t = 1)]
        num_workers: usize,
        /// The port to run the API server on.
        #[arg(long, default_value_t = 3030)]
        api_port: u16,
        /// Max page size for accounts endpoint.
        #[arg(long, default_value_t = 20)]
        page_size_accounts: u32,
        /// Max page size for transactions endpoint.
        #[arg(long, default_value_t = 50)]
        page_size_transactions: u32,
        /// Max page size for events endpoint.
        #[arg(long, default_value_t = 50)]
        page_size_events: u32,
    },
}

impl Command {
    async fn execute(self) -> Result<()> {
        match self {
            Command::Start {
                connection_pool_config,
                node_url,
                checkpoint_url,
                num_workers,
                api_port,
                page_size_accounts,
                page_size_transactions,
                page_size_events,
            } => {
                info!("Starting iSafe Indexer");

                let prometheus = PrometheusServer::new();
                let registry = prometheus.registry();

                let cancel_token = CancellationToken::new();

                let mut tasks: JoinSet<Result<()>> = JoinSet::new();

                let connection_pool = DbConnectionPool::new(connection_pool_config)?;
                connection_pool.run_migrations()?;

                // Spawn the auction API server
                let handle = cancel_token.clone();
                let database_pool = connection_pool.clone();
                tasks.spawn(async move {
                    start_api_server(
                        database_pool,
                        api_port,
                        page_size_accounts,
                        page_size_transactions,
                        page_size_events,
                        handle,
                    )
                    .await
                });

                // spawn the main isafe reader worker
                let isafe_config = IsafeIndexerConfig::from_env().unwrap_or_default();
                info!("Starting with iSafe config: {isafe_config:#?}");

                let handle = cancel_token.clone();
                tasks.spawn(async move {
                    let worker = IsafeWorker::new(
                        connection_pool,
                        isafe_config,
                        handle.clone(),
                    )?;

                    tokio::select! {
                        res = run_isafe_reader(worker, &node_url, &checkpoint_url, &registry, num_workers) => res,
                        _ = handle.cancelled() => Ok(()),
                    }
                });

                let mut exit_code = Ok(());

                tokio::select! {
                    res = interrupt_or_terminate() => {
                        cancel_token.cancel();
                        if let Err(err) = res {
                            tracing::error!("subscribing to OS interrupt signals failed with error: {err}; shutting down");
                            exit_code = Err(err);
                        } else {
                            tracing::info!("received interrupt; shutting down");
                        }
                    },
                    res = tasks.join_next() => {
                        cancel_token.cancel();
                        tracing::debug!("tasks have begun shutting down");
                        if let Some(Ok(Err(err))) = res {
                            tracing::error!("a worker failed with error: {err}");
                            exit_code = Err(err);
                        }
                        while let Some(res) = tasks.join_next().await {
                            if let Ok(Err(err)) = res {
                                tracing::error!("a worker failed with error: {err}");
                            }
                        }
                    },
                }

                // Allow the user to abort if the tasks aren't shutting down quickly.
                tokio::select! {
                    res = interrupt_or_terminate() => {
                        if let Err(err) = res {
                            tracing::error!("subscribing to OS interrupt signals failed with error: {err}; aborting");
                            exit_code = Err(err);
                        } else {
                            tracing::info!("received second interrupt; aborting");
                        }
                        tasks.shutdown().await;
                        tracing::info!("runtime aborted");
                    },
                    _ = async {
                            while let Some(res) = tasks.join_next().await {
                                if let Ok(Err(err)) = res {
                                    tracing::error!("a worker failed with error: {err}");
                                }
                            }
                        } => {
                        tracing::info!("runtime stopped");
                    },
                }

                exit_code
            }
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    set_up_logging()?;

    Command::parse().execute().await?;
    Ok(())
}

fn set_up_logging() -> Result<()> {
    std::panic::set_hook(Box::new(|p| {
        error!("{p}");
    }));

    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer().with_span_events(FmtSpan::CLOSE))
        .init();
    Ok(())
}

pub async fn interrupt_or_terminate() -> Result<()> {
    #[cfg(unix)]
    {
        use anyhow::anyhow;
        use tokio::signal::unix::{SignalKind, signal};
        let mut terminate = signal(SignalKind::terminate())
            .map_err(|e| anyhow!("cannot listen to `SIGTERM`: {e}"))?;
        let mut interrupt = signal(SignalKind::interrupt())
            .map_err(|e| anyhow!("cannot listen to `SIGINT`: {e}"))?;
        tokio::select! {
            _ = terminate.recv() => {}
            _ = interrupt.recv() => {}
        }
    }
    #[cfg(not(unix))]
    tokio::signal::ctrl_c().await?;

    Ok(())
}
