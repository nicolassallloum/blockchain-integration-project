/*
Phase 5 — Source View 1
View: blockchain.valoores_aml_rules

Purpose:
Prepare normalized AML rule source records for stable blockchain proof generation.

Phase 13 contract repair:
- Provide the required proof columns:
  source_system, source_entity, source_record_id, business_reference,
  record_type, record_status, standardized_event_timestamp, proof_version, hash_input.
- Do not expose raw AML SQL query text.
- Keep deterministic hash_input.
- Keep compatibility columns used by older AML Rules dashboard/API logic.
- Preserve blockchain.valoores_aml_rules_sync as a compatibility view.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DO $$
DECLARE
    v_rule_def_table text;
    v_rule_msg_table text;
    v_rule_query_table text;
BEGIN
    /*
      Resolve real source tables from the old view dependency when the old view exists.
      Use to_regclass so the script can also run when the view is missing.
    */

    IF to_regclass('blockchain.valoores_aml_rules') IS NOT NULL THEN
        SELECT quote_ident(src_ns.nspname) || '.' || quote_ident(src.relname)
        INTO v_rule_def_table
        FROM pg_depend d
        JOIN pg_rewrite r
          ON r.oid = d.objid
        JOIN pg_class v
          ON v.oid = r.ev_class
        JOIN pg_class src
          ON src.oid = d.refobjid
        JOIN pg_namespace src_ns
          ON src_ns.oid = src.relnamespace
        WHERE v.oid = to_regclass('blockchain.valoores_aml_rules')
          AND src.relname = 'br_business_rule_definition'
        LIMIT 1;

        SELECT quote_ident(src_ns.nspname) || '.' || quote_ident(src.relname)
        INTO v_rule_msg_table
        FROM pg_depend d
        JOIN pg_rewrite r
          ON r.oid = d.objid
        JOIN pg_class v
          ON v.oid = r.ev_class
        JOIN pg_class src
          ON src.oid = d.refobjid
        JOIN pg_namespace src_ns
          ON src_ns.oid = src.relnamespace
        WHERE v.oid = to_regclass('blockchain.valoores_aml_rules')
          AND src.relname = 'br_business_rule_message'
        LIMIT 1;

        SELECT quote_ident(src_ns.nspname) || '.' || quote_ident(src.relname)
        INTO v_rule_query_table
        FROM pg_depend d
        JOIN pg_rewrite r
          ON r.oid = d.objid
        JOIN pg_class v
          ON v.oid = r.ev_class
        JOIN pg_class src
          ON src.oid = d.refobjid
        JOIN pg_namespace src_ns
          ON src_ns.oid = src.relnamespace
        WHERE v.oid = to_regclass('blockchain.valoores_aml_rules')
          AND src.relname = 'br_business_rule_query'
        LIMIT 1;
    END IF;

    IF v_rule_def_table IS NULL THEN
        SELECT quote_ident(table_schema) || '.' || quote_ident(table_name)
        INTO v_rule_def_table
        FROM information_schema.tables
        WHERE table_name = 'br_business_rule_definition'
          AND table_schema NOT LIKE 'pg_%'
          AND table_schema <> 'information_schema'
        ORDER BY table_schema
        LIMIT 1;
    END IF;

    IF v_rule_msg_table IS NULL THEN
        SELECT quote_ident(table_schema) || '.' || quote_ident(table_name)
        INTO v_rule_msg_table
        FROM information_schema.tables
        WHERE table_name = 'br_business_rule_message'
          AND table_schema NOT LIKE 'pg_%'
          AND table_schema <> 'information_schema'
        ORDER BY table_schema
        LIMIT 1;
    END IF;

    IF v_rule_query_table IS NULL THEN
        SELECT quote_ident(table_schema) || '.' || quote_ident(table_name)
        INTO v_rule_query_table
        FROM information_schema.tables
        WHERE table_name = 'br_business_rule_query'
          AND table_schema NOT LIKE 'pg_%'
          AND table_schema <> 'information_schema'
        ORDER BY table_schema
        LIMIT 1;
    END IF;

    IF v_rule_def_table IS NULL
       OR v_rule_msg_table IS NULL
       OR v_rule_query_table IS NULL THEN
        RAISE EXCEPTION
            'Cannot resolve AML rule source tables. rule_def=%, rule_msg=%, rule_query=%',
            v_rule_def_table,
            v_rule_msg_table,
            v_rule_query_table;
    END IF;

    RAISE NOTICE 'Using AML source tables: %, %, %',
        v_rule_def_table,
        v_rule_msg_table,
        v_rule_query_table;

    DROP VIEW IF EXISTS blockchain.valoores_aml_rules_sync;
    DROP VIEW IF EXISTS blockchain.valoores_aml_rules;

    EXECUTE format($VIEW$
        CREATE VIEW blockchain.valoores_aml_rules AS
        WITH source_data AS (
            SELECT
                a.business_rule_id,
                c.business_rule_query_id,
                a.business_rule_desc,
                a.status_code,
                a.business_rule_bdate,
                a.business_rule_edate,
                a.creation_date AS rule_creation_date,
                a.update_date AS rule_update_date,
                b.message_subject,
                c.query_data,
                c.creation_date AS query_creation_date,
                c.update_date AS query_update_date
            FROM %s a
            JOIN %s b
              ON b.business_rule_id = a.business_rule_id
            JOIN %s c
              ON c.business_rule_id = a.business_rule_id
        ),
        normalized AS (
            SELECT
                'VALOORES'::text AS source_system,
                'AML_RULE'::text AS source_entity,

                CONCAT(
                    COALESCE(business_rule_id::text, 'NA'),
                    '-',
                    COALESCE(business_rule_query_id::text, 'NA')
                ) AS source_record_id,

                CONCAT(
                    'AML_RULE:',
                    COALESCE(business_rule_id::text, 'NA'),
                    ':QUERY:',
                    COALESCE(business_rule_query_id::text, 'NA')
                ) AS business_reference,

                'AML_RULE'::text AS record_type,
                COALESCE(status_code::text, 'UNKNOWN') AS record_status,

                COALESCE(
                    query_update_date::timestamptz,
                    rule_update_date::timestamptz,
                    query_creation_date::timestamptz,
                    rule_creation_date::timestamptz,
                    business_rule_bdate::timestamptz,
                    '1970-01-01 00:00:00+00'::timestamptz
                ) AS standardized_event_timestamp,

                'V1'::text AS proof_version,

                'AML_RULE'::text AS source_module,
                COALESCE(business_rule_id::text, 'NA') AS rule_id,
                COALESCE(business_rule_query_id::text, 'NA') AS rule_query_id,

                COALESCE(
                    LOWER(BTRIM(REGEXP_REPLACE(business_rule_desc::text, '\s+', ' ', 'g'))),
                    ''
                ) AS rule_desc_normalized,

                COALESCE(status_code::text, 'UNKNOWN') AS rule_status_code,

                COALESCE(
                    TO_CHAR(business_rule_bdate::date, 'YYYY-MM-DD'),
                    ''
                ) AS rule_start_date,

                COALESCE(
                    TO_CHAR(business_rule_edate::date, 'YYYY-MM-DD'),
                    ''
                ) AS rule_expiry_date,

                COALESCE(
                    TO_CHAR(rule_creation_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                    ''
                ) AS rule_creation_ts_utc,

                COALESCE(
                    TO_CHAR(rule_update_date::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
                    ''
                ) AS rule_update_ts_utc,

                COALESCE(
                    LOWER(BTRIM(REGEXP_REPLACE(message_subject::text, '\s+', ' ', 'g'))),
                    ''
                ) AS rule_message_normalized,

                /*
                  Do not expose raw AML SQL query text.
                  Only expose a deterministic fingerprint of normalized rule logic.
                */
                MD5(
                    COALESCE(
                        BTRIM(REGEXP_REPLACE(query_data::text, '\s+', ' ', 'g')),
                        ''
                    )
                ) AS rule_logic_fingerprint,

                COALESCE(
                    TO_CHAR(query_creation_date::date, 'YYYY-MM-DD'),
                    ''
                ) AS rule_logic_created_date,

                COALESCE(
                    TO_CHAR(query_update_date::date, 'YYYY-MM-DD'),
                    ''
                ) AS rule_logic_updated_date
            FROM source_data
        ),
        payload AS (
            SELECT
                normalized.*,
                CONCAT_WS(
                    '|',
                    'business_reference=' || business_reference,
                    'proof_version=' || proof_version,
                    'record_status=' || record_status,
                    'record_type=' || record_type,
                    'rule_desc_normalized=' || rule_desc_normalized,
                    'rule_expiry_date=' || rule_expiry_date,
                    'rule_id=' || rule_id,
                    'rule_logic_created_date=' || rule_logic_created_date,
                    'rule_logic_fingerprint=' || rule_logic_fingerprint,
                    'rule_logic_updated_date=' || rule_logic_updated_date,
                    'rule_message_normalized=' || rule_message_normalized,
                    'rule_query_id=' || rule_query_id,
                    'rule_start_date=' || rule_start_date,
                    'source_entity=' || source_entity,
                    'source_record_id=' || source_record_id,
                    'source_system=' || source_system,
                    'standardized_event_timestamp=' ||
                        TO_CHAR(standardized_event_timestamp AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
                ) AS hash_input
            FROM normalized
        )
        SELECT
            source_system,
            source_entity,
            source_record_id,
            business_reference,
            record_type,
            record_status,
            standardized_event_timestamp,
            proof_version,
            hash_input,

            source_module,
            rule_id,
            rule_query_id,
            rule_desc_normalized,
            rule_status_code,
            rule_start_date,
            rule_expiry_date,
            rule_creation_ts_utc,
            rule_update_ts_utc,
            rule_message_normalized,
            rule_logic_fingerprint,
            rule_logic_created_date,
            rule_logic_updated_date,

            MD5(hash_input) AS hash_md5
        FROM payload;
    $VIEW$, v_rule_def_table, v_rule_msg_table, v_rule_query_table);

    CREATE VIEW blockchain.valoores_aml_rules_sync AS
    SELECT
        source_module,
        source_record_id,
        rule_id,
        rule_query_id,
        rule_desc_normalized,
        rule_status_code,
        rule_start_date,
        rule_expiry_date,
        rule_creation_ts_utc,
        rule_update_ts_utc,
        rule_message_normalized,
        rule_logic_fingerprint,
        rule_logic_created_date,
        rule_logic_updated_date,
        hash_input,
        hash_md5
    FROM blockchain.valoores_aml_rules;
END $$;

COMMENT ON VIEW blockchain.valoores_aml_rules IS
'Phase 5 AML Rules proof source view repaired for Phase 13. Raw AML SQL query text is not exposed.';

COMMENT ON VIEW blockchain.valoores_aml_rules_sync IS
'Compatibility view rebuilt from blockchain.valoores_aml_rules. Raw AML SQL query text is not exposed.';

COMMIT;
