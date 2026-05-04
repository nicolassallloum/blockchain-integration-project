BEGIN;

DO $$
DECLARE
    v_schema_name TEXT := 'blockchain';
    v_table_name  TEXT := 'organizations';

    v_org_id UUID := gen_random_uuid();

    v_columns TEXT[];

    v_id_column TEXT;
    v_code_column TEXT;
    v_name_column TEXT;

    v_insert_columns TEXT := '';
    v_insert_values  TEXT := '';

    v_exists_sql TEXT;
    v_exists BOOLEAN := FALSE;

    v_sql TEXT;
BEGIN
    SELECT array_agg(column_name::TEXT ORDER BY ordinal_position)
    INTO v_columns
    FROM information_schema.columns
    WHERE table_schema = v_schema_name
      AND table_name = v_table_name
      AND is_generated = 'NEVER';

    IF v_columns IS NULL THEN
        RAISE EXCEPTION 'Table %.% does not exist', v_schema_name, v_table_name;
    END IF;

    /*
      Detect ID column
    */
    IF 'organization_id' = ANY(v_columns) THEN
        v_id_column := 'organization_id';
    ELSIF 'id' = ANY(v_columns) THEN
        v_id_column := 'id';
    ELSIF 'org_id' = ANY(v_columns) THEN
        v_id_column := 'org_id';
    ELSE
        v_id_column := NULL;
    END IF;

    /*
      Detect organization code column
    */
    IF 'organization_code' = ANY(v_columns) THEN
        v_code_column := 'organization_code';
    ELSIF 'org_code' = ANY(v_columns) THEN
        v_code_column := 'org_code';
    ELSIF 'code' = ANY(v_columns) THEN
        v_code_column := 'code';
    ELSIF 'bank_code' = ANY(v_columns) THEN
        v_code_column := 'bank_code';
    ELSIF 'external_org_id' = ANY(v_columns) THEN
        v_code_column := 'external_org_id';
    ELSE
        v_code_column := NULL;
    END IF;

    /*
      Detect organization name column
    */
    IF 'organization_name' = ANY(v_columns) THEN
        v_name_column := 'organization_name';
    ELSIF 'org_name' = ANY(v_columns) THEN
        v_name_column := 'org_name';
    ELSIF 'name' = ANY(v_columns) THEN
        v_name_column := 'name';
    ELSIF 'bank_name' = ANY(v_columns) THEN
        v_name_column := 'bank_name';
    ELSE
        v_name_column := NULL;
    END IF;

    RAISE NOTICE 'Detected id column: %', v_id_column;
    RAISE NOTICE 'Detected code column: %', v_code_column;
    RAISE NOTICE 'Detected name column: %', v_name_column;

    /*
      Duplicate check using dynamic SQL only on existing column.
    */
    IF v_code_column IS NOT NULL THEN
        v_exists_sql := format(
            'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = $1)',
            v_schema_name,
            v_table_name,
            v_code_column
        );

        EXECUTE v_exists_sql INTO v_exists USING 'BANK001';

        IF v_exists THEN
            RAISE NOTICE 'BANK001 already exists in %.%. Skipping insert.', v_schema_name, v_table_name;
            RETURN;
        END IF;
    END IF;

    /*
      ID column
    */
    IF v_id_column IS NOT NULL THEN
        v_insert_columns := v_insert_columns || format('%I, ', v_id_column);
        v_insert_values  := v_insert_values  || quote_literal(v_org_id) || '::uuid, ';
    END IF;

    /*
      Code column
    */
    IF v_code_column IS NOT NULL THEN
        v_insert_columns := v_insert_columns || format('%I, ', v_code_column);
        v_insert_values  := v_insert_values  || quote_literal('BANK001') || ', ';
    END IF;

    /*
      Name column
    */
    IF v_name_column IS NOT NULL THEN
        v_insert_columns := v_insert_columns || format('%I, ', v_name_column);
        v_insert_values  := v_insert_values  || quote_literal('Bank 001') || ', ';
    END IF;

    /*
      Organization type columns
    */
    IF 'organization_type' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'organization_type, ';
        v_insert_values  := v_insert_values  || quote_literal('BANK') || ', ';
    END IF;

    IF 'org_type' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'org_type, ';
        v_insert_values  := v_insert_values  || quote_literal('BANK') || ', ';
    END IF;

    IF 'type' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'type, ';
        v_insert_values  := v_insert_values  || quote_literal('BANK') || ', ';
    END IF;

    /*
      Status columns
    */
    IF 'status' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'status, ';
        v_insert_values  := v_insert_values  || quote_literal('ACTIVE') || ', ';
    END IF;

    IF 'organization_status' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'organization_status, ';
        v_insert_values  := v_insert_values  || quote_literal('ACTIVE') || ', ';
    END IF;

    /*
      Contact columns
    */
    IF 'email' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'email, ';
        v_insert_values  := v_insert_values  || quote_literal('bank001@blockchain.local') || ', ';
    END IF;

    IF 'contact_email' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'contact_email, ';
        v_insert_values  := v_insert_values  || quote_literal('bank001@blockchain.local') || ', ';
    END IF;

    IF 'phone' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'phone, ';
        v_insert_values  := v_insert_values  || quote_literal('+96100000000') || ', ';
    END IF;

    IF 'phone_number' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'phone_number, ';
        v_insert_values  := v_insert_values  || quote_literal('+96100000000') || ', ';
    END IF;

    /*
      Country / location columns
    */
    IF 'country' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'country, ';
        v_insert_values  := v_insert_values  || quote_literal('Lebanon') || ', ';
    END IF;

    IF 'country_code' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'country_code, ';
        v_insert_values  := v_insert_values  || quote_literal('LB') || ', ';
    END IF;

    IF 'city' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'city, ';
        v_insert_values  := v_insert_values  || quote_literal('Beirut') || ', ';
    END IF;

    /*
      JSONB columns
    */
    IF 'address' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'address, ';
        v_insert_values  := v_insert_values  || quote_literal('{"country":"Lebanon","city":"Beirut","addressLine":"Bank 001 HQ"}') || '::jsonb, ';
    END IF;

    IF 'metadata' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'metadata, ';
        v_insert_values  := v_insert_values  || quote_literal('{"source":"STEP_21_WALLET_CREATION_API","businessCode":"BANK001","createdFor":"Blockchain Integration Project"}') || '::jsonb, ';
    END IF;

    IF 'extra_data' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'extra_data, ';
        v_insert_values  := v_insert_values  || quote_literal('{"source":"STEP_21_WALLET_CREATION_API"}') || '::jsonb, ';
    END IF;

    /*
      Audit columns
    */
    IF 'created_by' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'created_by, ';
        v_insert_values  := v_insert_values  || quote_literal('nix') || ', ';
    END IF;

    IF 'updated_by' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'updated_by, ';
        v_insert_values  := v_insert_values  || quote_literal('nix') || ', ';
    END IF;

    IF 'created_at' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'created_at, ';
        v_insert_values  := v_insert_values  || 'NOW(), ';
    END IF;

    IF 'updated_at' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'updated_at, ';
        v_insert_values  := v_insert_values  || 'NOW(), ';
    END IF;

    IF 'is_active' = ANY(v_columns) THEN
        v_insert_columns := v_insert_columns || 'is_active, ';
        v_insert_values  := v_insert_values  || 'TRUE, ';
    END IF;

    /*
      Clean trailing comma
    */
    v_insert_columns := regexp_replace(v_insert_columns, ', $', '');
    v_insert_values  := regexp_replace(v_insert_values, ', $', '');

    IF v_insert_columns = '' THEN
        RAISE EXCEPTION 'No compatible columns found for %.%', v_schema_name, v_table_name;
    END IF;

    v_sql := format(
        'INSERT INTO %I.%I (%s) VALUES (%s);',
        v_schema_name,
        v_table_name,
        v_insert_columns,
        v_insert_values
    );

    RAISE NOTICE 'Executing: %', v_sql;

    EXECUTE v_sql;

    RAISE NOTICE 'BANK001 inserted successfully with organization UUID: %', v_org_id;
END $$;

COMMIT;