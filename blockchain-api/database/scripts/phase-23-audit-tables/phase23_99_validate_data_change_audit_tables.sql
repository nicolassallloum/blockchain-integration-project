\set ON_ERROR_STOP on
\pset pager off

\echo 'PHASE 23 VALIDATION - REQUIRED TABLE COUNT'
SELECT
  COUNT(*) AS required_table_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'blockchain'
  AND c.relkind = 'r'
  AND c.relname IN (
    'data_change_audit',
    'data_change_blockchain_outbox',
    'data_change_audit_batches',
    'data_change_audit_config'
  );

\echo 'PHASE 23 VALIDATION - REQUIRED TABLES'
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  pg_get_userbyid(c.relowner) AS owner,
  pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'blockchain'
  AND c.relkind = 'r'
  AND c.relname IN (
    'data_change_audit',
    'data_change_blockchain_outbox',
    'data_change_audit_batches',
    'data_change_audit_config'
  )
ORDER BY c.relname;

\echo 'PHASE 23 VALIDATION - REQUIRED CORE COLUMNS'
SELECT
  table_name,
  COUNT(*) AS column_count
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name IN (
    'data_change_audit',
    'data_change_blockchain_outbox',
    'data_change_audit_batches',
    'data_change_audit_config'
  )
GROUP BY table_name
ORDER BY table_name;

\echo 'PHASE 23 VALIDATION - REQUIRED INDEXES'
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND tablename IN (
    'data_change_audit',
    'data_change_blockchain_outbox',
    'data_change_audit_batches',
    'data_change_audit_config'
  )
ORDER BY tablename, indexname;

\echo 'PHASE 23 VALIDATION - CHECK STATUS'
SELECT
  CASE
    WHEN (
      SELECT COUNT(*)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'blockchain'
        AND c.relkind = 'r'
        AND c.relname IN (
          'data_change_audit',
          'data_change_blockchain_outbox',
          'data_change_audit_batches',
          'data_change_audit_config'
        )
    ) = 4
    THEN 'PASS'
    ELSE 'FAIL'
  END AS phase_23_validation_status;
