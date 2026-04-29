CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.blockchain_organization (
    organization_id VARCHAR(100) PRIMARY KEY,
    organization_name VARCHAR(255) NOT NULL,
    organization_type VARCHAR(50) NOT NULL,
    registration_number VARCHAR(100),
    country_code VARCHAR(10),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    ledger_key VARCHAR(200),
    ledger_tx_id VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_wallet (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_address VARCHAR(150) UNIQUE NOT NULL,
    wallet_type VARCHAR(50) NOT NULL,
    owner_type VARCHAR(50) NOT NULL,
    owner_reference_id VARCHAR(150) NOT NULL,
    enterprise_customer_id VARCHAR(150),
    organization_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    ledger_key VARCHAR(200),
    ledger_tx_id VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_transaction (
    transaction_id VARCHAR(150) PRIMARY KEY,
    transaction_type VARCHAR(80) NOT NULL,
    from_wallet_address VARCHAR(150) NOT NULL,
    to_wallet_address VARCHAR(150) NOT NULL,
    from_organization_id VARCHAR(100),
    to_organization_id VARCHAR(100),
    amount NUMERIC(18, 6) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL,
    business_reference_id VARCHAR(150),
    enterprise_transaction_id VARCHAR(150),
    description TEXT,
    ledger_key VARCHAR(200),
    ledger_tx_id VARCHAR(200),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_wallet_balance (
    wallet_address VARCHAR(150) PRIMARY KEY,
    organization_id VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    available_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
    blocked_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
    total_balance NUMERIC(18, 6) NOT NULL DEFAULT 0,
    last_transaction_id VARCHAR(150),
    last_ledger_tx_id VARCHAR(200),
    last_updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_auth_metadata (
    wallet_address VARCHAR(150) PRIMARY KEY,
    owner_reference_id VARCHAR(150) NOT NULL,
    auth_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMP,
    last_login_channel VARCHAR(50),
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS blockchain.blockchain_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(80) NOT NULL,
    entity_id VARCHAR(150) NOT NULL,
    action_name VARCHAR(100) NOT NULL,
    request_id VARCHAR(150),
    correlation_id VARCHAR(150),
    source_system VARCHAR(150),
    created_by_user_id VARCHAR(150),
    created_by_org_id VARCHAR(150),
    fabric_tx_id VARCHAR(200),
    ledger_key VARCHAR(200),
    request_payload JSONB,
    response_payload JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);


CREATE INDEX IF NOT EXISTS idx_blockchain_wallet_customer
ON blockchain.blockchain_wallet (enterprise_customer_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_wallet_org
ON blockchain.blockchain_wallet (organization_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_wallet_status
ON blockchain.blockchain_wallet (status);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_from_wallet
ON blockchain.blockchain_transaction (from_wallet_address);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_to_wallet
ON blockchain.blockchain_transaction (to_wallet_address);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_business_ref
ON blockchain.blockchain_transaction (business_reference_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_enterprise_txn
ON blockchain.blockchain_transaction (enterprise_transaction_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_created_at
ON blockchain.blockchain_transaction (created_at);

CREATE INDEX IF NOT EXISTS idx_blockchain_audit_entity
ON blockchain.blockchain_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_audit_request
ON blockchain.blockchain_audit_log (request_id, correlation_id);