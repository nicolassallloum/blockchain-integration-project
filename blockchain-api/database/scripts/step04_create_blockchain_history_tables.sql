/*
STEP 4 — Create PostgreSQL History Tables

Purpose:
Create history and audit tables for PostgreSQL to Blockchain proof synchronization.

Rules:
- PostgreSQL remains the source of truth.
- Blockchain stores proof only.
- No sensitive full business payload is stored in these tables.
- Full AML/customer/transaction/screening data must remain in source PostgreSQL tables/views only.
*/

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.blockchain_sync_runs (
    run_id UUID PRIMARY KEY,
    run_type VARCHAR(50) NOT NULL,
    record_type VARCHAR(100) NOT NULL,
    source_view_name TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    total_source_records BIGINT NOT NULL DEFAULT 0,
    total_create_records BIGINT NOT NULL DEFAULT 0,
    total_update_records BIGINT NOT NULL DEFAULT 0,
    total_unchanged_records BIGINT NOT NULL DEFAULT 0,
    total_failed_records BIGINT NOT NULL DEFAULT 0,
    triggered_by TEXT NOT NULL DEFAULT 'postgres-blockchain-proof-sync-service',
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_blockchain_sync_runs_run_type
        CHECK (run_type IN ('MANUAL', 'SCHEDULED', 'RETRY', 'VERIFY')),

    CONSTRAINT chk_blockchain_sync_runs_status
        CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED', 'PARTIAL'))
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_sync_history (
    history_id BIGSERIAL PRIMARY KEY,
    run_id UUID,
    record_type VARCHAR(100) NOT NULL,
    source_schema_name TEXT NOT NULL DEFAULT 'blockchain',
    source_view_name TEXT NOT NULL,
    source_primary_key JSONB NOT NULL,
    source_record_id TEXT NOT NULL,
    action_type VARCHAR(20) NOT NULL,
    old_hash TEXT,
    new_hash TEXT NOT NULL,
    hash_algorithm VARCHAR(50) NOT NULL DEFAULT 'SHA-256',
    sync_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    blockchain_key TEXT,
    blockchain_transaction_id TEXT,
    blockchain_submitted_at TIMESTAMPTZ,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'NOT_VERIFIED',
    verified_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_retry_at TIMESTAMPTZ,
    submitted_by TEXT NOT NULL DEFAULT 'postgres-blockchain-proof-sync-service',
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_blockchain_sync_history_run
        FOREIGN KEY (run_id)
        REFERENCES blockchain.blockchain_sync_runs(run_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_blockchain_sync_history_action_type
        CHECK (action_type IN ('CREATE', 'UPDATE')),

    CONSTRAINT chk_blockchain_sync_history_sync_status
        CHECK (sync_status IN (
            'PENDING',
            'SYNCED',
            'FAILED',
            'RETRY_PENDING',
            'SKIPPED',
            'VERIFIED',
            'MISMATCHED',
            'TAMPERED'
        )),

    CONSTRAINT chk_blockchain_sync_history_verification_status
        CHECK (verification_status IN (
            'NOT_VERIFIED',
            'VERIFIED',
            'MISMATCHED',
            'TAMPERED',
            'FAILED'
        )),

    CONSTRAINT chk_blockchain_sync_history_retry_count
        CHECK (retry_count >= 0),

    CONSTRAINT chk_blockchain_sync_history_hash_not_empty
        CHECK (length(trim(new_hash)) > 0)
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_verification_logs (
    verification_id BIGSERIAL PRIMARY KEY,
    history_id BIGINT,
    record_type VARCHAR(100) NOT NULL,
    source_record_id TEXT NOT NULL,
    postgres_hash TEXT NOT NULL,
    blockchain_hash TEXT,
    blockchain_key TEXT,
    blockchain_transaction_id TEXT,
    verification_status VARCHAR(50) NOT NULL,
    verified_by TEXT NOT NULL DEFAULT 'postgres-blockchain-proof-sync-service',
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_blockchain_verification_logs_history
        FOREIGN KEY (history_id)
        REFERENCES blockchain.blockchain_sync_history(history_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_blockchain_verification_logs_status
        CHECK (verification_status IN (
            'VERIFIED',
            'MISMATCHED',
            'TAMPERED',
            'FAILED'
        ))
);

-- Auto-update updated_at for sync runs/history tables
CREATE OR REPLACE FUNCTION blockchain.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blockchain_sync_runs_updated_at
ON blockchain.blockchain_sync_runs;

CREATE TRIGGER trg_blockchain_sync_runs_updated_at
BEFORE UPDATE ON blockchain.blockchain_sync_runs
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();

DROP TRIGGER IF EXISTS trg_blockchain_sync_history_updated_at
ON blockchain.blockchain_sync_history;

CREATE TRIGGER trg_blockchain_sync_history_updated_at
BEFORE UPDATE ON blockchain.blockchain_sync_history
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();

-- Validation output
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
  AND table_name IN (
      'blockchain_sync_runs',
      'blockchain_sync_history',
      'blockchain_verification_logs'
  )
ORDER BY table_name;
