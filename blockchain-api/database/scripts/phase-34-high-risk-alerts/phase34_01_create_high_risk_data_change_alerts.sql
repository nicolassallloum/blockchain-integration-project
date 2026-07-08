\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.data_change_high_risk_alerts (
  alert_id BIGSERIAL PRIMARY KEY,
  alert_key TEXT NOT NULL UNIQUE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  alert_rule_code TEXT NOT NULL,
  alert_rule_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'HIGH',
  risk_level TEXT NOT NULL DEFAULT 'HIGH',
  risk_score INTEGER NOT NULL DEFAULT 80,
  alert_status TEXT NOT NULL DEFAULT 'OPEN',
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  module_name TEXT NOT NULL,
  operation_type TEXT NOT NULL,
  primary_key_value TEXT,
  changed_fields JSONB,
  alert_reason TEXT NOT NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  blockchain_key TEXT,
  audit_event_hash TEXT,
  audit_batch_id BIGINT,
  blockchain_transaction_id TEXT,
  batch_blockchain_transaction_id TEXT,
  changed_by_app_user TEXT,
  changed_by_db_user TEXT,
  changed_by_role TEXT,
  client_ip TEXT,
  client_hostname TEXT,
  application_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL,
  created_by TEXT NOT NULL DEFAULT CURRENT_USER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  closed_at TIMESTAMPTZ,
  closed_by TEXT,
  closure_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_data_change_high_risk_alerts_audit_rule UNIQUE (audit_id, alert_rule_code),
  CONSTRAINT chk_data_change_high_risk_alerts_severity
    CHECK (severity IN ('MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_data_change_high_risk_alerts_risk_level
    CHECK (risk_level IN ('MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_data_change_high_risk_alerts_status
    CHECK (alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED', 'CLOSED', 'FALSE_POSITIVE'))
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS high_risk_alert_status TEXT NOT NULL DEFAULT 'NO_ALERT',
  ADD COLUMN IF NOT EXISTS high_risk_alert_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS highest_risk_level TEXT,
  ADD COLUMN IF NOT EXISTS highest_risk_score INTEGER,
  ADD COLUMN IF NOT EXISTS latest_high_risk_alert_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dchra_audit_id
  ON blockchain.data_change_high_risk_alerts (audit_id);

CREATE INDEX IF NOT EXISTS idx_dchra_status_created
  ON blockchain.data_change_high_risk_alerts (alert_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dchra_risk_level_created
  ON blockchain.data_change_high_risk_alerts (risk_level, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dchra_rule_code
  ON blockchain.data_change_high_risk_alerts (alert_rule_code);

CREATE INDEX IF NOT EXISTS idx_dchra_table_operation
  ON blockchain.data_change_high_risk_alerts (schema_name, table_name, operation_type, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_dchra_batch_id
  ON blockchain.data_change_high_risk_alerts (audit_batch_id)
  WHERE audit_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_data_change_audit_high_risk_status
  ON blockchain.data_change_audit (high_risk_alert_status, changed_at DESC);

CREATE OR REPLACE VIEW blockchain.v_data_change_high_risk_alerts_summary AS
SELECT
  COUNT(*)::INTEGER AS total_alerts,
  COUNT(*) FILTER (WHERE alert_status IN ('OPEN', 'PENDING_REVIEW', 'UNDER_REVIEW', 'ESCALATED'))::INTEGER AS open_alerts,
  COUNT(*) FILTER (WHERE alert_status = 'CLOSED')::INTEGER AS closed_alerts,
  COUNT(*) FILTER (WHERE risk_level = 'CRITICAL')::INTEGER AS critical_alerts,
  COUNT(*) FILTER (WHERE risk_level = 'HIGH')::INTEGER AS high_alerts,
  COUNT(*) FILTER (WHERE risk_level = 'MEDIUM')::INTEGER AS medium_alerts,
  COUNT(*) FILTER (WHERE alert_status = 'ESCALATED')::INTEGER AS escalated_alerts,
  MAX(created_at) AS latest_alert_at
FROM blockchain.data_change_high_risk_alerts;

COMMENT ON TABLE blockchain.data_change_high_risk_alerts IS
  'Phase 34 high-risk data change alerts generated from PostgreSQL audit events. Blockchain remains proof-only.';

COMMENT ON COLUMN blockchain.data_change_high_risk_alerts.evidence IS
  'Non-sensitive rule evidence for compliance review. Full old/new rows remain in data_change_audit and are redacted by APIs unless privileged.';

COMMIT;
