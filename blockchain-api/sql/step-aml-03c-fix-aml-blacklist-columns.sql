-- ======================================================
-- STEP 3C — FIX AML BLACKLIST REQUIRED COLUMNS
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_blacklist
ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);

ALTER TABLE blockchain.aml_blacklist
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE blockchain.aml_blacklist
ADD COLUMN IF NOT EXISTS disabled_by VARCHAR(100);

ALTER TABLE blockchain.aml_blacklist
ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMP;

ALTER TABLE blockchain.aml_blacklist
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_aml_blacklist_source_system
ON blockchain.aml_blacklist (source_system);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3C AML blacklist required columns fixed successfully.';
END $$;
