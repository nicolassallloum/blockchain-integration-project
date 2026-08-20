#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$HOME/u01/blockchain-integration}"
BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/blockchain-api"
FRONTEND="$ROOT/blockchain-test-ui"

if [[ ! -d "$BACKEND" || ! -d "$FRONTEND" ]]; then
  echo "[FAIL] Expected project folders were not found under: $ROOT"
  exit 1
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
backup_dir="$ROOT/backups/license-wallet-screen-$timestamp"
mkdir -p "$backup_dir"

cp "$BACKEND/src/server.js" "$backup_dir/server.js"
cp "$FRONTEND/src/app/app.routes.ts" "$backup_dir/app.routes.ts"
cp "$FRONTEND/src/app/app.ts" "$backup_dir/app.ts"
cp "$FRONTEND/src/app/services/license-recovery.service.ts" \
  "$backup_dir/license-recovery.service.ts"
cp "$FRONTEND/src/app/pages/license-recovery/license-recovery.component.html" \
  "$backup_dir/license-recovery.component.html"

mkdir -p "$BACKEND/routes"
mkdir -p "$FRONTEND/src/app/services"
mkdir -p "$FRONTEND/src/app/pages/license-wallet-create"

cp "$BUNDLE_DIR/backend/routes/licenseWalletRoutes.js" \
  "$BACKEND/routes/licenseWalletRoutes.js"
cp "$BUNDLE_DIR/frontend/src/app/services/license-wallet.service.ts" \
  "$FRONTEND/src/app/services/license-wallet.service.ts"
cp "$BUNDLE_DIR/frontend/src/app/pages/license-wallet-create/"* \
  "$FRONTEND/src/app/pages/license-wallet-create/"

python3 "$BUNDLE_DIR/patches/apply_patches.py" "$ROOT"

cd "$FRONTEND"
npm install ethers@6.17.0 --save

cd "$BACKEND"
node --check routes/licenseWalletRoutes.js
node --check src/server.js

cd "$FRONTEND"
npm run build

echo
echo "[PASS] License wallet creation screen installed."
echo "[INFO] Backup: $backup_dir"
echo "[NEXT] Restart the backend and Angular UI."
