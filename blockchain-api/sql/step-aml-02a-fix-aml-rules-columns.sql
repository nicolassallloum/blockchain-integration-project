-- ======================================================
-- STEP 2A — FIX AML RULES MISSING COLUMNS
-- ======================================================

ALTER TABLE blockchain.aml_rules
ADD COLUMN IF NOT EXISTS risk_score INTEGER NOT NULL DEFAULT 0;

ALTER TABLE blockchain.aml_rules
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE blockchain.aml_rules
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

ALTER TABLE blockchain.aml_rules
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Safety constraint for risk_score
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_aml_rules_risk_score'
    ) THEN
        ALTER TABLE blockchain.aml_rules
        ADD CONSTRAINT chk_aml_rules_risk_score
        CHECK (risk_score >= 0 AND risk_score <= 100);
    END IF;
END $$;

DO $$
BEGIN
    RAISE NOTICE 'AML rules missing columns fixed successfully.';
END $$;
