#!/usr/bin/env bash

set -u

PROJECT_DIR="$HOME/u01/blockchain-integration"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="$PROJECT_DIR/kyc_refresh_outputs_$TIMESTAMP"

mkdir -p "$OUT_DIR"

echo "Output directory: $OUT_DIR"

cd "$PROJECT_DIR" || exit 1

###############################################################################
# STEP 1 — Basic project information
###############################################################################

{
  echo "===== DATE ====="
  date

  echo
  echo "===== HOSTNAME ====="
  hostname

  echo
  echo "===== CURRENT DIRECTORY ====="
  pwd

  echo
  echo "===== NODE VERSION ====="
  node --version 2>&1 || true

  echo
  echo "===== NPM VERSION ====="
  npm --version 2>&1 || true
} > "$OUT_DIR/01_environment_information.txt" 2>&1

###############################################################################
# STEP 2 — Existing project tree
###############################################################################

if [ -f "$PROJECT_DIR/tree20260723.txt" ]; then
  cp "$PROJECT_DIR/tree20260723.txt" \
    "$OUT_DIR/02_project_tree.txt"
else
  tree \
    -I 'node_modules|dist|coverage|.git' \
    > "$OUT_DIR/02_project_tree.txt" 2>&1
fi

###############################################################################
# STEP 3 — Existing VALOORES payload
###############################################################################

if [ -f "$PROJECT_DIR/blockchain-api/valoores-real-payload.json" ]; then
  jq . "$PROJECT_DIR/blockchain-api/valoores-real-payload.json" \
    > "$OUT_DIR/03_valoores_real_payload.json" 2>&1
else
  echo "File not found: blockchain-api/valoores-real-payload.json" \
    > "$OUT_DIR/03_valoores_real_payload.json"
fi

###############################################################################
# STEP 4 — Search for the customer API route
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=backups \
  --exclude-dir=handoff \
  -E "router\.(post|put).*customers|['\"]/customers['\"]" \
  "$PROJECT_DIR/blockchain-api/src" \
  > "$OUT_DIR/04_customer_route_locations.txt" 2>&1 || true

###############################################################################
# STEP 5 — Search for CUSTOMER_NAME validation
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=backups \
  --exclude-dir=handoff \
  -E "formData\.CUSTOMER_NAME|CUSTOMER_NAME is required" \
  "$PROJECT_DIR/blockchain-api/src" \
  > "$OUT_DIR/05_customer_name_validation.txt" 2>&1 || true

###############################################################################
# STEP 6 — Search for formData request handling
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=backups \
  --exclude-dir=handoff \
  -E "req\.body\.formData|formData.*req\.body|req\.body.*formData" \
  "$PROJECT_DIR/blockchain-api/src" \
  > "$OUT_DIR/06_formdata_usage.txt" 2>&1 || true

###############################################################################
# STEP 7 — Search for storage-mode support
###############################################################################

grep -Rni \
  --exclude='*.bak*' \
  --exclude='*.log' \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=backups \
  --exclude-dir=handoff \
  -E "storageMode|POSTGRES_ONLY|BLOCKCHAIN_ONLY|POSTGRES_AND_BLOCKCHAIN" \
  "$PROJECT_DIR/blockchain-api/src" \
  "$PROJECT_DIR/blockchain-test-ui/src/app" \
  > "$OUT_DIR/07_storage_mode_support.txt" 2>&1 || true

###############################################################################
# STEP 8 — Find active KYC, wallet and VALOORES files
###############################################################################

find \
  "$PROJECT_DIR/blockchain-api/src" \
  "$PROJECT_DIR/blockchain-test-ui/src/app" \
  -type f \
  \( \
    -iname '*kyc*' \
    -o -iname '*wallet*' \
    -o -iname '*valoores*' \
    -o -iname '*resident*' \
  \) \
  ! -name '*.bak*' \
  ! -path '*/node_modules/*' \
  ! -path '*/dist/*' \
  | sort \
  > "$OUT_DIR/08_relevant_active_files.txt" 2>&1

