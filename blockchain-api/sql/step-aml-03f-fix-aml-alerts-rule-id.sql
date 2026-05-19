-- ======================================================
-- STEP 3F — FIX AML ALERTS RULE_ID COLUMN
-- Safe to run multiple times
-- ======================================================

ALTER TABLE blockchain.aml_alerts
ADD COLUMN IF NOT EXISTS rule_id UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_aml_alert_rule'
    ) THEN
        ALTER TABLE blockchain.aml_alerts
        ADD CONSTRAINT fk_aml_alert_rule
        FOREIGN KEY (rule_id)
        REFERENCES blockchain.aml_rules(rule_id)
        ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_aml_alerts_rule_id
ON blockchain.aml_alerts (rule_id);

DO $$
BEGIN
    RAISE NOTICE 'STEP 3F AML alerts rule_id column fixed successfully.';
END $$;
