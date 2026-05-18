#!/bin/bash

set -e

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
BACKEND_ROOT="$PROJECT_ROOT/blockchain-api"
FRONTEND_ROOT="$PROJECT_ROOT/blockchain-test-ui"
EXPORT_DIR="$PROJECT_ROOT/step59-dashboard-enhancement-export"
ARCHIVE_NAME="step59-dashboard-enhancement-files.tar.gz"

echo "=================================================="
echo " STEP 59 Dashboard Enhancement Files Export"
echo " Project Root: $PROJECT_ROOT"
echo " Export Dir:   $EXPORT_DIR"
echo " Archive:      $ARCHIVE_NAME"
echo "=================================================="

rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR/backend"
mkdir -p "$EXPORT_DIR/frontend"
mkdir -p "$EXPORT_DIR/discovery"

copy_if_exists() {
  SRC="$1"
  DEST_BASE="$2"

  if [ -f "$SRC" ]; then
    REL_PATH="${SRC#$PROJECT_ROOT/}"
    DEST="$DEST_BASE/$REL_PATH"
    mkdir -p "$(dirname "$DEST")"
    cp "$SRC" "$DEST"
    echo "✅ Copied: $REL_PATH"
  else
    echo "⚠️ Missing: ${SRC#$PROJECT_ROOT/}"
  fi
}

echo ""
echo "===== Exporting Backend Files ====="

BACKEND_FILES=(
"$BACKEND_ROOT/src/server.js"
"$BACKEND_ROOT/src/app.js"
"$BACKEND_ROOT/src/routes/index.js"
"$BACKEND_ROOT/src/routes/dashboard.routes.js"
"$BACKEND_ROOT/src/controllers/dashboard.controller.js"
"$BACKEND_ROOT/src/services/dashboard.service.js"
"$BACKEND_ROOT/src/config/database.js"
"$BACKEND_ROOT/src/config/fabric.js"
"$BACKEND_ROOT/package.json"
"$BACKEND_ROOT/.env"
)

for FILE in "${BACKEND_FILES[@]}"; do
  copy_if_exists "$FILE" "$EXPORT_DIR/backend"
done

echo ""
echo "===== Exporting Frontend Files ====="

FRONTEND_FILES=(
"$FRONTEND_ROOT/src/app/app.routes.ts"
"$FRONTEND_ROOT/src/app/app.config.ts"
"$FRONTEND_ROOT/src/app/services/api.service.ts"
"$FRONTEND_ROOT/src/app/services/dashboard.service.ts"
"$FRONTEND_ROOT/src/app/pages/digital-kyc-dashboard/digital-kyc-dashboard.component.ts"
"$FRONTEND_ROOT/src/app/pages/digital-kyc-dashboard/digital-kyc-dashboard.component.html"
"$FRONTEND_ROOT/src/app/pages/digital-kyc-dashboard/digital-kyc-dashboard.component.scss"
"$FRONTEND_ROOT/src/environments/environment.ts"
"$FRONTEND_ROOT/src/environments/environment.development.ts"
"$FRONTEND_ROOT/package.json"
)

for FILE in "${FRONTEND_FILES[@]}"; do
  copy_if_exists "$FILE" "$EXPORT_DIR/frontend"
done

echo ""
echo "===== Discovering Dashboard Related Files ====="

find "$BACKEND_ROOT/src" -type f \
  \( -iname "*dashboard*" -o -iname "*wallet*" -o -iname "*transaction*" -o -iname "*organization*" -o -iname "*report*" \) \
  > "$EXPORT_DIR/discovery/backend_dashboard_related_files.txt" 2>/dev/null || true

find "$FRONTEND_ROOT/src/app" -type f \
  \( -iname "*dashboard*" -o -iname "*wallet*" -o -iname "*transaction*" -o -iname "*organization*" -o -iname "*report*" \) \
  > "$EXPORT_DIR/discovery/frontend_dashboard_related_files.txt" 2>/dev/null || true

echo "✅ Backend discovery list created."
echo "✅ Frontend discovery list created."

echo ""
echo "===== Exporting Discovered Backend Dashboard Files ====="

while IFS= read -r FILE; do
  if [ -f "$FILE" ]; then
    copy_if_exists "$FILE" "$EXPORT_DIR/backend-discovered"
  fi
done < "$EXPORT_DIR/discovery/backend_dashboard_related_files.txt"

echo ""
echo "===== Exporting Discovered Frontend Dashboard Files ====="

while IFS= read -r FILE; do
  if [ -f "$FILE" ]; then
    copy_if_exists "$FILE" "$EXPORT_DIR/frontend-discovered"
  fi
done < "$EXPORT_DIR/discovery/frontend_dashboard_related_files.txt"

echo ""
echo "===== Creating Database Structure Snapshot ====="

cat > "$EXPORT_DIR/discovery/database_discovery_commands.sql" <<'SQL'
-- Run these commands manually if needed:

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'wallets'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'transactions'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name IN ('organizations', 'blockchain_organizations')
ORDER BY table_name, ordinal_position;
SQL

echo "✅ SQL discovery commands created."

echo ""
echo "===== Creating Archive ====="

cd "$PROJECT_ROOT"
tar -czf "$ARCHIVE_NAME" "$(basename "$EXPORT_DIR")"

echo ""
echo "=================================================="
echo " ✅ Export Completed Successfully"
echo " Archive Path:"
echo " $PROJECT_ROOT/$ARCHIVE_NAME"
echo "=================================================="
echo ""
echo "Send me this file:"
echo "$PROJECT_ROOT/$ARCHIVE_NAME"
