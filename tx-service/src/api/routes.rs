// Copyright (c) 2025 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

use std::str::FromStr;

use axum::{
    Router,
    extract::{Json, Path, State},
    routing::get,
    routing::post,
};
use chrono::Utc;
use fastcrypto::encoding::{Base64, Encoding};
use iota_json_rpc_types::IotaObjectDataOptions;
use iota_sdk::IotaClientBuilder;
use iota_types::{
    base_types::{IotaAddress},
    digests::TransactionDigest,
    move_authenticator::MoveAuthenticator,
    object::Owner::Shared,
    signature::GenericSignature,
    transaction::CallArg,
};
use tower_http::cors::{Any, CorsLayer};

use crate::{
    api::{
        ApiState,
        error::ApiError,
        responses::{AddTxRequest, AddTxResponse, TransactionResponse},
    },
    db::{
        queries
    },
};

pub fn routes() -> Router<ApiState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/transaction/{tx_digest}", get(get_transaction_by_digest))
        .route("/add_transaction", post(add_transaction))
        .route(
            "/derive_auth_signature/{address}",
            get(derive_auth_signature),
        )
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
}

async fn health_check() -> &'static str {
    "OK"
}

async fn get_transaction_by_digest(
    State(state): State<ApiState>,
    Path(tx_digest): Path<String>,
) -> Result<TransactionResponse, ApiError> {
    let _ = TransactionDigest::from_str(&tx_digest)
        .map_err(|_| ApiError::BadRequest("Invalid IOTA transaction digest".to_string()))?;

    let mut conn = state
        .pool
        .get_connection()
        .map_err(|err| ApiError::Database(err))?;

    let tx = queries::get_transaction_by_digest(&mut conn, &tx_digest)
        .map_err(|err| ApiError::Database(err))?;

    Ok(TransactionResponse {
        bcs: tx.tx_data,
        sender: IotaAddress::from_str(&tx.sender).map_err(|err| ApiError::Internal(err))?,
        added_at: tx.added_at as u64,
        description: tx.description,
    })
}

async fn add_transaction(
    State(state): State<ApiState>,
    Json(payload): Json<AddTxRequest>,
) -> Result<Json<AddTxResponse>, ApiError> {
    let tx_data = bcs::from_bytes::<iota_types::transaction::TransactionData>(
        &Base64::decode(&payload.tx_bytes)
            .map_err(|_| ApiError::BadRequest("Invalid base64 transaction bytes".to_string()))?,
    )
    .map_err(|_| ApiError::BadRequest("Invalid transaction data".to_string()))?;

    let tx_digest = tx_data.digest();
    let now = Utc::now().timestamp() as u64;

    let mut conn = state
        .pool
        .get_connection()
        .map_err(|err| ApiError::Database(err))?;

    queries::insert_transaction(&mut conn, &tx_data, payload.description, now)
        .map_err(|err| ApiError::Database(err))?;
    Ok(Json(AddTxResponse {
        digest: tx_digest.to_string(),
        added_at: now,
    }))
}

// Only temporary implementation for testing purposes
async fn derive_auth_signature(
    State(state): State<ApiState>,
    Path(address): Path<String>,
) -> Result<Json<serde_json::Value>, ApiError> {
    let addr = IotaAddress::from_str(&address)
        .map_err(|_| ApiError::BadRequest("Invalid IOTA address".to_string()))?;

    let iota_client = IotaClientBuilder::default()
        .build(&state.node_url)
        .await
        .map_err(|err| ApiError::Internal(anyhow::anyhow!(err)))?;

    let resp = iota_client
        .read_api()
        .get_object_with_options(addr.into(), IotaObjectDataOptions::new().with_owner())
        .await
        .map_err(|err| ApiError::Internal(anyhow::anyhow!(err)))?;

    let initial_shared_version = match resp.data.unwrap().owner {
        Some(Shared {
            initial_shared_version,
            ..
        }) => initial_shared_version,
        _ => {
            return Err(ApiError::BadRequest(
                "The provided address is not a shared object id".to_string(),
            ));
        }
    };

    let sigs = vec![GenericSignature::MoveAuthenticator(
        MoveAuthenticator::new( 
            vec![],
            vec![],
            CallArg::Object(iota_types::transaction::ObjectArg::SharedObject {
                id: addr.into(),
                initial_shared_version: initial_shared_version,
                mutable: false,
            }),
        ),
    )];

    Ok(Json(serde_json::json!({ "signature": sigs })))
}
