#!/bin/bash

set -e

# ============================================================
# Blockchain Integration Project - File Collection Script
# Purpose: Collect all files needed for ChatGPT to update
# wallet creation, transaction creation, PostgreSQL sync,
# Fabric integration, and Angular payload mapping.
# ============================================================

BASE_DIR="/home/nix/u01/blockchain-integration"
OUTPUT_DIR="/tmp/blockchain_update_package_$(date +%Y%m%d_%H%M%S)"
ZIP_FILE="${OUTPUT_DIR}.zip"

BACKEND_DIR="$BASE_DIR/blockchain-api"
CHAINCODE_DIR="$BASE_DIR/chaincode/kyc-wallet-chaincode-js"
ANGULAR_DIR="$BASE_DIR/blockchain-test-ui"

DB_HOST="172.31.13.133"
DB_PORT="5444"
DB_NAME="vfds_dev"
DB_USER="postrges"

echo "===================================================="
echo " Blockchain Update Files Collector"
echo "===================================================="
echo "Output Folder : $OUTPUT_DIR"
echo "Output ZIP    : $ZIP_FILE"
echo "Started At    : $(date)"
echo "===================================================="

mkdir -p "$OUTPUT_DIR"

# ============================================================
# 1. Backend API Files
# ============================================================

echo ""
echo "===================================================="
echo "Collecting Backend API files..."
echo "===================================================="

if [ -d "$BACKEND_DIR" ]; then
  mkdir -p "$OUTPUT_DIR/backend-api"

  cd "$BACKEND_DIR"

  # Main config files
  cp -v package.json "$OUTPUT_DIR/backend-api/" 2>/dev/null || true
  cp -v package-lock.json "$OUTPUT_DIR/backend-api/" 2>/dev/null || true
  cp -v README.md "$OUTPUT_DIR/backend-api/" 2>/dev/null || true

  # Copy .env safely as env.example
  if [ -f ".env" ]; then
    sed -E \
      -e 's/(PASSWORD|PASS|SECRET|KEY|TOKEN|PRIVATE|API_KEY|JWT_SECRET)=.*/\1=****/Ig' \
      .env > "$OUTPUT_DIR/backend-api/env.example"
    echo "Copied sanitized .env to env.example"
  fi

  # Source files needed for wallet, transaction, DB, Fabric, security
  find src -type f \
    \( -name "*.js" -o -name "*.json" -o -name "*.ts" \) \
    | grep -Ei "server|app|route|controller|service|repository|fabric|wallet|transaction|database|postgres|pool|logger|error|auth|api|correlation|config|middleware|helper|util" \
    | while read f; do
        mkdir -p "$OUTPUT_DIR/backend-api/$(dirname "$f")"
        cp -v "$f" "$OUTPUT_DIR/backend-api/$f"
      done

  # SQL / migration files if exist
  find . -maxdepth 4 -type f \
    \( -name "*.sql" -o -name "*.md" \) \
    | grep -Ei "wallet|transaction|blockchain|fabric|postgres|migration|schema|database|sync|customer|finance|audit" \
    | while read f; do
        CLEAN_PATH="${f#./}"
        mkdir -p "$OUTPUT_DIR/backend-api-extra/$(dirname "$CLEAN_PATH")"
        cp -v "$f" "$OUTPUT_DIR/backend-api-extra/$CLEAN_PATH"
      done
else
  echo "WARNING: Backend directory not found: $BACKEND_DIR"
fi

# ============================================================
# 2. Chaincode Files
# ============================================================

echo ""
echo "===================================================="
echo "Collecting Chaincode files..."
echo "===================================================="

if [ -d "$CHAINCODE_DIR" ]; then
  mkdir -p "$OUTPUT_DIR/chaincode"

  cd "$CHAINCODE_DIR"

  cp -v package.json "$OUTPUT_DIR/chaincode/" 2>/dev/null || true
  cp -v package-lock.json "$OUTPUT_DIR/chaincode/" 2>/dev/null || true
  cp -v README.md "$OUTPUT_DIR/chaincode/" 2>/dev/null || true
  cp -v index.js "$OUTPUT_DIR/chaincode/" 2>/dev/null || true

  find . -type f \
    \( -name "*.js" -o -name "*.json" \) \
    ! -path "./node_modules/*" \
    ! -path "./coverage/*" \
    | grep -Ei "wallet|transaction|chaincode|index|contract|lib|model|query|history|transfer|organization|customer|META-INF|indexes" \
    | while read f; do
        CLEAN_PATH="${f#./}"
        mkdir -p "$OUTPUT_DIR/chaincode/$(dirname "$CLEAN_PATH")"
        cp -v "$f" "$OUTPUT_DIR/chaincode/$CLEAN_PATH"
      done
