/*
Phase 5 — Source View 2
View: blockchain.valoores_customer_kyc

Confirmed source model:
- sdedba.ref_customer
- sdedba.cfg_customer_def

Expected source count:
- 1,146,133 records based on:
  SELECT COUNT(*)
  FROM sdedba.ref_customer a, sdedba.cfg_customer_def b
  WHERE a.customer_id = b.customer_id;

Purpose:
Prepare normalized customer KYC source records for stable blockchain proof generation.

Rules:
- Do not expose customer names, DOB, address, document number, comments, image, or raw JSON directly.
- Use deterministic fingerprints for sensitive customer/profile/KYC object content.
- Normalize text.
- Standardize dates.
- Standardize nulls.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_customer_kyc;

CREATE VIEW blockchain.valoores_customer_kyc AS
WITH source_data AS (
    SELECT
        a.customer_id,
        b.customer_def_id,
        b.object_id,
        b.object_pk_value,
        b.object_content,

        a.status_code,
        a.status_bdate,
        a.customer_internal_code,
        a.party_id,
        a.party_type_code,
        a.party_sub_type,
        a.customer_nature,
        a.is_valid,
        a.is_customer_displayed,
        a.data_source,
        a.bsn_group_id,
        a.cur_id,
        a.lan_id,
        a.soc_id,

        a.creation_date AS customer_creation_date,
        a.update_date AS customer_update_date,
        a.last_update_date,
        a.last_extraction_date,

        b.creation_date AS kyc_creation_date,
        b.update_date AS kyc_update_date,

        /*
          Sensitive fields used only inside fingerprint.
          They are not exposed directly in the final view.
        */
        a.customer_name,
        a.customer_sname,
        a.customer_previous_name,
        a.customer_embossing_name,
        a.customer_first_name,
        a.customer_last_name,
        a.customer_father_name,
        a.customer_mother_name,
        a.customer_maiden_name,
        a.mother_name,
        a.mother_maiden_name,
        a.person_dob,
        a.birth_cou_id,
        a.birth_place_id,
        a.birth_nationality_id,
        a.registration_no,
        a.registration_date,
        a.registration_cou_id,
        a.registration_place_id,
        a.customer_reference,
        a.tech_customer_name,
        a.tech_updated_customer_name,
        a.tech_customer_profile_id,
        a.tech_account_no,
        a.adr_desc
    FROM sdedba.ref_customer a
    JOIN sdedba.cfg_customer_def b
      ON b.customer_id = a.customer_id
),
normalized AS (
    SELECT
        'CUSTOMER_KYC'::text AS source_module,

        CONCAT(
            COALESCE(customer_id::text, 'NA'),
            ':',
            COALESCE(customer_def_id::text, 'NA')
        ) AS source_record_id,

        COALESCE(customer_id::text, 'NA') AS customer_id,
        COALESCE(customer_def_id::text, 'NA') AS customer_def_id,
        COALESCE(object_id::text, 'NA') AS object_id,
        COALESCE(object_pk_value::text, 'NA') AS object_pk_value,

        COALESCE(status_code::text, 'NA') AS customer_status_code,
        COALESCE(TO_CHAR(status_bdate::date, 'YYYY-MM-DD'), '') AS customer_status_date,

        COALESCE(party_id::text, 'NA') AS party_id,
        COALESCE(party_type_code::text, 'NA') AS party_type_code,
        COALESCE(party_sub_type::text, 'NA') AS party_sub_type_code,
        COALESCE(customer_nature::text, 'NA') AS customer_nature_code,

        COALESCE(LOWER(BTRIM(is_valid::text)), '') AS is_valid_flag,
        COALESCE(LOWER(BTRIM(is_customer_displayed::text)), '') AS is_displayed_flag,

        COALESCE(data_source::text, 'NA') AS data_source_code,
        COALESCE(bsn_group_id::text, 'NA') AS business_group_id,
        COALESCE(cur_id::text, 'NA') AS currency_id,
        COALESCE(lan_id::text, 'NA') AS language_id,
        COALESCE(soc_id::text, 'NA') AS society_id,

        /*
          Sensitive profile fingerprint.
          Raw values are not exposed.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_internal_code::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_sname::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_previous_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_embossing_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_first_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_last_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_father_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_mother_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_maiden_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(mother_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(mother_maiden_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(TO_CHAR(person_dob::date, 'YYYY-MM-DD'), ''),
                COALESCE(birth_cou_id::text, ''),
                COALESCE(birth_place_id::text, ''),
                COALESCE(birth_nationality_id::text, ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(registration_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(TO_CHAR(registration_date::date, 'YYYY-MM-DD'), ''),
                COALESCE(registration_cou_id::text, ''),
                COALESCE(registration_place_id::text, ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_reference::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_customer_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_updated_customer_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_customer_profile_id::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_account_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(adr_desc::text, '\s+', ' ', 'g'))), '')
            )
        ) AS customer_profile_fingerprint,

        /*
          KYC JSON content fingerprint.
          Raw JSON is not exposed.
        */
        MD5(
            COALESCE(object_content::text, '')
        ) AS kyc_object_fingerprint,

        COALESCE(TO_CHAR(customer_creation_date::date, 'YYYY-MM-DD'), '') AS customer_creation_date,
        COALESCE(TO_CHAR(customer_update_date::date, 'YYYY-MM-DD'), '') AS customer_update_date,
        COALESCE(TO_CHAR(last_update_date::date, 'YYYY-MM-DD'), '') AS last_update_date,
        COALESCE(TO_CHAR(last_extraction_date::date, 'YYYY-MM-DD'), '') AS last_extraction_date,
        COALESCE(TO_CHAR(kyc_creation_date::date, 'YYYY-MM-DD'), '') AS kyc_creation_date,
        COALESCE(TO_CHAR(kyc_update_date::date, 'YYYY-MM-DD'), '') AS kyc_update_date
    FROM source_data
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            customer_id,
            customer_def_id,
            object_id,
            object_pk_value,
            customer_status_code,
            customer_status_date,
            party_id,
            party_type_code,
            party_sub_type_code,
            customer_nature_code,
            is_valid_flag,
            is_displayed_flag,
            data_source_code,
            business_group_id,
            currency_id,
            language_id,
            society_id,
            customer_profile_fingerprint,
            kyc_object_fingerprint,
            customer_creation_date,
            customer_update_date,
            last_update_date,
            last_extraction_date,
            kyc_creation_date,
            kyc_update_date
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    customer_id,
    customer_def_id,
    object_id,
    object_pk_value,
    customer_status_code,
    customer_status_date,
    party_id,
    party_type_code,
    party_sub_type_code,
    customer_nature_code,
    is_valid_flag,
    is_displayed_flag,
    data_source_code,
    business_group_id,
    currency_id,
    language_id,
    society_id,
    customer_profile_fingerprint,
    kyc_object_fingerprint,
    customer_creation_date,
    customer_update_date,
    last_update_date,
    last_extraction_date,
    kyc_creation_date,
    kyc_update_date,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_customer_kyc IS
'Phase 5 normalized customer KYC source view for blockchain proof hash generation. Source: sdedba.ref_customer + sdedba.cfg_customer_def. Sensitive customer and KYC JSON values are exposed only as deterministic fingerprints.';

COMMIT;
