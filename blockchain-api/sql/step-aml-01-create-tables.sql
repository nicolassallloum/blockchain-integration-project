CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ======================================================
-- 1. AML RULES TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_rules (
    rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    rule_code VARCHAR(100) NOT NULL UNIQUE,
    rule_name VARCHAR(200) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,

    description TEXT,

    threshold_amount NUMERIC(18, 2),
    threshold_count INTEGER,
    time_window_minutes INTEGER,

    risk_action VARCHAR(30) NOT NULL DEFAULT 'REVIEW',
    severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',

    risk_score INTEGER NOT NULL DEFAULT 0,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_aml_rules_type
        CHECK (rule_type IN (
            'AMOUNT',
            'FREQUENCY',
            'STRUCTURING',
            'BLACKLIST',
            'WALLET_RISK',
            'COUNTRY_RISK',
            'ORGANIZATION_RISK',
            'CUSTOM'
        )),

    CONSTRAINT chk_aml_rules_action
        CHECK (risk_action IN (
            'ALLOW',
            'REVIEW',
            'BLOCK'
        )),

    CONSTRAINT chk_aml_rules_severity
        CHECK (severity IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        ))
);

CREATE INDEX IF NOT EXISTS idx_aml_rules_rule_code
ON blockchain.aml_rules (rule_code);

CREATE INDEX IF NOT EXISTS idx_aml_rules_active
ON blockchain.aml_rules (is_active);

CREATE INDEX IF NOT EXISTS idx_aml_rules_type
ON blockchain.aml_rules (rule_type);


-- ======================================================
-- 2. AML ALERTS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_alerts (
    alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    transaction_id UUID,
    request_id VARCHAR(100),

    wallet_address VARCHAR(255),
    counterparty_wallet_address VARCHAR(255),

    customer_id VARCHAR(100),
    counterparty_customer_id VARCHAR(100),

    organization_id UUID,
    organization_code VARCHAR(100),
    organization_name VARCHAR(255),

    rule_id UUID,
    rule_code VARCHAR(100),

    alert_status VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    risk_action VARCHAR(30) NOT NULL,
    severity VARCHAR(20) NOT NULL,

    risk_score INTEGER NOT NULL DEFAULT 0,

    transaction_amount NUMERIC(18, 2),
    currency_code VARCHAR(10),

    transaction_type VARCHAR(50),

    reason TEXT,
    alert_details JSONB,

    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    review_notes TEXT,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_aml_alert_rule
        FOREIGN KEY (rule_id)
        REFERENCES blockchain.aml_rules(rule_id)
        ON DELETE SET NULL,

    CONSTRAINT chk_aml_alert_status
        CHECK (alert_status IN (
            'OPEN',
            'UNDER_REVIEW',
            'CLEARED',
            'ESCALATED',
            'BLOCKED',
            'FALSE_POSITIVE',
            'CLOSED'
        )),

    CONSTRAINT chk_aml_alert_action
        CHECK (risk_action IN (
            'REVIEW',
            'BLOCK'
        )),

    CONSTRAINT chk_aml_alert_severity
        CHECK (severity IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL'
        ))
);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_status
ON blockchain.aml_alerts (alert_status);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_wallet
ON blockchain.aml_alerts (wallet_address);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_customer
ON blockchain.aml_alerts (customer_id);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_rule_code
ON blockchain.aml_alerts (rule_code);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_created_at
ON blockchain.aml_alerts (created_at);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_severity
ON blockchain.aml_alerts (severity);


-- ======================================================
-- 3. AML BLACKLIST TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_blacklist (
    blacklist_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    entity_type VARCHAR(50) NOT NULL,
    entity_value VARCHAR(255) NOT NULL,

    reason TEXT,
    source_system VARCHAR(100),

    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',

    created_by VARCHAR(100),
    disabled_by VARCHAR(100),
    disabled_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_aml_blacklist_entity
        UNIQUE (entity_type, entity_value),

    CONSTRAINT chk_aml_blacklist_entity_type
        CHECK (entity_type IN (
            'CUSTOMER',
            'WALLET',
            'ORGANIZATION',
            'COUNTRY',
            'NATIONAL_ID',
            'MOBILE',
            'EMAIL',
            'PASSPORT'
        )),

    CONSTRAINT chk_aml_blacklist_status
        CHECK (status IN (
            'ACTIVE',
            'DISABLED',
            'EXPIRED'
        ))
);

