\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.data_change_compliance_rules (
  rule_id BIGSERIAL PRIMARY KEY,
  rule_code TEXT NOT NULL UNIQUE,
  rule_name TEXT NOT NULL,
  rule_description TEXT,
  rule_category TEXT NOT NULL DEFAULT 'COMPLIANCE_PROOF',
  rule_scope TEXT NOT NULL DEFAULT 'DATA_CHANGE_AUDIT',
  rule_priority INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  decision TEXT NOT NULL DEFAULT 'MANUAL_REVIEW',
  risk_level TEXT NOT NULL DEFAULT 'MEDIUM',
  risk_score INTEGER NOT NULL DEFAULT 50,
  requires_manual_review BOOLEAN NOT NULL DEFAULT true,
  proof_required BOOLEAN NOT NULL DEFAULT true,
  auto_apply BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL DEFAULT CURRENT_USER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_compliance_rules_decision
    CHECK (decision IN ('AUTO_APPROVE', 'MANUAL_REVIEW', 'BLOCK', 'REJECT', 'PROOF_REQUIRED', 'NO_ACTION')),
  CONSTRAINT chk_dc_compliance_rules_risk_level
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_dc_compliance_rules_score
    CHECK (risk_score BETWEEN 0 AND 100)
);

CREATE TABLE IF NOT EXISTS blockchain.data_change_compliance_rule_evaluations (
  evaluation_id BIGSERIAL PRIMARY KEY,
  evaluation_key TEXT NOT NULL UNIQUE,
  audit_id BIGINT NOT NULL REFERENCES blockchain.data_change_audit(audit_id) ON DELETE CASCADE,
  rule_id BIGINT REFERENCES blockchain.data_change_compliance_rules(rule_id) ON DELETE SET NULL,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_result TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  risk_score INTEGER NOT NULL,
  evaluation_reason TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  applied_to_audit BOOLEAN NOT NULL DEFAULT false,
  evaluated_by TEXT NOT NULL DEFAULT CURRENT_USER,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_dc_compliance_eval_result
    CHECK (rule_result IN ('MATCHED', 'NOT_MATCHED', 'SKIPPED')),
  CONSTRAINT chk_dc_compliance_eval_decision
    CHECK (decision IN ('AUTO_APPROVE', 'MANUAL_REVIEW', 'BLOCK', 'REJECT', 'PROOF_REQUIRED', 'NO_ACTION')),
  CONSTRAINT chk_dc_compliance_eval_risk_level
    CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT chk_dc_compliance_eval_score
    CHECK (risk_score BETWEEN 0 AND 100)
);

ALTER TABLE blockchain.data_change_audit
  ADD COLUMN IF NOT EXISTS compliance_rule_status TEXT NOT NULL DEFAULT 'NOT_EVALUATED',
  ADD COLUMN IF NOT EXISTS compliance_rule_decision TEXT,
  ADD COLUMN IF NOT EXISTS compliance_rule_score INTEGER,
  ADD COLUMN IF NOT EXISTS compliance_rule_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS compliance_rule_evaluated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS compliance_rule_evaluated_by TEXT;

CREATE INDEX IF NOT EXISTS idx_dc_compliance_rules_active_priority
  ON blockchain.data_change_compliance_rules (is_active, rule_priority, rule_code);

