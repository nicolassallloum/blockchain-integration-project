/*
Phase 5 — Source View 5
View: blockchain.valoores_audit_logs

Confirmed source model:
- blockchain.mw_audit_logs

Expected source count:
- 64,789 records based on:
  SELECT COUNT(*) FROM blockchain.mw_audit_logs;

Purpose:
Prepare normalized audit log source records for stable blockchain proof generation.

Rules:
- Do not expose logged_by directly.
- Do not expose raw changes directly.
- Do not expose raw action_text directly.
- Use deterministic fingerprints for sensitive audit values.
- Normalize text.
- Standardize timestamps.
- Standardize nulls.
- Produce deterministic unique source_record_id.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_audit_logs;

CREATE VIEW blockchain.valoores_audit_logs AS
WITH source_data AS (
    SELECT
        log_id,
        table_name,
        action_type,
        log_date,
        logged_by,
        changes,
        action_text
    FROM blockchain.mw_audit_logs
),
sequenced AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(s.log_id::text, 'NO_LOG_ID')
            ORDER BY
                s.log_date NULLS LAST,
                COALESCE(s.table_name::text, ''),
                COALESCE(s.action_type::text, ''),
                MD5(COALESCE(s.logged_by::text, '')),
                MD5(COALESCE(s.changes::text, '')),
                MD5(COALESCE(s.action_text::text, ''))
        ) AS duplicate_sequence
    FROM source_data s
),
normalized AS (
    SELECT
        'AUDIT_LOG'::text AS source_module,

        CONCAT(
            COALESCE(log_id::text, 'NO_LOG_ID'),
            ':',
            LPAD(duplicate_sequence::text, 6, '0')
        ) AS source_record_id,

        COALESCE(log_id::text, 'NA') AS log_id,
        COALESCE(duplicate_sequence::text, 'NA') AS duplicate_sequence,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(table_name::text, '\s+', ' ', 'g'))),
            ''
        ) AS audited_object_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(action_type::text, '\s+', ' ', 'g'))),
            ''
        ) AS action_type_normalized,

        COALESCE(
            TO_CHAR(log_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
            ''
        ) AS log_ts_utc,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(logged_by::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS logged_by_fingerprint,

        MD5(
            COALESCE(
                BTRIM(REGEXP_REPLACE(changes::text, '\s+', ' ', 'g')),
                ''
            )
        ) AS changes_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(action_text::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS action_text_fingerprint
    FROM sequenced
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            log_id,
            duplicate_sequence,
            audited_object_normalized,
            action_type_normalized,
            log_ts_utc,
            logged_by_fingerprint,
            changes_fingerprint,
            action_text_fingerprint
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    log_id,
    duplicate_sequence,
    audited_object_normalized,
    action_type_normalized,
    log_ts_utc,
    logged_by_fingerprint,
    changes_fingerprint,
    action_text_fingerprint,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_audit_logs IS
'Phase 5 normalized audit logs source view for blockchain proof hash generation. Source: blockchain.mw_audit_logs. User/action/change values are exposed only as deterministic fingerprints. Duplicate log IDs are handled with deterministic sequence values.';

COMMIT;
