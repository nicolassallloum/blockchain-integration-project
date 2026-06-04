#!/bin/bash

set -e

BASE_DIR="/home/nix/u01/blockchain-integration"
API_DIR="$BASE_DIR/blockchain-api"
UI_DIR="$BASE_DIR/blockchain-test-ui"
OUT_DIR="$BASE_DIR/resident-wallets-debug-export"
ZIP_FILE="$BASE_DIR/resident-wallets-debug-export.zip"

DB_HOST="172.31.13.133"
DB_PORT="5444"
DB_USER="pgdata"
DB_NAME="vfds_dev"

echo "=================================================="
echo " Resident Wallets Debug Export"
echo "=================================================="

rm -rf "$OUT_DIR" "$ZIP_FILE"
mkdir -p "$OUT_DIR/backend"
mkdir -p "$OUT_DIR/angular"
mkdir -p "$OUT_DIR/sql"
mkdir -p "$OUT_DIR/api-tests"
mkdir -p "$OUT_DIR/logs"

echo "[1/7] Copying backend files..."

if [ -d "$API_DIR" ]; then
  cp "$API_DIR/package.json" "$OUT_DIR/backend/package.json" 2>/dev/null || true
  cp "$API_DIR/src/server.js" "$OUT_DIR/backend/server.js" 2>/dev/null || true

  mkdir -p "$OUT_DIR/backend/src/config"
  cp "$API_DIR/src/config/database.js" "$OUT_DIR/backend/src/config/database.js" 2>/dev/null || true

  mkdir -p "$OUT_DIR/backend/src/routes"
  cp -r "$API_DIR/src/routes/"* "$OUT_DIR/backend/src/routes/" 2>/dev/null || true

  if [ -f "$API_DIR/.env" ]; then
    sed -E \
      -e 's/(PASSWORD|DB_PASSWORD|JWT_SECRET|API_KEY|SECRET|TOKEN|PRIVATE_KEY)=.*/\1=HIDDEN/g' \
      -e 's/(password|db_password|jwt_secret|api_key|secret|token|private_key)=.*/\1=HIDDEN/g' \
      "$API_DIR/.env" > "$OUT_DIR/backend/.env.sanitized"
  fi
else
  echo "WARNING: Backend directory not found: $API_DIR" | tee "$OUT_DIR/logs/warnings.txt"
fi

echo "[2/7] Copying Angular files..."

if [ -d "$UI_DIR" ]; then
  mkdir -p "$OUT_DIR/angular/src/app"

  find "$UI_DIR/src/app" -type f \( \
    -iname "*resident-wallet*" -o \
    -iname "*government-blockchain*" -o \
    -iname "*api.service.ts" -o \
    -iname "*government-blockchain.service.ts" -o \
    -iname "*resident-wallets.service.ts" -o \
    -iname "*app-routing.module.ts" -o \
    -iname "*routing*.ts" \
  \) -exec cp --parents {} "$OUT_DIR/angular/" \; 2>/dev/null || true

  cp "$UI_DIR/package.json" "$OUT_DIR/angular/package.json" 2>/dev/null || true
  cp "$UI_DIR/angular.json" "$OUT_DIR/angular/angular.json" 2>/dev/null || true

  if [ -d "$UI_DIR/src/environments" ]; then
    mkdir -p "$OUT_DIR/angular/src/environments"
    cp -r "$UI_DIR/src/environments/"* "$OUT_DIR/angular/src/environments/" 2>/dev/null || true
  fi
else
  echo "WARNING: Angular directory not found: $UI_DIR" | tee -a "$OUT_DIR/logs/warnings.txt"
fi

echo "[3/7] Exporting database structure..."

PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -o "$OUT_DIR/sql/residents_columns.txt" <<'SQL'
SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'residents'
ORDER BY ordinal_position;
SQL

echo "[4/7] Exporting residents sample data..."

PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -o "$OUT_DIR/sql/residents_sample_30.txt" <<'SQL'
SELECT *
FROM blockchain.residents
ORDER BY id DESC
LIMIT 30;
SQL

echo "[5/7] Exporting safe resident wallet query test..."

PGPASSWORD="" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -o "$OUT_DIR/sql/resident_wallets_query_test.txt" <<'SQL'
SELECT
    r.id,
    r.wallet_address,
    r.resident_id,
    COALESCE(
        NULLIF(TRIM(r.full_name), ''),
        TRIM(CONCAT_WS(' ', r.first_name, r.father_name, r.last_name))
    ) AS resident_name,
    COALESCE(r.wallet_currency, 'GOV') AS currency,
    COALESCE(r.monthly_income, 0) AS current_balance,
    COALESCE(r.wallet_status, 'ACTIVE') AS wallet_status,
    COALESCE(r.blockchain_status, 'PENDING') AS blockchain_status,
    r.created_at
FROM blockchain.residents r
ORDER BY r.created_at DESC NULLS LAST, r.id DESC
LIMIT 30;
SQL

echo "[6/7] Testing APIs with curl..."

curl -s -X GET "http://172.31.13.90:3001/api/v1/health" \
  -H "Accept: application/json" \
  > "$OUT_DIR/api-tests/health_api_response.json" || true

curl -s -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/resident-wallets" \
  -H "Accept: application/json" \
  > "$OUT_DIR/api-tests/resident_wallets_api_response.json" || true

curl -s -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/resident-wallets?residentName=Nicolas" \
  -H "Accept: application/json" \
  > "$OUT_DIR/api-tests/resident_wallets_filter_name_response.json" || true

curl -s -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/resident-wallets?residentId=RES-BLOCKCHAIN-000043" \
  -H "Accept: application/json" \
  > "$OUT_DIR/api-tests/resident_wallets_filter_id_response.json" || true

echo "[7/7] Collecting useful grep outputs..."

if [ -d "$API_DIR/src" ]; then
  grep -R "resident-wallet\|residentWallet\|wallets\|residents" -n "$API_DIR/src" \
    > "$OUT_DIR/logs/backend_grep_resident_wallets.txt" 2>/dev/null || true
fi

if [ -d "$UI_DIR/src/app" ]; then
  grep -R "resident-wallet\|residentWallet\|Resident Wallet\|resident wallets\|government-blockchain" -n "$UI_DIR/src/app" \
    > "$OUT_DIR/logs/angular_grep_resident_wallets.txt" 2>/dev/null || true
fi

echo "Creating README..."

cat > "$OUT_DIR/README.txt" <<README
Resident Wallets Debug Export

Generated from:
$BASE_DIR

Included:
1. Backend files
2. Angular files related to Resident Wallets and Government Blockchain
3. Sanitized .env file
4. PostgreSQL residents table structure
5. PostgreSQL residents sample data
6. Resident wallets SQL query test
7. API curl responses
8. grep outputs for route/service/component tracing

Important:
- Passwords and secrets from .env were hidden.
- Upload this ZIP file to ChatGPT for analysis.
README

echo "Creating ZIP file..."

cd "$BASE_DIR"
zip -r "$ZIP_FILE" "$(basename "$OUT_DIR")" >/dev/null

echo "=================================================="
echo "Export completed successfully."
echo "ZIP file created:"
echo "$ZIP_FILE"
echo "=================================================="
