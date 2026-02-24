// Copyright (c) 2025 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

use std::str::FromStr;

use crate::{api::responses::GetEventsResponse, db::queries};
use axum::{
    Router,
    extract::{Path, Query, State},
    routing::get,
};
use iota_types::base_types::IotaAddress;
use tower_http::cors::{Any, CorsLayer};

use crate::api::{
    ApiState,
    error::ApiError,
    responses::{Event, GetAccountsResponse, GetTransactionsResponse, PaginationParams, next_cursor_if_full_page},
};

pub fn routes() -> Router<ApiState> {
    Router::new()
        .route("/health", get(health_check))
        .route("/accounts/{member_address}", get(get_accounts))
        .route("/transactions/{account_address}", get(get_transactions))
        .route("/events/{account_address}", get(get_events))
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

async fn get_accounts(
    State(state): State<ApiState>,
    Path(member_address): Path<String>,
    Query(pagination): Query<PaginationParams>,
) -> Result<GetAccountsResponse, ApiError> {
    let address = IotaAddress::from_str(&member_address)
        .map_err(|_| ApiError::BadRequest("Invalid IOTA address".to_string()))?;

    let (offset, limit) = pagination
        .resolve(state.page_size_accounts)
        .map_err(|e| ApiError::BadRequest(e))?;

    let mut conn = state
        .pool
        .get_connection()
        .map_err(|err| ApiError::Database(err))?;

    let accounts = queries::get_accounts_for_member(&mut conn, &address, offset, limit)
        .map_err(|err| ApiError::Database(err))?;

    let next_cursor = next_cursor_if_full_page(offset, limit, accounts.len());

    Ok(GetAccountsResponse { accounts, next_cursor })
}

async fn get_transactions(
    State(state): State<ApiState>,
    Path(account_address): Path<String>,
    Query(pagination): Query<PaginationParams>,
) -> Result<GetTransactionsResponse, ApiError> {
    let address = IotaAddress::from_str(&account_address)
        .map_err(|_| ApiError::BadRequest("Invalid account address".to_string()))?;

    let (offset, limit) = pagination
        .resolve(state.page_size_transactions)
        .map_err(|e| ApiError::BadRequest(e))?;

    let mut conn = state
        .pool
        .get_connection()
        .map_err(|err| ApiError::Database(err))?;

    let transactions = queries::get_transactions_for_account(&mut conn, &address, offset, limit)
        .map_err(|err| ApiError::Database(err))?;

    let next_cursor = next_cursor_if_full_page(offset, limit, transactions.len());

    Ok(GetTransactionsResponse { transactions, next_cursor })
}

async fn get_events(
    State(state): State<ApiState>,
    Path(account_address): Path<String>,
    Query(pagination): Query<PaginationParams>,
) -> Result<GetEventsResponse, ApiError> {
    let address = IotaAddress::from_str(&account_address)
        .map_err(|_| ApiError::BadRequest("Invalid account address".to_string()))?;

    let (offset, limit) = pagination
        .resolve(state.page_size_events)
        .map_err(|e| ApiError::BadRequest(e))?;

    let mut conn = state
        .pool
        .get_connection()
        .map_err(|err| ApiError::Database(err))?;

    let events = queries::get_events_for_account(&mut conn, &address, offset, limit)
        .map_err(|err| ApiError::Database(err))?;

    let next_cursor = next_cursor_if_full_page(offset, limit, events.len());

    Ok(GetEventsResponse {
        events: events
            .into_iter()
            .map(|e| Event {
                account_address: IotaAddress::from_str(&e.account_address).unwrap_or_default(),
                firing_tx_digest: e.firing_tx_digest,
                event_type: e.event_type,
                event_data: e.content,
                timestamp: e.timestamp as u64,
            })
            .collect(),
        next_cursor,
    })
}
