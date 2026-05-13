#!/bin/bash

OUTPUT_FILE="enterprise_db_schema.txt"

DB_HOST="${POSTGRES_HOST:-172.31.13.133}"
DB_PORT="${POSTGRES_PORT:-5444}"
DB_NAME="${POSTGRES_DATABASE:-vfds_dev}"
DB_USER="${POSTGRES_USER:-postgres}"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "ENTERPRISE DB SCHEMA EXPORT" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

run_sql () {
  TITLE="$1"
  SQL="$2"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "$TITLE" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  PGPASSWORD="${POSTGRES_PASSWORD}" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -c "$SQL" >> "$OUTPUT_FILE" 2>&1
}

run_sql "TABLE EXISTENCE CHECK" "
SELECT table_schema, table_name
FROM information_schema.tables
WHERE UPPER(table_schema) IN ('BLOCKCHAIN','SDEDBA','FINDBA','SUITEDBA','STS_STATUS','PUBLIC')
  AND UPPER(table_name) IN (
    'WALLETS',
    'TRANSACTIONS',
    'REFF_CUSTOMER',
    'REF_CUSTOMER',
    'CFG_CUSTOMER_DEF',
    'FIN_TRANSACTION',
    'CFG_OBJECT_API_DEF',
    'REF_COM_CURRENCY',
    'STS_STATUS'
  )
ORDER BY table_schema, table_name;
"

run_sql "COLUMN STRUCTURE CHECK" "
SELECT
  table_schema,
  table_name,
  ordinal_position,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default,
  character_maximum_length,
  numeric_precision,
  numeric_scale
FROM information_schema.columns
WHERE UPPER(table_schema) IN ('BLOCKCHAIN','SDEDBA','FINDBA','SUITEDBA','STS_STATUS','PUBLIC')
  AND UPPER(table_name) IN (
    'WALLETS',
    'TRANSACTIONS',
    'REFF_CUSTOMER',
    'REF_CUSTOMER',
    'CFG_CUSTOMER_DEF',
    'FIN_TRANSACTION',
    'CFG_OBJECT_API_DEF',
    'REF_COM_CURRENCY',
    'STS_STATUS'
  )
ORDER BY table_schema, table_name, ordinal_position;
"

run_sql "SEQUENCE CHECK" "
SELECT sequence_schema, sequence_name, data_type
FROM information_schema.sequences
WHERE UPPER(sequence_name) IN (
  'S_CUSTOMER',
  'S_FIN_TRANSACTION'
)
ORDER BY sequence_schema, sequence_name;
"

run_sql "CONSTRAINT CHECK" "
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE UPPER(tc.table_schema) IN ('BLOCKCHAIN','SDEDBA','FINDBA','SUITEDBA')
  AND UPPER(tc.table_name) IN (
    'WALLETS',
    'TRANSACTIONS',
    'REFF_CUSTOMER',
    'REF_CUSTOMER',
    'CFG_CUSTOMER_DEF',
    'FIN_TRANSACTION',
    'CFG_OBJECT_API_DEF'
  )
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;
"

run_sql "CURRENCY SAMPLE" "
SELECT *
FROM SDEDBA.REF_COM_CURRENCY
LIMIT 20;
"

run_sql "STATUS SAMPLE" "
SELECT *
FROM STS_STATUS
LIMIT 20;
"

echo ""
echo "Export completed:"
echo "$OUTPUT_FILE"
