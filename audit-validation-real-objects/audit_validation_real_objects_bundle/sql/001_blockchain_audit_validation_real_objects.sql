-- 001_blockchain_audit_validation_real_objects.sql
-- Purpose:
--   Replace test-only audit source public.blockchain_ui_audit_test with real
--   application PostgreSQL audit capture for the Blockchain Integration project.
--
-- Safety:
--   - Uses environment-managed DB connections outside SQL.
--   - Does not hardcode credentials.
--   - Does not submit sensitive old_data/new_data to blockchain.
--   - Attaches triggers to base tables when target source objects are views.
--
-- Run in the APPLICATION PostgreSQL database.

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

-- pgcrypto is not installed here because this database already has gen_random_uuid().
-- Use built-in sha256(bytea) instead of pgcrypto.digest().
DO $$
BEGIN
    IF to_regprocedure('gen_random_uuid()') IS NULL THEN
        RAISE EXCEPTION 'Required function gen_random_uuid() is missing';
    END IF;

    IF to_regprocedure('sha256(bytea)') IS NULL THEN
        RAISE EXCEPTION 'Required function sha256(bytea) is missing';
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS blockchain.audit_events (
    id bigserial PRIMARY KEY,
    event_id text UNIQUE NOT NULL,
    source_system text NOT NULL,
    source_database text NOT NULL,
    source_schema text NOT NULL,
    source_object text NOT NULL,
    source_table text NOT NULL,
    source_view text NULL,
    record_pk text NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data jsonb,
    new_data jsonb,
    changed_by text NOT NULL,
    changed_at timestamptz NOT NULL,
    application_user text NULL,
    request_id text NULL,
    correlation_id text NULL,
    hash_value text NOT NULL,
    recalculated_hash text NULL,
    hash_status text NOT NULL DEFAULT 'PENDING',
    validation_status text NOT NULL DEFAULT 'PENDING',
    blockchain_status text NOT NULL DEFAULT 'NOT_SUBMITTED',
    blockchain_tx_id text NULL,
    ledger_key text NULL,
    couchdb_doc_id text NULL,
    submitted_at timestamptz NULL,
    submit_error text NULL,

    -- Additive production metadata used by approve/reject workflow.
    approved_by text NULL,
    approved_at timestamptz NULL,
    rejected_by text NULL,
    rejected_at timestamptz NULL,
    reject_reason text NULL,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT audit_events_hash_status_chk CHECK (hash_status IN ('PENDING', 'VALID', 'INVALID')),
    CONSTRAINT audit_events_validation_status_chk CHECK (validation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    CONSTRAINT audit_events_blockchain_status_chk CHECK (blockchain_status IN ('NOT_SUBMITTED', 'SUBMITTED', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idx_audit_events_event_id
    ON blockchain.audit_events(event_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_source_object
    ON blockchain.audit_events(source_object);

CREATE INDEX IF NOT EXISTS idx_audit_events_source_schema_table
    ON blockchain.audit_events(source_schema, source_table);

CREATE INDEX IF NOT EXISTS idx_audit_events_action_type
    ON blockchain.audit_events(action_type);

CREATE INDEX IF NOT EXISTS idx_audit_events_changed_at_desc
    ON blockchain.audit_events(changed_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_hash_status
    ON blockchain.audit_events(hash_status);

CREATE INDEX IF NOT EXISTS idx_audit_events_validation_status
    ON blockchain.audit_events(validation_status);

CREATE INDEX IF NOT EXISTS idx_audit_events_blockchain_status
    ON blockchain.audit_events(blockchain_status);

CREATE INDEX IF NOT EXISTS idx_audit_events_source_object_changed_at_desc
    ON blockchain.audit_events(source_object, changed_at DESC);

CREATE TABLE IF NOT EXISTS blockchain.audit_source_object_map (
    id bigserial PRIMARY KEY,
    source_schema text NOT NULL,
    source_object text NOT NULL,
    source_relkind char NOT NULL,
    source_view text NULL,
    source_table_schema text NOT NULL,
    source_table_name text NOT NULL,
    enabled boolean NOT NULL DEFAULT true,
    discovered_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (source_schema, source_object, source_table_schema, source_table_name)
);

CREATE INDEX IF NOT EXISTS idx_audit_source_object_map_table
    ON blockchain.audit_source_object_map(source_table_schema, source_table_name)
    WHERE enabled;

CREATE OR REPLACE FUNCTION blockchain.audit_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_events_touch_updated_at ON blockchain.audit_events;
CREATE TRIGGER trg_audit_events_touch_updated_at
BEFORE UPDATE ON blockchain.audit_events
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_touch_updated_at();

DROP TRIGGER IF EXISTS trg_audit_source_object_map_touch_updated_at ON blockchain.audit_source_object_map;
CREATE TRIGGER trg_audit_source_object_map_touch_updated_at
BEFORE UPDATE ON blockchain.audit_source_object_map
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_touch_updated_at();

CREATE OR REPLACE FUNCTION blockchain.audit_json_strip_volatile(p_data jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_data IS NULL THEN NULL
        ELSE p_data
             - 'updated_at'
             - 'created_at'
             - 'submitted_at'
             - 'approved_at'
             - 'rejected_at'
    END;
$$;

CREATE OR REPLACE FUNCTION blockchain.audit_record_pk(
    p_table_schema text,
    p_table_name text,
    p_row jsonb
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    pk_cols text[];
    pk_col text;
    parts text[] := ARRAY[]::text[];
    candidate text;
BEGIN
    SELECT array_agg(a.attname ORDER BY k.ord)
    INTO pk_cols
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_index i ON i.indrelid = c.oid AND i.indisprimary
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = k.attnum
    WHERE n.nspname = p_table_schema
      AND c.relname = p_table_name;

    IF pk_cols IS NOT NULL THEN
        FOREACH pk_col IN ARRAY pk_cols LOOP
            parts := parts || (pk_col || '=' || COALESCE(p_row ->> pk_col, 'NULL'));
        END LOOP;
        RETURN array_to_string(parts, '|');
    END IF;

    FOREACH candidate IN ARRAY ARRAY[
        'id',
        'customer_id',
        'transaction_id',
        'query_id',
        'rule_id',
        'alert_id',
        'aml_alert_id',
        'object_id',
        'code'
    ] LOOP
        IF p_row ? candidate THEN
            RETURN candidate || '=' || COALESCE(p_row ->> candidate, 'NULL');
        END IF;
    END LOOP;

    RETURN 'row_hash=' || encode(sha256(convert_to(COALESCE(p_row::text, ''), 'UTF8')), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION blockchain.audit_event_hash(
    p_event_id text,
    p_source_system text,
    p_source_database text,
    p_source_schema text,
    p_source_object text,
    p_source_table text,
    p_source_view text,
    p_record_pk text,
    p_action_type text,
    p_old_data jsonb,
    p_new_data jsonb,
    p_changed_by text,
    p_changed_at timestamptz,
    p_application_user text,
    p_request_id text,
    p_correlation_id text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
    SELECT encode(
        sha256(
            convert_to(
                concat_ws('|',
                COALESCE(p_event_id, ''),
                COALESCE(p_source_system, ''),
                COALESCE(p_source_database, ''),
                COALESCE(p_source_schema, ''),
                COALESCE(p_source_object, ''),
                COALESCE(p_source_table, ''),
                COALESCE(p_source_view, ''),
                COALESCE(p_record_pk, ''),
                COALESCE(p_action_type, ''),
                COALESCE(blockchain.audit_json_strip_volatile(p_old_data)::text, ''),
                COALESCE(blockchain.audit_json_strip_volatile(p_new_data)::text, ''),
                COALESCE(p_changed_by, ''),
                COALESCE(to_char(p_changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'), ''),
                COALESCE(p_application_user, ''),
                COALESCE(p_request_id, ''),
                COALESCE(p_correlation_id, '')
            ),
                'UTF8'
            )
        ),
        'hex'
    );
$$;

CREATE OR REPLACE FUNCTION blockchain.audit_insert_event(
    p_source_object text,
    p_source_table_schema text,
    p_source_table_name text,
    p_source_view text,
    p_action_type text,
    p_old_data jsonb,
    p_new_data jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_event_id text;
    v_changed_at timestamptz;
    v_changed_by text;
    v_application_user text;
    v_request_id text;
    v_correlation_id text;
    v_source_system text;
    v_source_table text;
    v_record_pk text;
    v_row_data jsonb;
    v_hash text;
BEGIN
    v_event_id := 'AUDIT-' || replace(gen_random_uuid()::text, '-', '');
    v_changed_at := clock_timestamp();

    v_changed_by := COALESCE(
        NULLIF(current_setting('app.changed_by', true), ''),
        NULLIF(current_setting('app.client_ip', true), ''),
        NULLIF(inet_client_addr()::text, ''),
        current_user
    );
    v_application_user := NULLIF(current_setting('app.application_user', true), '');
    v_request_id := NULLIF(current_setting('app.request_id', true), '');
    v_correlation_id := NULLIF(current_setting('app.correlation_id', true), '');
    v_source_system := COALESCE(NULLIF(current_setting('app.source_system', true), ''), 'application_postgresql');

    v_source_table := p_source_table_schema || '.' || p_source_table_name;
    v_row_data := COALESCE(p_new_data, p_old_data);
    v_record_pk := blockchain.audit_record_pk(p_source_table_schema, p_source_table_name, v_row_data);

    v_hash := blockchain.audit_event_hash(
        v_event_id,
        v_source_system,
        current_database(),
        p_source_table_schema,
        p_source_object,
        v_source_table,
        p_source_view,
        v_record_pk,
        p_action_type,
        p_old_data,
        p_new_data,
        v_changed_by,
        v_changed_at,
        v_application_user,
        v_request_id,
        v_correlation_id
    );

    INSERT INTO blockchain.audit_events (
        event_id,
        source_system,
        source_database,
        source_schema,
        source_object,
        source_table,
        source_view,
        record_pk,
        action_type,
        old_data,
        new_data,
        changed_by,
        changed_at,
        application_user,
        request_id,
        correlation_id,
        hash_value
    ) VALUES (
        v_event_id,
        v_source_system,
        current_database(),
        p_source_table_schema,
        p_source_object,
        v_source_table,
        p_source_view,
        v_record_pk,
        p_action_type,
        p_old_data,
        p_new_data,
        v_changed_by,
        v_changed_at,
        v_application_user,
        v_request_id,
        v_correlation_id,
        v_hash
    );
END;
$$;

CREATE OR REPLACE FUNCTION blockchain.audit_capture_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_old_data jsonb;
    v_new_data jsonb;
    v_map record;
    v_has_mapping boolean := false;
    v_source_object text;
BEGIN
    IF TG_OP = 'INSERT' THEN
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);

        -- Avoid noise when PostgreSQL receives an UPDATE that does not actually change row data.
        IF v_old_data = v_new_data THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
    ELSE
        RAISE EXCEPTION 'Unsupported audit operation: %', TG_OP;
    END IF;

    FOR v_map IN
        SELECT *
        FROM blockchain.audit_source_object_map
        WHERE enabled = true
          AND source_table_schema = TG_TABLE_SCHEMA
          AND source_table_name = TG_TABLE_NAME
        ORDER BY source_schema, source_object
    LOOP
        v_has_mapping := true;

        PERFORM blockchain.audit_insert_event(
            v_map.source_schema || '.' || v_map.source_object,
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            v_map.source_view,
            TG_OP,
            v_old_data,
            v_new_data
        );
    END LOOP;

    -- Fallback when a trigger is attached manually without an object-map row.
    IF NOT v_has_mapping THEN
        v_source_object := TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME;

        PERFORM blockchain.audit_insert_event(
            v_source_object,
            TG_TABLE_SCHEMA,
            TG_TABLE_NAME,
            NULL,
            TG_OP,
            v_old_data,
            v_new_data
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION blockchain.discover_base_tables_for_object(p_object regclass)
RETURNS TABLE (
    source_oid oid,
    base_schema text,
    base_table text,
    base_relkind char
)
LANGUAGE sql
STABLE
AS $$
WITH RECURSIVE walk(source_oid, dep_oid, depth, path) AS (
    SELECT
        p_object::oid AS source_oid,
        p_object::oid AS dep_oid,
        0 AS depth,
        ARRAY[p_object::oid] AS path

    UNION ALL

    SELECT
        w.source_oid,
        c.oid AS dep_oid,
        w.depth + 1 AS depth,
        w.path || c.oid AS path
    FROM walk w
    JOIN pg_rewrite r ON r.ev_class = w.dep_oid
    JOIN pg_depend d ON d.objid = r.oid
    JOIN pg_class c ON c.oid = d.refobjid
    WHERE c.oid <> ALL(w.path)
      AND c.relkind IN ('r', 'p', 'v', 'm')
      AND w.depth < 10
)
SELECT DISTINCT
    w.source_oid,
    n.nspname AS base_schema,
    c.relname AS base_table,
    c.relkind AS base_relkind
FROM walk w
JOIN pg_class c ON c.oid = w.dep_oid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname;
$$;

CREATE OR REPLACE FUNCTION blockchain.install_audit_for_targets(
    p_targets text[] DEFAULT ARRAY[
        'blockchain.v_aml_alert_by_customer',
        'blockchain.v_customers',
        'blockchain.v_transactions',
        'blockchain.v_queries',
        'blockchain.v_aml_rules'
    ]
)
RETURNS TABLE (
    target_object text,
    target_relkind char,
    target_kind text,
    attached_table text,
    trigger_name text,
    status text
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_target text;
    v_oid oid;
    v_relkind char;
    v_kind text;
    v_source_schema text;
    v_source_object text;
    v_base record;
    v_trigger_name text := 'trg_blockchain_audit_capture';
BEGIN
    FOREACH v_target IN ARRAY p_targets LOOP
        v_oid := to_regclass(v_target);

        IF v_oid IS NULL THEN
            target_object := v_target;
            target_relkind := NULL;
            target_kind := 'MISSING';
            attached_table := NULL;
            trigger_name := NULL;
            status := 'SKIPPED_SOURCE_OBJECT_NOT_FOUND';
            RETURN NEXT;
            CONTINUE;
        END IF;

        SELECT c.relkind, n.nspname, c.relname,
               CASE c.relkind
                    WHEN 'r' THEN 'TABLE'
                    WHEN 'p' THEN 'PARTITIONED_TABLE'
                    WHEN 'v' THEN 'VIEW'
                    WHEN 'm' THEN 'MATERIALIZED_VIEW'
                    ELSE 'OTHER'
               END
        INTO v_relkind, v_source_schema, v_source_object, v_kind
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.oid = v_oid;

        IF v_relkind IN ('r', 'p') THEN
            INSERT INTO blockchain.audit_source_object_map (
                source_schema,
                source_object,
                source_relkind,
                source_view,
                source_table_schema,
                source_table_name,
                enabled
            )
            VALUES (
                v_source_schema,
                v_source_object,
                v_relkind,
                NULL,
                v_source_schema,
                v_source_object,
                true
            )
            ON CONFLICT (source_schema, source_object, source_table_schema, source_table_name)
            DO UPDATE SET
                source_relkind = EXCLUDED.source_relkind,
                source_view = EXCLUDED.source_view,
                enabled = true,
                discovered_at = now(),
                updated_at = now();

            EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', v_trigger_name, v_source_schema, v_source_object);
            EXECUTE format(
                'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION blockchain.audit_capture_trigger()',
                v_trigger_name,
                v_source_schema,
                v_source_object
            );

            target_object := v_target;
            target_relkind := v_relkind;
            target_kind := v_kind;
            attached_table := v_source_schema || '.' || v_source_object;
            trigger_name := v_trigger_name;
            status := 'ATTACHED_DIRECT_TABLE';
            RETURN NEXT;

        ELSIF v_relkind IN ('v', 'm') THEN
            FOR v_base IN SELECT * FROM blockchain.discover_base_tables_for_object(v_oid::regclass) LOOP
                INSERT INTO blockchain.audit_source_object_map (
                    source_schema,
                    source_object,
                    source_relkind,
                    source_view,
                    source_table_schema,
                    source_table_name,
                    enabled
                )
                VALUES (
                    v_source_schema,
                    v_source_object,
                    v_relkind,
                    v_target,
                    v_base.base_schema,
                    v_base.base_table,
                    true
                )
                ON CONFLICT (source_schema, source_object, source_table_schema, source_table_name)
                DO UPDATE SET
                    source_relkind = EXCLUDED.source_relkind,
                    source_view = EXCLUDED.source_view,
                    enabled = true,
                    discovered_at = now(),
                    updated_at = now();

                EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I.%I', v_trigger_name, v_base.base_schema, v_base.base_table);
                EXECUTE format(
                    'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION blockchain.audit_capture_trigger()',
                    v_trigger_name,
                    v_base.base_schema,
                    v_base.base_table
                );

                target_object := v_target;
                target_relkind := v_relkind;
                target_kind := v_kind;
                attached_table := v_base.base_schema || '.' || v_base.base_table;
                trigger_name := v_trigger_name;
                status := 'ATTACHED_BASE_TABLE_FOR_VIEW';
                RETURN NEXT;
            END LOOP;

            IF NOT FOUND THEN
                target_object := v_target;
                target_relkind := v_relkind;
                target_kind := v_kind;
                attached_table := NULL;
                trigger_name := NULL;
                status := 'NO_BASE_TABLE_FOUND_REVIEW_VIEW_SQL';
                RETURN NEXT;
            END IF;
        ELSE
            target_object := v_target;
            target_relkind := v_relkind;
            target_kind := v_kind;
            attached_table := NULL;
            trigger_name := NULL;
            status := 'SKIPPED_UNSUPPORTED_RELKIND';
            RETURN NEXT;
        END IF;
    END LOOP;
END;
$$;

-- Attach triggers to tables/base tables for the requested real objects.
SELECT *
FROM blockchain.install_audit_for_targets();

COMMIT;
