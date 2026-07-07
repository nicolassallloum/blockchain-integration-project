\set ON_ERROR_STOP on

BEGIN;

-- PostgreSQL 18 provides pg_catalog.sha256(bytea); pgcrypto is not required.

CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_text_sha256(p_input TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(pg_catalog.sha256(convert_to(COALESCE(p_input, ''), 'UTF8')), 'hex');
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_jsonb_sha256(p_input JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT blockchain.fn_audit_text_sha256(COALESCE(p_input, '{}'::jsonb)::text);
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_row_hash(p_row JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT blockchain.fn_audit_jsonb_sha256(COALESCE(p_row, '{}'::jsonb));
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_changed_fields(
  p_old_row JSONB,
  p_new_row JSONB
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  WITH keys AS (
    SELECT jsonb_object_keys(COALESCE(p_old_row, '{}'::jsonb)) AS field_name
    UNION
    SELECT jsonb_object_keys(COALESCE(p_new_row, '{}'::jsonb)) AS field_name
  ),
  changed AS (
    SELECT
      field_name,
      COALESCE(p_old_row, '{}'::jsonb) -> field_name AS old_value,
      COALESCE(p_new_row, '{}'::jsonb) -> field_name AS new_value
    FROM keys
    WHERE (COALESCE(p_old_row, '{}'::jsonb) -> field_name)
       IS DISTINCT FROM
          (COALESCE(p_new_row, '{}'::jsonb) -> field_name)
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'field_name', field_name,
        'old_value', old_value,
        'new_value', new_value
      )
      ORDER BY field_name
    ),
    '[]'::jsonb
  )
  FROM changed;
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_primary_key_json(
  p_row JSONB,
  p_primary_key_columns TEXT[]
)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    jsonb_object_agg(pk_col, COALESCE(p_row, '{}'::jsonb) -> pk_col),
    '{}'::jsonb
  )
  FROM unnest(COALESCE(p_primary_key_columns, ARRAY[]::TEXT[])) AS pk_col;
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_primary_key_value(
  p_row JSONB,
  p_primary_key_columns TEXT[]
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    string_agg(
      pk_col || '=' || COALESCE(COALESCE(p_row, '{}'::jsonb) ->> pk_col, ''),
      '|'
      ORDER BY pk_col
    ),
    ''
  )
  FROM unnest(COALESCE(p_primary_key_columns, ARRAY[]::TEXT[])) AS pk_col;
$$;

CREATE OR REPLACE FUNCTION blockchain.fn_audit_event_hash(
  p_schema_name TEXT,
  p_table_name TEXT,
  p_operation_type TEXT,
  p_primary_key_json JSONB,
  p_old_row_hash TEXT,
  p_new_row_hash TEXT,
  p_changed_at TIMESTAMPTZ,
  p_postgres_transaction_id BIGINT
)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT blockchain.fn_audit_text_sha256(
    jsonb_build_object(
      'schema_name', p_schema_name,
      'table_name', p_table_name,
      'operation_type', p_operation_type,
      'primary_key_json', COALESCE(p_primary_key_json, '{}'::jsonb),
      'old_row_hash', p_old_row_hash,
      'new_row_hash', p_new_row_hash,
      'changed_at', p_changed_at,
      'postgres_transaction_id', p_postgres_transaction_id
    )::text
  );
$$;

COMMENT ON FUNCTION blockchain.fn_audit_text_sha256(TEXT) IS
  'Returns SHA-256 hex hash for text input using PostgreSQL built-in sha256.';

COMMENT ON FUNCTION blockchain.fn_audit_jsonb_sha256(JSONB) IS
  'Returns SHA-256 hex hash for normalized JSONB input.';

COMMENT ON FUNCTION blockchain.fn_audit_row_hash(JSONB) IS
  'Returns SHA-256 row hash for audit old/new row JSONB.';

COMMENT ON FUNCTION blockchain.fn_audit_changed_fields(JSONB, JSONB) IS
  'Returns JSONB array of changed fields with old and new values.';

COMMENT ON FUNCTION blockchain.fn_audit_primary_key_json(JSONB, TEXT[]) IS
  'Builds JSONB primary-key object from row JSONB and configured primary-key columns.';

COMMENT ON FUNCTION blockchain.fn_audit_primary_key_value(JSONB, TEXT[]) IS
  'Builds deterministic text primary-key value from configured primary-key columns.';

COMMENT ON FUNCTION blockchain.fn_audit_event_hash(TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TIMESTAMPTZ, BIGINT) IS
  'Builds deterministic audit event hash for a PostgreSQL data change event.';

COMMIT;
