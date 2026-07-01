# Phase 6 — Blockchain History Reporting Views

## Objective

Create operational reporting views for blockchain proof history, retry monitoring, and module-level status summaries.

## Created Views

### 1. `blockchain.vw_blockchain_history_latest`

Shows the latest blockchain history status per `module_name` and `source_record_id`, enriched with latest attempt details.

### 2. `blockchain.vw_blockchain_history_summary`

Provides module-level summary counts for:

- Approval status
- Blockchain status
- Verification status
- Retry totals
- First and latest history timestamps

### 3. `blockchain.vw_blockchain_history_retry_queue`

Lists records that require retry or operational follow-up because they are pending or failed.

## Validation

The views were validated by checking:

1. View existence.
2. View columns.
3. Current view counts.
4. Insert test records.
5. Insert related attempt records.
6. Query latest, summary, and retry queue views.
7. Rollback cleanup.

## Status

Completed.
