/*
  Phase 14 — Customer KYC source view compatibility patch

  Purpose:
  Add the required blockchain proof contract columns to:
    blockchain.valoores_customer_kyc

  Rules:
  - Do not expose raw PII.
  - Do not change hash_input.
  - Do not read raw Customer/KYC business tables.
  - Keep existing source view content by wrapping the current view.
*/

BEGIN;

DO $$
BEGIN
  IF to_regclass('blockchain.valoores_customer_kyc') IS NULL THEN
    RAISE EXCEPTION 'Required view blockchain.valoores_customer_kyc does not exist';
  END IF;

  IF to_regclass('blockchain.valoores_customer_kyc_legacy_20260703') IS NOT NULL THEN
    RAISE EXCEPTION 'Backup view blockchain.valoores_customer_kyc_legacy_20260703 already exists. Stop to avoid overwrite.';
  END IF;
END $$;

ALTER VIEW blockchain.valoores_customer_kyc
RENAME TO valoores_customer_kyc_legacy_20260703;

CREATE VIEW blockchain.valoores_customer_kyc AS
SELECT
  'VALOORES'::text AS source_system,
  'CUSTOMER_KYC'::text AS source_entity,
  legacy.source_record_id::text AS source_record_id,

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
