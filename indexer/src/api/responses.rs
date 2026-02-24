// Copyright (c) 2025 IOTA Stiftung
// SPDX-License-Identifier: Apache-2.0

use fastcrypto::encoding::{Base64, Encoding};
use iota_types::base_types::IotaAddress;
use serde::{Deserialize, Serialize};

use crate::db::models::TransactionSummary;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub cursor: Option<String>,
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct CursorData {
    offset: i64,
    limit: i64,
}

impl PaginationParams {
    pub fn resolve(&self, max_page_size: u32) -> Result<(i64, i64), String> {
        if let Some(ref cursor) = self.cursor {
            let decoded = Base64::decode(cursor).map_err(|e| format!("Invalid cursor: {e}"))?;
            let data: CursorData =
                serde_json::from_slice(&decoded).map_err(|e| format!("Invalid cursor data: {e}"))?;
            if data.offset < 0 || data.limit <= 0 {
                return Err("Invalid cursor values".to_string());
            }
            Ok((data.offset, data.limit.min(max_page_size as i64)))
        } else {
            let limit = self
                .limit
                .map(|l| l.min(max_page_size))
                .unwrap_or(max_page_size) as i64;
            Ok((0, limit))
        }
    }
}

pub fn next_cursor_if_full_page(offset: i64, limit: i64, result_count: usize) -> Option<String> {
    if result_count >= limit as usize {
        let next = CursorData {
            offset: offset + limit,
            limit,
        };
        let json = serde_json::to_vec(&next).ok()?;
        Some(Base64::encode(&json))
    } else {
        None
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GetAccountsResponse {
    pub accounts: Vec<IotaAddress>,
    pub next_cursor: Option<String>,
}

impl axum::response::IntoResponse for GetAccountsResponse {
    fn into_response(self) -> axum::response::Response {
        axum::Json(self).into_response()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetTransactionsResponse {
    pub transactions: Vec<TransactionSummary>,
    pub next_cursor: Option<String>,
}

impl axum::response::IntoResponse for GetTransactionsResponse {
    fn into_response(self) -> axum::response::Response {
        axum::Json(self).into_response()
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    pub account_address: IotaAddress,
    pub firing_tx_digest: String,
    pub event_type: String,
    pub event_data: String,
    pub timestamp: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GetEventsResponse {
    pub events: Vec<Event>,
    pub next_cursor: Option<String>,
}

impl axum::response::IntoResponse for GetEventsResponse {
    fn into_response(self) -> axum::response::Response {
        axum::Json(self).into_response()
    }
}
