\set ON_ERROR_STOP on

BEGIN;

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS batch_blockchain_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS batch_blockchain_submitted_at TIMESTAMPTZ;

ALTER TABLE blockchain.data_change_blockchain_outbox
  ADD COLUMN IF NOT EXISTS batch_blockchain_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS batch_blockchain_submitted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_tx_id
  ON blockchain.data_change_audit (batch_blockchain_transaction_id)
  WHERE batch_blockchain_transaction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_batch_tx_id
  ON blockchain.data_change_blockchain_outbox (batch_blockchain_transaction_id)
  WHERE batch_blockchain_transaction_id IS NOT NULL;

COMMENT ON COLUMN blockchain.data_change_audit.batch_blockchain_transaction_id IS
  'Fabric transaction ID for the batch Merkle root proof submission. Separate from individual event proof transaction ID.';

COMMENT ON COLUMN blockchain.data_change_blockchain_outbox.batch_blockchain_transaction_id IS
  'Fabric transaction ID for the batch Merkle root proof submission. Separate from individual outbox transaction ID.';

COMMIT;
