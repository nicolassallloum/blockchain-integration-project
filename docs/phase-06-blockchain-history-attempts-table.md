# Phase 6 — Blockchain History Attempts Table

## Objective

Create a retry/error detail table linked to `blockchain.blockchain_history`.

## Created Table

`blockchain.blockchain_history_attempts`

## Purpose

This table tracks each individual blockchain submission, verification, retry, callback, and error attempt. It prevents the main history table from losing earlier error details when a later retry succeeds.

## Parent Table

`blockchain.blockchain_history`

## Key Columns

- `blockchain_history_attempt_id`
- `blockchain_history_id`
- `module_name`
- `source_record_id`
- `blockchain_key`
- `attempt_no`
- `attempt_type`
- `blockchain_status`
- `verification_status`
- `blockchain_transaction_id`
- `error_code`
- `error_message`
- `error_detail_fingerprint`
- `request_id`
- `worker_name`
- `started_at`
- `finished_at`
- `duration_ms`
- `created_by`
- `created_at`

## Design Notes

- The table uses a foreign key to `blockchain.blockchain_history`.
- Raw detailed error payloads or stacks should not be stored directly.
- Detailed error payloads should be stored as deterministic fingerprints when needed.
- A unique index prevents duplicate attempt numbers for the same history record.

## Validation

The table creation was validated by checking:

1. Table existence.
2. Required columns.
3. Primary key.
4. Foreign key.
5. Indexes.
6. Check constraints.
7. Parent history insert.
8. Failed first attempt insert.
9. Successful retry attempt insert.
10. Rollback cleanup.

## Status

Completed.
