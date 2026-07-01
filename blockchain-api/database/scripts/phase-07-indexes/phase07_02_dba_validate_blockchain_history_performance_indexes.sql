/*
Phase 7 — DBA Validation Script
Validate Blockchain History Performance Indexes
*/

\pset pager off

SELECT '===== PHASE 7 DBA VALIDATION 1. REQUIRED NEW INDEXES EXIST =====' AS section;

WITH required_indexes(index_name) AS (
    VALUES
        ('idx_blockchain_history_source_record_id'),
        ('idx_blockchain_history_module_created_at_desc'),
        ('idx_blockchain_history_module_submitted_at_desc'),
        ('idx_blockchain_history_status_created_at_desc'),
        ('idx_blockchain_history_verification_created_at_desc'),
        ('idx_blockchain_history_retry_queue_status_pending_failed'),
        ('idx_blockchain_history_retry_queue_verification_failed'),
        ('idx_blockchain_history_attempts_source_record_id'),
        ('idx_blockchain_history_attempts_module_started_at_desc'),
        ('idx_blockchain_history_attempts_status_started_at_desc')
)
SELECT
    r.index_name,
    CASE WHEN i.indexname IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM required_indexes r
LEFT JOIN pg_indexes i
  ON i.schemaname = 'blockchain'
 AND i.indexname = r.index_name
ORDER BY r.index_name;

SELECT '===== PHASE 7 DBA VALIDATION 2. INDEX DEFINITIONS =====' AS section;

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND indexname IN (
      'idx_blockchain_history_source_record_id',
      'idx_blockchain_history_module_created_at_desc',
      'idx_blockchain_history_module_submitted_at_desc',
      'idx_blockchain_history_status_created_at_desc',
      'idx_blockchain_history_verification_created_at_desc',
      'idx_blockchain_history_retry_queue_status_pending_failed',
      'idx_blockchain_history_retry_queue_verification_failed',
      'idx_blockchain_history_attempts_source_record_id',
      'idx_blockchain_history_attempts_module_started_at_desc',
      'idx_blockchain_history_attempts_status_started_at_desc'
  )
ORDER BY tablename, indexname;

SELECT '===== PHASE 7 DBA VALIDATION 3. DUPLICATE INDEX CHECK =====' AS section;

WITH idx AS (
    SELECT
        n.nspname AS schema_name,
        t.relname AS table_name,
        i.relname AS index_name,
        ix.indkey::text AS index_keys,
        COALESCE(pg_get_expr(ix.indpred, ix.indrelid), '') AS partial_condition,
        COALESCE(pg_get_expr(ix.indexprs, ix.indrelid), '') AS expression_definition
    FROM pg_index ix
    JOIN pg_class t ON t.oid = ix.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_class i ON i.oid = ix.indexrelid
    WHERE n.nspname = 'blockchain'
      AND t.relname IN ('blockchain_history', 'blockchain_history_attempts')
)
SELECT
    table_name,
    index_keys,
    partial_condition,
    expression_definition,
    COUNT(*) AS index_count,
    STRING_AGG(index_name, ', ' ORDER BY index_name) AS indexes
FROM idx
GROUP BY table_name, index_keys, partial_condition, expression_definition
HAVING COUNT(*) > 1
ORDER BY table_name, index_keys;

SELECT '===== PHASE 7 DBA VALIDATION 4. TOTAL INDEX COUNT =====' AS section;

SELECT
    tablename,
    COUNT(*) AS index_count
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND tablename IN ('blockchain_history', 'blockchain_history_attempts')
GROUP BY tablename
ORDER BY tablename;

SELECT '===== PHASE 7 DBA VALIDATION 5. ANALYZE TABLES =====' AS section;

ANALYZE blockchain.blockchain_history;
ANALYZE blockchain.blockchain_history_attempts;

SELECT 'ANALYZE completed' AS analyze_status;

SELECT '===== PHASE 7 DBA VALIDATION 6. EXPLAIN CHECKS =====' AS section;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE source_record_id = 'TEST_SOURCE_ID';

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE module_name = 'TEST_MODULE'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC, blockchain_history_id DESC;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE module_name = 'TEST_MODULE'
  AND submitted_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY submitted_at DESC, blockchain_history_id DESC;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE blockchain_status = 'FAILED'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC, blockchain_history_id DESC;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE verification_status = 'FAILED'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY created_at DESC, blockchain_history_id DESC;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE blockchain_status IN ('PENDING', 'FAILED')
ORDER BY updated_at ASC, blockchain_history_id ASC
LIMIT 100;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history
WHERE verification_status IN ('FAILED', 'MISMATCH')
ORDER BY updated_at ASC, blockchain_history_id ASC
LIMIT 100;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history_attempts
WHERE source_record_id = 'TEST_SOURCE_ID';

EXPLAIN
SELECT *
FROM blockchain.blockchain_history_attempts
WHERE module_name = 'TEST_MODULE'
  AND started_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY started_at DESC, blockchain_history_attempt_id DESC;

EXPLAIN
SELECT *
FROM blockchain.blockchain_history_attempts
WHERE blockchain_status = 'FAILED'
  AND verification_status = 'FAILED'
  AND started_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY started_at DESC, blockchain_history_attempt_id DESC;

SELECT '===== PHASE 7 DBA VALIDATION 7. FINAL TABLE COUNTS =====' AS section;

SELECT 'blockchain.blockchain_history' AS object_name, COUNT(*) AS row_count
FROM blockchain.blockchain_history
UNION ALL
SELECT 'blockchain.blockchain_history_attempts', COUNT(*)
FROM blockchain.blockchain_history_attempts
ORDER BY object_name;