CREATE INDEX IF NOT EXISTS idx_dc_compliance_eval_audit
  ON blockchain.data_change_compliance_rule_evaluations (audit_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_compliance_eval_rule
  ON blockchain.data_change_compliance_rule_evaluations (rule_code, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_compliance_eval_decision
  ON blockchain.data_change_compliance_rule_evaluations (decision, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_compliance_rule_status
  ON blockchain.data_change_audit (compliance_rule_status, changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_data_change_audit_compliance_rule_decision
  ON blockchain.data_change_audit (compliance_rule_decision, changed_at DESC);

INSERT INTO blockchain.data_change_compliance_rules (
  rule_code,
  rule_name,
  rule_description,
  rule_category,
  rule_priority,
  condition_json,
  decision,
  risk_level,
  risk_score,
  requires_manual_review,
  proof_required,
  auto_apply,
  created_by
)
VALUES
(
  'INVALID_REVIEW_REQUIRES_MANUAL_APPROVAL',
  'Invalid review requires manual approval',
  'Any audit event under invalid-record review must remain under manual compliance review.',
  'INVALID_RECORD_REVIEW',
  10,
  '{"invalidReviewStatuses":["UNDER_COMPLIANCE_REVIEW","APPROVED_CORRECTED_VERSION","NEW_PROOF_SUBMITTED","REJECTED"],"reactivationStatuses":["NOT_REACTIVATED","APPROVED_CORRECTION","NEW_PROOF_SUBMITTED","REJECTED"]}'::jsonb,
  'MANUAL_REVIEW',
  'CRITICAL',
  100,
  true,
  true,
  true,
  'phase36-seed'
),
(
  'HIGH_RISK_ALERT_REQUIRES_REVIEW',
  'Open high-risk alert requires review',
  'Open high-risk data-change alerts require manual compliance review.',
  'HIGH_RISK_ALERT',
  20,
  '{"highRiskAlertStatuses":["OPEN","PENDING_REVIEW","UNDER_REVIEW","ESCALATED"],"minHighRiskAlertCount":1}'::jsonb,
  'MANUAL_REVIEW',
  'HIGH',
  90,
  true,
  true,
  true,
  'phase36-seed'
),
(
  'BLOCKCHAIN_PROOF_FAILURE_REQUIRES_REVIEW',
  'Blockchain proof failure requires review',
  'Failed, mismatched, tampered, or missing blockchain proof requires manual review.',
  'BLOCKCHAIN_PROOF',
  30,
  '{"blockchainStatuses":["FAILED","MISMATCH","MISMATCHED","TAMPERED","NOT_FOUND","NOT_VALID"],"batchVerificationStatuses":["FAILED","MISMATCH","TAMPERED","NOT_FOUND"]}'::jsonb,
  'MANUAL_REVIEW',
  'CRITICAL',
  95,
  true,
  true,
  true,
  'phase36-seed'
),
(
  'SANCTION_SCREENING_CHANGE_REQUIRES_REVIEW',
  'Sanction or screening data change requires review',
  'Sanction and screening table changes require manual compliance review.',
  'SANCTION_SCREENING',
  40,
  '{"tableNameContains":["sanction","snction","screening"],"moduleNameContains":["SCREENING","SANCTION"],"sourceViewNameContains":["sanction","screening"]}'::jsonb,
  'MANUAL_REVIEW',
  'HIGH',
  85,
  true,
  true,
  true,
  'phase36-seed'
),
(
  'DELETE_OPERATION_REQUIRES_REVIEW',
  'Delete operation requires review',
  'Delete operations on audited business data require manual review.',
  'DATA_CHANGE_OPERATION',
  50,
  '{"operationTypes":["DELETE"]}'::jsonb,
  'MANUAL_REVIEW',
  'HIGH',
  80,
  true,
  true,
  true,
  'phase36-seed'
),
(
  'PENDING_LOW_RISK_AUTO_APPROVE',
  'Pending low-risk audit can be auto approved',
  'Low-risk pending audit events without alerts or invalid review can be auto-approved.',
  'AUTO_APPROVAL',
  500,
  '{
    "operationTypes":["INSERT","UPDATE"],
    "approvalStatuses":["PENDING"],
    "complianceStatuses":["PENDING"],
    "highRiskAlertStatuses":["NO_ALERT"],
    "invalidReviewStatuses":["NO_REVIEW"],
    "maxRiskScore":49,
    "excludeTableNameContains":["sanction","snction","screening","risk","aml","customer","kyc"],
    "excludeModuleNameContains":["SANCTION","SCREENING","AML","RISK","CUSTOMER_KYC"],
    "excludeSourceViewNameContains":["sanction","screening","aml","risk","customer","kyc"],
    "excludeChangedFieldsContain":["amount","transaction_amount","customer","identity","national","passport","tin","rule","evidence","document"]
  }'::jsonb,
  'AUTO_APPROVE',
  'LOW',
  20,
  false,
  true,
  true,
  'phase36-seed'
)
ON CONFLICT (rule_code)
DO UPDATE SET
  rule_name = EXCLUDED.rule_name,
  rule_description = EXCLUDED.rule_description,
  rule_category = EXCLUDED.rule_category,
  rule_priority = EXCLUDED.rule_priority,
  condition_json = EXCLUDED.condition_json,
  decision = EXCLUDED.decision,
  risk_level = EXCLUDED.risk_level,
  risk_score = EXCLUDED.risk_score,
  requires_manual_review = EXCLUDED.requires_manual_review,
  proof_required = EXCLUDED.proof_required,
  auto_apply = EXCLUDED.auto_apply,
  is_active = true,
  updated_by = 'phase36-seed',
  updated_at = now();

CREATE OR REPLACE VIEW blockchain.v_data_change_compliance_rule_summary AS
SELECT
  COUNT(*)::INTEGER AS total_rules,
  COUNT(*) FILTER (WHERE is_active = true)::INTEGER AS active_rules,
  COUNT(*) FILTER (WHERE decision = 'AUTO_APPROVE' AND is_active = true)::INTEGER AS active_auto_approve_rules,
  COUNT(*) FILTER (WHERE decision = 'MANUAL_REVIEW' AND is_active = true)::INTEGER AS active_manual_review_rules,
  (
    SELECT COUNT(*)::INTEGER
    FROM blockchain.data_change_compliance_rule_evaluations
  ) AS total_evaluations,
  (
    SELECT COUNT(DISTINCT audit_id)::INTEGER
    FROM blockchain.data_change_compliance_rule_evaluations
  ) AS evaluated_audit_events,
  (
    SELECT COUNT(*)::INTEGER
    FROM blockchain.data_change_compliance_rule_evaluations
    WHERE decision = 'MANUAL_REVIEW'
  ) AS manual_review_evaluations,
  (
    SELECT COUNT(*)::INTEGER
    FROM blockchain.data_change_compliance_rule_evaluations
    WHERE decision = 'AUTO_APPROVE'
  ) AS auto_approve_evaluations,
  (
    SELECT MAX(evaluated_at)
    FROM blockchain.data_change_compliance_rule_evaluations
  ) AS latest_evaluated_at
FROM blockchain.data_change_compliance_rules;

COMMENT ON TABLE blockchain.data_change_compliance_rules IS
  'Phase 36 configurable compliance proof rules for data-change audit events.';

COMMENT ON TABLE blockchain.data_change_compliance_rule_evaluations IS
  'Phase 36 evidence trail for compliance rule evaluations against audit events.';

COMMENT ON COLUMN blockchain.data_change_audit.compliance_rule_codes IS
  'Matched Phase 36 compliance rule codes as JSON array.';

COMMIT;
