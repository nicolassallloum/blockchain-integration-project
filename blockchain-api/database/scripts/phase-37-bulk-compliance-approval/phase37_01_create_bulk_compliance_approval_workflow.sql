\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.data_change_bulk_approval_batches (
  bulk_approval_id BIGSERIAL PRIMARY KEY,
  bulk_approval_key TEXT NOT NULL UNIQUE,
  batch_name TEXT NOT NULL,
  batch_description TEXT,
  batch_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL',
  batch_decision TEXT NOT NULL DEFAULT 'PENDING',
  approval_scope TEXT NOT NULL DEFAULT 'DATA_CHANGE_AUDIT',
  selection_filter JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_item_count INTEGER NOT NULL DEFAULT 0,
  pending_item_count INTEGER NOT NULL DEFAULT 0,
  approved_item_count INTEGER NOT NULL DEFAULT 0,
  rejected_item_count INTEGER NOT NULL DEFAULT 0,
  skipped_item_count INTEGER NOT NULL DEFAULT 0,
  risk_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_by TEXT NOT NULL DEFAULT CURRENT_USER,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejected_by TEXT,
  rejected_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_bulk_approval_batch_status
    CHECK (batch_status IN (
      'PENDING_APPROVAL',
      'APPROVED',
      'PARTIALLY_APPROVED',
      'REJECTED',
      'CANCELLED',
      'CLOSED'
    )),
  CONSTRAINT chk_dc_bulk_approval_batch_decision
    CHECK (batch_decision IN (
      'PENDING',
      'APPROVED',
      'PARTIALLY_APPROVED',
      'REJECTED',
      'CANCELLED',
      'CLOSED'
    ))
);

CREATE TABLE IF NOT EXISTS blockchain.data_change_bulk_approval_items (
  bulk_approval_item_id BIGSERIAL PRIMARY KEY,
  bulk_approval_id BIGINT NOT NULL REFERENCES blockchain.data_change_bulk_approval_batches(bulk_approval_id) ON DELETE CASCADE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  item_status TEXT NOT NULL DEFAULT 'PENDING',
  item_decision TEXT NOT NULL DEFAULT 'PENDING',
  previous_approval_status TEXT,
  previous_compliance_status TEXT,
  previous_compliance_rule_status TEXT,
  previous_compliance_rule_decision TEXT,
  previous_high_risk_alert_status TEXT,
  previous_invalid_review_status TEXT,
  previous_reactivation_status TEXT,
  safety_result TEXT NOT NULL DEFAULT 'NOT_CHECKED',
  safety_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  applied_by TEXT,
  applied_at TIMESTAMPTZ,
  item_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_bulk_approval_item_status
    CHECK (item_status IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
  CONSTRAINT chk_dc_bulk_approval_item_decision
    CHECK (item_decision IN ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED')),
  CONSTRAINT chk_dc_bulk_approval_item_safety
    CHECK (safety_result IN ('NOT_CHECKED', 'SAFE', 'UNSAFE', 'OVERRIDDEN'))
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS bulk_approval_batch_id BIGINT,
  ADD COLUMN IF NOT EXISTS bulk_approval_status TEXT NOT NULL DEFAULT 'NOT_IN_BULK',
  ADD COLUMN IF NOT EXISTS bulk_approval_decision TEXT,
  ADD COLUMN IF NOT EXISTS bulk_approval_requested_by TEXT,
  ADD COLUMN IF NOT EXISTS bulk_approval_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bulk_approval_applied_by TEXT,
  ADD COLUMN IF NOT EXISTS bulk_approval_applied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bulk_approval_notes TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_data_change_audit_bulk_approval_batch'
      AND conrelid = 'blockchain.data_change_audit'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_audit
      ADD CONSTRAINT fk_data_change_audit_bulk_approval_batch
      FOREIGN KEY (bulk_approval_batch_id)
      REFERENCES blockchain.data_change_bulk_approval_batches(bulk_approval_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dc_bulk_approval_item_batch_audit
  ON blockchain.data_change_bulk_approval_items (bulk_approval_id, audit_id);

CREATE INDEX IF NOT EXISTS idx_dc_bulk_approval_batches_status
  ON blockchain.data_change_bulk_approval_batches (batch_status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_bulk_approval_batches_decision
  ON blockchain.data_change_bulk_approval_batches (batch_decision, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_bulk_approval_items_batch_status
  ON blockchain.data_change_bulk_approval_items (bulk_approval_id, item_status);

CREATE INDEX IF NOT EXISTS idx_dc_bulk_approval_items_audit
  ON blockchain.data_change_bulk_approval_items (audit_id);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_bulk_approval_status
  ON blockchain.data_change_audit (bulk_approval_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_bulk_approval_batch
  ON blockchain.data_change_audit (bulk_approval_batch_id)
  WHERE bulk_approval_batch_id IS NOT NULL;

CREATE OR REPLACE VIEW blockchain.v_data_change_bulk_approval_summary AS
SELECT
  COUNT(*)::INTEGER AS total_batches,
  COUNT(*) FILTER (WHERE batch_status = 'PENDING_APPROVAL')::INTEGER AS pending_batches,
  COUNT(*) FILTER (WHERE batch_status = 'APPROVED')::INTEGER AS approved_batches,
  COUNT(*) FILTER (WHERE batch_status = 'PARTIALLY_APPROVED')::INTEGER AS partially_approved_batches,
  COUNT(*) FILTER (WHERE batch_status = 'REJECTED')::INTEGER AS rejected_batches,
  COALESCE(SUM(total_item_count), 0)::INTEGER AS total_items,
  COALESCE(SUM(pending_item_count), 0)::INTEGER AS pending_items,
  COALESCE(SUM(approved_item_count), 0)::INTEGER AS approved_items,
  COALESCE(SUM(rejected_item_count), 0)::INTEGER AS rejected_items,
  COALESCE(SUM(skipped_item_count), 0)::INTEGER AS skipped_items,
  MAX(requested_at) AS latest_requested_at,
  MAX(approved_at) AS latest_approved_at
FROM blockchain.data_change_bulk_approval_batches;

COMMENT ON TABLE blockchain.data_change_bulk_approval_batches IS
  'Phase 37 bulk compliance approval batches for large data-change audit approval queues.';

COMMENT ON TABLE blockchain.data_change_bulk_approval_items IS
  'Phase 37 individual audit events included in a bulk compliance approval batch.';

COMMENT ON COLUMN blockchain.data_change_audit.bulk_approval_status IS
  'Current Phase 37 bulk approval status for an audit event.';

COMMIT;
