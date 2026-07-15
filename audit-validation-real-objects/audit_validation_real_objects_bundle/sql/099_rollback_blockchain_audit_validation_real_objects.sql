-- 099_rollback_blockchain_audit_validation_real_objects.sql
-- Run in the APPLICATION PostgreSQL database.
-- This rollback removes audit triggers/functions/maps.
-- By default it keeps blockchain.audit_events for compliance retention.
-- Uncomment the DROP TABLE line at the bottom only after approved backup/retention review.

BEGIN;

DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT DISTINCT source_table_schema, source_table_name
        FROM blockchain.audit_source_object_map
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS trg_blockchain_audit_capture ON %I.%I',
            r.source_table_schema,
            r.source_table_name
        );
    END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS blockchain.install_audit_for_targets(text[]);
DROP FUNCTION IF EXISTS blockchain.discover_base_tables_for_object(regclass);
DROP FUNCTION IF EXISTS blockchain.audit_capture_trigger();
DROP FUNCTION IF EXISTS blockchain.audit_insert_event(text, text, text, text, text, jsonb, jsonb);
DROP FUNCTION IF EXISTS blockchain.audit_event_hash(text, text, text, text, text, text, text, text, text, jsonb, jsonb, text, timestamptz, text, text, text);
DROP FUNCTION IF EXISTS blockchain.audit_record_pk(text, text, jsonb);
DROP FUNCTION IF EXISTS blockchain.audit_json_strip_volatile(jsonb);

DROP TRIGGER IF EXISTS trg_audit_source_object_map_touch_updated_at ON blockchain.audit_source_object_map;
DROP TABLE IF EXISTS blockchain.audit_source_object_map;

-- Keep this table by default for compliance retention:
-- DROP TRIGGER IF EXISTS trg_audit_events_touch_updated_at ON blockchain.audit_events;
-- DROP TABLE IF EXISTS blockchain.audit_events;

COMMIT;
