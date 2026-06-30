/*
Phase 5 — Source View 7
View: blockchain.valoores_sanction_list

Confirmed source model:
- auditdba.ref_com_sanctn_list_his

Purpose:
Prepare normalized sanction list state-history source records for stable blockchain proof generation.

Rules:
- Do not expose comments directly.
- Do not expose created_by / updated_by directly.
- Do not expose ip_address directly.
- Use deterministic fingerprints for sensitive values.
- Normalize text.
- Standardize dates.
- Standardize nulls.
- Produce deterministic unique source_record_id.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_sanction_list;

CREATE VIEW blockchain.valoores_sanction_list AS
WITH source_data AS (
    SELECT
        sanctn_list_state_his_id,
        sanction_list_id,
        sanction_list_state,
        sanction_list_state_bdate,
        comments,
        creation_date,
        created_by,
        update_date,
        updated_by,
        ip_address
    FROM auditdba.ref_com_sanctn_list_his
),
sequenced AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(s.sanctn_list_state_his_id::text, 'NO_HISTORY_ID')
            ORDER BY
                s.sanction_list_state_bdate NULLS LAST,
                s.creation_date NULLS LAST,
                s.update_date NULLS LAST,
                COALESCE(s.sanction_list_id::text, ''),
                COALESCE(s.sanction_list_state::text, ''),
                MD5(COALESCE(s.comments::text, '')),
                MD5(COALESCE(s.created_by::text, '')),
                MD5(COALESCE(s.updated_by::text, '')),
                MD5(COALESCE(s.ip_address::text, ''))
        ) AS duplicate_sequence
    FROM source_data s
),
normalized AS (
    SELECT
        'SANCTION_LIST'::text AS source_module,

        CONCAT(
            COALESCE(sanctn_list_state_his_id::text, 'NO_HISTORY_ID'),
            ':',
            LPAD(duplicate_sequence::text, 6, '0')
        ) AS source_record_id,

        COALESCE(sanctn_list_state_his_id::text, 'NA') AS sanction_list_state_history_id,
        COALESCE(duplicate_sequence::text, 'NA') AS duplicate_sequence,

        COALESCE(sanction_list_id::text, 'NA') AS sanction_list_id,
        COALESCE(sanction_list_state::text, 'NA') AS sanction_list_state_code,

        COALESCE(
            TO_CHAR(sanction_list_state_bdate::date, 'YYYY-MM-DD'),
            ''
        ) AS sanction_list_state_start_date,

        COALESCE(
            TO_CHAR(creation_date::date, 'YYYY-MM-DD'),
            ''
        ) AS creation_date,

        COALESCE(
            TO_CHAR(update_date::date, 'YYYY-MM-DD'),
            ''
        ) AS update_date,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(comments::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS comments_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(created_by::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS created_by_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(updated_by::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS updated_by_fingerprint,

        MD5(
            COALESCE(
                LOWER(BTRIM(REGEXP_REPLACE(ip_address::text, '\s+', ' ', 'g'))),
                ''
            )
        ) AS ip_address_fingerprint
    FROM sequenced
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            sanction_list_state_history_id,
            duplicate_sequence,
            sanction_list_id,
            sanction_list_state_code,
            sanction_list_state_start_date,
            creation_date,
            update_date,
            comments_fingerprint,
            created_by_fingerprint,
            updated_by_fingerprint,
            ip_address_fingerprint
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    sanction_list_state_history_id,
    duplicate_sequence,
    sanction_list_id,
    sanction_list_state_code,
    sanction_list_state_start_date,
    creation_date,
    update_date,
    comments_fingerprint,
    created_by_fingerprint,
    updated_by_fingerprint,
    ip_address_fingerprint,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_sanction_list IS
'Phase 5 normalized sanction list state-history source view for blockchain proof hash generation. Source: auditdba.ref_com_sanctn_list_his. Comments, users, and IP values are exposed only as deterministic fingerprints.';

COMMIT;
