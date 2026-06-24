/*
STEP 8 — Validate UPDATE Detection

Purpose:
Validate that UPDATE detection has the correct PostgreSQL base data.

This script does not calculate the application hash.
Hash comparison is handled in Node.js to keep the same hash logic used by the backend service.
*/

-- 1. Count total AML source records
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;

-- 2. Count existing AML history records
SELECT
    COUNT(*) AS existing_aml_history_rows
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML';

-- 3. Preview latest AML history records if any
SELECT
    history_id,
    record_type,
    source_record_id,
    action_type,
    new_hash,
    sync_status,
    created_at
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML'
ORDER BY created_at DESC, history_id DESC
LIMIT 10;

-- 4. Preview AML source records
SELECT
    rule_id,
    rule_query_id,
    CONCAT_WS('::', rule_id::TEXT, rule_query_id::TEXT) AS source_record_id
FROM blockchain.valoores_aml_rules_sync
ORDER BY rule_id, rule_query_id
LIMIT 10;
