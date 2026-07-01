/*
Phase 6 — Blockchain History Tables
Script 2: Create blockchain.blockchain_history_attempts

Purpose:
Track every blockchain submission, verification, retry, and error attempt
related to blockchain.blockchain_history.

Main parent table:
- blockchain.blockchain_history

Detail table:
- blockchain.blockchain_history_attempts
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.blockchain_history_attempts (
    blockchain_history_attempt_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    blockchain_history_id BIGINT NOT NULL,

    module_name VARCHAR(100) NOT NULL,
    source_record_id TEXT NOT NULL,
    blockchain_key TEXT NOT NULL,

    attempt_no INTEGER NOT NULL DEFAULT 1,
    attempt_type VARCHAR(50) NOT NULL DEFAULT 'SUBMIT',

    blockchain_status VARCHAR(50),
    verification_status VARCHAR(50),
    blockchain_transaction_id TEXT,

    error_code VARCHAR(100),
    error_message TEXT,
    error_detail_fingerprint VARCHAR(128),

    request_id TEXT,
    worker_name VARCHAR(150),

    started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,

    created_by VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT blockchain_history_attempts_history_fk
        FOREIGN KEY (blockchain_history_id)
        REFERENCES blockchain.blockchain_history (blockchain_history_id)
        ON DELETE CASCADE,

    CONSTRAINT blockchain_history_attempts_attempt_no_chk
        CHECK (attempt_no >= 1),

    CONSTRAINT blockchain_history_attempts_duration_chk
        CHECK (duration_ms IS NULL OR duration_ms >= 0),

    CONSTRAINT blockchain_history_attempts_module_name_chk
        CHECK (BTRIM(module_name) <> ''),

    CONSTRAINT blockchain_history_attempts_source_record_id_chk
        CHECK (BTRIM(source_record_id) <> ''),

    CONSTRAINT blockchain_history_attempts_blockchain_key_chk
        CHECK (BTRIM(blockchain_key) <> ''),

    CONSTRAINT blockchain_history_attempts_finished_after_started_chk
        CHECK (
            finished_at IS NULL
            OR finished_at >= started_at
        )
);

COMMENT ON TABLE blockchain.blockchain_history_attempts IS
'Phase 6 retry/error detail table. Tracks individual blockchain submission, verification, retry, and error attempts linked to blockchain.blockchain_history.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.blockchain_history_attempt_id IS
'Internal PostgreSQL identity primary key for each blockchain attempt record.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.blockchain_history_id IS
'Parent blockchain history record ID.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.module_name IS
'VALOORES module name copied from blockchain.blockchain_history for reporting and filtering.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.source_record_id IS
'Source record ID copied from blockchain.blockchain_history for reporting and filtering.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.blockchain_key IS
'Blockchain ledger key copied from blockchain.blockchain_history for reporting and filtering.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.attempt_no IS
'Attempt number for this blockchain history record. Starts at 1.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.attempt_type IS
'Attempt type such as SUBMIT, VERIFY, RETRY, ERROR, or CALLBACK.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.blockchain_status IS
'Blockchain status returned or assigned during this attempt.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.verification_status IS
'Verification status returned or assigned during this attempt.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.blockchain_transaction_id IS
'Blockchain/Fabric transaction ID returned during this attempt, if available.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.error_code IS
'Application or blockchain error code for failed attempts.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.error_message IS
'Error message for failed attempts.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.error_detail_fingerprint IS
'Deterministic fingerprint of detailed error payload/stack if available. Raw payloads should not be stored here.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.request_id IS
'Application request ID or correlation ID.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.worker_name IS
'Worker, service, or job name that executed the attempt.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.started_at IS
'Timestamp when the attempt started.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.finished_at IS
'Timestamp when the attempt finished.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.duration_ms IS
'Attempt duration in milliseconds.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.created_by IS
'Application user, system user, or service that created the attempt record.';

COMMENT ON COLUMN blockchain.blockchain_history_attempts.created_at IS
'Audit timestamp when the attempt record was created.';

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_history_id
    ON blockchain.blockchain_history_attempts (blockchain_history_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_module_source
    ON blockchain.blockchain_history_attempts (module_name, source_record_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_blockchain_key
    ON blockchain.blockchain_history_attempts (blockchain_key);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_attempt_type
    ON blockchain.blockchain_history_attempts (attempt_type);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_status
    ON blockchain.blockchain_history_attempts (blockchain_status, verification_status);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_tx_id
    ON blockchain.blockchain_history_attempts (blockchain_transaction_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_error_code
    ON blockchain.blockchain_history_attempts (error_code);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_attempts_started_at
    ON blockchain.blockchain_history_attempts (started_at);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blockchain_history_attempts_history_attempt_no
    ON blockchain.blockchain_history_attempts (blockchain_history_id, attempt_no);

COMMIT;
