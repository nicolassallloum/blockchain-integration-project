# Phase 7 — DBA Index Handoff

## Project

VALOORES Blockchain Integration Project

## Objective

Create PostgreSQL performance indexes for blockchain proof lookup, verification, retry queue processing, and dashboard reporting.

## Execution Owner

DBA Team

## Application Owner

Blockchain Integration Project Team

## DBA Execution Script

`blockchain-api/database/scripts/phase-07-indexes/phase07_01_dba_create_blockchain_history_performance_indexes.sql`

## DBA Validation Script

`blockchain-api/database/scripts/phase-07-indexes/phase07_02_dba_validate_blockchain_history_performance_indexes.sql`

## DBA Rollback Script

`blockchain-api/database/scripts/phase-07-indexes/phase07_03_dba_rollback_blockchain_history_performance_indexes.sql`

## Important Execution Notes

The create and rollback scripts use concurrent index operations.

Therefore:

- Do not wrap the script inside `BEGIN` / `COMMIT`.
- Do not execute as a single transaction.
- Execute during a DBA-approved maintenance window.
- Confirm there are no invalid indexes after execution.
- Run the validation script after execution.

## Indexes Requested

### Main History Table

| Index | Purpose |
|---|---|
| `idx_blockchain_history_source_record_id` | Direct lookup by source record ID |
| `idx_blockchain_history_module_created_at_desc` | Module dashboard reporting by created date |
| `idx_blockchain_history_module_submitted_at_desc` | Module dashboard reporting by submitted date |
| `idx_blockchain_history_status_created_at_desc` | Blockchain status dashboard filtering |
| `idx_blockchain_history_verification_created_at_desc` | Verification status dashboard filtering |
| `idx_blockchain_history_retry_queue_status_pending_failed` | Retry queue for pending/failed blockchain records |
| `idx_blockchain_history_retry_queue_verification_failed` | Retry queue for failed/mismatched verification records |

### Attempt Table

| Index | Purpose |
|---|---|
| `idx_blockchain_history_attempts_source_record_id` | Direct attempt lookup by source record ID |
| `idx_blockchain_history_attempts_module_started_at_desc` | Attempt dashboard reporting by module and started date |
| `idx_blockchain_history_attempts_status_started_at_desc` | Attempt status filtering by started date |

## Why These Indexes Are Needed

Phase 7 inspection found that existing Phase 6 indexes already cover many lookup requirements. The additional indexes focus on the remaining performance gaps:

- Direct `source_record_id` lookup without `module_name`.
- Dashboard sorting by date.
- Status-based dashboard filtering.
- Retry queue ordering.
- Attempt-level reporting.

## Validation Requirements

After execution, DBA should confirm:

1. All requested indexes exist.
2. No duplicate indexes were introduced.
3. `ANALYZE` completed.
4. `EXPLAIN` checks complete.
5. Table row counts remain unchanged.
6. No invalid indexes exist.

## Status

Prepared for DBA execution.
