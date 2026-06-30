/*
Phase 5 — Source View 6
View: blockchain.valoores_screening_activities

Confirmed source model:
- blockchain.vw_screening_activities_customers

Expected source count:
- 244,375 records based on:
  SELECT COUNT(*) FROM blockchain.vw_screening_activities_customers;

Purpose:
Prepare normalized screening activity source records for stable blockchain proof generation.

Rules:
- Do not expose customer name directly.
- Do not expose approver/created_by/updated_by directly.
- Use deterministic fingerprints for sensitive user/name values.
- Normalize text.
- Standardize dates/timestamps.
- Standardize numbers.
- Standardize nulls.
- Produce deterministic unique source_record_id.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_screening_activities;

CREATE VIEW blockchain.valoores_screening_activities AS
WITH source_data AS (
    SELECT
        sanction_list_id,
        customer_id,
        match_score,
        approver_user_id,
        creation_date,
        created_by,
        update_date,
        updated_by,
        matching_type,
        approver_date,
        sanction_list_cust_match_id,
        match_execution_date,
        match_filter_type_code,
        tech_entity_source_id,
        lib_template_id,
        tech_customer_name,
        is_external_customer
    FROM blockchain.vw_screening_activities_customers
),
sequenced AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(s.sanction_list_cust_match_id::text, 'NO_MATCH_ID')
            ORDER BY
                s.match_execution_date NULLS LAST,
                s.creation_date NULLS LAST,
                s.update_date NULLS LAST,
                COALESCE(s.sanction_list_id::text, ''),
                COALESCE(s.customer_id::text, ''),
                COALESCE(s.match_score::text, ''),
                COALESCE(s.matching_type::text, ''),
                COALESCE(s.match_filter_type_code::text, ''),
                COALESCE(s.tech_entity_source_id::text, ''),
                COALESCE(s.lib_template_id::text, ''),
                MD5(COALESCE(s.tech_customer_name::text, ''))
        ) AS duplicate_sequence
    FROM source_data s
),
normalized AS (
    SELECT
        'SCREENING_ACTIVITY'::text AS source_module,

        CONCAT(
            COALESCE(sanction_list_cust_match_id::text, 'NO_MATCH_ID'),
            ':',
            LPAD(duplicate_sequence::text, 6, '0')
        ) AS source_record_id,

        COALESCE(sanction_list_cust_match_id::text, 'NA') AS sanction_list_cust_match_id,
        COALESCE(duplicate_sequence::text, 'NA') AS duplicate_sequence,

        COALESCE(sanction_list_id::text, 'NA') AS sanction_list_id,
        COALESCE(customer_id::text, 'NA') AS customer_id,

        CASE
            WHEN match_score::text ~ '^-?[0-9]+(\.[0-9]+)?$'
            THEN TO_CHAR(match_score::numeric, 'FM999999999999999999990.000000')
            ELSE COALESCE(LOWER(BTRIM(REGEXP_REPLACE(match_score::text, '\s+', ' ', 'g'))), 'NA')
        END AS match_score_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(matching_type::text, '\s+', ' ', 'g'))),
            ''
        ) AS matching_type_normalized,

        COALESCE(match_filter_type_code::text, 'NA') AS match_filter_type_code,
        COALESCE(tech_entity_source_id::text, 'NA') AS tech_entity_source_id,
        COALESCE(lib_template_id::text, 'NA') AS lib_template_id,

        COALESCE(
            LOWER(BTRIM(is_external_customer::text)),
            ''
        ) AS is_external_customer_flag,

        COALESCE(
            TO_CHAR(match_execution_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS match_execution_ts_utc,

        COALESCE(
            TO_CHAR(approver_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS approver_ts_utc,

        COALESCE(
            TO_CHAR(creation_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS creation_ts_utc,

        COALESCE(
            TO_CHAR(update_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS update_ts_utc,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(approver_user_id::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS approver_user_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(created_by::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS created_by_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(updated_by::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS updated_by_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(tech_customer_name::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS customer_name_fingerprint
    FROM sequenced
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            sanction_list_cust_match_id,
            duplicate_sequence,
            sanction_list_id,
            customer_id,
            match_score_normalized,
            matching_type_normalized,
            match_filter_type_code,
            tech_entity_source_id,
            lib_template_id,
            is_external_customer_flag,
            match_execution_ts_utc,
            approver_ts_utc,
            creation_ts_utc,
            update_ts_utc,
            approver_user_fingerprint,
            created_by_fingerprint,
            updated_by_fingerprint,
            customer_name_fingerprint
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    sanction_list_cust_match_id,
    duplicate_sequence,
    sanction_list_id,
    customer_id,
    match_score_normalized,
    matching_type_normalized,
    match_filter_type_code,
    tech_entity_source_id,
    lib_template_id,
    is_external_customer_flag,
    match_execution_ts_utc,
    approver_ts_utc,
    creation_ts_utc,
    update_ts_utc,
    approver_user_fingerprint,
    created_by_fingerprint,
    updated_by_fingerprint,
    customer_name_fingerprint,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_screening_activities IS
'Phase 5 normalized screening activities source view for blockchain proof hash generation. Source: blockchain.vw_screening_activities_customers. Customer and user values are exposed only as deterministic fingerprints.';

COMMIT;
