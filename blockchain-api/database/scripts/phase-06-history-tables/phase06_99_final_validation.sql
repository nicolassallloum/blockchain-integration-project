/*
Phase 6 — Final Validation
Validates blockchain history tables, attempt table, reporting views, relationships, and rollback test.
*/

\pset pager off

SELECT '===== PHASE 6 FINAL 1. REQUIRED TABLES EXIST =====' AS section;

WITH required_tables(table_name) AS (
    VALUES
        ('blockchain_history'),
        ('blockchain_history_attempts')
)
SELECT
    r.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM required_tables r
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'blockchain'
 AND t.table_name = r.table_name
ORDER BY r.table_name;

SELECT '===== PHASE 6 FINAL 2. REQUIRED VIEWS EXIST =====' AS section;

WITH required_views(view_name) AS (
    VALUES
        ('vw_blockchain_history_latest'),
        ('vw_blockchain_history_summary'),
        ('vw_blockchain_history_retry_queue')
)
SELECT
    r.view_name,
    CASE WHEN v.table_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM required_views r
LEFT JOIN information_schema.views v
  ON v.table_schema = 'blockchain'
 AND v.table_name = r.view_name
ORDER BY r.view_name;

SELECT '===== PHASE 6 FINAL 3. TABLE ROW COUNTS =====' AS section;

SELECT 'blockchain.blockchain_history' AS object_name, COUNT(*) AS row_count
FROM blockchain.blockchain_history
UNION ALL
SELECT 'blockchain.blockchain_history_attempts', COUNT(*)
FROM blockchain.blockchain_history_attempts
ORDER BY object_name;

SELECT '===== PHASE 6 FINAL 4. VIEW ROW COUNTS =====' AS section;

SELECT 'blockchain.vw_blockchain_history_latest' AS object_name, COUNT(*) AS row_count
FROM blockchain.vw_blockchain_history_latest
UNION ALL
SELECT 'blockchain.vw_blockchain_history_summary', COUNT(*)
FROM blockchain.vw_blockchain_history_summary
UNION ALL
SELECT 'blockchain.vw_blockchain_history_retry_queue', COUNT(*)
FROM blockchain.vw_blockchain_history_retry_queue
ORDER BY object_name;

SELECT '===== PHASE 6 FINAL 5. MAIN TABLE REQUIRED COLUMNS =====' AS section;

WITH required_columns(column_name) AS (
    VALUES
        ('module_name'),
        ('source_record_id'),
        ('blockchain_key'),
        ('record_hash'),
        ('hash_version'),
        ('action_type'),
        ('approval_status'),
        ('blockchain_status'),
        ('blockchain_transaction_id'),
        ('submitted_by'),
        ('submitted_at'),
        ('verified_at'),
        ('verification_status'),
        ('error_message'),
        ('retry_count'),
        ('created_at'),
        ('updated_at')
)
SELECT
    r.column_name,
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'blockchain'
 AND c.table_name = 'blockchain_history'
 AND c.column_name = r.column_name
ORDER BY r.column_name;

SELECT '===== PHASE 6 FINAL 6. ATTEMPT TABLE REQUIRED COLUMNS =====' AS section;

WITH required_columns(column_name) AS (
    VALUES
        ('blockchain_history_attempt_id'),
        ('blockchain_history_id'),
        ('module_name'),
        ('source_record_id'),
        ('blockchain_key'),
        ('attempt_no'),
        ('attempt_type'),
        ('blockchain_status'),
        ('verification_status'),
        ('blockchain_transaction_id'),
        ('error_code'),
        ('error_message'),
        ('error_detail_fingerprint'),
        ('request_id'),
        ('worker_name'),
        ('started_at'),
        ('finished_at'),
        ('duration_ms'),
        ('created_by'),
        ('created_at')
)
SELECT
    r.column_name,
    CASE WHEN c.column_name IS NOT NULL THEN 'EXISTS' ELSE 'MISSING' END AS status
FROM required_columns r
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'blockchain'
 AND c.table_name = 'blockchain_history_attempts'
 AND c.column_name = r.column_name
ORDER BY r.column_name;

