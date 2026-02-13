use fastcrypto::encoding::{Base64, Encoding};
use futures::FutureExt;
use std::{ panic::AssertUnwindSafe, path::PathBuf, sync::Arc};

use iota_data_ingestion_core::{
    DataIngestionMetrics, FileProgressStore, IndexerExecutor, ReaderOptions, Worker, WorkerPool,
    reader::v2::{CheckpointReaderConfig, RemoteUrl},
};
use iota_json_rpc_types::{IotaObjectDataOptions, IotaTransactionBlockResponseOptions};
use iota_sdk::IotaClientBuilder;
use iota_types::{
    base_types::ObjectID,
    digests::TransactionDigest,
    effects::{TransactionEffects, TransactionEffectsAPI},
    execution_status::ExecutionStatus,
    full_checkpoint_content::{CheckpointData},
};

use diesel::Connection;

use crate::db::models::Status;
use crate::db::{pool::DbConnectionPool, queries};
use crate::{config::IsafeIndexerConfig, events::IsafeEvent};
use anyhow::{Result, anyhow, bail};
use async_trait::async_trait;
use prometheus::Registry;
use tokio_util::sync::CancellationToken;
use tracing::{debug, info, warn};

pub(crate) async fn run_isafe_reader(
    worker: IsafeWorker,
    node_url: &str,
    checkpoint_url: &str,
    registry: &Registry,
    concurrency: usize,
) -> anyhow::Result<()> {
    let progress_store_path = "./data/progress_store";
    initialize_progress_store(&worker, node_url, progress_store_path).await?;

    let progress_store = FileProgressStore::new(progress_store_path).await?;

    let mut executor = IndexerExecutor::new(
        progress_store,
        1,
        DataIngestionMetrics::new(registry),
        worker.token.clone(),
    );
    let worker_pool = WorkerPool::new(
        worker,
        "isafe_reader".to_string(),
        concurrency,
        Default::default(),
    );
    executor.register(worker_pool).await?;

    info!("Connecting to {checkpoint_url} to sync checkpoints");
    let reader_options = ReaderOptions {
        timeout_secs: 60,
        ..Default::default()
    };
    // Localnet does not support remote store, so we use the REST API
    if checkpoint_url.contains("localhost") || checkpoint_url.contains("host.docker.internal") {
        executor
            .run(
                // path to a local directory where checkpoints are stored.
                PathBuf::from("./data/chk"),
                Some(format!("{checkpoint_url}/api/v1")),
                // optional remote store access options.
                vec![],
                reader_options,
            )
            .await?;
    } else {
        let config = CheckpointReaderConfig {
            remote_store_url: Some(RemoteUrl::HybridHistoricalStore {
                historical_url: format!("{checkpoint_url}/ingestion/historical"),
                live_url: Some(format!("{checkpoint_url}/ingestion/live")),
            }),
            ingestion_path: Some(PathBuf::from("./data/chk")),
            reader_options,
        };
        executor.run_with_config(config).await?;
    }
    Ok(())
}

pub(crate) struct IsafeWorker {
    pool: DbConnectionPool,
    config: IsafeIndexerConfig,
    token: CancellationToken,
}

impl IsafeWorker {
    pub(crate) fn new(
        pool: DbConnectionPool,
        config: IsafeIndexerConfig,
        token: CancellationToken,
    ) -> anyhow::Result<Self> {
        Ok(Self {
            pool,
            config,
            token,
        })
    }

    async fn process_checkpoint(&self, checkpoint: &CheckpointData) -> anyhow::Result<()> {
        debug!(
            "Processing checkpoint: {}",
            checkpoint.checkpoint_summary.sequence_number
        );
        // events shall have a unique timestamp to signal ordering (per account), therfore we use a mutable timestamp here
        // which is always incremented by 1 ms after processing each event
        // note: checkpoint interval is 200-300ms, so we should be safe for ~200 events per account per checkpoint
        // even if this number is exceeded,
        let mut event_timestamp = checkpoint.checkpoint_summary.timestamp_ms;

        for transaction in &checkpoint.transactions {
            let TransactionEffects::V1(effects) = &transaction.effects;

            if *effects.status() != ExecutionStatus::Success {
                continue;
            }

            let timestamp = checkpoint.checkpoint_summary.timestamp_ms;

            if let Some(events) = &transaction.events {
                for event in events.data.iter() {
                    match IsafeEvent::try_from_event(event, &self.config) {
                        Ok(Some(event)) => self.process_event(
                            event,
                            timestamp,
                            &mut event_timestamp,
                            &transaction.transaction.digest().to_string(),
                        )?,
                        Err(e) => warn!("parsing event failed: {e}"),
                        _ => {}
                    }
                }
            }
        }

        Ok(())
    }

