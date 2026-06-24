/*
STEP 3 — Confirm PostgreSQL Source Views

Purpose:
Inspect PostgreSQL views that may be used as source views for blockchain proof sync.

This script does not modify data.
It only lists available views, columns, and AML source view count.
*/

-- 1. Confirm connected database
SELECT
    current_database() AS database_name,
    current_user AS connected_user,
    current_schema() AS current_schema,
    inet_server_addr() AS server_address,
    inet_server_port() AS server_port;

-- 2. List views in important schemas
SELECT
    table_schema,
    table_name
FROM information_schema.views
WHERE table_schema IN ('blockchain', 'public', 'suitedba', 'sdedba')
ORDER BY table_schema, table_name;

-- 3. Inspect expected AML source view columns
SELECT
    table_schema,
    table_name,
    column_name,
    data_type,
    ordinal_position
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'valoores_aml_rules'
ORDER BY ordinal_position;

-- 4. Check if expected AML source view exists
SELECT
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM information_schema.views
            WHERE table_schema = 'blockchain'
              AND table_name = 'valoores_aml_rules'
        )
        THEN 'FOUND'
        ELSE 'MISSING'
    END AS aml_source_view_status;

-- 5. Count AML source records if view exists
DO $$
DECLARE
    v_exists BOOLEAN;
    v_count BIGINT;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.views
        WHERE table_schema = 'blockchain'
          AND table_name = 'valoores_aml_rules'
    )
    INTO v_exists;

    IF v_exists THEN
        EXECUTE 'SELECT COUNT(*) FROM blockchain.valoores_aml_rules' INTO v_count;
        RAISE NOTICE 'AML source view blockchain.valoores_aml_rules count: %', v_count;
    ELSE
        RAISE NOTICE 'AML source view blockchain.valoores_aml_rules is missing';
    END IF;
END $$;
