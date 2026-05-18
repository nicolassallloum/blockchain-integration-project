#!/bin/bash

set -e

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
PATCH_ROOT="$PROJECT_ROOT/step59-dashboard-enhancement-patch"
BACKUP_DIR="$PROJECT_ROOT/backups/step59-dashboard-enhancement-$(date +%Y%m%d-%H%M%S)"

copy_with_backup() {
  local SRC="$1"
  local DEST="$2"

  if [ ! -f "$SRC" ]; then
    echo "❌ Missing patch file: $SRC"
    exit 1
  fi

  if [ -f "$DEST" ]; then
    mkdir -p "$BACKUP_DIR/$(dirname "${DEST#$PROJECT_ROOT/}")"
    cp "$DEST" "$BACKUP_DIR/${DEST#$PROJECT_ROOT/}"
    echo "🛡️  Backup: ${DEST#$PROJECT_ROOT/}"
  fi

  mkdir -p "$(dirname "$DEST")"
  cp "$SRC" "$DEST"
  echo "✅ Updated: ${DEST#$PROJECT_ROOT/}"
}

echo "=================================================="
echo " STEP 59 — Dashboard Enhancement Installer"
echo " Project Root: $PROJECT_ROOT"
echo " Patch Root:   $PATCH_ROOT"
echo " Backup Dir:   $BACKUP_DIR"
echo "=================================================="

copy_with_backup "$PATCH_ROOT/blockchain-api/src/services/dashboard.service.js" "$PROJECT_ROOT/blockchain-api/src/services/dashboard.service.js"
copy_with_backup "$PATCH_ROOT/blockchain-api/src/controllers/dashboard.controller.js" "$PROJECT_ROOT/blockchain-api/src/controllers/dashboard.controller.js"
copy_with_backup "$PATCH_ROOT/blockchain-api/src/routes/dashboard.routes.js" "$PROJECT_ROOT/blockchain-api/src/routes/dashboard.routes.js"
copy_with_backup "$PATCH_ROOT/blockchain-api/src/server.js" "$PROJECT_ROOT/blockchain-api/src/server.js"
copy_with_backup "$PATCH_ROOT/blockchain-api/src/routes/index.js" "$PROJECT_ROOT/blockchain-api/src/routes/index.js"
copy_with_backup "$PATCH_ROOT/blockchain-test-ui/src/app/core/services/wallet-api.service.ts" "$PROJECT_ROOT/blockchain-test-ui/src/app/core/services/wallet-api.service.ts"
copy_with_backup "$PATCH_ROOT/blockchain-test-ui/src/app/features/dashboard/dashboard.component.ts" "$PROJECT_ROOT/blockchain-test-ui/src/app/features/dashboard/dashboard.component.ts"

echo ""
echo "===== Backend Syntax Check ====="
cd "$PROJECT_ROOT/blockchain-api"
node --check src/services/dashboard.service.js
node --check src/controllers/dashboard.controller.js
node --check src/routes/dashboard.routes.js
node --check src/server.js

echo ""
echo "=================================================="
echo "✅ STEP 59 Dashboard Enhancement installed successfully."
echo "Backup saved at: $BACKUP_DIR"
echo "Next: restart backend and rebuild Angular frontend."
echo "=================================================="
