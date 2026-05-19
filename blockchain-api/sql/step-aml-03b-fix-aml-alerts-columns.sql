-- ======================================================
-- STEP 3B — FIX AML ALERTS REQUIRED COLUMNS
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS counterparty_wallet_address VARCHAR(255);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS counterparty_customer_id VARCHAR(100);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS organization_id UUID;

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS organization_code VARCHAR(100);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS organization_name VARCHAR(255);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS transaction_amount NUMERIC(18,2);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS currency_code VARCHAR(10);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS alert_details JSONB;

CREATE INDEX IF NOT EXISTS idx_aml_alerts_request_id
ON blockchain.aml_alerts (request_id);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_counterparty_wallet
ON blockchain.aml_alerts (counterparty_wallet_address);

CREATE INDEX IF NOT EXISTS idx_aml_alerts_transaction_type
ON blockchain.aml_alerts (transaction_type);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3B AML alerts required columns fixed successfully.';
END $$;