    fn process_event(
        &self,
        event: IsafeEvent,
        timestamp: u64,
        event_timestamp: &mut u64,
        tx_digest_str: &String,
    ) -> anyhow::Result<()> {
        let mut conn = self.pool.get_connection()?;
        match &event {
            IsafeEvent::AccountCreated(acct_event) => {
                info!(
                    "Processing AccountCreated event for account: {}",
                    acct_event.account_id
                );
                // First, insert the account itself
                let authenticator = format!(
                    "{}::{}::{}",
                    acct_event.authenticator.package,
                    acct_event.authenticator.module_name,
                    acct_event.authenticator.function_name
                );
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::insert_new_account_entry(
                        conn,
                        acct_event.account_id,
                        acct_event.threshold,
                        authenticator,
                        timestamp,
                    )?;
                    info!(
                        "Created account {} with threshold {}",
                        acct_event.account_id, acct_event.threshold
                    );
                    for member in &acct_event.members {
                        queries::insert_member_entry(
                            conn,
                            acct_event.account_id,
                            member.member_address,
                            member.weight,
                            timestamp,
                        )?;
                        info!(
                            "Added member {} with weight {} to account {}",
                            member.member_address, member.weight, acct_event.account_id
                        );
                    }
                    queries::insert_event_entry(
                        conn,
                        acct_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&acct_event)?),
                    )?;
                    // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                    *event_timestamp += 1;
                    Ok(())
                })?;
            }
            IsafeEvent::AccountRotated(_acct_event) => {
                // Handle account rotation event
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    // TODOs:
                    // remove all existing members and re-insert new members
                    // update account threshold and authenticator
                    // update the guardian if applicable
                    queries::insert_event_entry(
                        conn,
                        _acct_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&_acct_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
            }
            IsafeEvent::MemberAdded(member_added_event) => {
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::insert_member_entry(
                        conn,
                        member_added_event.account_id,
                        member_added_event.member.member_address,
                        member_added_event.member.weight,
                        timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        member_added_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&member_added_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Added member {} with weight {} to account {}",
                    member_added_event.member.member_address,
                    member_added_event.member.weight,
                    member_added_event.account_id
                );
            }
            IsafeEvent::MemberRemoved(member_removed_event) => {
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::delete_member_from_account(
                        conn,
                        &member_removed_event.account_id,
                        &member_removed_event.member.member_address,
                    )?;
                    // account's total weight is computed as sum(members.weight), so no need to adjust separately
                    queries::delete_approvals_for_not_yet_executed_transactions(
                        conn,
                        &member_removed_event.account_id,
                        &member_removed_event.member.member_address,
                    )?;
                    // member removal may affect proposed/approved transactions' approval status. Need to re-evaluate them
                    queries::recheck_account_transactions_status(
                        conn,
                        &member_removed_event.account_id,
                        event_timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        member_removed_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&member_removed_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Removed member {} from account {}",
                    member_removed_event.member.member_address, member_removed_event.account_id
                );
            }
            IsafeEvent::MemberWeightUpdated(member_updated_event) => {
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::update_member_weight(
                        conn,
                        &member_updated_event.account_id,
                        &member_updated_event.member.member_address,
                        member_updated_event.member.weight,
                    )?;
                    // There could be proposed transactions that are now approved or lost approval due to weight change
                    // Let's re-evaluate them
                    queries::recheck_account_transactions_status(
                        conn,
                        &member_updated_event.account_id,
                        event_timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        member_updated_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&member_updated_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Updated member {} weight to {} in account {}",
                    member_updated_event.member.member_address,
                    member_updated_event.member.weight,
                    member_updated_event.account_id
                );
            }
            IsafeEvent::ThresholdChanged(th_changed_event) => {
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::update_account_threshold(
                        conn,
                        &th_changed_event.account_id,
                        th_changed_event.new_threshold,
                    )?;
                    // Threshold change may affect proposed/approved transactions' approval status. Need to re-evaluate
                    queries::recheck_account_transactions_status(
                        conn,
                        &th_changed_event.account_id,
                        event_timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        th_changed_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&th_changed_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
            }
            IsafeEvent::GuardianChanged(guardian_changed_event) => {
                // TODO: Update the account's guardian
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::insert_event_entry(
                        conn,
                        guardian_changed_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&guardian_changed_event)?),
                    )
                })?;
                // Increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
            }
            IsafeEvent::TransactionProposed(tx_event) => {
                // on-chain type shall always be 32 bytes
                let tx_digest_bytes: [u8; 32] = tx_event
                    .transaction_digest
                    .clone()
                    .try_into()
                    .expect("Invalid transaction digest length");
                let tx_digest = TransactionDigest::from(tx_digest_bytes);
                info!(
                    "Processing TransactionProposed event for transaction: {:?}",
                    tx_digest
                );
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::insert_transaction_entry(
                        conn,
                        tx_digest.to_string(),
                        &tx_event.account_id,
                        &tx_event.proposer,
                        Status::Proposed.into(),
                        timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        tx_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&tx_event)?),
                    )
                })?;
                // increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Inserted proposed transaction {} for account {}",
                    tx_digest.to_string(),
                    tx_event.account_id
                );
            }
            IsafeEvent::TransactionApproved(tx_event) => {
                let tx_digest_bytes: [u8; 32] = tx_event
                    .transaction_digest
                    .clone()
                    .try_into()
                    .expect("Invalid transaction digest length");
                let tx_digest = TransactionDigest::from(tx_digest_bytes);
                info!(
                    "Processing TransactionApproved event for transaction: {:?}",
                    tx_digest
                );
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::insert_approval_entry(
                        conn,
                        tx_digest.to_string(),
                        &tx_event.account_id,
                        &tx_event.approver,
                        tx_event.approver_weight,
                        timestamp,
                    )?;
                    queries::insert_event_entry(
                        conn,
                        tx_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&tx_event)?),
                    )
                })?;
                // increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Inserted approval for transaction {} by approver {}",
                    tx_digest.to_string(),
                    tx_event.approver
                );
            }
            IsafeEvent::TransactionApprovalThresholdReached(tx_event) => {
                let tx_digest_bytes: [u8; 32] = tx_event
                    .transaction_digest
                    .clone()
                    .try_into()
                    .expect("Invalid transaction digest length");
                let tx_digest = TransactionDigest::from(tx_digest_bytes);
                info!(
                    "Processing TransactionApprovalThresholdReached event for transaction: {:?}",
                    tx_digest
                );
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::update_transaction_status(
                        conn,
                        tx_digest.to_string(),
                        Status::Approved.into(),
                    )?;
                    queries::insert_event_entry(
                        conn,
                        tx_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&tx_event)?),
                    )
                })?;
                // increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Updated transaction {} status to Approved",
                    tx_digest.to_string()
                );
            }
            IsafeEvent::TransactionExecuted(tx_executed_event) => {
                let tx_digest_bytes: [u8; 32] = tx_executed_event
                    .transaction_digest
                    .clone()
                    .try_into()
                    .expect("Invalid transaction digest length");
                let tx_digest = TransactionDigest::from(tx_digest_bytes);
                info!(
                    "Processing TransactionExecuted event for transaction: {:?}",
                    tx_digest
                );
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                    queries::update_transaction_status(
                        conn,
                        tx_digest.to_string(),
                        Status::Executed.into(),
                    )?;
                    queries::insert_event_entry(
                        conn,
                        tx_executed_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&tx_executed_event)?),
                    )
                })?;
                // increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Processed TransactionExecuted event for account {} transaction: {:?}",
                    tx_executed_event.account_id,
                    tx_digest.to_string(),
                );
            }
            IsafeEvent::TransactionRemoved(tx_removed_event) => {
                // TODO: remove the transaction from the transactions table?
                conn.transaction::<_, anyhow::Error, _>(|conn| {
                let tx_digest_bytes: [u8; 32] = tx_removed_event
                    .transaction_digest
                    .clone()
                    .try_into()
                    .expect("Invalid transaction digest length");
                let tx_digest = TransactionDigest::from(tx_digest_bytes);
                    // if the transaction was already executed and got deleted, that means normal cleanup of on-chain state
                    // if the transaction was proposed/approved but got deleted, that means the transaction got rejected/cancelled
                    match queries::get_transaction(conn, tx_digest.to_string()) {
                        Ok(tx) => {
                            match tx.status {
                                Status::Proposed | Status::Approved => {
                                    // change the status to Rejected
                                    queries::update_transaction_status(
                                        conn,
                                        tx_digest.to_string(),
                                        Status::Rejected.into(),
                                    )?;
                                },
                                Status::Executed => {
                                    // transaction got removed after execution, this is expected as on-chain state will be cleaned up eventually
                                    // we keep the transaction in the database with Executed status for historical/reference purposes
                                },
                                Status::Rejected => {
                                    warn!("Transaction {} got removed from chain with Rejected status, this should not have happened", tx_digest.to_string());
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Transaction {} not found in database when processing TransactionRemoved event: {e}", tx_digest.to_string());
                        }
                    }
                    queries::insert_event_entry(
                        conn,
                        tx_removed_event.account_id.to_string(),
                        tx_digest_str.clone(),
                        event.type_().to_string(),
                        *event_timestamp,
                        Base64::encode(bcs::to_bytes(&tx_removed_event)?),
                    )
                })?;
                // increment timestamp by 1 to ensure unique timestamps for events in the same tx
                *event_timestamp += 1;
                info!(
                    "Processed TransactionRemoved event for transaction: {:?}",
                    tx_removed_event.transaction_digest
                );
            }
            // This event doesn't exist on-chain, it's for indexing purposes only
            IsafeEvent::TransactionApprovalThresholdLost(_) => {
                unreachable!()
            }
        }
        Ok(())
    }
}

