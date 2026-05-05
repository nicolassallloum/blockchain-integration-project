-- ============================================================
-- STEP 29 — Audit Logging & Traceability
-- Blockchain Integration Project
-- PostgreSQL Audit Table
-- ============================================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.blockchain_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id VARCHAR(100),
    correlation_id VARCHAR(100),

    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(100),
    event_status VARCHAR(30) NOT NULL,

    source_system VARCHAR(100),
    request_source VARCHAR(100),

    http_method VARCHAR(20),
    endpoint TEXT,
    controller_name VARCHAR(150),
    service_name VARCHAR(150),

    customer_id VARCHAR(100),
    organization_id UUID,
    organization_code VARCHAR(100),
    wallet_address VARCHAR(150),

    transaction_id UUID,
    fabric_tx_id VARCHAR(150),
    blockchain_function VARCHAR(150),
    chaincode_name VARCHAR(150),
    channel_name VARCHAR(150),

    ip_address VARCHAR(100),
    user_agent TEXT,

    request_payload JSONB,
    response_payload JSONB,
    metadata JSONB,

    error_code VARCHAR(100),
    error_message TEXT,
    error_stack TEXT,

    duration_ms INTEGER,

    created_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_request_id
ON blockchain.blockchain_audit_log (request_id);

CREATE INDEX IF NOT EXISTS idx_audit_correlation_id
ON blockchain.blockchain_audit_log (correlation_id);

CREATE INDEX IF NOT EXISTS idx_audit_event_type
ON blockchain.blockchain_audit_log (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_event_status
ON blockchain.blockchain_audit_log (event_status);

CREATE INDEX IF NOT EXISTS idx_audit_customer_id
ON blockchain.blockchain_audit_log (customer_id);

CREATE INDEX IF NOT EXISTS idx_audit_wallet_address
ON blockchain.blockchain_audit_log (wallet_address);

CREATE INDEX IF NOT EXISTS idx_audit_transaction_id
ON blockchain.blockchain_audit_log (transaction_id);

CREATE INDEX IF NOT EXISTS idx_audit_fabric_tx_id
ON blockchain.blockchain_audit_log (fabric_tx_id);

CREATE INDEX IF NOT EXISTS idx_audit_created_at
ON blockchain.blockchain_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_event_status_created_at
ON blockchain.blockchain_audit_log (event_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_source_system_created_at
ON blockchain.blockchain_audit_log (source_system, created_at DESC);

COMMIT;
