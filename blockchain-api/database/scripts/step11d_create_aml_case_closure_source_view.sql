-- ============================================================
-- Phase 1 - Step 11D
-- AML Case Closure Blockchain Proof Source View
-- ============================================================
--
-- Purpose:
--   Create a proof-safe source view for AML case closure events.
--
-- Rules:
--   - PostgreSQL remains the source of truth.
--   - Blockchain stores proof hash and metadata only.
--   - Do not expose investigation notes, full case description, or sensitive payloads.
--   - Only closed AML cases are included.
--
-- Source table:
--   blockchain.aml_cases
--
-- Target view:
--   blockchain.aml_case_closure_sync
-- ============================================================

CREATE OR REPLACE VIEW blockchain.aml_case_closure_sync AS
SELECT
    c.case_id::text AS case_id,
    c.case_number::text AS case_number,
    c.alert_id::text AS alert_id,
    c.case_status::text AS case_status,
    c.priority::text AS priority,
    c.risk_level::text AS risk_level,
    c.risk_score::text AS risk_score,
    c.assigned_team::text AS assigned_team,
    c.opened_at::text AS opened_at,
    c.reviewed_at::text AS reviewed_at,
    c.closed_at::text AS closed_at,

    -- Store only a hash of the closure reason in the source view.
    -- The raw closure reason must not be submitted to blockchain.
    encode(
        digest(COALESCE(c.closure_reason::text, ''), 'sha256'),
        'hex'
    ) AS closure_reason_hash,

    c.updated_at::text AS updated_at,

    -- Stable event identifier for blockchain proof history.
    CONCAT('AML_CASE_CLOSURE::', c.case_id::text) AS source_record_id

FROM blockchain.aml_cases c
WHERE UPPER(COALESCE(c.case_status::text, '')) = 'CLOSED'
  AND c.closed_at IS NOT NULL;

COMMENT ON VIEW blockchain.aml_case_closure_sync IS
'Proof-safe AML case closure source view for blockchain proof sync. Excludes raw closure reason, investigation notes, and sensitive case payloads.';
