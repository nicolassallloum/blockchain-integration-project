/*
STEP 13 — Validate Proof-Only Submission Readiness

Purpose:
Confirm that source data and history tables are ready before submitting proof only to blockchain.

No data is inserted or updated by this script.
*/

-- 1. Confirm AML source records
SELECT
    COUNT(*) AS total_aml_source_records
FROM blockchain.valoores_aml_rules_sync;

-- 2. Confirm history table is available
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
  AND table_name = 'blockchain_sync_history';

-- 3. Confirm blockchain key column exists
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'blockchain_sync_history'
  AND column_name IN (
      'blockchain_key',
      'blockchain_transaction_id',
      'new_hash',
      'source_record_id',
      'record_type',
      'action_type'
  )
ORDER BY ordinal_position;

-- 4. Confirm no AML history rows currently exist
SELECT
    COUNT(*) AS aml_history_count
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML';