###############################################################################
# STEP 9 — Export active customer route files
###############################################################################

ROUTE_FILES="$OUT_DIR/04_customer_route_locations.txt"

if [ -s "$ROUTE_FILES" ]; then
  cut -d: -f1 "$ROUTE_FILES" \
    | sort -u \
    > "$OUT_DIR/09_route_file_paths.txt"

  while IFS= read -r file; do
    [ -f "$file" ] || continue

    safe_name="$(
      echo "$file" |
      sed "s|$PROJECT_DIR/||" |
      tr '/' '_'
    )"

    {
      echo "===== FILE: $file ====="
      nl -ba "$file"
    } > "$OUT_DIR/09_${safe_name}.txt" 2>&1
  done < "$OUT_DIR/09_route_file_paths.txt"
else
  echo "No active customer route file was found." \
    > "$OUT_DIR/09_route_file_paths.txt"
fi

###############################################################################
# STEP 10 — Export validation-related files
###############################################################################

VALIDATION_FILES="$OUT_DIR/05_customer_name_validation.txt"

if [ -s "$VALIDATION_FILES" ]; then
  cut -d: -f1 "$VALIDATION_FILES" \
    | sort -u \
    > "$OUT_DIR/10_validation_file_paths.txt"

  while IFS= read -r file; do
    [ -f "$file" ] || continue

    safe_name="$(
      echo "$file" |
      sed "s|$PROJECT_DIR/||" |
      tr '/' '_'
    )"

    {
      echo "===== FILE: $file ====="
      nl -ba "$file"
    } > "$OUT_DIR/10_${safe_name}.txt" 2>&1
  done < "$OUT_DIR/10_validation_file_paths.txt"
else
  echo "No validation source file was found." \
    > "$OUT_DIR/10_validation_file_paths.txt"
fi

###############################################################################
# STEP 11 — Export selected likely active files
###############################################################################

CANDIDATE_FILES=(
  "$PROJECT_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
  "$PROJECT_DIR/blockchain-api/src/controllers/blockchain-kyc.controller.js"
  "$PROJECT_DIR/blockchain-api/src/routes/blockchain-kyc.routes.js"
  "$PROJECT_DIR/blockchain-api/src/services/blockchain-kyc.service.js"
  "$PROJECT_DIR/blockchain-api/src/controllers/wallet.controller.js"
  "$PROJECT_DIR/blockchain-api/src/routes/wallet.routes.js"
  "$PROJECT_DIR/blockchain-api/src/services/wallet.service.js"
  "$PROJECT_DIR/blockchain-api/src/services/fabric.service.js"
)

for file in "${CANDIDATE_FILES[@]}"; do
  if [ -f "$file" ]; then
    safe_name="$(
      echo "$file" |
      sed "s|$PROJECT_DIR/||" |
      tr '/' '_'
    )"

    {
      echo "===== FILE: $file ====="
      nl -ba "$file"
    } > "$OUT_DIR/11_${safe_name}.txt" 2>&1
  fi
done

###############################################################################
# STEP 12 — Package manifest
###############################################################################

{
  echo "===== COLLECTED FILES ====="
  find "$OUT_DIR" -maxdepth 1 -type f -printf '%f\n' | sort

  echo
  echo "===== FILE SIZES ====="
  du -h "$OUT_DIR"/* 2>/dev/null | sort -h
} > "$OUT_DIR/12_manifest.txt" 2>&1

###############################################################################
# STEP 13 — Compress all outputs
###############################################################################

ARCHIVE="$PROJECT_DIR/kyc_refresh_outputs_$TIMESTAMP.tar.gz"

tar -czf "$ARCHIVE" \
  -C "$PROJECT_DIR" \
  "$(basename "$OUT_DIR")"

echo
echo "Collection completed."
echo "Folder:  $OUT_DIR"
echo "Archive: $ARCHIVE"
echo
echo "Upload this file:"
echo "$ARCHIVE"
