#!/bin/bash

set -e

# ============================================================
# Blockchain Integration Project
# Collect all needed code into ONE SINGLE TEXT FILE
# ============================================================

BASE_DIR="/home/nix/u01/blockchain-integration"

BACKEND_DIR="$BASE_DIR/blockchain-api"
CHAINCODE_DIR="$BASE_DIR/chaincode/kyc-wallet-chaincode-js"
ANGULAR_DIR="$BASE_DIR/blockchain-test-ui"

OUTPUT_DIR="/tmp/blockchain_one_file_export_$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="$OUTPUT_DIR/blockchain_all_needed_codes.txt"
ZIP_FILE="$OUTPUT_DIR.zip"

DB_HOST="172.31.13.133"
DB_PORT="5444"
DB_NAME="vfds_dev"
DB_USER="postrges"

mkdir -p "$OUTPUT_DIR"

echo "===================================================="
echo " Blockchain One File Code Export"
echo "===================================================="
echo "Output file : $OUTPUT_FILE"
echo "ZIP file    : $ZIP_FILE"
echo "Started At  : $(date)"
echo "===================================================="

# ============================================================
# Helper function to append file content
# ============================================================

append_file() {
  local file_path="$1"
  local section_name="$2"

  if [ -f "$file_path" ]; then
    {
      echo ""
      echo ""
      echo "============================================================"
      echo "FILE: $section_name"
      echo "FULL PATH: $file_path"
      echo "============================================================"
      echo ""
      cat "$file_path"
      echo ""
      echo "============================================================"
      echo "END FILE: $section_name"
      echo "============================================================"
      echo ""
    } >> "$OUTPUT_FILE"
  fi
}

# ============================================================
# Header
# ============================================================

cat > "$OUTPUT_FILE" <<EOF
============================================================
BLOCKCHAIN INTEGRATION PROJECT - ALL NEEDED CODES
============================================================
Generated At : $(date)
Server Base  : $BASE_DIR

Purpose:
This file contains all needed source code and database structure
to update the Blockchain Integration Project data modeling,
wallet creation logic, transaction creation logic, PostgreSQL
synchronization, Fabric integration, and Angular payload mapping.

Main Required Update:
1. Wallet creation must sync:
   - BLOCKCHAIN.WALLETS
   - SDEDBA.REFF_CUSTOMER / SDEDBA.REF_CUSTOMER
   - SDEDBA.CFG_CUSTOMER_DEF

2. Transaction creation must sync:
   - BLOCKCHAIN.TRANSACTIONS
   - FINDBA.FIN_TRANSACTION
   - SUITEDBA.CFG_OBJECT_API_DEF

============================================================
EOF

# ============================================================
# 1. Backend API code
# ============================================================

echo "Collecting Backend API code..."

{
  echo ""
  echo "############################################################"
  echo "# SECTION 1 - BACKEND API FILES"
  echo "############################################################"
} >> "$OUTPUT_FILE"

if [ -d "$BACKEND_DIR" ]; then
  cd "$BACKEND_DIR"

  append_file "$BACKEND_DIR/package.json" "backend-api/package.json"
  append_file "$BACKEND_DIR/package-lock.json" "backend-api/package-lock.json"
  append_file "$BACKEND_DIR/README.md" "backend-api/README.md"

  if [ -f "$BACKEND_DIR/.env" ]; then
    SANITIZED_ENV="$OUTPUT_DIR/backend_env_sanitized.txt"
    sed -E \
      -e 's/(PASSWORD|PASS|SECRET|KEY|TOKEN|PRIVATE|API_KEY|JWT_SECRET)=.*/\1=****/Ig' \
      "$BACKEND_DIR/.env" > "$SANITIZED_ENV"

    append_file "$SANITIZED_ENV" "backend-api/.env SANITIZED"
  fi

  find src -type f \
    \( -name "*.js" -o -name "*.json" -o -name "*.ts" \) \
    | grep -Ei "server|app|route|controller|service|repository|fabric|wallet|transaction|database|postgres|pool|logger|error|auth|api|correlation|config|middleware|helper|util" \
    | sort \
    | while read f; do
        append_file "$BACKEND_DIR/$f" "backend-api/$f"
      done

  find . -maxdepth 5 -type f \
    \( -name "*.sql" -o -name "*.md" \) \
    | grep -Ei "wallet|transaction|blockchain|fabric|postgres|migration|schema|database|sync|customer|finance|audit" \
    | sort \
    | while read f; do
        CLEAN_PATH="${f#./}"
        append_file "$BACKEND_DIR/$CLEAN_PATH" "backend-api-extra/$CLEAN_PATH"
      done
