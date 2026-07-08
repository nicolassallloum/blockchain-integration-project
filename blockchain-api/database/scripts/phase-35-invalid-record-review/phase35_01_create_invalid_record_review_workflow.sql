\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.data_change_invalid_record_reviews (
  review_id BIGSERIAL PRIMARY KEY,
  review_key TEXT NOT NULL UNIQUE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  invalid_status TEXT NOT NULL,
  review_status TEXT NOT NULL DEFAULT 'UNDER_COMPLIANCE_REVIEW',
  review_decision TEXT NOT NULL DEFAULT 'PENDING',
  reactivation_status TEXT NOT NULL DEFAULT 'NOT_REACTIVATED',
  invalid_reason TEXT NOT NULL,
  detected_by TEXT NOT NULL DEFAULT CURRENT_USER,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  original_validation_status TEXT,
  original_blockchain_status TEXT,
  original_compliance_status TEXT,
  original_approval_status TEXT,
  original_audit_event_hash TEXT,
  original_blockchain_key TEXT,
  original_blockchain_transaction_id TEXT,
  original_batch_blockchain_transaction_id TEXT,
  corrected_audit_event_hash TEXT,
  corrected_blockchain_key TEXT,
  corrected_blockchain_transaction_id TEXT,
  correction_notes TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT true,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  submitted_by TEXT,
  submitted_at TIMESTAMPTZ,
  reactivated_by TEXT,
  reactivated_at TIMESTAMPTZ,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  closure_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_invalid_review_invalid_status
    CHECK (invalid_status IN ('MISMATCH', 'MISMATCHED', 'TAMPERED', 'NOT_FOUND', 'FAILED', 'NOT_VALID', 'INVALID')),
  CONSTRAINT chk_dc_invalid_review_review_status
    CHECK (review_status IN (
      'UNDER_COMPLIANCE_REVIEW',
      'APPROVED_CORRECTED_VERSION',
      'REJECTED',
      'NEW_PROOF_SUBMITTED',
      'VERIFIED_ACTIVE',
      'CLOSED'
    )),
  CONSTRAINT chk_dc_invalid_review_decision
    CHECK (review_decision IN (
      'PENDING',
      'APPROVED_CORRECTED_VERSION',
      'REJECTED',
      'REACTIVATED',
      'CLOSED'
    )),
  CONSTRAINT chk_dc_invalid_review_reactivation_status
    CHECK (reactivation_status IN (
      'NOT_REACTIVATED',
      'APPROVED_CORRECTION',
      'NEW_PROOF_SUBMITTED',
      'REACTIVATED',
      'REJECTED'
    ))
);

CREATE TABLE IF NOT EXISTS blockchain.data_change_invalid_record_review_actions (
  action_id BIGSERIAL PRIMARY KEY,
  review_id BIGINT NOT NULL REFERENCES blockchain.data_change_invalid_record_reviews(review_id) ON DELETE CASCADE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  previous_review_status TEXT,
  new_review_status TEXT,
  previous_reactivation_status TEXT,
  new_reactivation_status TEXT,
  action_by TEXT NOT NULL DEFAULT CURRENT_USER,
  action_notes TEXT,
  action_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_invalid_review_action_type
    CHECK (action_type IN (
      'OPEN_REVIEW',
      'APPROVE_CORRECTED_VERSION',
      'REJECT_REACTIVATION',
      'MARK_NEW_PROOF_SUBMITTED',
      'REACTIVATE_RECORD',
      'CLOSE_REVIEW'
    ))
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS invalid_review_id BIGINT,
  ADD COLUMN IF NOT EXISTS invalid_status TEXT,
  ADD COLUMN IF NOT EXISTS invalid_reason TEXT,
  ADD COLUMN IF NOT EXISTS invalid_review_status TEXT NOT NULL DEFAULT 'NO_REVIEW',
  ADD COLUMN IF NOT EXISTS reactivation_status TEXT NOT NULL DEFAULT 'NOT_REACTIVATED',
  ADD COLUMN IF NOT EXISTS corrected_audit_event_hash TEXT,
  ADD COLUMN IF NOT EXISTS corrected_blockchain_key TEXT,
  ADD COLUMN IF NOT EXISTS corrected_blockchain_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS invalid_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invalid_resolved_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_data_change_audit_invalid_review'
      AND conrelid = 'blockchain.data_change_audit'::regclass
  ) THEN
    ALTER TABLE blockchain.data_change_audit
      ADD CONSTRAINT fk_data_change_audit_invalid_review
      FOREIGN KEY (invalid_review_id)
      REFERENCES blockchain.data_change_invalid_record_reviews(review_id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_dc_invalid_reviews_current_audit
  ON blockchain.data_change_invalid_record_reviews (audit_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_dc_invalid_reviews_status
  ON blockchain.data_change_invalid_record_reviews (review_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_invalid_reviews_invalid_status
  ON blockchain.data_change_invalid_record_reviews (invalid_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_invalid_reviews_reactivation
  ON blockchain.data_change_invalid_record_reviews (reactivation_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_invalid_review_actions_review
  ON blockchain.data_change_invalid_record_review_actions (review_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_invalid_review_status
  ON blockchain.data_change_audit (invalid_review_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_reactivation_status
  ON blockchain.data_change_audit (reactivation_status, changed_at DESC);

CREATE OR REPLACE VIEW blockchain.v_data_change_invalid_record_review_summary AS
SELECT
  COUNT(*)::INTEGER AS total_reviews,
  COUNT(*) FILTER (WHERE review_status = 'UNDER_COMPLIANCE_REVIEW')::INTEGER AS under_review,
  COUNT(*) FILTER (WHERE review_status = 'APPROVED_CORRECTED_VERSION')::INTEGER AS approved_corrected_versions,
  COUNT(*) FILTER (WHERE review_status = 'NEW_PROOF_SUBMITTED')::INTEGER AS new_proof_submitted,
  COUNT(*) FILTER (WHERE review_status = 'VERIFIED_ACTIVE')::INTEGER AS verified_active,
  COUNT(*) FILTER (WHERE review_status = 'REJECTED')::INTEGER AS rejected,
  COUNT(*) FILTER (WHERE reactivation_status = 'REACTIVATED')::INTEGER AS reactivated_records,
  MAX(created_at) AS latest_review_at,
  MAX(reactivated_at) AS latest_reactivated_at
FROM blockchain.data_change_invalid_record_reviews;

COMMENT ON TABLE blockchain.data_change_invalid_record_reviews IS
  'Phase 35 compliance workflow for invalid, mismatched, tampered, or not-found audit records.';

COMMENT ON COLUMN blockchain.data_change_invalid_record_reviews.corrected_audit_event_hash IS
  'Corrected proof hash approved by compliance before reactivation.';

COMMENT ON COLUMN blockchain.data_change_audit.invalid_review_status IS
  'Current invalid-record review state for the audit event.';

COMMIT;