CREATE INDEX IF NOT EXISTS idx_aml_blacklist_entity
ON blockchain.aml_blacklist (entity_type, entity_value);

CREATE INDEX IF NOT EXISTS idx_aml_blacklist_status
ON blockchain.aml_blacklist (status);

CREATE INDEX IF NOT EXISTS idx_aml_blacklist_created_at
ON blockchain.aml_blacklist (created_at);


-- ======================================================
-- 4. AML WALLET RISK PROFILES TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_wallet_risk_profiles (
    wallet_address VARCHAR(255) PRIMARY KEY,

    customer_id VARCHAR(100),

    risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    risk_score INTEGER NOT NULL DEFAULT 0,

    country_code VARCHAR(10),
    occupation_code VARCHAR(100),
    source_of_funds_code VARCHAR(100),

    is_pep BOOLEAN NOT NULL DEFAULT FALSE,
    is_sanctioned BOOLEAN NOT NULL DEFAULT FALSE,
    is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,

    last_transaction_at TIMESTAMP,
    last_review_date TIMESTAMP,

    notes TEXT,

    created_by VARCHAR(100),
    updated_by VARCHAR(100),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_aml_wallet_risk_level
        CHECK (risk_level IN (
            'LOW',
            'MEDIUM',
            'HIGH',
            'CRITICAL',
            'BLOCKED'
        )),

    CONSTRAINT chk_aml_wallet_risk_score
        CHECK (risk_score >= 0 AND risk_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_customer
ON blockchain.aml_wallet_risk_profiles (customer_id);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_level
ON blockchain.aml_wallet_risk_profiles (risk_level);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_score
ON blockchain.aml_wallet_risk_profiles (risk_score);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_blacklisted
ON blockchain.aml_wallet_risk_profiles (is_blacklisted);


-- ======================================================
-- 5. AML RULE EXECUTION LOGS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_rule_execution_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    request_id VARCHAR(100),

    transaction_id UUID,

    wallet_address VARCHAR(255),
    counterparty_wallet_address VARCHAR(255),

    customer_id VARCHAR(100),
    counterparty_customer_id VARCHAR(100),

    transaction_type VARCHAR(50),
    transaction_amount NUMERIC(18, 2),
    currency_code VARCHAR(10),

    rules_checked INTEGER NOT NULL DEFAULT 0,
    matched_rules INTEGER NOT NULL DEFAULT 0,

    final_decision VARCHAR(30) NOT NULL,
    final_risk_score INTEGER NOT NULL DEFAULT 0,

    execution_details JSONB,

    execution_started_at TIMESTAMP,
    execution_finished_at TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_aml_execution_decision
        CHECK (final_decision IN (
            'ALLOW',
            'REVIEW',
            'BLOCK'
        )),

    CONSTRAINT chk_aml_execution_risk_score
        CHECK (final_risk_score >= 0 AND final_risk_score <= 100)
);

CREATE INDEX IF NOT EXISTS idx_aml_exec_wallet
ON blockchain.aml_rule_execution_logs (wallet_address);

CREATE INDEX IF NOT EXISTS idx_aml_exec_customer
ON blockchain.aml_rule_execution_logs (customer_id);

CREATE INDEX IF NOT EXISTS idx_aml_exec_decision
ON blockchain.aml_rule_execution_logs (final_decision);

CREATE INDEX IF NOT EXISTS idx_aml_exec_created_at
ON blockchain.aml_rule_execution_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_aml_exec_request_id
ON blockchain.aml_rule_execution_logs (request_id);


-- ======================================================
-- 6. AML CASE REVIEWS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_case_reviews (
    review_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    alert_id UUID NOT NULL,

    previous_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,

    decision VARCHAR(50) NOT NULL,

    reviewed_by VARCHAR(100) NOT NULL,
    review_notes TEXT,

    action_taken VARCHAR(100),

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_aml_case_review_alert
        FOREIGN KEY (alert_id)
        REFERENCES blockchain.aml_alerts(alert_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_aml_case_review_status
        CHECK (new_status IN (
            'OPEN',
            'UNDER_REVIEW',
            'CLEARED',
            'ESCALATED',
            'BLOCKED',
            'FALSE_POSITIVE',
            'CLOSED'
        )),

    CONSTRAINT chk_aml_case_review_decision
        CHECK (decision IN (
            'CLEARED',
            'ESCALATED',
            'BLOCKED',
            'FALSE_POSITIVE',
            'REQUIRES_MORE_INFO',
            'CLOSED'
        ))
);

CREATE INDEX IF NOT EXISTS idx_aml_case_reviews_alert
ON blockchain.aml_case_reviews (alert_id);

CREATE INDEX IF NOT EXISTS idx_aml_case_reviews_reviewed_by
ON blockchain.aml_case_reviews (reviewed_by);

CREATE INDEX IF NOT EXISTS idx_aml_case_reviews_created_at
ON blockchain.aml_case_reviews (created_at);


-- ======================================================
-- 7. AML REPORTS TABLE
-- ======================================================

CREATE TABLE IF NOT EXISTS blockchain.aml_reports (
    report_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    report_code VARCHAR(100) NOT NULL UNIQUE,
    report_type VARCHAR(100) NOT NULL,

    report_title VARCHAR(255) NOT NULL,
    report_period_from DATE,
    report_period_to DATE,

    report_status VARCHAR(30) NOT NULL DEFAULT 'GENERATED',

    generated_by VARCHAR(100),
    generated_at TIMESTAMP NOT NULL DEFAULT NOW(),

    file_path TEXT,
    file_format VARCHAR(20),

    report_summary JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_aml_report_status
        CHECK (report_status IN (
            'GENERATED',
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'ARCHIVED'
        )),

    CONSTRAINT chk_aml_report_format
        CHECK (
            file_format IS NULL
            OR file_format IN (
                'PDF',
                'EXCEL',
                'CSV',
                'JSON'
            )
        )
);

CREATE INDEX IF NOT EXISTS idx_aml_reports_type
ON blockchain.aml_reports (report_type);

CREATE INDEX IF NOT EXISTS idx_aml_reports_status
ON blockchain.aml_reports (report_status);

CREATE INDEX IF NOT EXISTS idx_aml_reports_generated_at
ON blockchain.aml_reports (generated_at);


-- ======================================================
-- 8. OPTIONAL: ADD AML COLUMNS TO EXISTING TRANSACTIONS TABLE
-- ======================================================

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_status VARCHAR(30) DEFAULT 'NOT_CHECKED';

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_decision VARCHAR(30);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_risk_score INTEGER DEFAULT 0;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_reason TEXT;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_checked_at TIMESTAMP;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_alert_id UUID;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS aml_proof_hash VARCHAR(255);


-- ======================================================
-- 9. OPTIONAL: ADD AML COLUMNS TO EXISTING WALLETS TABLE
-- ======================================================

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS aml_risk_level VARCHAR(20) DEFAULT 'LOW';

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS aml_risk_score INTEGER DEFAULT 0;

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS aml_status VARCHAR(30) DEFAULT 'CLEAR';

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS aml_last_reviewed_at TIMESTAMP;


-- ======================================================
-- 10. UPDATED_AT TRIGGER FUNCTION
-- ======================================================

CREATE OR REPLACE FUNCTION blockchain.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


DROP TRIGGER IF EXISTS trg_aml_rules_updated_at ON blockchain.aml_rules;
CREATE TRIGGER trg_aml_rules_updated_at
BEFORE UPDATE ON blockchain.aml_rules
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();


DROP TRIGGER IF EXISTS trg_aml_alerts_updated_at ON blockchain.aml_alerts;
CREATE TRIGGER trg_aml_alerts_updated_at
BEFORE UPDATE ON blockchain.aml_alerts
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();


DROP TRIGGER IF EXISTS trg_aml_blacklist_updated_at ON blockchain.aml_blacklist;
CREATE TRIGGER trg_aml_blacklist_updated_at
BEFORE UPDATE ON blockchain.aml_blacklist
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();


DROP TRIGGER IF EXISTS trg_aml_wallet_risk_updated_at ON blockchain.aml_wallet_risk_profiles;
CREATE TRIGGER trg_aml_wallet_risk_updated_at
BEFORE UPDATE ON blockchain.aml_wallet_risk_profiles
FOR EACH ROW
EXECUTE FUNCTION blockchain.set_updated_at();


-- ======================================================
-- 11. VALIDATION MESSAGE
-- ======================================================

DO $$
BEGIN
    RAISE NOTICE 'STEP 1 AML PostgreSQL tables created successfully.';
END $$;
