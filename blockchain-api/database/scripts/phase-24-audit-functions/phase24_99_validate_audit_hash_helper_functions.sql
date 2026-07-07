\set ON_ERROR_STOP on
\pset pager off

\echo 'PHASE 24 VALIDATION - Built-in SHA256 Function'
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS result_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'pg_catalog'
  AND p.proname = 'sha256';

\echo 'PHASE 24 VALIDATION - Helper Functions'
SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS result_type,
  l.lanname AS language,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'blockchain'
  AND p.proname IN (
    'fn_audit_text_sha256',
    'fn_audit_jsonb_sha256',
    'fn_audit_row_hash',
    'fn_audit_changed_fields',
    'fn_audit_primary_key_json',
    'fn_audit_primary_key_value',
    'fn_audit_event_hash'
  )
ORDER BY p.proname;

\echo 'PHASE 24 VALIDATION - Hash Test'
SELECT
  blockchain.fn_audit_text_sha256('VALOORES') AS text_hash,
  length(blockchain.fn_audit_text_sha256('VALOORES')) AS hash_length;

\echo 'PHASE 24 VALIDATION - Row Hash Stability Test'
SELECT
  blockchain.fn_audit_row_hash('{"a":1,"b":"test"}'::jsonb) =
  blockchain.fn_audit_row_hash('{"b":"test","a":1}'::jsonb) AS stable_jsonb_hash;

\echo 'PHASE 24 VALIDATION - Changed Fields Test'
SELECT
  blockchain.fn_audit_changed_fields(
    '{"id":1,"name":"old","status":"A"}'::jsonb,
    '{"id":1,"name":"new","status":"A"}'::jsonb
  ) AS changed_fields;

\echo 'PHASE 24 VALIDATION - Primary Key JSON Test'
SELECT
  blockchain.fn_audit_primary_key_json(
    '{"customer_id":123,"name":"Test"}'::jsonb,
    ARRAY['customer_id']
  ) AS primary_key_json;

\echo 'PHASE 24 VALIDATION - Primary Key Value Test'
SELECT
  blockchain.fn_audit_primary_key_value(
    '{"customer_id":123,"case_id":456,"name":"Test"}'::jsonb,
    ARRAY['customer_id','case_id']
  ) AS primary_key_value;

\echo 'PHASE 24 VALIDATION - Audit Event Hash Test'
SELECT
  blockchain.fn_audit_event_hash(
    'sdedba',
    'ref_customer',
    'UPDATE',
    '{"customer_id":123}'::jsonb,
    blockchain.fn_audit_row_hash('{"name":"old"}'::jsonb),
    blockchain.fn_audit_row_hash('{"name":"new"}'::jsonb),
    now(),
    txid_current()
  ) AS audit_event_hash;

\echo 'PHASE 24 VALIDATION - CHECK STATUS'
SELECT
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'blockchain'
        AND p.proname IN (
          'fn_audit_text_sha256',
          'fn_audit_jsonb_sha256',
          'fn_audit_row_hash',
          'fn_audit_changed_fields',
          'fn_audit_primary_key_json',
          'fn_audit_primary_key_value',
          'fn_audit_event_hash'
        )
    ) = 7
    THEN 'PASS'
    ELSE 'FAIL'
  END AS phase_24_validation_status;
