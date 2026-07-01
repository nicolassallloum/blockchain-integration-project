/*
Phase 7 — DBA Script
Create Blockchain History Performance Indexes

Project:
VALOORES Blockchain Integration Project

Execution owner:
DBA Team

Important DBA Notes:
1. Review before execution.
2. Recommended execution window: low-traffic maintenance window.
3. This script uses CREATE INDEX CONCURRENTLY to reduce blocking.
4. Do NOT wrap this script inside BEGIN / COMMIT.
5. Do NOT execute as a single transaction.
6. If DBA standards require non-concurrent index creation, replace CREATE INDEX CONCURRENTLY with CREATE INDEX after approval.
7. Existing Phase 6 indexes are preserved.
8. These indexes avoid exact duplicates found during Phase 7 inspection.
*/

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_source_record_id
    ON blockchain.blockchain_history (source_record_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_module_created_at_desc
    ON blockchain.blockchain_history (module_name, created_at DESC, blockchain_history_id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_module_submitted_at_desc
    ON blockchain.blockchain_history (module_name, submitted_at DESC, blockchain_history_id DESC)
    WHERE submitted_at IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_status_created_at_desc
    ON blockchain.blockchain_history (blockchain_status, created_at DESC, blockchain_history_id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_verification_created_at_desc
    ON blockchain.blockchain_history (verification_status, created_at DESC, blockchain_history_id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_retry_queue_status_pending_failed
    ON blockchain.blockchain_history (updated_at ASC, blockchain_history_id ASC)
    WHERE blockchain_status IN ('PENDING', 'FAILED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_retry_queue_verification_failed
    ON blockchain.blockchain_history (updated_at ASC, blockchain_history_id ASC)
    WHERE verification_status IN ('FAILED', 'MISMATCH');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_attempts_source_record_id
    ON blockchain.blockchain_history_attempts (source_record_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_attempts_module_started_at_desc
    ON blockchain.blockchain_history_attempts (module_name, started_at DESC, blockchain_history_attempt_id DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blockchain_history_attempts_status_started_at_desc
    ON blockchain.blockchain_history_attempts (blockchain_status, verification_status, started_at DESC, blockchain_history_attempt_id DESC);

COMMENT ON INDEX blockchain.idx_blockchain_history_source_record_id IS
'Phase 7: Supports direct lookup by source_record_id when module_name is not provided.';

COMMENT ON INDEX blockchain.idx_blockchain_history_module_created_at_desc IS
'Phase 7: Supports module dashboard reporting ordered by created_at descending.';

COMMENT ON INDEX blockchain.idx_blockchain_history_module_submitted_at_desc IS
'Phase 7: Supports module dashboard reporting ordered by submitted_at descending for submitted records.';

COMMENT ON INDEX blockchain.idx_blockchain_history_status_created_at_desc IS
'Phase 7: Supports dashboard filtering by blockchain_status and created_at.';

COMMENT ON INDEX blockchain.idx_blockchain_history_verification_created_at_desc IS
'Phase 7: Supports dashboard filtering by verification_status and created_at.';

COMMENT ON INDEX blockchain.idx_blockchain_history_retry_queue_status_pending_failed IS
'Phase 7: Supports retry queue ordering for PENDING and FAILED blockchain statuses.';

COMMENT ON INDEX blockchain.idx_blockchain_history_retry_queue_verification_failed IS
'Phase 7: Supports retry queue ordering for FAILED and MISMATCH verification statuses.';

COMMENT ON INDEX blockchain.idx_blockchain_history_attempts_source_record_id IS
'Phase 7: Supports direct attempt lookup by source_record_id.';

COMMENT ON INDEX blockchain.idx_blockchain_history_attempts_module_started_at_desc IS
'Phase 7: Supports attempt dashboard reporting by module and started_at descending.';

COMMENT ON INDEX blockchain.idx_blockchain_history_attempts_status_started_at_desc IS
'Phase 7: Supports attempt filtering by blockchain/verification status and started_at descending.';
