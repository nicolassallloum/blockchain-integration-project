/*
STEP 5 — Create Indexes for Blockchain Sync Performance

Purpose:
Improve performance for:
- CREATE detection
- UPDATE detection
- unchanged-record skipping
- failed-record retry
- verification
- dashboard statistics
- blockchain transaction lookup

Important:
- These indexes do not change data.
- These indexes support PostgreSQL as the source of truth.
- Blockchain remains proof-only.
*/

-- =========================================================
-- blockchain.blockchain_sync_history indexes
-- =========================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_record_type_source_record_created
ON blockchain.blockchain_sync_history (
    record_type,
    source_record_id,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_record_type_source_record_hash
ON blockchain.blockchain_sync_history (
    record_type,
    source_record_id,
    new_hash
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_sync_status_created
ON blockchain.blockchain_sync_history (
    sync_status,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_record_type_sync_status
ON blockchain.blockchain_sync_history (
    record_type,
    sync_status
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_new_hash
ON blockchain.blockchain_sync_history (
    new_hash
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_blockchain_transaction_id
ON blockchain.blockchain_sync_history (
    blockchain_transaction_id
)
WHERE blockchain_transaction_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_blockchain_key
ON blockchain.blockchain_sync_history (
    blockchain_key
)
WHERE blockchain_key IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_created_at
ON blockchain.blockchain_sync_history (
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_run_id
ON blockchain.blockchain_sync_history (
    run_id
)
WHERE run_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_action_type_created
ON blockchain.blockchain_sync_history (
    action_type,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_verification_status
ON blockchain.blockchain_sync_history (
    verification_status,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_retry_failed
ON blockchain.blockchain_sync_history (
    retry_count,
    created_at DESC
)
WHERE sync_status IN ('FAILED', 'RETRY_PENDING');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsh_source_primary_key_gin
ON blockchain.blockchain_sync_history
USING GIN (
    source_primary_key
);

-- =========================================================
-- blockchain.blockchain_sync_runs indexes
-- =========================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsr_record_type_started
ON blockchain.blockchain_sync_runs (
    record_type,
    started_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsr_status_started
ON blockchain.blockchain_sync_runs (
    status,
    started_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bsr_run_type_started
ON blockchain.blockchain_sync_runs (
    run_type,
    started_at DESC
);

-- =========================================================
-- blockchain.blockchain_verification_logs indexes
-- =========================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bvl_history_id
ON blockchain.blockchain_verification_logs (
    history_id
)
WHERE history_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bvl_record_type_source_record
ON blockchain.blockchain_verification_logs (
    record_type,
    source_record_id,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bvl_verification_status_created
ON blockchain.blockchain_verification_logs (
    verification_status,
    created_at DESC
);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bvl_blockchain_transaction_id
ON blockchain.blockchain_verification_logs (
    blockchain_transaction_id
)
WHERE blockchain_transaction_id IS NOT NULL;

-- =========================================================
-- Validation output
-- =========================================================

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND tablename IN (
      'blockchain_sync_history',
      'blockchain_sync_runs',
      'blockchain_verification_logs'
  )
  AND indexname LIKE 'idx_b%'
ORDER BY tablename, indexname;