else
  echo "WARNING: Backend directory not found: $BACKEND_DIR" >> "$OUTPUT_FILE"
fi

# ============================================================
# 2. Chaincode code
# ============================================================

echo "Collecting Chaincode code..."

{
  echo ""
  echo "############################################################"
  echo "# SECTION 2 - HYPERLEDGER FABRIC CHAINCODE FILES"
  echo "############################################################"
} >> "$OUTPUT_FILE"

if [ -d "$CHAINCODE_DIR" ]; then
  cd "$CHAINCODE_DIR"

  append_file "$CHAINCODE_DIR/package.json" "chaincode/package.json"
  append_file "$CHAINCODE_DIR/package-lock.json" "chaincode/package-lock.json"
  append_file "$CHAINCODE_DIR/README.md" "chaincode/README.md"
  append_file "$CHAINCODE_DIR/index.js" "chaincode/index.js"

  find . -type f \
    \( -name "*.js" -o -name "*.json" \) \
    ! -path "./node_modules/*" \
    ! -path "./coverage/*" \
    | grep -Ei "wallet|transaction|chaincode|index|contract|lib|model|query|history|transfer|organization|customer|META-INF|indexes" \
    | sort \
    | while read f; do
        CLEAN_PATH="${f#./}"
        append_file "$CHAINCODE_DIR/$CLEAN_PATH" "chaincode/$CLEAN_PATH"
      done
else
  echo "WARNING: Chaincode directory not found: $CHAINCODE_DIR" >> "$OUTPUT_FILE"
fi

# ============================================================
# 3. Angular UI code
# ============================================================

echo "Collecting Angular UI code..."

{
  echo ""
  echo "############################################################"
  echo "# SECTION 3 - ANGULAR UI FILES"
  echo "############################################################"
} >> "$OUTPUT_FILE"

if [ -d "$ANGULAR_DIR" ]; then
  cd "$ANGULAR_DIR"

  append_file "$ANGULAR_DIR/package.json" "angular-ui/package.json"
  append_file "$ANGULAR_DIR/angular.json" "angular-ui/angular.json"
  append_file "$ANGULAR_DIR/tsconfig.json" "angular-ui/tsconfig.json"
  append_file "$ANGULAR_DIR/README.md" "angular-ui/README.md"

  find src -type f \
    \( -name "*.ts" -o -name "*.html" -o -name "*.scss" -o -name "*.css" -o -name "*.json" \) \
    | grep -Ei "app.routes|wallet|transaction|organization|dashboard|fabric|blockchain|api|service|environment|sidebar|layout|login|query|history|transfer|create" \
    | sort \
    | while read f; do
        append_file "$ANGULAR_DIR/$f" "angular-ui/$f"
      done
else
  echo "WARNING: Angular directory not found: $ANGULAR_DIR" >> "$OUTPUT_FILE"
fi

# ============================================================
# 4. PostgreSQL DB structure export
# ============================================================

echo "Creating PostgreSQL DB structure export..."

{
  echo ""
  echo "############################################################"
  echo "# SECTION 4 - POSTGRESQL DATABASE STRUCTURE"
  echo "############################################################"
} >> "$OUTPUT_FILE"

SQL_FILE="$OUTPUT_DIR/export_blockchain_model_info.sql"
DB_OUTPUT_FILE="$OUTPUT_DIR/blockchain_model_info_output.txt"

cat > "$SQL_FILE" <<'SQL'
\pset pager off
\pset border 2

\echo '===================================================='
\echo 'SCHEMAS'
\echo '===================================================='
SELECT schema_name
FROM information_schema.schemata
WHERE upper(schema_name) IN ('BLOCKCHAIN','SDEDBA','SDEBDA','FINDBA','SUITEDBA')
ORDER BY schema_name;

\echo '===================================================='
\echo 'BLOCKCHAIN.WALLETS COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'BLOCKCHAIN'
  AND upper(table_name) = 'WALLETS'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'BLOCKCHAIN.TRANSACTIONS COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'BLOCKCHAIN'
  AND upper(table_name) = 'TRANSACTIONS'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'CUSTOMER TABLES'
\echo '===================================================='
SELECT table_schema, table_name
FROM information_schema.tables
WHERE upper(table_schema) IN ('SDEDBA','SDEBDA')
  AND upper(table_name) IN ('REFF_CUSTOMER','REF_CUSTOMER','CFG_CUSTOMER_DEF')
ORDER BY table_schema, table_name;

\echo '===================================================='
\echo 'CUSTOMER AND CURRENCY TABLE COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) IN ('SDEDBA','SDEBDA')
  AND upper(table_name) IN ('REFF_CUSTOMER','REF_CUSTOMER','CFG_CUSTOMER_DEF','REF_COM_CURRENCY')
