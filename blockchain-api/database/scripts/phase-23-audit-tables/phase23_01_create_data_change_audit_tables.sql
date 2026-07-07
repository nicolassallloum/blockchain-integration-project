\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.data_change_audit (
  audit_id BIGSERIAL PRIMARY KEY,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  primary_key_column TEXT,
  primary_key_value TEXT,
  operation_type TEXT NOT NULL,
  old_row_json JSONB,
  new_row_json JSONB,
  changed_fields JSONB,
  old_row_hash TEXT,
  new_row_hash TEXT,
  audit_event_hash TEXT NOT NULL,
  changed_by_app_user TEXT,
  changed_by_db_user TEXT,
  changed_by_role TEXT,
  client_ip TEXT,
  client_hostname TEXT,
  user_agent TEXT,
  application_name TEXT,
  postgres_transaction_id BIGINT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  blockchain_key TEXT,
  blockchain_transaction_id TEXT,
  blockchain_status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS primary_key_json JSONB,
  ADD COLUMN IF NOT EXISTS source_view_name TEXT,
  ADD COLUMN IF NOT EXISTS audit_batch_id BIGINT,
  ADD COLUMN IF NOT EXISTS blockchain_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS blockchain_error TEXT,
  ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'VALIDATED',
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS compliance_status TEXT DEFAULT 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'data_change_audit_operation_type_check'
      AND conrelid = 'blockchain.data_change_audit'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_audit
      ADD CONSTRAINT data_change_audit_operation_type_check
      CHECK (operation_type IN ('INSERT','UPDATE','DELETE'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS blockchain.data_change_blockchain_outbox (
  outbox_id BIGSERIAL PRIMARY KEY,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  blockchain_key TEXT NOT NULL,
  audit_event_hash TEXT NOT NULL,
  module_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  primary_key_value TEXT,
  operation_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  blockchain_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ
);

ALTER TABLE blockchain.data_change_blockchain_outbox
  ADD COLUMN IF NOT EXISTS schema_name TEXT,
  ADD COLUMN IF NOT EXISTS audit_batch_id BIGINT,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_by TEXT;

CREATE TABLE IF NOT EXISTS blockchain.data_change_audit_batches (
  batch_id BIGSERIAL PRIMARY KEY,
  batch_key TEXT NOT NULL UNIQUE,
  module_name TEXT,
  batch_status TEXT NOT NULL DEFAULT 'OPEN',
  audit_count INTEGER NOT NULL DEFAULT 0,
  pending_count INTEGER NOT NULL DEFAULT 0,
  submitted_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  first_audit_id BIGINT,
  last_audit_id BIGINT,
  first_changed_at TIMESTAMPTZ,
  last_changed_at TIMESTAMPTZ,
  blockchain_key TEXT,
  blockchain_transaction_id TEXT,
  blockchain_status TEXT NOT NULL DEFAULT 'PENDING',
  created_by TEXT DEFAULT current_user,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS blockchain.data_change_audit_config (
  config_id BIGSERIAL PRIMARY KEY,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  primary_key_columns TEXT[],
  source_view_name TEXT,
  audit_enabled BOOLEAN NOT NULL DEFAULT true,
  capture_insert BOOLEAN NOT NULL DEFAULT true,
  capture_update BOOLEAN NOT NULL DEFAULT true,
  capture_delete BOOLEAN NOT NULL DEFAULT true,
  capture_old_row BOOLEAN NOT NULL DEFAULT true,
  capture_new_row BOOLEAN NOT NULL DEFAULT true,
  blockchain_enabled BOOLEAN NOT NULL DEFAULT true,
  sensitive_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  excluded_fields TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_by TEXT DEFAULT current_user,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schema_name, table_name)
);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_table_changed_at
  ON blockchain.data_change_audit(schema_name, table_name, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_blockchain_status
  ON blockchain.data_change_audit(blockchain_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_event_hash
  ON blockchain.data_change_audit(audit_event_hash);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_operation
  ON blockchain.data_change_audit(operation_type, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_status
  ON blockchain.data_change_blockchain_outbox(status, created_at);

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_audit_id
  ON blockchain.data_change_blockchain_outbox(audit_id);

CREATE INDEX IF NOT EXISTS idx_data_change_outbox_blockchain_key
  ON blockchain.data_change_blockchain_outbox(blockchain_key);

CREATE INDEX IF NOT EXISTS idx_data_change_batches_status
  ON blockchain.data_change_audit_batches(batch_status, created_at);

CREATE INDEX IF NOT EXISTS idx_data_change_config_enabled
  ON blockchain.data_change_audit_config(audit_enabled, blockchain_enabled);

COMMENT ON TABLE blockchain.data_change_audit IS
  'Generic PostgreSQL row-level data change audit table for INSERT, UPDATE, and DELETE events.';

COMMENT ON TABLE blockchain.data_change_blockchain_outbox IS
  'Outbox table for data change audit events waiting for blockchain proof submission.';

COMMENT ON TABLE blockchain.data_change_audit_batches IS
  'Batch control table for grouping data change audit events.';

COMMENT ON TABLE blockchain.data_change_audit_config IS
  'Configuration table for generic data change audit trigger behavior per physical table.';

COMMIT;
