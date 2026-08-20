#!/usr/bin/env bash

set -uo pipefail

PROJECT_DIR="$HOME/u01/blockchain-integration"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
PACKAGE_NAME="kyc_exact_refresh_package_$TIMESTAMP"
OUT_DIR="$PROJECT_DIR/$PACKAGE_NAME"
FILES_DIR="$OUT_DIR/files"
DIAG_DIR="$OUT_DIR/diagnostics"
DB_DIR="$OUT_DIR/database"
LOG_DIR="$OUT_DIR/logs"

mkdir -p "$FILES_DIR" "$DIAG_DIR" "$DB_DIR" "$LOG_DIR"

cd "$PROJECT_DIR" || exit 1

copy_project_file() {
  local relative_path="$1"
  local source_path="$PROJECT_DIR/$relative_path"
  local destination_path="$FILES_DIR/$relative_path"

  if [ -f "$source_path" ]; then
    mkdir -p "$(dirname "$destination_path")"
    cp "$source_path" "$destination_path"
    echo "COPIED: $relative_path" \
      >> "$DIAG_DIR/copied_files.txt"
  else
    echo "MISSING: $relative_path" \
      >> "$DIAG_DIR/missing_files.txt"
  fi
}

###############################################################################
# 1. Backend KYC files
###############################################################################

copy_project_file \
  "blockchain-api/src/routes/blockchain-kyc.routes.js"

copy_project_file \
  "blockchain-api/src/controllers/blockchain-kyc.controller.js"

copy_project_file \
  "blockchain-api/src/services/blockchain-kyc.service.js"

###############################################################################
# 2. Wallet and password files
###############################################################################

copy_project_file \
  "blockchain-api/src/routes/wallet.routes.js"

copy_project_file \
  "blockchain-api/src/controllers/wallet.controller.js"

copy_project_file \
  "blockchain-api/src/services/wallet.service.js"

copy_project_file \
  "blockchain-api/src/controllers/wallet-auth.controller.js"

copy_project_file \
  "blockchain-api/src/services/wallet-auth.service.js"

copy_project_file \
  "blockchain-api/src/middlewares/wallet-login.validator.js"

###############################################################################
# 3. Fabric files
###############################################################################

copy_project_file \
  "blockchain-api/src/services/fabric.service.js"

copy_project_file \
  "blockchain-api/src/config/config.js"

###############################################################################
# 4. Backend route mounting
###############################################################################

copy_project_file \
  "blockchain-api/src/server.js"

copy_project_file \
  "blockchain-api/server.js"

copy_project_file \
  "blockchain-api/src/app.js"

copy_project_file \
  "blockchain-api/src/routes/index.js"

copy_project_file \
  "blockchain-api/src/routes/routes-index.js"

###############################################################################
# 5. PostgreSQL and repositories
###############################################################################

copy_project_file \
  "blockchain-api/src/config/database.js"

copy_project_file \
  "blockchain-api/src/db/applicationPostgres.js"

copy_project_file \
  "blockchain-api/src/db/blockchainPostgres.js"

copy_project_file \
  "blockchain-api/src/repositories/resident.repository.js"

###############################################################################
# 6. Existing VALOORES route for comparison
###############################################################################

copy_project_file \
  "blockchain-api/src/routes/valoores-blockchain.routes.js"

###############################################################################
# 7. Angular KYC screen
###############################################################################

copy_project_file \
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.ts"

copy_project_file \
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.html"

copy_project_file \
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.scss"

copy_project_file \
  "blockchain-test-ui/src/app/services/blockchain-kyc.service.ts"

###############################################################################
# 8. Angular routes and configuration
###############################################################################

copy_project_file \
  "blockchain-test-ui/src/app/app.routes.ts"

copy_project_file \
  "blockchain-test-ui/proxy.conf.json"

copy_project_file \
  "blockchain-test-ui/angular.json"

###############################################################################
# 9. Reusable resident/wallet screen
###############################################################################

copy_project_file \
  "blockchain-test-ui/src/app/pages/government-blockchain/create-resident-account/create-resident-account.component.ts"

