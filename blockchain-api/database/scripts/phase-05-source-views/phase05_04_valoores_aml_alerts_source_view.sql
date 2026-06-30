/*
Phase 5 — Source View 4
View: blockchain.valoores_aml_alerts

Confirmed source model:
- blockchain.mv_aml_alerts_customers

Expected source count:
- 259,605 records based on:
  SELECT COUNT(*) FROM blockchain.mv_aml_alerts_customers;

Purpose:
Prepare normalized AML alert source records for stable blockchain proof generation.

Rules:
- Do not expose customer_name directly.
- Do not expose branch_name directly.
- Use deterministic fingerprints for sensitive text values.
- Normalize alert/rule/risk text.
- Standardize dates/timestamps.
- Standardize nulls.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_aml_alerts;

CREATE VIEW blockchain.valoores_aml_alerts AS
WITH source_data AS (
    SELECT
        business_rule_id,
        business_rule_message_id,
        business_rule_message_info_id,
        customer_id,
        customer_name,
        alert_status,
        alert_status_code,
        rule_name,
        execution_date,
        branch_name,
        customer_risk
    FROM blockchain.mv_aml_alerts_customers
),
normalized AS (
    SELECT
        'AML_ALERT'::text AS source_module,

        COALESCE(
            business_rule_message_info_id::text,
            CONCAT_WS(
                ':',
                COALESCE(business_rule_id::text, 'NA'),
                COALESCE(business_rule_message_id::text, 'NA'),
                COALESCE(customer_id::text, 'NA')
            )
        ) AS source_record_id,

        COALESCE(business_rule_id::text, 'NA') AS business_rule_id,
        COALESCE(business_rule_message_id::text, 'NA') AS business_rule_message_id,
        COALESCE(business_rule_message_info_id::text, 'NA') AS business_rule_message_info_id,
        COALESCE(customer_id::text, 'NA') AS customer_id,

        COALESCE(alert_status_code::text, 'NA') AS alert_status_code,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(alert_status::text, '\s+', ' ', 'g'))),
            ''
        ) AS alert_status_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(rule_name::text, '\s+', ' ', 'g'))),
            ''
        ) AS rule_name_normalized,

        COALESCE(
            TO_CHAR(execution_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS execution_ts_utc,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(customer_risk::text, '\s+', ' ', 'g'))),
            ''
        ) AS customer_risk_normalized,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(customer_name::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS customer_name_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(branch_name::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS branch_name_fingerprint
    FROM source_data
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            business_rule_id,
            business_rule_message_id,
            business_rule_message_info_id,
            customer_id,
            alert_status_code,
            alert_status_normalized,
            rule_name_normalized,
            execution_ts_utc,
            customer_risk_normalized,
            customer_name_fingerprint,
            branch_name_fingerprint
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    business_rule_id,
    business_rule_message_id,
    business_rule_message_info_id,
    customer_id,
    alert_status_code,
    alert_status_normalized,
    rule_name_normalized,
    execution_ts_utc,
    customer_risk_normalized,
    customer_name_fingerprint,
    branch_name_fingerprint,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_aml_alerts IS
'Phase 5 normalized AML alerts source view for blockchain proof hash generation. Source: blockchain.mv_aml_alerts_customers. Customer and branch names are exposed only as deterministic fingerprints.';

COMMIT;