#[async_trait]
impl Worker for IsafeWorker {
    type Message = ();
    type Error = anyhow::Error;

    async fn process_checkpoint(
        &self,
        checkpoint: Arc<CheckpointData>,
    ) -> Result<Self::Message, Self::Error> {
        let res = AssertUnwindSafe(self.process_checkpoint(&checkpoint))
            .catch_unwind()
            .await
            .map_err(map_panic);
        if let Err(e) | Ok(Err(e)) = &res {
            tracing::error!("{e}");
            self.token.cancel();
        }
        res?
    }
}

async fn initialize_progress_store(
    worker: &IsafeWorker,
    node_url: &str,
    progress_store_path: &str,
) -> anyhow::Result<()> {
    if std::path::Path::new(progress_store_path).exists() {
        return Ok(());
    }

    info!("Progress store file not found, creating with initial checkpoint");
    let client = IotaClientBuilder::default().build(node_url).await?;

    let package_id = &worker.config.package_address;
    let mut checkpoint: u64 = 0;

    match get_package_deployment_checkpoint(&client, package_id).await {
        Err(e) => {
            // If we can't get the deployment checkpoint, we default to the last known checkpoint
            let current_checkpoint = client
                .read_api()
                .get_latest_checkpoint_sequence_number()
                .await?;
            warn!(
                "Failed to get package deployment checkpoint: {e}, defaulting to current checkpoint of {current_checkpoint}"
            );
            checkpoint = current_checkpoint;
        }
        Ok(deployed_at) => {
            info!("Package deployed at checkpoint: {deployed_at}");
            checkpoint = deployed_at;
        }
    }

    // Create the data directory if it doesn't exist
    std::fs::create_dir_all("./data")?;

    let progress_content = serde_json::json!({
        "isafe_reader": checkpoint
    });
    info!("Setting progress store checkpoint to: {checkpoint}");
    std::fs::write(
        progress_store_path,
        serde_json::to_string_pretty(&progress_content)?,
    )?;

    Ok(())
}

