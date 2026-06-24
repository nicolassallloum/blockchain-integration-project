/*
STEP 9 — Validate Skip Unchanged Records

Purpose:
Validate base data for unchanged-record detection.

Important:
- Actual hash comparison is done in Node.js.
- This script only validates source/history counts.
- This step does not submit anything to blockchain.
*/

-- 1. Count AML source records
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;

-- 2. Count AML history rows
SELECT
    COUNT(*) AS aml_history_rows
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML';

-- 3. Preview latest AML history rows
SELECT
    history_id,
    record_type,
    source_record_id,
    action_type,
    new_hash,
    sync_status,
    submitted_by,
    created_at
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML'
ORDER BY created_at DESC, history_id DESC
LIMIT 10;
