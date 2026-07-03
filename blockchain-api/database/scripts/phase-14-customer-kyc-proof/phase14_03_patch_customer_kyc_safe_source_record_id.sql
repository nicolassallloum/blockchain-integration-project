/*
  Phase 14 — Customer KYC safe source_record_id patch

  Purpose:
  Make blockchain.valoores_customer_kyc.source_record_id compatible with
  Phase 9 blockchain key format:

    VALOORES:{MODULE}:{SOURCE_RECORD_ID}:{HASH_VERSION}

  Rules:
  - No colon (:)
  - No whitespace
  - Only letters, numbers, underscore, dash, dot
  - Max 128 characters
  - Do not change hash_input
  - Do not expose raw PII
  - Do not read raw Customer/KYC business tables
*/

BEGIN;

DO $$
BEGIN
  IF to_regclass('blockchain.valoores_customer_kyc') IS NULL THEN
    RAISE EXCEPTION 'Required view blockchain.valoores_customer_kyc does not exist';
  END IF;

  IF to_regclass('blockchain.valoores_customer_kyc_legacy_20260703') IS NULL THEN
    RAISE EXCEPTION 'Required backup view blockchain.valoores_customer_kyc_legacy_20260703 does not exist';
  END IF;
END $$;

CREATE OR REPLACE VIEW blockchain.valoores_customer_kyc AS
SELECT
  'VALOORES'::text AS source_system,
  'CUSTOMER_KYC'::text AS source_entity,

  UPPER(
    regexp_replace(
      replace(legacy.source_record_id::text, ':', '-'),
      '[^A-Za-z0-9_.-]+',
      '-',
      'g'
    )
  ) AS source_record_id,

  COALESCE(
    NULLIF(legacy.customer_id::text, ''),
    NULLIF(legacy.customer_def_id::text, ''),
    legacy.source_record_id::text
  ) AS business_reference,

  'CUSTOMER_KYC'::text AS record_type,

  COALESCE(
    NULLIF(legacy.customer_status_code::text, ''),
    'UNKNOWN'
  ) AS record_status,

  COALESCE(
    NULLIF(legacy.kyc_update_date::text, ''),
    NULLIF(legacy.customer_update_date::text, ''),
    NULLIF(legacy.last_update_date::text, ''),
    NULLIF(legacy.kyc_creation_date::text, ''),
    NULLIF(legacy.customer_creation_date::text, ''),
    NULLIF(legacy.last_extraction_date::text, ''),
    NOW()::text
  ) AS standardized_event_timestamp,

  'V1'::text AS proof_version,

  legacy.hash_input::text AS hash_input,

  legacy.source_module,
  legacy.customer_id,
  legacy.customer_def_id,
  legacy.object_id,
  legacy.object_pk_value,
  legacy.customer_status_code,
  legacy.customer_status_date,
  legacy.party_id,
  legacy.party_type_code,
  legacy.party_sub_type_code,
  legacy.customer_nature_code,
  legacy.is_valid_flag,
  legacy.is_displayed_flag,
  legacy.data_source_code,
  legacy.business_group_id,
  legacy.currency_id,
  legacy.language_id,
  legacy.society_id,
  legacy.customer_profile_fingerprint,
  legacy.kyc_object_fingerprint,
  legacy.customer_creation_date,
  legacy.customer_update_date,
  legacy.last_update_date,
  legacy.last_extraction_date,
  legacy.kyc_creation_date,
  legacy.kyc_update_date,
  legacy.hash_md5
FROM blockchain.valoores_customer_kyc_legacy_20260703 legacy;

COMMIT;
