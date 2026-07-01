# Phase 7 — DBA Execution Request Email

## Subject

Request to Execute Phase 7 PostgreSQL Performance Indexes for Blockchain History Tables

## Email Body

Dear DBA Team,

As part of Phase 7 of the VALOORES Blockchain Integration Project, we prepared a DBA handoff package to create PostgreSQL performance indexes for the blockchain proof history tables.

The indexes are required to improve lookup and reporting performance for:

- Module name lookup
- Source record ID lookup
- Blockchain key lookup
- Record hash lookup
- Blockchain transaction ID lookup
- Blockchain status filtering
- Verification status filtering
- Dashboard reporting by created date
- Dashboard reporting by submitted date
- Retry queue monitoring

## Database Objects

The target tables are:

- `blockchain.blockchain_history`
- `blockchain.blockchain_history_attempts`

## Execution Script

Please review and execute the following script:

`blockchain-api/database/scripts/phase-07-indexes/phase07_01_dba_create_blockchain_history_performance_indexes.sql`

## Validation Script

After execution, please run:

`blockchain-api/database/scripts/phase-07-indexes/phase07_02_dba_validate_blockchain_history_performance_indexes.sql`

## Rollback Script

Rollback script, if needed:

`blockchain-api/database/scripts/phase-07-indexes/phase07_03_dba_rollback_blockchain_history_performance_indexes.sql`

## Important Execution Notes

The create and rollback scripts use concurrent index operations.

Please note:

- Do not wrap the script inside `BEGIN` / `COMMIT`.
- Do not execute the script as a single transaction.
- Recommended execution window: low-traffic maintenance window.
- Please confirm there are no invalid indexes after execution.
- Please share the validation output after execution.

## Requested Indexes

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

Kindly proceed after your review and share the execution and validation results.

Best regards,  
Nicolas Salloum
