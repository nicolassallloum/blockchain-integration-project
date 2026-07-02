-- Phase 12 duplicate protection for blockchain history.
-- Prevents duplicate blockchain submissions at the database level.

CREATE UNIQUE INDEX IF NOT EXISTS uq_blockchain_history_blockchain_key
ON blockchain.blockchain_history (blockchain_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_blockchain_history_module_source_action_hash
ON blockchain.blockchain_history (
  module_name,
  source_record_id,
  action_type,
  record_hash
);
