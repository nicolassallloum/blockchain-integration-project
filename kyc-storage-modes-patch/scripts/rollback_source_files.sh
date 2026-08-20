#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /absolute/path/to/backups/kyc-storage-modes-YYYYMMDD_HHMMSS [project_dir]" >&2
  exit 1
fi

BACKUP_DIR="$1"
PROJECT_DIR="${2:-$HOME/u01/blockchain-integration}"

FILES=(
  "blockchain-api/src/controllers/blockchain-kyc.controller.js"
  "blockchain-api/src/services/blockchain-kyc.service.js"
  "blockchain-api/src/services/wallet.service.js"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.ts"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.html"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.scss"
)

for relative_path in "${FILES[@]}"; do
  backup_path="$BACKUP_DIR/$relative_path"
  target_path="$PROJECT_DIR/$relative_path"

  if [[ ! -f "$backup_path" ]]; then
    echo "ERROR: Backup file is missing: $backup_path" >&2
    exit 1
  fi

  cp -a "$backup_path" "$target_path"
  echo "RESTORED: $relative_path"
done

node --check "$PROJECT_DIR/blockchain-api/src/controllers/blockchain-kyc.controller.js"
node --check "$PROJECT_DIR/blockchain-api/src/services/blockchain-kyc.service.js"
node --check "$PROJECT_DIR/blockchain-api/src/services/wallet.service.js"

echo "Source rollback completed."
