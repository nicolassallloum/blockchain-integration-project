#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"
BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  LAST_BACKUP_FILE="$PROJECT_ROOT/.last_customer_created_only_backup"

  if [[ ! -f "$LAST_BACKUP_FILE" ]]; then
    echo "ERROR: Backup directory was not provided and no last-backup file exists." >&2
    exit 1
  fi

  BACKUP_DIR="$(cat "$LAST_BACKUP_FILE")"
fi

SOURCE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Backup file not found: $SOURCE" >&2
  exit 1
fi

ROLLBACK_SAFETY_BACKUP="${TARGET}.before_rollback_$(date +%Y%m%d_%H%M%S)"
cp -a "$TARGET" "$ROLLBACK_SAFETY_BACKUP"
cp -a "$SOURCE" "$TARGET"

node --check "$TARGET"

echo "Rollback completed."
echo "Restored from: $SOURCE"
echo "Restored to:   $TARGET"
echo "Safety copy:   $ROLLBACK_SAFETY_BACKUP"
