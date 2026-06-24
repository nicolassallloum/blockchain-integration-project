/*
STEP 12 — Validate Blockchain Key Format

Purpose:
Validate source record IDs that will be used in blockchain proof keys.

Official key format:
BCPROOF::V1::<RECORD_TYPE>::<SOURCE_RECORD_ID>::<HASH_PREFIX_16>

Example:
BCPROOF::V1::AML::44571::4184::78299a474f0f15dd
*/

-- 1. Preview AML source record IDs
SELECT
    rule_id,
    rule_query_id,
    CONCAT_WS('::', rule_id::TEXT, rule_query_id::TEXT) AS source_record_id
FROM blockchain.valoores_aml_rules_sync
ORDER BY rule_id, rule_query_id
LIMIT 10;

-- 2. Validate source record IDs are not null
SELECT
    COUNT(*) AS invalid_source_record_id_count
FROM blockchain.valoores_aml_rules_sync
WHERE rule_id IS NULL
   OR rule_query_id IS NULL
   OR trim(rule_id::TEXT) = ''
   OR trim(rule_query_id::TEXT) = '';

-- 3. Count AML source records
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;
