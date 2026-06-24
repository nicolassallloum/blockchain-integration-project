/*
STEP 10 — Validate Stable Hash Source Data

Purpose:
Validate the AML source data used for stable hash generation.

Important:
- Hash generation is done in Node.js.
- This script validates the source keys and sample source records.
- No data is inserted or updated.
*/

-- 1. Confirm AML source count
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;

-- 2. Confirm no duplicate source keys
SELECT
    rule_id,
    rule_query_id,
    COUNT(*) AS duplicate_count
FROM blockchain.valoores_aml_rules_sync
GROUP BY rule_id, rule_query_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. Preview source records used for hashing
SELECT
    rule_id,
    rule_query_id,
    rule_desc,
    rule_status,
    rule_start_date,
    rule_expiry_date,
    rule_creation_date,
    rule_update_date
FROM blockchain.valoores_aml_rules_sync
ORDER BY rule_id, rule_query_id
LIMIT 10;