copy_project_file \
  "blockchain-test-ui/src/app/pages/government-blockchain/create-resident-account/create-resident-account.component.html"

copy_project_file \
  "blockchain-test-ui/src/app/pages/government-blockchain/create-resident-account/create-resident-account.component.scss"

###############################################################################
# 10. Package versions
###############################################################################

copy_project_file \
  "blockchain-api/package.json"

copy_project_file \
  "blockchain-test-ui/package.json"

###############################################################################
# 11. Find all active references to the KYC endpoint
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=backups \
  --exclude-dir=handoff \
  -E \
  "blockchain-wallet|blockchain-kyc|createBlockchainKycWallet|storageMode" \
  blockchain-api/src \
  blockchain-test-ui/src/app \
  > "$DIAG_DIR/kyc_endpoint_references.txt" 2>&1 || true

###############################################################################
# 12. Find SQL tables referenced by KYC and wallet services
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  -E \
  "INSERT INTO|UPDATE[[:space:]]+blockchain\.|FROM[[:space:]]+blockchain\.|JOIN[[:space:]]+blockchain\." \
  blockchain-api/src/services/blockchain-kyc.service.js \
  blockchain-api/src/services/wallet.service.js \
  blockchain-api/src/repositories/resident.repository.js \
  > "$DIAG_DIR/referenced_database_tables.txt" 2>&1 || true

###############################################################################
# 13. Save relevant backend log tails
###############################################################################

for log_file in \
  "$PROJECT_DIR/blockchain-api/logs/app.log" \
  "$PROJECT_DIR/blockchain-api/logs/error.log"
do
  if [ -f "$log_file" ]; then
    log_name="$(basename "$log_file")"

    tail -n 500 "$log_file" \
      > "$LOG_DIR/last_500_lines_$log_name" 2>&1
  fi
done

###############################################################################
# 14. Export PostgreSQL metadata only
#
# Uses already-loaded PostgreSQL environment variables.
# No password is written to the output.
###############################################################################

export PGHOST="${POSTGRES_HOST:-${PGHOST:-172.31.13.133}}"
export PGPORT="${POSTGRES_PORT:-${PGPORT:-5444}}"
export PGDATABASE="${POSTGRES_DATABASE:-${POSTGRES_DB:-${PGDATABASE:-vfds_dev}}}"
export PGUSER="${POSTGRES_USER:-${PGUSER:-pgdata}}"

