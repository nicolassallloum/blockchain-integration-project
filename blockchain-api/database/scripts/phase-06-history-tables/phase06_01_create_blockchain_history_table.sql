/*
Phase 6 — Blockchain History Tables
Script 1: Create blockchain.blockchain_history

Purpose:
Track blockchain proof submissions, approval status, blockchain transaction IDs,
verification results, errors, retries, and audit timestamps.

Main table:
- blockchain.blockchain_history

Required fields:
1. Module name
2. Source record ID
3. Blockchain key
4. Record hash
5. Hash version
6. Action type
7. Approval status
8. Blockchain status
9. Blockchain transaction ID
10. Submitted by
11. Submitted at
12. Verified at
13. Verification status
14. Error message
15. Retry count
16. Created at
17. Updated at
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.blockchain_history (
    blockchain_history_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    module_name VARCHAR(100) NOT NULL,
    source_record_id TEXT NOT NULL,
    blockchain_key TEXT NOT NULL,
    record_hash VARCHAR(128) NOT NULL,
    hash_version VARCHAR(30) NOT NULL DEFAULT 'v1',

    action_type VARCHAR(50) NOT NULL DEFAULT 'SUBMIT',
    approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    blockchain_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    blockchain_transaction_id TEXT,

    submitted_by VARCHAR(150),
    submitted_at TIMESTAMPTZ,

    verified_at TIMESTAMPTZ,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'NOT_VERIFIED',

    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT blockchain_history_retry_count_chk
        CHECK (retry_count >= 0),

    CONSTRAINT blockchain_history_module_name_chk
        CHECK (BTRIM(module_name) <> ''),

    CONSTRAINT blockchain_history_source_record_id_chk
        CHECK (BTRIM(source_record_id) <> ''),

    CONSTRAINT blockchain_history_blockchain_key_chk
        CHECK (BTRIM(blockchain_key) <> ''),

    CONSTRAINT blockchain_history_record_hash_chk
        CHECK (BTRIM(record_hash) <> ''),

    CONSTRAINT blockchain_history_submitted_at_chk
        CHECK (
            submitted_at IS NULL
            OR submitted_at >= TIMESTAMPTZ '2000-01-01 00:00:00+00'
        ),

    CONSTRAINT blockchain_history_verified_after_submit_chk
        CHECK (
            verified_at IS NULL
            OR submitted_at IS NULL
            OR verified_at >= submitted_at
        )
);

COMMENT ON TABLE blockchain.blockchain_history IS
'Phase 6 main blockchain history table. Tracks proof submissions, transaction IDs, verification status, errors, retries, and audit timestamps.';

COMMENT ON COLUMN blockchain.blockchain_history.blockchain_history_id IS
'Internal PostgreSQL identity primary key for blockchain history records.';

COMMENT ON COLUMN blockchain.blockchain_history.module_name IS
'VALOORES module name, such as AML_RULE, CUSTOMER_KYC, TRANSACTION, AML_ALERT, AUDIT_LOG, SCREENING_ACTIVITY, or SANCTION_LIST.';

COMMENT ON COLUMN blockchain.blockchain_history.source_record_id IS
'Stable source record identifier from the normalized Phase 5 source view.';

COMMENT ON COLUMN blockchain.blockchain_history.blockchain_key IS
'Deterministic ledger key used when submitting the proof to blockchain.';

COMMENT ON COLUMN blockchain.blockchain_history.record_hash IS
'Hash value generated from the normalized source record hash input.';

COMMENT ON COLUMN blockchain.blockchain_history.hash_version IS
'Hashing/version strategy, for example v1 or md5-v1.';

COMMENT ON COLUMN blockchain.blockchain_history.action_type IS
'Business action type such as SUBMIT, RESUBMIT, VERIFY, APPROVE, REJECT, or RETRY.';

COMMENT ON COLUMN blockchain.blockchain_history.approval_status IS
'Internal approval state before or after blockchain submission.';

COMMENT ON COLUMN blockchain.blockchain_history.blockchain_status IS
'Blockchain submission state, such as PENDING, SUBMITTED, CONFIRMED, FAILED, or SKIPPED.';

COMMENT ON COLUMN blockchain.blockchain_history.blockchain_transaction_id IS
'Blockchain/Fabric transaction ID returned by the ledger submission.';

COMMENT ON COLUMN blockchain.blockchain_history.submitted_by IS
'Application user, system user, or service that submitted the proof.';

COMMENT ON COLUMN blockchain.blockchain_history.submitted_at IS
'Timestamp when the proof was submitted to blockchain.';

COMMENT ON COLUMN blockchain.blockchain_history.verified_at IS
'Timestamp when the blockchain proof was verified.';

COMMENT ON COLUMN blockchain.blockchain_history.verification_status IS
'Verification result, such as NOT_VERIFIED, VERIFIED, FAILED, or MISMATCH.';

COMMENT ON COLUMN blockchain.blockchain_history.error_message IS
'Latest error message related to blockchain submission or verification.';

COMMENT ON COLUMN blockchain.blockchain_history.retry_count IS
'Number of retry attempts for this blockchain history record.';

COMMENT ON COLUMN blockchain.blockchain_history.created_at IS
'Audit timestamp when the PostgreSQL history record was created.';

COMMENT ON COLUMN blockchain.blockchain_history.updated_at IS
'Audit timestamp automatically updated when the PostgreSQL history record changes.';

CREATE INDEX IF NOT EXISTS idx_blockchain_history_module_source
    ON blockchain.blockchain_history (module_name, source_record_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_blockchain_key
    ON blockchain.blockchain_history (blockchain_key);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_record_hash
    ON blockchain.blockchain_history (record_hash);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_tx_id
    ON blockchain.blockchain_history (blockchain_transaction_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_blockchain_status
    ON blockchain.blockchain_history (blockchain_status);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_verification_status
    ON blockchain.blockchain_history (verification_status);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_submitted_at
    ON blockchain.blockchain_history (submitted_at);

CREATE INDEX IF NOT EXISTS idx_blockchain_history_created_at
    ON blockchain.blockchain_history (created_at);

CREATE OR REPLACE FUNCTION blockchain.set_blockchain_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = clock_timestamp();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_blockchain_history_set_updated_at
ON blockchain.blockchain_history;

CREATE TRIGGER trg_blockchain_history_set_updated_at
BEFORE UPDATE ON blockchain.blockchain_history
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_blockchain_history_updated_at();

COMMIT;
