\set ON_ERROR_STOP on
\pset pager off

\echo 'PHASE 25 VALIDATION - Trigger Function Exists'
SELECT
  n.nspname AS function_schema,
  p.proname AS function_name,
  pg_get_function_result(p.oid) AS result_type,
  l.lanname AS language,
  pg_get_userbyid(p.proowner) AS owner
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'blockchain'
  AND p.proname = 'fn_generic_data_change_audit_trigger';

\echo 'PHASE 25 VALIDATION - Runtime Test In Rollback Transaction'
BEGIN;

CREATE TEMP TABLE phase25_trigger_test (
  test_id BIGINT PRIMARY KEY,
  test_name TEXT,
  test_status TEXT
);

INSERT INTO blockchain.data_change_audit_config (
  schema_name,
  table_name,
  module_name,
  primary_key_columns,
  source_view_name,
  audit_enabled,
  capture_insert,
  capture_update,
  capture_delete,
  blockchain_enabled,
  sensitive_fields,
  excluded_fields,
  notes
)
SELECT
  n.nspname,
  'phase25_trigger_test',
  'PHASE_25_TEST',
  ARRAY['test_id'],
  'phase25_validation_temp_table',
  true,
  true,
  true,
  true,
  true,
  ARRAY[]::TEXT[],
  ARRAY[]::TEXT[],
  'Temporary validation config for Phase 25'
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relname = 'phase25_trigger_test'
  AND c.relkind = 'r'
LIMIT 1;

CREATE TRIGGER trg_phase25_test_audit
AFTER INSERT OR UPDATE OR DELETE ON phase25_trigger_test
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_generic_data_change_audit_trigger();

SET LOCAL app.username = 'phase25_validation_user';
SET LOCAL app.user_role = 'VALIDATOR';
SET LOCAL app.user_agent = 'phase25_validation_psql';
SET LOCAL app.client_hostname = 'pg-replica';

INSERT INTO phase25_trigger_test(test_id, test_name, test_status)
VALUES (1, 'Before', 'OPEN');

UPDATE phase25_trigger_test
SET test_name = 'After'
WHERE test_id = 1;

DELETE FROM phase25_trigger_test
WHERE test_id = 1;

\echo 'PHASE 25 VALIDATION - Test Audit Rows'
SELECT
  operation_type,
  module_name,
  table_name,
  primary_key_value,
  changed_by_app_user,
  changed_by_role,
  client_hostname,
  blockchain_status,
  length(audit_event_hash) AS audit_event_hash_length,
  length(blockchain_key) AS blockchain_key_length
FROM blockchain.data_change_audit
WHERE module_name = 'PHASE_25_TEST'
ORDER BY audit_id;

\echo 'PHASE 25 VALIDATION - Test Outbox Rows'
SELECT
  o.operation_type,
  o.status,
  o.module_name,
  o.table_name,
  length(o.audit_event_hash) AS audit_event_hash_length,
  length(o.blockchain_key) AS blockchain_key_length
FROM blockchain.data_change_blockchain_outbox o
JOIN blockchain.data_change_audit a ON a.audit_id = o.audit_id
WHERE a.module_name = 'PHASE_25_TEST'
ORDER BY o.outbox_id;

\echo 'PHASE 25 VALIDATION - CHECK STATUS'
SELECT
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM blockchain.data_change_audit
      WHERE module_name = 'PHASE_25_TEST'
    ) = 3
    AND (
      SELECT COUNT(*)
      FROM blockchain.data_change_blockchain_outbox o
      JOIN blockchain.data_change_audit a ON a.audit_id = o.audit_id
      WHERE a.module_name = 'PHASE_25_TEST'
    ) = 3
    THEN 'PASS'
    ELSE 'FAIL'
  END AS phase_25_validation_status;

ROLLBACK;