if [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export PGPASSWORD="$POSTGRES_PASSWORD"
fi

if command -v psql >/dev/null 2>&1; then

  psql \
    -X \
    -v ON_ERROR_STOP=0 \
    -A \
    -F $'\t' \
    -c "
      SELECT
          table_schema,
          table_name,
          ordinal_position,
          column_name,
          data_type,
          udt_name,
          is_nullable,
          column_default,
          character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'blockchain'
        AND (
          table_name ILIKE '%kyc%'
          OR table_name ILIKE '%wallet%'
          OR table_name ILIKE '%enterprise%'
          OR table_name ILIKE '%organization%'
        )
      ORDER BY table_schema, table_name, ordinal_position;
    " \
    > "$DB_DIR/01_relevant_table_columns.tsv" 2>&1 || true

  psql \
    -X \
    -v ON_ERROR_STOP=0 \
    -A \
    -F $'\t' \
    -c "
      SELECT
          schemaname,
          tablename,
          indexname,
          indexdef
      FROM pg_indexes
      WHERE schemaname = 'blockchain'
        AND (
          tablename ILIKE '%kyc%'
          OR tablename ILIKE '%wallet%'
          OR tablename ILIKE '%enterprise%'
          OR tablename ILIKE '%organization%'
        )
      ORDER BY tablename, indexname;
    " \
    > "$DB_DIR/02_relevant_table_indexes.tsv" 2>&1 || true

  psql \
    -X \
    -v ON_ERROR_STOP=0 \
    -A \
    -F $'\t' \
    -c "
      SELECT
          n.nspname AS table_schema,
          c.relname AS table_name,
          con.conname AS constraint_name,
          con.contype AS constraint_type,
          pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class c
        ON c.oid = con.conrelid
      JOIN pg_namespace n
        ON n.oid = c.relnamespace
      WHERE n.nspname = 'blockchain'
        AND (
          c.relname ILIKE '%kyc%'
          OR c.relname ILIKE '%wallet%'
          OR c.relname ILIKE '%enterprise%'
          OR c.relname ILIKE '%organization%'
        )
      ORDER BY c.relname, con.conname;
    " \
    > "$DB_DIR/03_relevant_table_constraints.tsv" 2>&1 || true

  psql \
    -X \
    -v ON_ERROR_STOP=0 \
    -A \
    -F $'\t' \
    -c "
      SELECT
          table_schema,
          table_name
      FROM information_schema.tables
      WHERE table_schema = 'blockchain'
        AND (
          table_name ILIKE '%kyc%'
          OR table_name ILIKE '%wallet%'
          OR table_name ILIKE '%enterprise%'
          OR table_name ILIKE '%organization%'
        )
      ORDER BY table_name;
    " \
    > "$DB_DIR/04_relevant_table_names.tsv" 2>&1 || true

else
  echo "psql command is unavailable." \
    > "$DB_DIR/database_export_error.txt"
fi

###############################################################################
# 15. Redact common secrets from collected copies
###############################################################################

python3 <<PY
from pathlib import Path
import re

root = Path(r"$OUT_DIR")

patterns = [
    (
        re.compile(
            r'(?i)(POSTGRES_PASSWORD\s*=\s*)[^\s"\']+'
        ),
        r'\1<REDACTED>'
    ),
    (
        re.compile(
            r'''(?i)(API_KEY\s*[:=]\s*["'])[^\n"']+(["'])'''
        ),
        r'\1<REDACTED>\2'
    ),
    (
        re.compile(
            r'''(?i)(apiKey\s*[:=]\s*["'])[^\n"']+(["'])'''
        ),
        r'\1<REDACTED>\2'
    ),
    (
        re.compile(
            r'''(?i)(password\s*[:=]\s*["'])[^\n"']+(["'])'''
        ),
        r'\1<REDACTED>\2'
    ),
    (
        re.compile(
            r'''(?i)(authorization\s*[:=]\s*["'])[^\n"']+(["'])'''
        ),
        r'\1<REDACTED>\2'
    )
]

allowed_suffixes = {
    ".js", ".ts", ".html", ".scss", ".json",
    ".txt", ".tsv", ".log"
}

for path in root.rglob("*"):
    if not path.is_file():
        continue

    if path.suffix.lower() not in allowed_suffixes:
        continue

    try:
        content = path.read_text(
            encoding="utf-8",
            errors="replace"
        )
    except Exception:
        continue

    updated = content

    for pattern, replacement in patterns:
        updated = pattern.sub(replacement, updated)

    if updated != content:
        path.write_text(updated, encoding="utf-8")
PY

###############################################################################
# 16. Create manifest
###############################################################################

{
  echo "===== PACKAGE DATE ====="
  date

  echo
  echo "===== HOST ====="
  hostname

  echo
  echo "===== PROJECT DIRECTORY ====="
  echo "$PROJECT_DIR"

  echo
  echo "===== COLLECTED FILES ====="
  find "$OUT_DIR" -type f -printf '%P\n' | sort

  echo
  echo "===== FILE SIZES ====="
  du -h "$OUT_DIR"/* 2>/dev/null | sort -h
} > "$OUT_DIR/manifest.txt"

###############################################################################
# 17. Create compressed archive
###############################################################################

ARCHIVE="$PROJECT_DIR/$PACKAGE_NAME.tar.gz"

tar -czf "$ARCHIVE" \
  -C "$PROJECT_DIR" \
  "$PACKAGE_NAME"

echo
echo "KYC refresh package created successfully."
echo
echo "Folder:"
echo "$OUT_DIR"
echo
echo "Upload this archive:"
echo "$ARCHIVE"