ORDER BY table_schema, table_name, ordinal_position;

\echo '===================================================='
\echo 'FINDBA.FIN_TRANSACTION COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'FINDBA'
  AND upper(table_name) = 'FIN_TRANSACTION'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'SUITEDBA.CFG_OBJECT_API_DEF COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'SUITEDBA'
  AND upper(table_name) = 'CFG_OBJECT_API_DEF'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'STATUS TABLES AND COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_name) = 'STS_STATUS'
ORDER BY table_schema, table_name, ordinal_position;

\echo '===================================================='
\echo 'REQUIRED SEQUENCES'
\echo '===================================================='
SELECT sequence_schema, sequence_name, data_type
FROM information_schema.sequences
WHERE upper(sequence_schema) IN ('SDEDBA','SDEBDA','FINDBA','SUITEDBA','BLOCKCHAIN')
  AND (
       upper(sequence_name) LIKE '%CUSTOMER%'
    OR upper(sequence_name) LIKE '%FIN_TRANSACTION%'
    OR upper(sequence_name) LIKE '%CFG_CUSTOMER_DEF%'
    OR upper(sequence_name) LIKE '%OBJECT_API_DEF%'
    OR upper(sequence_name) LIKE '%WALLET%'
    OR upper(sequence_name) LIKE '%TRANSACTION%'
  )
ORDER BY sequence_schema, sequence_name;

\echo '===================================================='
\echo 'CURRENT BLOCKCHAIN INDEXES'
\echo '===================================================='
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE upper(schemaname) = 'BLOCKCHAIN'
  AND upper(tablename) IN ('WALLETS','TRANSACTIONS')
ORDER BY tablename, indexname;

\echo '===================================================='
\echo 'PRIMARY KEYS AND FOREIGN KEYS'
\echo '===================================================='
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
WHERE upper(tc.table_schema) IN ('BLOCKCHAIN','SDEDBA','SDEBDA','FINDBA','SUITEDBA')
  AND upper(tc.table_name) IN (
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
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;
SQL

append_file "$SQL_FILE" "postgresql/export_blockchain_model_info.sql"

if command -v psql >/dev/null 2>&1; then
  echo "Trying to run PostgreSQL structure export..."
  echo "If password is requested, enter PostgreSQL password."

  set +e
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$SQL_FILE" \
    > "$DB_OUTPUT_FILE" 2>&1
  DB_STATUS=$?
  set -e

  if [ "$DB_STATUS" -eq 0 ]; then
    append_file "$DB_OUTPUT_FILE" "postgresql/blockchain_model_info_output.txt"
  else
    {
      echo ""
      echo "============================================================"
      echo "POSTGRESQL EXPORT FAILED"
      echo "============================================================"
      echo "The SQL export script is included above."
      echo "Run it manually if needed:"
      echo "psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f $SQL_FILE > blockchain_model_info_output.txt"
      echo ""
      cat "$DB_OUTPUT_FILE"
      echo ""
    } >> "$OUTPUT_FILE"
  fi
else
  echo "WARNING: psql command not found. SQL script included only." >> "$OUTPUT_FILE"
fi

# ============================================================
# 5. Add file list summary
# ============================================================

{
  echo ""
  echo "############################################################"
  echo "# SECTION 5 - EXPORT SUMMARY"
  echo "############################################################"
  echo ""
  echo "Generated At: $(date)"
  echo "Output File : $OUTPUT_FILE"
  echo ""
  echo "File size:"
  ls -lh "$OUTPUT_FILE"
  echo ""
  echo "Line count:"
  wc -l "$OUTPUT_FILE"
} >> "$OUTPUT_FILE"

# ============================================================
# 6. Zip one file
# ============================================================

cd "$OUTPUT_DIR"
zip -q "$(basename "$ZIP_FILE")" "$(basename "$OUTPUT_FILE")"
mv "$(basename "$ZIP_FILE")" "$ZIP_FILE"

echo ""
echo "===================================================="
echo "DONE"
echo "===================================================="
echo "ONE FILE CREATED:"
echo "$OUTPUT_FILE"
echo ""
echo "ZIP CREATED:"
echo "$ZIP_FILE"
echo ""
echo "Copy to your Windows PC using PowerShell:"
echo ""
echo "New-Item -ItemType Directory -Force \"C:\\Users\\Public\\BlockChain\\Updated Files\""
echo "scp nix@172.31.13.90:$ZIP_FILE \"C:\\Users\\Public\\BlockChain\\Updated Files\\blockchain_all_needed_codes.zip\""
echo "===================================================="