/// Maps a panic payload to an error.
///
/// A invocation of the panic!() macro in Rust 2021 or later will always result
/// in a panic payload of type &'static str or String.
///
/// Only an invocation of panic_any (or, in Rust 2018 and earlier, panic!(x)
/// where x is something other than a string) can result in a panic payload
/// other than a &'static str or String.
/// See https://doc.rust-lang.org/stable/std/panic/struct.PanicHookInfo.html for more info
fn map_panic(payload: Box<dyn std::any::Any + Send + 'static>) -> anyhow::Error {
    if let Some(s) = payload.downcast_ref::<&str>() {
        anyhow!("{s}")
    } else if let Some(s) = payload.downcast_ref::<String>() {
        anyhow!("{s}")
    } else {
        anyhow!("unknown panic occurred")
    }
}

async fn get_package_deployment_checkpoint(
    client: &iota_sdk::IotaClient,
    package_address: &iota_types::base_types::IotaAddress,
) -> anyhow::Result<u64> {
    let object_response = client
        .read_api()
        .get_object_with_options(
            ObjectID::from(*package_address),
            IotaObjectDataOptions::default().with_previous_transaction(),
        )
        .await?;

    if let Some(error) = object_response.error {
        bail!("Failed to fetch package object: {error}");
    }

    let tx_response = client
        .read_api()
        .get_transaction_with_options(
            object_response.data.unwrap().previous_transaction.unwrap(),
            IotaTransactionBlockResponseOptions::default(),
        )
        .await?;
    if !tx_response.errors.is_empty() {
        bail!("Failed to fetch transaction: {:?}", tx_response.errors);
    }

    tx_response
        .checkpoint
        .ok_or_else(|| anyhow::anyhow!("Missing checkpoint"))
}
