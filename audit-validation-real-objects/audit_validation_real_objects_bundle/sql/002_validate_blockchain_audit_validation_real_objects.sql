-- 002_validate_blockchain_audit_validation_real_objects.sql
-- Run in the APPLICATION PostgreSQL database after migration.

\echo '1) Source object kind inspection'
SELECT
    n.nspname AS schema_name,
    c.relname AS object_name,
    c.relkind,
    CASE c.relkind
        WHEN 'r' THEN 'TABLE'
        WHEN 'p' THEN 'PARTITIONED_TABLE'
        WHEN 'v' THEN 'VIEW'
        WHEN 'm' THEN 'MATERIALIZED_VIEW'
        ELSE 'OTHER'
    END AS object_kind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE (n.nspname || '.' || c.relname) IN (
    'blockchain.v_aml_alert_by_customer',
    'blockchain.v_customers',
    'blockchain.v_transactions',
    'blockchain.v_queries',
    'blockchain.v_aml_rules'
)
ORDER BY schema_name, object_name;

\echo '2) information_schema table/view inspection'
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'blockchain'
  AND table_name IN (
    'v_aml_alert_by_customer',
    'v_customers',
    'v_transactions',
    'v_queries',
    'v_aml_rules'
)
ORDER BY table_schema, table_name;

SELECT table_schema, table_name, is_updatable, is_insertable_into
FROM information_schema.views
WHERE table_schema = 'blockchain'
  AND table_name IN (
    'v_aml_alert_by_customer',
    'v_customers',
    'v_transactions',
    'v_queries',
    'v_aml_rules'
)
ORDER BY table_schema, table_name;

\echo '3) View/base table dependency discovery'
SELECT
    m.source_schema || '.' || m.source_object AS source_object,
    m.source_relkind,
    m.source_view,
    m.source_table_schema || '.' || m.source_table_name AS attached_base_table,
    m.enabled,
    m.discovered_at
FROM blockchain.audit_source_object_map m
ORDER BY source_object, attached_base_table;

\echo '4) Audit table exists'
SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
  AND table_name = 'audit_events';

\echo '5) Audit indexes'
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'blockchain'
  AND tablename = 'audit_events'
ORDER BY indexname;

\echo '6) Trigger function compiles'
SELECT
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'blockchain'
  AND p.proname IN (
    'audit_capture_trigger',
    'audit_insert_event',
    'audit_event_hash',
    'audit_record_pk',
    'discover_base_tables_for_object',
    'install_audit_for_targets'
)
ORDER BY p.proname;

\echo '7) Attached trigger inspection'
SELECT
    event_object_schema,
    event_object_table,
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers
WHERE trigger_schema NOT IN ('pg_catalog', 'information_schema')
  AND trigger_name = 'trg_blockchain_audit_capture'
ORDER BY event_object_schema, event_object_table, event_manipulation;

\echo '8) Last 20 audit events'
SELECT
    id,
    event_id,
    source_object,
    source_table,
    source_view,
    record_pk,
    action_type,
    changed_by,
    changed_at,
    hash_status,
    validation_status,
    blockchain_status
FROM blockchain.audit_events
ORDER BY changed_at DESC
LIMIT 20;

\echo '9) Hash verification for recent events'
WITH recent AS (
    SELECT *
    FROM blockchain.audit_events
    ORDER BY changed_at DESC
    LIMIT 20
)
SELECT
    event_id,
    hash_value,
    blockchain.audit_event_hash(
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
        correlation_id
    ) AS recalculated_hash,
    CASE
        WHEN hash_value = blockchain.audit_event_hash(
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
            correlation_id
        )
        THEN 'VALID'
        ELSE 'INVALID'
    END AS calculated_status
FROM recent
ORDER BY changed_at DESC;
