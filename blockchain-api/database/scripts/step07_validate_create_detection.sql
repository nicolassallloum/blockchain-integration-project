/*
STEP 7 — Validate CREATE Detection

Purpose:
Detect records from blockchain.valoores_aml_rules_sync that do not yet exist
in blockchain.blockchain_sync_history.

This script does not insert or update data.
*/

-- 1. Check duplicate AML source keys
SELECT
    rule_id,
    rule_query_id,
    COUNT(*) AS duplicate_count
FROM blockchain.valoores_aml_rules_sync
GROUP BY rule_id, rule_query_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. Count total AML source records
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;

-- 3. Count existing AML records in sync history
SELECT
    COUNT(DISTINCT source_record_id) AS existing_aml_history_records
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML';

-- 4. Detect AML CREATE candidates
WITH source_records AS (
    SELECT
        rule_id,
        rule_query_id,
        CONCAT_WS('::', rule_id::TEXT, rule_query_id::TEXT) AS source_record_id
    FROM blockchain.valoores_aml_rules_sync
),
existing_history AS (
    SELECT DISTINCT
        source_record_id
    FROM blockchain.blockchain_sync_history
    WHERE record_type = 'AML'
)
SELECT
    COUNT(*) AS create_candidate_count
FROM source_records src
LEFT JOIN existing_history hist
    ON hist.source_record_id = src.source_record_id
WHERE hist.source_record_id IS NULL;

-- 5. Preview AML CREATE candidates
WITH source_records AS (
    SELECT
        rule_id,
        rule_query_id,
        CONCAT_WS('::', rule_id::TEXT, rule_query_id::TEXT) AS source_record_id
    FROM blockchain.valoores_aml_rules_sync
),
existing_history AS (
    SELECT DISTINCT
        source_record_id
    FROM blockchain.blockchain_sync_history
    WHERE record_type = 'AML'
)
SELECT
    src.rule_id,
    src.rule_query_id,
    src.source_record_id
FROM source_records src
LEFT JOIN existing_history hist
    ON hist.source_record_id = src.source_record_id
WHERE hist.source_record_id IS NULL
ORDER BY src.source_record_id
LIMIT 10;
