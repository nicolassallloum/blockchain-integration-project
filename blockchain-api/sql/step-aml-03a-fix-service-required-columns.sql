-- ======================================================
-- STEP 3A — FIX REQUIRED AML SERVICE COLUMNS
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS counterparty_customer_id VARCHAR(100);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS counterparty_wallet_address VARCHAR(255);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS transaction_amount NUMERIC(18, 2);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS final_risk_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMP;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS execution_finished_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_blacklisted
ON blockchain.aml_wallet_risk_profiles (is_blacklisted);

CREATE INDEX IF NOT EXISTS idx_aml_exec_customer
ON blockchain.aml_rule_execution_logs (customer_id);

CREATE INDEX IF NOT EXISTS idx_aml_exec_counterparty_wallet
ON blockchain.aml_rule_execution_logs (counterparty_wallet_address);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3A AML service required columns fixed successfully.';
END $$;
