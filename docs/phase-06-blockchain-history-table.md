# Phase 6 — Blockchain History Table

## Objective

Create the main PostgreSQL blockchain history table used to track proof submissions, blockchain transaction IDs, verification results, errors, retries, and audit timestamps.

## Created Table

`blockchain.blockchain_history`

## Required Business Columns

- `module_name`
- `source_record_id`
- `blockchain_key`
- `record_hash`
- `hash_version`
- `action_type`
- `approval_status`
- `blockchain_status`
- `blockchain_transaction_id`
- `submitted_by`
- `submitted_at`
- `verified_at`
- `verification_status`
- `error_message`
- `retry_count`
- `created_at`
- `updated_at`

## Technical Columns

- `blockchain_history_id`

## Indexes

- `idx_blockchain_history_module_source`
- `idx_blockchain_history_blockchain_key`
- `idx_blockchain_history_record_hash`
- `idx_blockchain_history_tx_id`
- `idx_blockchain_history_blockchain_status`
- `idx_blockchain_history_verification_status`
- `idx_blockchain_history_submitted_at`
- `idx_blockchain_history_created_at`

## Validation

The table creation was validated by checking:

1. Table existence.
2. Required columns.
3. Primary key.
4. Indexes.
5. Check constraints.
6. Updated-at trigger.
7. Insert/update/delete rollback test.

## Status

Completed.
