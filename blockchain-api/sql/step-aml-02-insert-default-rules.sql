-- ======================================================
-- STEP 2 — INSERT DEFAULT AML RULES
-- Idempotent script: safe to run many times
-- ======================================================

CREATE SCHEMA IF NOT EXISTS blockchain;

-- ======================================================
-- DEFAULT AML RULES
-- ======================================================

INSERT INTO blockchain.aml_rules
(
    rule_code,
    rule_name,
    rule_type,
    description,
    threshold_amount,
    threshold_count,
    time_window_minutes,
    risk_action,
    severity,
    risk_score,
    is_active,
    created_by,
    updated_by
)
VALUES
(
    'HIGH_VALUE_TXN',
    'High Value Transaction',
    'AMOUNT',
    'Transaction amount above 10,000 USD requires AML compliance review.',
    10000.00,
    NULL,
    NULL,
    'REVIEW',
    'HIGH',
    60,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'VERY_HIGH_VALUE_TXN',
    'Very High Value Transaction',
    'AMOUNT',
    'Transaction amount above 50,000 USD is automatically blocked by AML policy.',
    50000.00,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    95,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'HIGH_FREQ_1H',
    'High Frequency Transactions - 1 Hour',
    'FREQUENCY',
    'More than 10 transactions from the same wallet within 1 hour requires AML review.',
    NULL,
    10,
    60,
    'REVIEW',
    'HIGH',
    70,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'HIGH_FREQ_24H',
    'High Frequency Transactions - 24 Hours',
    'FREQUENCY',
    'More than 50 transactions from the same wallet within 24 hours requires AML review.',
    NULL,
    50,
    1440,
    'REVIEW',
    'HIGH',
    75,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'STRUCTURING_24H',
    'Possible Structuring / Smurfing - 24 Hours',
    'STRUCTURING',
    'Multiple small transactions below 1,000 USD with total amount above 10,000 USD within 24 hours requires AML review.',
    10000.00,
    10,
    1440,
    'REVIEW',
    'CRITICAL',
    90,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'BLOCKED_WALLET',
    'Blocked Wallet Transaction',
    'BLACKLIST',
    'Transaction is blocked because sender wallet or receiver wallet exists in AML blacklist.',
    NULL,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    100,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'BLOCKED_CUSTOMER',
    'Blocked Customer Transaction',
    'BLACKLIST',
    'Transaction is blocked because sender customer or receiver customer exists in AML blacklist.',
    NULL,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    100,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'HIGH_RISK_WALLET',
    'High Risk Wallet Transaction',
    'WALLET_RISK',
    'Transaction requires review because the wallet AML risk level is HIGH or CRITICAL.',
    NULL,
    NULL,
    NULL,
    'REVIEW',
    'HIGH',
    80,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'BLOCKED_RISK_WALLET',
    'Blocked Risk Wallet Transaction',
    'WALLET_RISK',
    'Transaction is blocked because the wallet AML risk level is BLOCKED.',
    NULL,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    100,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'SANCTIONED_COUNTRY',
    'Sanctioned Country Transaction',
    'COUNTRY_RISK',
    'Transaction is blocked because customer country or counterparty country is sanctioned.',
    NULL,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    100,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'HIGH_RISK_COUNTRY',
    'High Risk Country Transaction',
    'COUNTRY_RISK',
    'Transaction requires AML review because customer country or counterparty country is high risk.',
    NULL,
    NULL,
    NULL,
    'REVIEW',
    'HIGH',
    75,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'HIGH_RISK_ORGANIZATION',
    'High Risk Organization Transfer',
    'ORGANIZATION_RISK',
    'Wallet-to-organization transaction requires review because the receiving organization is classified as high risk.',
    NULL,
    NULL,
    NULL,
    'REVIEW',
    'HIGH',
    75,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'BLOCKED_ORGANIZATION',
    'Blocked Organization Transfer',
    'ORGANIZATION_RISK',
    'Wallet-to-organization transaction is blocked because the organization is blacklisted or blocked.',
    NULL,
    NULL,
    NULL,
    'BLOCK',
    'CRITICAL',
    100,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'REPEATED_SAME_RECEIVER_24H',
    'Repeated Transfers To Same Receiver - 24 Hours',
    'FREQUENCY',
    'More than 15 transfers to the same receiver wallet within 24 hours requires AML review.',
    NULL,
    15,
    1440,
    'REVIEW',
    'MEDIUM',
    55,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'DAILY_AMOUNT_LIMIT',
    'Daily Wallet Amount Limit',
    'AMOUNT',
    'Total outgoing amount above 20,000 USD from the same wallet within 24 hours requires AML review.',
    20000.00,
    NULL,
    1440,
    'REVIEW',
    'HIGH',
    70,
    TRUE,
    'SYSTEM',
    'SYSTEM'
),
(
    'MONTHLY_AMOUNT_LIMIT',
    'Monthly Wallet Amount Limit',
    'AMOUNT',
    'Total outgoing amount above 100,000 USD from the same wallet within 30 days requires AML review.',
    100000.00,
    NULL,
    43200,
    'REVIEW',
    'HIGH',
    80,
    TRUE,
    'SYSTEM',
    'SYSTEM'
)
ON CONFLICT (rule_code)
DO UPDATE SET
    rule_name = EXCLUDED.rule_name,
    rule_type = EXCLUDED.rule_type,
    description = EXCLUDED.description,
    threshold_amount = EXCLUDED.threshold_amount,
    threshold_count = EXCLUDED.threshold_count,
    time_window_minutes = EXCLUDED.time_window_minutes,
    risk_action = EXCLUDED.risk_action,
    severity = EXCLUDED.severity,
    risk_score = EXCLUDED.risk_score,
    is_active = EXCLUDED.is_active,
    updated_by = 'SYSTEM',
    updated_at = NOW();


-- ======================================================
-- OPTIONAL DEFAULT COUNTRY RISK DATA
-- Only runs if aml_country_risk table has these columns
-- ======================================================

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'blockchain'
        AND table_name = 'aml_country_risk'
    ) THEN

        INSERT INTO blockchain.aml_country_risk
        (
            country_code,
            country_name,
            risk_level,
            is_sanctioned,
            created_at
        )
        VALUES
        ('LB', 'Lebanon', 'MEDIUM', FALSE, NOW()),
        ('US', 'United States', 'LOW', FALSE, NOW()),
        ('AE', 'United Arab Emirates', 'LOW', FALSE, NOW()),
        ('SA', 'Saudi Arabia', 'LOW', FALSE, NOW()),
        ('FR', 'France', 'LOW', FALSE, NOW()),
        ('GB', 'United Kingdom', 'LOW', FALSE, NOW()),
        ('IR', 'Iran', 'CRITICAL', TRUE, NOW()),
        ('SY', 'Syria', 'CRITICAL', TRUE, NOW()),
        ('KP', 'North Korea', 'CRITICAL', TRUE, NOW())
        ON CONFLICT (country_code)
        DO UPDATE SET
            country_name = EXCLUDED.country_name,
            risk_level = EXCLUDED.risk_level,
            is_sanctioned = EXCLUDED.is_sanctioned;

    END IF;
END $$;


-- ======================================================
-- VALIDATION MESSAGE
-- ======================================================

DO $$
BEGIN
    RAISE NOTICE 'STEP 2 AML default rules inserted/updated successfully.';
END $$;
