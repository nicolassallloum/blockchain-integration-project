CREATE OR REPLACE FUNCTION blockchain.audit_events_fill_application_user_before_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.application_user := COALESCE(
        NULLIF(NEW.application_user, ''),
        blockchain.get_audit_application_user(
            NEW.action_type,
            NEW.old_data,
            NEW.new_data
        )
    );

    -- Recalculate hash before insert so application_user is included safely.
    NEW.hash_value := blockchain.audit_event_hash(
        NEW.event_id,
        NEW.source_system,
        NEW.source_database,
        NEW.source_schema,
        NEW.source_object,
        NEW.source_table,
        NEW.source_view,
        NEW.record_pk,
        NEW.action_type,
        NEW.old_data,
        NEW.new_data,
        NEW.changed_by,
        NEW.changed_at,
        NEW.application_user,
        NEW.request_id,
        NEW.correlation_id
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_events_fill_application_user_before_insert
ON blockchain.audit_events;

CREATE TRIGGER trg_audit_events_fill_application_user_before_insert
BEFORE INSERT ON blockchain.audit_events
FOR EACH ROW
EXECUTE FUNCTION blockchain.audit_events_fill_application_user_before_insert();
