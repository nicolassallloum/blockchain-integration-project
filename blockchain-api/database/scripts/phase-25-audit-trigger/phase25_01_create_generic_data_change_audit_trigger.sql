\set ON_ERROR_STOP on

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE OR REPLACE FUNCTION blockchain.fn_generic_data_change_audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_config RECORD;
  v_old_row JSONB;
  v_new_row JSONB;
  v_audit_old_row JSONB;
  v_audit_new_row JSONB;
  v_changed_fields JSONB;
  v_primary_key_json JSONB;
  v_primary_key_value TEXT;
  v_primary_key_column TEXT;
  v_old_row_hash TEXT;
  v_new_row_hash TEXT;
  v_audit_event_hash TEXT;
  v_audit_id BIGINT;
  v_changed_at TIMESTAMPTZ;
  v_txid BIGINT;
  v_blockchain_key TEXT;
  v_app_user TEXT;
  v_app_role TEXT;
  v_user_agent TEXT;
  v_client_ip TEXT;
  v_client_hostname TEXT;
  v_application_name TEXT;
BEGIN
  SELECT
    c.*
  INTO v_config
  FROM blockchain.data_change_audit_config c
  WHERE lower(c.schema_name) = lower(TG_TABLE_SCHEMA)
    AND lower(c.table_name) = lower(TG_TABLE_NAME)
    AND c.audit_enabled = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  IF TG_OP = 'INSERT' AND COALESCE(v_config.capture_insert, true) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(v_config.capture_update, true) = false THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' AND COALESCE(v_config.capture_delete, true) = false THEN
    RETURN OLD;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    v_old_row := to_jsonb(OLD);
  ELSE
    v_old_row := NULL;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    v_new_row := to_jsonb(NEW);
  ELSE
    v_new_row := NULL;
  END IF;

  v_audit_old_row := CASE
    WHEN COALESCE(v_config.capture_old_row, true) THEN v_old_row
    ELSE NULL
  END;

  v_audit_new_row := CASE
    WHEN COALESCE(v_config.capture_new_row, true) THEN v_new_row
    ELSE NULL
  END;

  IF COALESCE(array_length(v_config.excluded_fields, 1), 0) > 0 THEN
    v_audit_old_row := CASE
      WHEN v_audit_old_row IS NULL THEN NULL
      ELSE v_audit_old_row - v_config.excluded_fields
    END;

    v_audit_new_row := CASE
      WHEN v_audit_new_row IS NULL THEN NULL
      ELSE v_audit_new_row - v_config.excluded_fields
    END;
  END IF;

  IF COALESCE(array_length(v_config.sensitive_fields, 1), 0) > 0 THEN
    v_audit_old_row := CASE
      WHEN v_audit_old_row IS NULL THEN NULL
      ELSE v_audit_old_row - v_config.sensitive_fields
    END;

    v_audit_new_row := CASE
      WHEN v_audit_new_row IS NULL THEN NULL
      ELSE v_audit_new_row - v_config.sensitive_fields
    END;
  END IF;

  v_changed_fields := blockchain.fn_audit_changed_fields(v_audit_old_row, v_audit_new_row);

  IF TG_OP = 'DELETE' THEN
    v_primary_key_json := blockchain.fn_audit_primary_key_json(v_old_row, v_config.primary_key_columns);
    v_primary_key_value := blockchain.fn_audit_primary_key_value(v_old_row, v_config.primary_key_columns);
  ELSE
    v_primary_key_json := blockchain.fn_audit_primary_key_json(v_new_row, v_config.primary_key_columns);
    v_primary_key_value := blockchain.fn_audit_primary_key_value(v_new_row, v_config.primary_key_columns);
  END IF;

  IF COALESCE(array_length(v_config.primary_key_columns, 1), 0) = 1 THEN
    v_primary_key_column := v_config.primary_key_columns[1];
  ELSE
    v_primary_key_column := array_to_string(v_config.primary_key_columns, ',');
  END IF;

  v_old_row_hash := CASE
    WHEN v_audit_old_row IS NULL THEN NULL
    ELSE blockchain.fn_audit_row_hash(v_audit_old_row)
  END;

  v_new_row_hash := CASE
    WHEN v_audit_new_row IS NULL THEN NULL
    ELSE blockchain.fn_audit_row_hash(v_audit_new_row)
  END;

  v_changed_at := clock_timestamp();
  v_txid := txid_current();

  v_audit_event_hash := blockchain.fn_audit_event_hash(
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    TG_OP,
    v_primary_key_json,
    v_old_row_hash,
    v_new_row_hash,
    v_changed_at,
    v_txid
  );

  v_blockchain_key := 'DATA_CHANGE_' ||
    upper(TG_TABLE_SCHEMA) || '_' ||
    upper(TG_TABLE_NAME) || '_' ||
    TG_OP || '_' ||
    substring(v_audit_event_hash from 1 for 24);

  v_app_user := COALESCE(
    NULLIF(current_setting('app.username', true), ''),
    NULLIF(current_setting('app.user_id', true), '')
  );

  v_app_role := NULLIF(current_setting('app.user_role', true), '');
  v_user_agent := NULLIF(current_setting('app.user_agent', true), '');
  v_client_ip := inet_client_addr()::TEXT;
  v_client_hostname := NULLIF(current_setting('app.client_hostname', true), '');
  v_application_name := current_setting('application_name', true);

  INSERT INTO blockchain.data_change_audit (
    schema_name,
    table_name,
    module_name,
    primary_key_column,
    primary_key_value,
    primary_key_json,
    operation_type,
    old_row_json,
    new_row_json,
    changed_fields,
    old_row_hash,
    new_row_hash,
    audit_event_hash,
    changed_by_app_user,
    changed_by_db_user,
    changed_by_role,
    client_ip,
    client_hostname,
    user_agent,
    application_name,
    postgres_transaction_id,
    changed_at,
    blockchain_key,
    blockchain_status,
    source_view_name,
    validation_status,
    approval_status,
    compliance_status
  )
  VALUES (
    TG_TABLE_SCHEMA,
    TG_TABLE_NAME,
    v_config.module_name,
    v_primary_key_column,
    v_primary_key_value,
    v_primary_key_json,
    TG_OP,
    v_audit_old_row,
    v_audit_new_row,
    v_changed_fields,
    v_old_row_hash,
    v_new_row_hash,
    v_audit_event_hash,
    v_app_user,
    current_user,
    v_app_role,
    v_client_ip,
    v_client_hostname,
    v_user_agent,
    v_application_name,
    v_txid,
    v_changed_at,
    v_blockchain_key,
    CASE WHEN COALESCE(v_config.blockchain_enabled, true) THEN 'PENDING' ELSE 'DISABLED' END,
    v_config.source_view_name,
    'VALIDATED',
    'PENDING',
    'PENDING'
  )
  RETURNING audit_id INTO v_audit_id;

  IF COALESCE(v_config.blockchain_enabled, true) THEN
    INSERT INTO blockchain.data_change_blockchain_outbox (
      audit_id,
      schema_name,
      blockchain_key,
      audit_event_hash,
      module_name,
      table_name,
      primary_key_value,
      operation_type,
      status,
      retry_count
    )
    VALUES (
      v_audit_id,
      TG_TABLE_SCHEMA,
      v_blockchain_key,
      v_audit_event_hash,
      v_config.module_name,
      TG_TABLE_NAME,
      v_primary_key_value,
      TG_OP,
      'PENDING',
      0
    );
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

COMMENT ON FUNCTION blockchain.fn_generic_data_change_audit_trigger() IS
  'Generic row-level data change audit trigger for INSERT, UPDATE, and DELETE on configured physical source tables.';

COMMIT;
