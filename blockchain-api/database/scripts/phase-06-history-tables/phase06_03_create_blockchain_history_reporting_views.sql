/*
Phase 6 — Blockchain History Tables
Script 3: Create blockchain history reporting views

Views:
1. blockchain.vw_blockchain_history_latest
2. blockchain.vw_blockchain_history_summary
3. blockchain.vw_blockchain_history_retry_queue

Purpose:
Provide operational reporting views for latest proof status, module-level summary,
and retry queue monitoring.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE OR REPLACE VIEW blockchain.vw_blockchain_history_latest AS
WITH attempt_summary AS (
    SELECT
        blockchain_history_id,
        COUNT(*) AS attempt_count,
        MAX(attempt_no) AS latest_attempt_no,
        MAX(started_at) AS latest_attempt_started_at,
        MAX(finished_at) AS latest_attempt_finished_at
    FROM blockchain.blockchain_history_attempts
    GROUP BY blockchain_history_id
),
latest_attempt AS (
    SELECT
        a.*,
        ROW_NUMBER() OVER (
            PARTITION BY a.blockchain_history_id
            ORDER BY a.attempt_no DESC, a.started_at DESC, a.blockchain_history_attempt_id DESC
        ) AS rn
    FROM blockchain.blockchain_history_attempts a
),
ranked_history AS (
    SELECT
        h.*,
        ROW_NUMBER() OVER (
            PARTITION BY h.module_name, h.source_record_id
            ORDER BY h.updated_at DESC, h.created_at DESC, h.blockchain_history_id DESC
        ) AS rn
    FROM blockchain.blockchain_history h
)
SELECT
    h.blockchain_history_id,
    h.module_name,
    h.source_record_id,
    h.blockchain_key,
    h.record_hash,
    h.hash_version,
    h.action_type,
    h.approval_status,
    h.blockchain_status,
    h.blockchain_transaction_id,
    h.submitted_by,
    h.submitted_at,
    h.verified_at,
    h.verification_status,
    h.error_message,
    h.retry_count,
    COALESCE(s.attempt_count, 0) AS attempt_count,
    s.latest_attempt_no,
    s.latest_attempt_started_at,
    s.latest_attempt_finished_at,
    la.attempt_type AS latest_attempt_type,
    la.blockchain_status AS latest_attempt_blockchain_status,
    la.verification_status AS latest_attempt_verification_status,
    la.error_code AS latest_attempt_error_code,
    la.request_id AS latest_attempt_request_id,
    la.worker_name AS latest_attempt_worker_name,
    h.created_at,
    h.updated_at
FROM ranked_history h
LEFT JOIN attempt_summary s
  ON s.blockchain_history_id = h.blockchain_history_id
LEFT JOIN latest_attempt la
  ON la.blockchain_history_id = h.blockchain_history_id
 AND la.rn = 1
WHERE h.rn = 1;

COMMENT ON VIEW blockchain.vw_blockchain_history_latest IS
'Latest blockchain history status per module_name and source_record_id, enriched with latest retry/error attempt information.';

CREATE OR REPLACE VIEW blockchain.vw_blockchain_history_summary AS
SELECT
    h.module_name,
    COUNT(*) AS total_history_records,
    COUNT(*) FILTER (WHERE h.approval_status = 'PENDING') AS approval_pending_count,
    COUNT(*) FILTER (WHERE h.approval_status = 'APPROVED') AS approval_approved_count,
    COUNT(*) FILTER (WHERE h.approval_status = 'REJECTED') AS approval_rejected_count,
    COUNT(*) FILTER (WHERE h.blockchain_status = 'PENDING') AS blockchain_pending_count,
    COUNT(*) FILTER (WHERE h.blockchain_status = 'SUBMITTED') AS blockchain_submitted_count,
    COUNT(*) FILTER (WHERE h.blockchain_status = 'CONFIRMED') AS blockchain_confirmed_count,
    COUNT(*) FILTER (WHERE h.blockchain_status = 'FAILED') AS blockchain_failed_count,
    COUNT(*) FILTER (WHERE h.verification_status = 'NOT_VERIFIED') AS not_verified_count,
    COUNT(*) FILTER (WHERE h.verification_status = 'VERIFIED') AS verified_count,
    COUNT(*) FILTER (WHERE h.verification_status = 'FAILED') AS verification_failed_count,
    COUNT(*) FILTER (WHERE h.verification_status = 'MISMATCH') AS verification_mismatch_count,
    COALESCE(SUM(h.retry_count), 0) AS total_retry_count,
    MIN(h.created_at) AS first_history_created_at,
    MAX(h.updated_at) AS latest_history_updated_at
FROM blockchain.blockchain_history h
GROUP BY h.module_name;

COMMENT ON VIEW blockchain.vw_blockchain_history_summary IS
'Module-level blockchain history summary for approval, submission, verification, and retry monitoring.';

CREATE OR REPLACE VIEW blockchain.vw_blockchain_history_retry_queue AS
WITH attempt_summary AS (
    SELECT
        blockchain_history_id,
        COUNT(*) AS attempt_count,
        MAX(attempt_no) AS latest_attempt_no,
        MAX(started_at) AS latest_attempt_started_at,
        MAX(finished_at) AS latest_attempt_finished_at
    FROM blockchain.blockchain_history_attempts
    GROUP BY blockchain_history_id
)
SELECT
    h.blockchain_history_id,
    h.module_name,
    h.source_record_id,
    h.blockchain_key,
    h.record_hash,
    h.hash_version,
    h.action_type,
    h.approval_status,
    h.blockchain_status,
    h.verification_status,
    h.blockchain_transaction_id,
    h.submitted_by,
    h.submitted_at,
    h.verified_at,
    h.error_message,
    h.retry_count,
    COALESCE(s.attempt_count, 0) AS attempt_count,
    COALESCE(s.latest_attempt_no, 0) + 1 AS next_attempt_no,
    s.latest_attempt_started_at,
    s.latest_attempt_finished_at,
    h.created_at,
    h.updated_at
FROM blockchain.blockchain_history h
LEFT JOIN attempt_summary s
  ON s.blockchain_history_id = h.blockchain_history_id
WHERE h.blockchain_status IN ('PENDING', 'FAILED')
   OR h.verification_status IN ('FAILED', 'MISMATCH')
ORDER BY h.updated_at ASC, h.blockchain_history_id ASC;

COMMENT ON VIEW blockchain.vw_blockchain_history_retry_queue IS
'Retry queue view for blockchain history records with pending/failed blockchain or verification status.';

COMMIT;
