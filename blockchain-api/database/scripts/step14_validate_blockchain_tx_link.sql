/*
STEP 14 — Validate Blockchain Transaction ID Link

Purpose:
Confirm PostgreSQL history table supports linking Fabric transaction IDs.

No data is inserted or updated by this script.
*/

-- 1. Confirm required columns exist
SELECT
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'blockchain_sync_history'
  AND column_name IN (
      'history_id',
      'record_type',
      'source_record_id',
      'new_hash',
      'blockchain_key',
      'blockchain_transaction_id',
      'sync_status',
      'submitted_by',
      'metadata',
      'created_at',
      'updated_at'
  )
ORDER BY ordinal_position;

-- 2. Confirm AML history rows before Step 14 test
SELECT
    COUNT(*) AS aml_history_count
FROM blockchain.blockchain_sync_history
WHERE record_type = 'AML';

-- 3. Confirm there are no leftover Step 14 test rows
SELECT
    COUNT(*) AS step14_test_rows
FROM blockchain.blockchain_sync_history
WHERE submitted_by = 'step14-transaction-link-test'
   OR metadata->>'step' = 'STEP_14';