else
  echo "WARNING: Chaincode directory not found: $CHAINCODE_DIR"
fi

# ============================================================
# 3. Angular UI Files
# ============================================================

echo ""
echo "===================================================="
echo "Collecting Angular UI files..."
echo "===================================================="

if [ -d "$ANGULAR_DIR" ]; then
  mkdir -p "$OUTPUT_DIR/angular-ui"

  cd "$ANGULAR_DIR"

  cp -v package.json "$OUTPUT_DIR/angular-ui/" 2>/dev/null || true
  cp -v angular.json "$OUTPUT_DIR/angular-ui/" 2>/dev/null || true
  cp -v tsconfig.json "$OUTPUT_DIR/angular-ui/" 2>/dev/null || true
  cp -v README.md "$OUTPUT_DIR/angular-ui/" 2>/dev/null || true

  find src -type f \
    \( -name "*.ts" -o -name "*.html" -o -name "*.scss" -o -name "*.css" -o -name "*.json" \) \
    | grep -Ei "app.routes|wallet|transaction|organization|dashboard|fabric|blockchain|api|service|environment|sidebar|layout|login|query|history|transfer|create" \
    | while read f; do
        mkdir -p "$OUTPUT_DIR/angular-ui/$(dirname "$f")"
        cp -v "$f" "$OUTPUT_DIR/angular-ui/$f"
      done
else
  echo "WARNING: Angular directory not found: $ANGULAR_DIR"
fi

# ============================================================
# 4. PostgreSQL Structure Export Script
# ============================================================

echo ""
echo "===================================================="
echo "Creating PostgreSQL structure export SQL..."
echo "===================================================="

cat > "$OUTPUT_DIR/export_blockchain_model_info.sql" <<'SQL'
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
\echo 'SDEDBA / SDEBDA CUSTOMER AND CURRENCY TABLE COLUMNS'
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

# ============================================================
# 5. Try to Export PostgreSQL Structure
# ============================================================

echo ""
echo "===================================================="
echo "Trying PostgreSQL structure export..."
echo "===================================================="
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "User    : $DB_USER"
echo ""
echo "If password is requested, enter PostgreSQL password."
echo ""

if command -v psql >/dev/null 2>&1; then
  set +e
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -f "$OUTPUT_DIR/export_blockchain_model_info.sql" \
    > "$OUTPUT_DIR/blockchain_model_info_output.txt" 2>&1
  DB_EXPORT_STATUS=$?
  set -e

  if [ "$DB_EXPORT_STATUS" -eq 0 ]; then
    echo "PostgreSQL structure exported successfully."
  else
    echo "WARNING: PostgreSQL export failed."
    echo "The SQL file is still included. You can run it manually later."
  fi
else
  echo "WARNING: psql command not found. SQL export script created only."
fi

# ============================================================
# 6. Create Project Tree Summary
# ============================================================

echo ""
echo "===================================================="
echo "Creating project tree summary..."
echo "===================================================="

{
  echo "Blockchain Integration Project File Summary"
  echo "Generated At: $(date)"
  echo ""
  echo "BASE_DIR: $BASE_DIR"
  echo "BACKEND_DIR: $BACKEND_DIR"
  echo "CHAINCODE_DIR: $CHAINCODE_DIR"
  echo "ANGULAR_DIR: $ANGULAR_DIR"
  echo ""
  echo "Collected Files:"
  find "$OUTPUT_DIR" -type f | sort
} > "$OUTPUT_DIR/FILES_INCLUDED.txt"

# ============================================================
# 7. Zip Final Package
# ============================================================

echo ""
echo "===================================================="
echo "Creating ZIP file..."
echo "===================================================="

cd /tmp
zip -r "$ZIP_FILE" "$(basename "$OUTPUT_DIR")" >/dev/null

echo ""
echo "===================================================="
echo "DONE"
echo "===================================================="
echo "ZIP File Created:"
echo "$ZIP_FILE"
echo ""
echo "Send this file to ChatGPT:"
echo "$ZIP_FILE"
echo ""
echo "To copy it to your Windows PC, run this from PowerShell:"
echo ""
echo "scp nix@172.31.13.90:$ZIP_FILE \"C:\\Users\\Public\\BlockChain\\Updated Files\\\""
echo "===================================================="

