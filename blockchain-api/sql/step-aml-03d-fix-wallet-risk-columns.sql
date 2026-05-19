-- ======================================================
-- STEP 3D — FIX AML WALLET RISK PROFILE COLUMNS
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10);

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS occupation_code VARCHAR(100);

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS source_of_funds_code VARCHAR(100);

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS is_pep BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS is_sanctioned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS last_transaction_at TIMESTAMP;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS last_review_date TIMESTAMP;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

ALTER TABLE blockchain.aml_wallet_risk_profiles
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_country
ON blockchain.aml_wallet_risk_profiles (country_code);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_pep
ON blockchain.aml_wallet_risk_profiles (is_pep);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_sanctioned
ON blockchain.aml_wallet_risk_profiles (is_sanctioned);

CREATE INDEX IF NOT EXISTS idx_aml_wallet_risk_blacklisted
ON blockchain.aml_wallet_risk_profiles (is_blacklisted);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3D AML wallet risk profile columns fixed successfully.';
END $$;