SELECT '===== PHASE 6 FINAL 7. FK / INDEX SUMMARY =====' AS section;

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'blockchain'
  AND tc.table_name IN ('blockchain_history', 'blockchain_history_attempts')
  AND tc.constraint_type IN ('PRIMARY KEY', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

SELECT '===== PHASE 6 FINAL 8. INDEXES =====' AS section;

SELECT
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND tablename IN ('blockchain_history', 'blockchain_history_attempts')
ORDER BY tablename, indexname;

SELECT '===== PHASE 6 FINAL 9. END-TO-END ROLLBACK TEST =====' AS section;

BEGIN;

WITH parent_insert AS (
    INSERT INTO blockchain.blockchain_history (
        module_name,
        source_record_id,
        blockchain_key,
        record_hash,
        hash_version,
        action_type,
        approval_status,
        blockchain_status,
        blockchain_transaction_id,
        submitted_by,
        submitted_at,
        verified_at,
        verification_status,
        error_message,
        retry_count
    )
    VALUES
        (
            'PHASE6_FINAL_TEST',
            'FINAL_SOURCE_001',
            'PHASE6_FINAL_KEY_001',
            'dddddddddddddddddddddddddddddddd',
            'md5-v1',
            'SUBMIT',
            'APPROVED',
            'CONFIRMED',
            'FINAL_TX_ID_001',
            'phase6_validation',
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP,
            'VERIFIED',
            NULL,
            0
        ),
        (
            'PHASE6_FINAL_TEST',
            'FINAL_SOURCE_002',
            'PHASE6_FINAL_KEY_002',
            'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
            'md5-v1',
            'SUBMIT',
            'APPROVED',
            'FAILED',
            NULL,
            'phase6_validation',
            CURRENT_TIMESTAMP,
            NULL,
            'FAILED',
            'Final validation simulated failure',
            1
        )
    RETURNING blockchain_history_id, module_name, source_record_id, blockchain_key
),
attempt_insert AS (
    INSERT INTO blockchain.blockchain_history_attempts (
        blockchain_history_id,
        module_name,
        source_record_id,
        blockchain_key,
        attempt_no,
        attempt_type,
        blockchain_status,
        verification_status,
        blockchain_transaction_id,
        error_code,
        error_message,
        error_detail_fingerprint,
        request_id,
        worker_name,
        started_at,
        finished_at,
        duration_ms,
        created_by
    )
    SELECT
        blockchain_history_id,
        module_name,
        source_record_id,
        blockchain_key,
        1,
        CASE WHEN source_record_id = 'FINAL_SOURCE_001' THEN 'VERIFY' ELSE 'SUBMIT' END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_001' THEN 'CONFIRMED' ELSE 'FAILED' END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_001' THEN 'VERIFIED' ELSE 'FAILED' END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_001' THEN 'FINAL_TX_ID_001' ELSE NULL END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_002' THEN 'FINAL_TEST_ERROR' ELSE NULL END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_002' THEN 'Final validation simulated failure' ELSE NULL END,
        CASE WHEN source_record_id = 'FINAL_SOURCE_002' THEN MD5('Final validation simulated failure detail') ELSE NULL END,
        'REQ_PHASE6_FINAL_TEST',
        'phase6-final-worker',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP,
        700,
        'phase6_validation'
    FROM parent_insert
    RETURNING blockchain_history_attempt_id
)
SELECT COUNT(*) AS inserted_attempt_rows
FROM attempt_insert;

SELECT 'LATEST_VIEW_FINAL_TEST' AS test_name, COUNT(*) AS row_count
FROM blockchain.vw_blockchain_history_latest
WHERE module_name = 'PHASE6_FINAL_TEST';

SELECT 'SUMMARY_VIEW_FINAL_TEST' AS test_name, *
FROM blockchain.vw_blockchain_history_summary
WHERE module_name = 'PHASE6_FINAL_TEST';

SELECT 'RETRY_QUEUE_FINAL_TEST' AS test_name, COUNT(*) AS retry_queue_rows
FROM blockchain.vw_blockchain_history_retry_queue
WHERE module_name = 'PHASE6_FINAL_TEST';

ROLLBACK;

SELECT '===== PHASE 6 FINAL 10. CLEANUP CONFIRMATION =====' AS section;

SELECT
    (SELECT COUNT(*) FROM blockchain.blockchain_history WHERE module_name = 'PHASE6_FINAL_TEST') AS remaining_history_test_rows,
    (SELECT COUNT(*) FROM blockchain.blockchain_history_attempts WHERE module_name = 'PHASE6_FINAL_TEST') AS remaining_attempt_test_rows;
