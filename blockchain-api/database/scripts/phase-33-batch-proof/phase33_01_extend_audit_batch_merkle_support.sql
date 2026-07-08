\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

ALTER TABLE blockchain.data_change_audit_batches
  ADD COLUMN IF NOT EXISTS proof_type TEXT NOT NULL DEFAULT 'AUDIT_BATCH_MERKLE_ROOT',
  ADD COLUMN IF NOT EXISTS batch_hash TEXT,
  ADD COLUMN IF NOT EXISTS merkle_root_hash TEXT,
  ADD COLUMN IF NOT EXISTS merkle_leaf_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  ADD COLUMN IF NOT EXISTS hash_version TEXT NOT NULL DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS batch_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS batch_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS submitted_by TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blockchain_error TEXT,
  ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS blockchain.data_change_audit_batch_items (
  batch_item_id BIGSERIAL PRIMARY KEY,
  batch_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit_batches(batch_id) ON DELETE CASCADE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  leaf_index INTEGER NOT NULL,
  audit_event_hash TEXT NOT NULL,
  merkle_leaf_hash TEXT NOT NULL,
  merkle_proof JSONB NOT NULL DEFAULT '[]'::jsonb,
  verification_status TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_data_change_audit_batch_items_leaf_index CHECK (leaf_index >= 0),
  CONSTRAINT uq_data_change_audit_batch_items_batch_audit UNIQUE (batch_id, audit_id),
  CONSTRAINT uq_data_change_audit_batch_items_batch_leaf UNIQUE (batch_id, leaf_index)
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS batch_merkle_root_hash TEXT,
  ADD COLUMN IF NOT EXISTS batch_merkle_leaf_hash TEXT,
  ADD COLUMN IF NOT EXISTS batch_merkle_proof JSONB,
  ADD COLUMN IF NOT EXISTS batch_verification_status TEXT NOT NULL DEFAULT 'NOT_BATCHED',
  ADD COLUMN IF NOT EXISTS batch_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS batch_proof_checked_at TIMESTAMPTZ;

ALTER TABLE blockchain.data_change_blockchain_outbox
  ADD COLUMN IF NOT EXISTS proof_mode TEXT NOT NULL DEFAULT 'SINGLE_EVENT',
  ADD COLUMN IF NOT EXISTS batch_key TEXT,
  ADD COLUMN IF NOT EXISTS batch_merkle_root_hash TEXT,
  ADD COLUMN IF NOT EXISTS batch_hash TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_data_change_audit_audit_batch'
      AND conrelid = 'blockchain.data_change_audit'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_audit
      ADD CONSTRAINT fk_data_change_audit_audit_batch
      FOREIGN KEY (audit_batch_id)
      REFERENCES blockchain.data_change_audit_batches(batch_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_data_change_outbox_audit_batch'
      AND conrelid = 'blockchain.data_change_blockchain_outbox'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_blockchain_outbox
      ADD CONSTRAINT fk_data_change_outbox_audit_batch
      FOREIGN KEY (audit_batch_id)
      REFERENCES blockchain.data_change_audit_batches(batch_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_data_change_outbox_proof_mode'
      AND conrelid = 'blockchain.data_change_blockchain_outbox'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_blockchain_outbox
      ADD CONSTRAINT chk_data_change_outbox_proof_mode
      CHECK (proof_mode IN ('SINGLE_EVENT', 'BATCH_MERKLE_ROOT', 'BATCH_ITEM'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_data_change_batch_verification_status'
      AND conrelid = 'blockchain.data_change_audit_batches'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_audit_batches
      ADD CONSTRAINT chk_data_change_batch_verification_status
      CHECK (verification_status IN ('NOT_VERIFIED', 'VERIFIED', 'MISMATCH', 'NOT_FOUND', 'TAMPERED', 'FAILED'));
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_data_change_audit_batches_blockchain_key
  ON blockchain.data_change_audit_batches (blockchain_key)
  WHERE blockchain_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batches_batch_hash
  ON blockchain.data_change_audit_batches (batch_hash)
  WHERE batch_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batches_merkle_root
  ON blockchain.data_change_audit_batches (merkle_root_hash)
  WHERE merkle_root_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batches_verification
  ON blockchain.data_change_audit_batches (verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_items_audit_id
  ON blockchain.data_change_audit_batch_items (audit_id);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_items_leaf_hash
  ON blockchain.data_change_audit_batch_items (merkle_leaf_hash);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_items_status
  ON blockchain.data_change_audit_batch_items (verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_audit_batch_id
  ON blockchain.data_change_audit (audit_batch_id)
  WHERE audit_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_verification_status
  ON blockchain.data_change_audit (batch_verification_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_batch_leaf_hash
  ON blockchain.data_change_audit (batch_merkle_leaf_hash)
  WHERE batch_merkle_leaf_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_audit_batch_id
  ON blockchain.data_change_blockchain_outbox (audit_batch_id)
  WHERE audit_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_proof_mode_status
  ON blockchain.data_change_blockchain_outbox (proof_mode, status, created_at);

CREATE OR REPLACE VIEW blockchain.v_data_change_audit_batch_proof_summary AS
SELECT
  b.batch_id,
  b.batch_key,
  b.module_name,
  b.batch_status,
  b.blockchain_status,
  b.verification_status,
  b.proof_type,
  b.audit_count,
  b.merkle_leaf_count,
  b.batch_hash,
  b.merkle_root_hash,
  b.blockchain_key,
  b.blockchain_transaction_id,
  b.created_by,
  b.created_at,
  b.closed_at,
  b.submitted_at,
  b.blockchain_submitted_at,
  b.verified_at,
  COUNT(i.batch_item_id)::INTEGER AS mapped_item_count,
  MIN(i.audit_id) AS first_item_audit_id,
  MAX(i.audit_id) AS last_item_audit_id
FROM blockchain.data_change_audit_batches b
LEFT JOIN blockchain.data_change_audit_batch_items i
  ON i.batch_id = b.batch_id
GROUP BY b.batch_id;

COMMENT ON TABLE blockchain.data_change_audit_batch_items IS
  'Maps individual data change audit events into Merkle batch proofs without storing sensitive data on-chain.';

COMMENT ON COLUMN blockchain.data_change_audit_batches.merkle_root_hash IS
  'Merkle root generated from the ordered audit event leaf hashes for batch blockchain proof submission.';

COMMENT ON COLUMN blockchain.data_change_audit_batch_items.merkle_proof IS
  'Sibling path used to verify one audit event inside the batch Merkle root.';

COMMIT;
