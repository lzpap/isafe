use std::str::FromStr;

use anyhow::Result;
use diesel::{
    Connection, ExpressionMethods, OptionalExtension, QueryDsl, RunQueryDsl, SqliteConnection,
    delete, dsl, insert_into, update,
};
use fastcrypto::encoding::{Base64, Encoding};
use iota_types::base_types::IotaAddress;
use iota_types::digests::TransactionDigest;

use crate::db::models;
use crate::db::models::Status;
use crate::db::models::StoredTransaction;
use crate::db::models::TransactionSummary;
use crate::db::schema::accounts;
use crate::db::schema::approvals;
use crate::db::schema::events;
use crate::db::schema::members;
use crate::db::schema::transactions;

pub fn account_exists(conn: &mut SqliteConnection, account: &IotaAddress) -> Result<bool> {
    let count: i64 = accounts::table
        .filter(accounts::account_address.eq(account.to_string()))
        .count()
        .get_result(conn)?;
    Ok(count > 0)
}

pub fn insert_new_account_entry(
    conn: &mut SqliteConnection,
    account: IotaAddress,
    threshold: u64,
    authenticator: String,
    at: u64,
) -> Result<()> {
    insert_into(accounts::table)
        .values((
            accounts::account_address.eq(account.to_string()),
            accounts::threshold.eq(threshold as i32),
            accounts::authenticator.eq(authenticator),
            accounts::created_at.eq(at as i64),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn insert_member_entry(
    conn: &mut SqliteConnection,
    account: IotaAddress,
    member: IotaAddress,
    _weight: u64,
    at: u64,
) -> Result<()> {
    insert_into(members::table)
        .values((
            members::account_address.eq(account.to_string()),
            members::member_address.eq(member.to_string()),
            members::weight.eq(_weight as i32),
            members::added_at.eq(at as i64),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn update_member_weight(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    member: &IotaAddress,
    new_weight: u64,
) -> Result<()> {
    update(
        members::table
            .filter(members::account_address.eq(account.to_string()))
            .filter(members::member_address.eq(member.to_string())),
    )
    .set(members::weight.eq(new_weight as i32))
    .execute(conn)?;
    Ok(())
}

pub fn delete_member_from_account(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    member: &IotaAddress,
) -> Result<()> {
    delete(
        members::table
            .filter(members::account_address.eq(account.to_string()))
            .filter(members::member_address.eq(member.to_string())),
    )
    .execute(conn)?;
    Ok(())
}

pub fn get_accounts_for_member(
    conn: &mut SqliteConnection,
    member: &IotaAddress,
) -> Result<Vec<IotaAddress>> {
    let results = members::table
        .filter(members::member_address.eq(member.to_string()))
        .select(members::account_address)
        .load::<String>(conn)?;

    let accounts = results
        .into_iter()
        .filter_map(|addr_str| IotaAddress::from_str(&addr_str).ok())
        .collect();

    Ok(accounts)
}

pub fn get_transaction_approval_details(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    tx_digest: &str,
) -> Result<models::ApprovalDetails> {
    conn.transaction(|conn| {
        // Get approver addresses and weights in a single query
        let approver_data: Vec<(String, i32)> = approvals::table
            .filter(approvals::transaction_digest.eq(tx_digest))
            .filter(approvals::account_address.eq(account.to_string()))
            .select((approvals::approver_address, approvals::approver_weight))
            .load::<(String, i32)>(conn)?;

        let (approvers, approver_weights): (Vec<IotaAddress>, Vec<u64>) = approver_data
            .into_iter()
            .filter_map(|(addr, weight)| {
                IotaAddress::from_str(&addr)
                    .ok()
                    .map(|a| (a, weight as u64))
            })
            .unzip();

        // Get the total account weight
        let total_account_weight: i64 = members::table
            .filter(members::account_address.eq(account.to_string()))
            .select(dsl::sum(members::weight))
            .first::<Option<i64>>(conn)?
            .unwrap_or(0);

        // Get account threshold
        let threshold: i32 = accounts::table
            .filter(accounts::account_address.eq(&account.to_string()))
            .select(accounts::threshold)
            .first::<i32>(conn)?;

        Ok(models::ApprovalDetails {
            total_account_weight: total_account_weight as u64,
            approvers,
            approver_weights,
            threshold: threshold as u64,
        })
    })
}

pub fn get_transactions_for_account(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
) -> Result<Vec<TransactionSummary>> {
    // Use a transaction to ensure atomic reads across multiple tables
    conn.transaction(|conn| {
        let account_str = account.to_string();

        // 1. Get account threshold
        let threshold: i32 = accounts::table
            .filter(accounts::account_address.eq(&account_str))
            .select(accounts::threshold)
            .first::<i32>(conn)?;

        // 2. Get total weight of all members for this account
        let total_weight: i64 = members::table
            .filter(members::account_address.eq(&account_str))
            .select(dsl::sum(members::weight))
            .first::<Option<i64>>(conn)?
            .unwrap_or(0);

        // 3. Get all transactions for this account
        let stored_transactions = transactions::table
            .filter(transactions::account_address.eq(&account_str))
            .load::<models::StoredTransaction>(conn)?;

        // 4. For each transaction, get its approvals and build the summary
        let mut summaries = Vec::new();
        for tx in stored_transactions {
            // Get approver addresses and weights in a single query
            let approver_data: Vec<(String, i32)> = approvals::table
                .filter(approvals::transaction_digest.eq(&tx.transaction_digest))
                .filter(approvals::account_address.eq(&account_str))
                .select((approvals::approver_address, approvals::approver_weight))
                .load::<(String, i32)>(conn)?;

            let mut approved_by = Vec::new();
            let mut current_approvals: u64 = 0;
            for (addr, weight) in approver_data {
                if let Ok(iota_addr) = IotaAddress::from_str(&addr) {
                    approved_by.push(iota_addr);
                    current_approvals += weight as u64;
                }
            }

            summaries.push(TransactionSummary {
                transaction_digest: tx.transaction_digest,
                proposer_address: IotaAddress::from_str(&tx.proposer_address)
                    .unwrap_or(IotaAddress::ZERO),
                status: tx.status.into(),
                current_approvals: current_approvals as u64,
                threshold: threshold as u64,
                total_account_weight: total_weight as u64,
                approved_by,
                created_at: tx.created_at,
            });
        }

        Ok(summaries)
    })
}

pub fn update_transaction_status(
    conn: &mut SqliteConnection,
    tx_digest: String,
    status: String,
) -> Result<()> {
    let existing_tx = transactions::table
        .filter(transactions::transaction_digest.eq(tx_digest.clone()))
        .first::<models::StoredTransaction>(conn)
        .optional()?;

    if let Some(_) = existing_tx {
        update(transactions::table.filter(transactions::transaction_digest.eq(tx_digest)))
            .set(transactions::status.eq(status))
            .execute(conn)?;
    } else {
        return Err(anyhow::anyhow!("Transaction not found"));
    }
    Ok(())
}

pub fn get_transaction(
    conn: &mut SqliteConnection,
    tx_digest: String,
) -> Result<StoredTransaction> {
    match transactions::table
        .filter(transactions::transaction_digest.eq(tx_digest.clone()))
        .first::<models::StoredTransaction>(conn)
        .optional()?
    {
        Some(tx) => Ok(tx),
        None => Err(anyhow::anyhow!("Transaction not found")),
    }
}

pub fn delete_transaction(
    conn: &mut SqliteConnection,
    tx_digest: String,
) -> Result<()> {
    delete(transactions::table.filter(transactions::transaction_digest.eq(tx_digest.clone()))).execute(conn)?;
    Ok(())
}

pub fn insert_transaction_entry(
    conn: &mut SqliteConnection,
    tx_digest: String,
    account: &IotaAddress,
    proposer: &IotaAddress,
    status: String,
    at: u64,
) -> Result<()> {
    insert_into(transactions::table)
        .values((
            transactions::transaction_digest.eq(tx_digest),
            transactions::account_address.eq(account.to_string()),
            transactions::proposer_address.eq(proposer.to_string()),
            transactions::status.eq(status),
            transactions::created_at.eq(at as i64),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn insert_approval_entry(
    conn: &mut SqliteConnection,
    tx_digest: String,
    account: &IotaAddress,
    approver: &IotaAddress,
    approver_weight: u64,
    at: u64,
) -> Result<()> {
    insert_into(approvals::table)
        .values((
            approvals::transaction_digest.eq(tx_digest),
            approvals::account_address.eq(account.to_string()),
            approvals::approver_address.eq(approver.to_string()),
            approvals::approver_weight.eq(approver_weight as i32),
            approvals::approved_at.eq(at as i64),
        ))
        .execute(conn)?;
    Ok(())
}

/// Delete approvals from a member for proposed transactions, as they are no longer valid
pub fn delete_approvals_for_not_yet_executed_transactions(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    member: &IotaAddress,
) -> Result<()> {
    let account_str = account.to_string();
    let member_str = member.to_string();
    let proposed_status = String::from(Status::Proposed);
    let approved_status = String::from(Status::Approved);

    let not_yet_executed_txs = transactions::table
        .filter(transactions::account_address.eq(&account_str))
        .filter(transactions::status.eq_any([proposed_status, approved_status]))
        .select(transactions::transaction_digest);

    delete(
        approvals::table
            .filter(approvals::account_address.eq(&account_str))
            .filter(approvals::approver_address.eq(member_str))
            .filter(approvals::transaction_digest.eq_any(not_yet_executed_txs)),
    )
    .execute(conn)?;
    Ok(())
}

/// Re-evaluate all proposed/approved transactions for an account to see if their status needs to be updated
/// This is useful when members, their weights or the account threshold change
///
pub fn recheck_account_transactions_status(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    timestamp: &mut u64,
) -> Result<()> {
    let account_str = account.to_string();
    let proposed_status: String = Status::Proposed.into();
    let approved_status: String = Status::Approved.into();
    let mut proposed_to_approved_txs: Vec<String> = Vec::new();

    let proposed_tx_digests = transactions::table
        .filter(transactions::account_address.eq(&account_str))
        .filter(transactions::status.eq(proposed_status.clone()));
    for tx in proposed_tx_digests.load::<models::StoredTransaction>(conn)? {
        let approval_details =
            get_transaction_approval_details(conn, account, &tx.transaction_digest)?;
        let approving_weight = approval_details
            .approver_weights
            .iter()
            .fold(0, |acc, &w| acc + w);
        if approving_weight >= approval_details.threshold {
            // A proposed transaction is now approved
            update_transaction_status(
                conn,
                tx.transaction_digest.clone(),
                approved_status.clone(),
            )?;
            proposed_to_approved_txs.push(tx.transaction_digest.clone());
            // Insert an event for this status change (not fired on-chain, just for record-keeping)
            let th_reached_event_inner = crate::events::TransactionApprovalThresholdReachedEvent {
                account_id: account.clone(),
                transaction_digest: TransactionDigest::from_str(&tx.transaction_digest)?
                    .into_inner()
                    .into(),
                total_approved_weight: approving_weight,
                threshold: approval_details.threshold,
            };
            let threshold_reached_event =
                crate::events::IsafeEvent::TransactionApprovalThresholdReached(
                    th_reached_event_inner.clone(),
                );
            insert_event_entry(
                conn,
                account.to_string(),
                tx.transaction_digest.clone(),
                threshold_reached_event.type_().to_string(),
                *timestamp,
                Base64::encode(bcs::to_bytes(&th_reached_event_inner)?),
            )?;
            *timestamp += 1;
        }
    }

    let approved_tx_digests = transactions::table
        .filter(transactions::account_address.eq(&account_str))
        .filter(transactions::status.eq(approved_status.clone()))
        // for the ones we just bumped it doesn't make sense to check again
        .filter(transactions::transaction_digest.ne_all(&proposed_to_approved_txs));
    for tx in approved_tx_digests.load::<models::StoredTransaction>(conn)? {
        let approval_details =
            get_transaction_approval_details(conn, account, &tx.transaction_digest)?;
        let approving_weight = approval_details
            .approver_weights
            .iter()
            .fold(0, |acc, &w| acc + w);
        if approving_weight < approval_details.threshold {
            // An approved transaction has lost its approval
            update_transaction_status(
                conn,
                tx.transaction_digest.clone(),
                proposed_status.clone(),
            )?;
        }
        let th_lost_event_inner = crate::events::TransactionApprovalThresholdLostEvent {
            account_id: account.clone(),
            transaction_digest: TransactionDigest::from_str(&tx.transaction_digest)?
                .into_inner()
                .into(),
            total_approved_weight: approving_weight,
            threshold: approval_details.threshold,
        };
        let threshold_lost_event = crate::events::IsafeEvent::TransactionApprovalThresholdLost(
            th_lost_event_inner.clone(),
        );
        insert_event_entry(
            conn,
            account.to_string(),
            tx.transaction_digest.clone(),
            threshold_lost_event.type_().to_string(),
            *timestamp,
            Base64::encode(bcs::to_bytes(&th_lost_event_inner)?),
        )?;
        *timestamp += 1;
    }
    Ok(())
}

pub fn insert_event_entry(
    conn: &mut SqliteConnection,
    account_address: String,
    firing_tx_digest: String,
    event_type: String,
    timestamp: u64,
    // base64 encoded event
    content: String,
) -> Result<()> {
    insert_into(crate::db::schema::events::table)
        .values((
            events::account_address.eq(account_address),
            events::firing_tx_digest.eq(firing_tx_digest),
            events::event_type.eq(event_type),
            events::content.eq(content),
            events::timestamp.eq(timestamp as i64),
        ))
        .execute(conn)?;
    Ok(())
}

pub fn get_events_for_account(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
) -> Result<Vec<models::StoredEvent>> {
    let results = events::table
        .filter(events::account_address.eq(account.to_string()))
        .order(events::timestamp.desc())
        .load::<models::StoredEvent>(conn)?;

    Ok(results)
}

pub fn update_account_threshold(
    conn: &mut SqliteConnection,
    account: &IotaAddress,
    new_threshold: u64,
) -> Result<()> {
    update(accounts::table.filter(accounts::account_address.eq(account.to_string())))
        .set(accounts::threshold.eq(new_threshold as i32))
        .execute(conn)?;
    Ok(())
}
