#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${1:?Usage: $0 <backup-directory> [project-root]}"
PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"

SOURCE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Backup file not found: $SOURCE" >&2
  exit 1
fi

cp -a "$SOURCE" "$TARGET"
node --check "$TARGET"

echo "Rollback completed."
echo "Restored: $TARGET"
