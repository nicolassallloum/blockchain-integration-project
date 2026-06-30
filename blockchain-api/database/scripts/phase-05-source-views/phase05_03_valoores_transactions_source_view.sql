/*
Phase 5 — Source View 3
View: blockchain.valoores_transactions

Confirmed source model:
- findba.fin_transaction
- suitedba.cfg_object_api_def

Expected source count:
- 190,128 records based on:
  SELECT COUNT(*)
  FROM findba.fin_transaction a, suitedba.cfg_object_api_def b
  WHERE a.transaction_id = b.primary_key_value;

Purpose:
Prepare normalized VALOORES transaction source records for stable blockchain proof generation.

Rules:
- Do not expose transaction description, comments, references, or raw API JSON directly.
- Use deterministic fingerprints for sensitive transaction/API content.
- Normalize text.
- Standardize dates.
- Standardize numbers.
- Standardize nulls.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_transactions;

CREATE VIEW blockchain.valoores_transactions AS
WITH source_data AS (
    SELECT
        a.transaction_id,
        b.object_api_def_id,
        b.object_id,
        b.primary_key_value,
        b.status_code AS api_status_code,
        b.api_content,

        a.ven_id,
        a.itm_id,
        a.bsn_group_id,
        a.dst_bsn_group_id,
        a.status_code,
        a.status_bdate,
        a.transaction_date,
        a.transaction_amnt,
        a.converted_cur_transaction_amnt,
        a.cur_id,
        a.cur_cnv_future_id,

        a.src_customer_id,
        a.dst_customer_id,
        a.transaction_purpose_code,
        a.dst_transaction_purpose_code,
        a.transaction_grouping_id,
        a.transaction_type_id,

        a.card_id,
        a.account_id,
        a.subdiv_code,
        a.cou_id,
        a.country_region_id,
        a.client_id,
        a.data_source,
        a.promo_prc_rl_id,
        a.psycho_rule_value,
        a.payment_due_date,

        a.creation_date AS transaction_creation_date,
        a.update_date AS transaction_update_date,
        a.last_extraction_date,

        b.creation_date AS api_creation_date,
        b.update_date AS api_update_date,

        /*
          Sensitive/free-text/API fields used only inside fingerprints.
          They are not exposed directly in the final view.
        */
        a.transaction_desc,
        a.transaction_internal_code,
        a.transaction_reference,
        a.comments
    FROM findba.fin_transaction a
    JOIN suitedba.cfg_object_api_def b
      ON a.transaction_id = b.primary_key_value
),
normalized AS (
    SELECT
        'TRANSACTION'::text AS source_module,

        CONCAT(
            COALESCE(transaction_id::text, 'NA'),
            ':',
            COALESCE(object_api_def_id::text, 'NA')
        ) AS source_record_id,

        COALESCE(transaction_id::text, 'NA') AS transaction_id,
        COALESCE(object_api_def_id::text, 'NA') AS object_api_def_id,
        COALESCE(object_id::text, 'NA') AS object_id,
        COALESCE(primary_key_value::text, 'NA') AS primary_key_value,

        COALESCE(ven_id::text, 'NA') AS vendor_id,
        COALESCE(itm_id::text, 'NA') AS item_id,
        COALESCE(bsn_group_id::text, 'NA') AS business_group_id,
        COALESCE(dst_bsn_group_id::text, 'NA') AS destination_business_group_id,

        COALESCE(status_code::text, 'NA') AS transaction_status_code,
        COALESCE(TO_CHAR(status_bdate::date, 'YYYY-MM-DD'), '') AS transaction_status_date,
        COALESCE(TO_CHAR(transaction_date::date, 'YYYY-MM-DD'), '') AS transaction_date,

        COALESCE(
            TO_CHAR(transaction_amnt::numeric, 'FM999999999999999999999999990.000000'),
            'NA'
        ) AS transaction_amount,

        COALESCE(
            TO_CHAR(converted_cur_transaction_amnt::numeric, 'FM999999999999999999999999990.000000'),
            'NA'
        ) AS converted_transaction_amount,

        COALESCE(cur_id::text, 'NA') AS currency_id,
        COALESCE(cur_cnv_future_id::text, 'NA') AS currency_conversion_future_id,

        COALESCE(src_customer_id::text, 'NA') AS source_customer_id,
        COALESCE(dst_customer_id::text, 'NA') AS destination_customer_id,

        COALESCE(transaction_purpose_code::text, 'NA') AS transaction_purpose_code,
        COALESCE(dst_transaction_purpose_code::text, 'NA') AS destination_transaction_purpose_code,
        COALESCE(transaction_grouping_id::text, 'NA') AS transaction_grouping_id,
        COALESCE(transaction_type_id::text, 'NA') AS transaction_type_id,

        COALESCE(card_id::text, 'NA') AS card_id,
        COALESCE(account_id::text, 'NA') AS account_id,
        COALESCE(subdiv_code::text, 'NA') AS subdivision_code,
        COALESCE(cou_id::text, 'NA') AS country_id,
        COALESCE(country_region_id::text, 'NA') AS country_region_id,
        COALESCE(client_id::text, 'NA') AS client_id,
        COALESCE(data_source::text, 'NA') AS data_source_code,
        COALESCE(promo_prc_rl_id::text, 'NA') AS promotion_rule_id,
        COALESCE(psycho_rule_value::text, 'NA') AS psycho_rule_value,

        COALESCE(TO_CHAR(payment_due_date::date, 'YYYY-MM-DD'), '') AS payment_due_date,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(api_status_code::text, '\s+', ' ', 'g'))),
            ''
        ) AS api_status_code,

        /*
          Sensitive transaction content fingerprint.
          Raw description, comments, reference, and internal code are not exposed.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(transaction_desc::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(transaction_internal_code::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(transaction_reference::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(comments::text, '\s+', ' ', 'g'))), '')
            )
        ) AS transaction_content_fingerprint,

        /*
          API JSON fingerprint.
          Raw JSON is not exposed.
        */
        MD5(
            COALESCE(api_content::text, '')
        ) AS api_content_fingerprint,

        COALESCE(
            TO_CHAR(transaction_creation_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS transaction_creation_ts_utc,

        COALESCE(TO_CHAR(transaction_update_date::date, 'YYYY-MM-DD'), '') AS transaction_update_date,
        COALESCE(TO_CHAR(last_extraction_date::date, 'YYYY-MM-DD'), '') AS last_extraction_date,
        COALESCE(TO_CHAR(api_creation_date::date, 'YYYY-MM-DD'), '') AS api_creation_date,
        COALESCE(TO_CHAR(api_update_date::date, 'YYYY-MM-DD'), '') AS api_update_date
    FROM source_data
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            transaction_id,
            object_api_def_id,
            object_id,
            primary_key_value,
            vendor_id,
            item_id,
            business_group_id,
            destination_business_group_id,
            transaction_status_code,
            transaction_status_date,
            transaction_date,
            transaction_amount,
            converted_transaction_amount,
            currency_id,
            currency_conversion_future_id,
            source_customer_id,
            destination_customer_id,
            transaction_purpose_code,
            destination_transaction_purpose_code,
            transaction_grouping_id,
            transaction_type_id,
            card_id,
            account_id,
            subdivision_code,
            country_id,
            country_region_id,
            client_id,
            data_source_code,
            promotion_rule_id,
            psycho_rule_value,
            payment_due_date,
            api_status_code,
            transaction_content_fingerprint,
            api_content_fingerprint,
            transaction_creation_ts_utc,
            transaction_update_date,
            last_extraction_date,
            api_creation_date,
            api_update_date
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    transaction_id,
    object_api_def_id,
    object_id,
    primary_key_value,
    vendor_id,
    item_id,
    business_group_id,
    destination_business_group_id,
    transaction_status_code,
    transaction_status_date,
    transaction_date,
    transaction_amount,
    converted_transaction_amount,
    currency_id,
    currency_conversion_future_id,
    source_customer_id,
    destination_customer_id,
    transaction_purpose_code,
    destination_transaction_purpose_code,
    transaction_grouping_id,
    transaction_type_id,
    card_id,
    account_id,
    subdivision_code,
    country_id,
    country_region_id,
    client_id,
    data_source_code,
    promotion_rule_id,
    psycho_rule_value,
    payment_due_date,
    api_status_code,
    transaction_content_fingerprint,
    api_content_fingerprint,
    transaction_creation_ts_utc,
    transaction_update_date,
    last_extraction_date,
    api_creation_date,
    api_update_date,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_transactions IS
'Phase 5 normalized transactions source view for blockchain proof hash generation. Source: findba.fin_transaction + suitedba.cfg_object_api_def. Sensitive transaction/API values are exposed only as deterministic fingerprints.';

COMMIT;
