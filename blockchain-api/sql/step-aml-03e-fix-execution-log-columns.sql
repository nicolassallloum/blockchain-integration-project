-- ======================================================
-- STEP 3E — FIX AML EXECUTION LOG REQUIRED COLUMNS
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS transaction_id UUID;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS wallet_address VARCHAR(255);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS counterparty_wallet_address VARCHAR(255);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS counterparty_customer_id VARCHAR(100);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS transaction_amount NUMERIC(18,2);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS rules_checked INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS matched_rules INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS final_decision VARCHAR(30);

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS final_risk_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS execution_details JSONB;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS execution_started_at TIMESTAMP;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS execution_finished_at TIMESTAMP;

ALTER TABLE blockchain.aml_rule_execution_logs
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_aml_exec_transaction_id
ON blockchain.aml_rule_execution_logs (transaction_id);

CREATE INDEX IF NOT EXISTS idx_aml_exec_request_id
ON blockchain.aml_rule_execution_logs (request_id);

CREATE INDEX IF NOT EXISTS idx_aml_exec_wallet
ON blockchain.aml_rule_execution_logs (wallet_address);

CREATE INDEX IF NOT EXISTS idx_aml_exec_customer
ON blockchain.aml_rule_execution_logs (customer_id);

CREATE INDEX IF NOT EXISTS idx_aml_exec_decision
ON blockchain.aml_rule_execution_logs (final_decision);

CREATE INDEX IF NOT EXISTS idx_aml_exec_created_at
ON blockchain.aml_rule_execution_logs (created_at);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3E AML execution log columns fixed successfully.';
END $$;
