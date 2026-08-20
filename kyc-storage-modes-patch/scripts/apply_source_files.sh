#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-$HOME/u01/blockchain-integration}"
BUNDLE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$PROJECT_DIR/backups/kyc-storage-modes-$TIMESTAMP"

FILES=(
  "blockchain-api/src/controllers/blockchain-kyc.controller.js"
  "blockchain-api/src/services/blockchain-kyc.service.js"
  "blockchain-api/src/services/wallet.service.js"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.ts"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.html"
  "blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.scss"
)

mkdir -p "$BACKUP_DIR"

for relative_path in "${FILES[@]}"; do
  source_path="$PROJECT_DIR/$relative_path"
  replacement_path="$BUNDLE_DIR/files/$relative_path"
  backup_path="$BACKUP_DIR/$relative_path"

  if [[ ! -f "$source_path" ]]; then
    echo "ERROR: Active file is missing: $source_path" >&2
    exit 1
  fi

  if [[ ! -f "$replacement_path" ]]; then
    echo "ERROR: Replacement file is missing: $replacement_path" >&2
    exit 1
  fi

  mkdir -p "$(dirname "$backup_path")"
  cp -a "$source_path" "$backup_path"
  cp -a "$replacement_path" "$source_path"
  echo "UPDATED: $relative_path"
done

node --check "$PROJECT_DIR/blockchain-api/src/controllers/blockchain-kyc.controller.js"
node --check "$PROJECT_DIR/blockchain-api/src/services/blockchain-kyc.service.js"
node --check "$PROJECT_DIR/blockchain-api/src/services/wallet.service.js"

echo
printf 'Source patch applied.\nBackup directory: %s\n' "$BACKUP_DIR"
printf 'Save this path for rollback.\n'
