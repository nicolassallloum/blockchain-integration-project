/*
Phase 7 — DBA Rollback Script
Drop Blockchain History Performance Indexes

Execution owner:
DBA Team

Important:
1. Review before execution.
2. This script uses DROP INDEX CONCURRENTLY to reduce blocking.
3. Do NOT wrap this script inside BEGIN / COMMIT.
4. Do NOT execute as a single transaction.
*/

DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_attempts_status_started_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_attempts_module_started_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_attempts_source_record_id;

DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_retry_queue_verification_failed;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_retry_queue_status_pending_failed;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_verification_created_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_status_created_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_module_submitted_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_module_created_at_desc;
DROP INDEX CONCURRENTLY IF EXISTS blockchain.idx_blockchain_history_source_record_id;
