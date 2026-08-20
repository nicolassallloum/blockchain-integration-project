#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"
BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  POINTER_FILE="$PROJECT_ROOT/.last_professional_customer_created_log_backup"

  if [[ ! -f "$POINTER_FILE" ]]; then
    echo "ERROR: Backup pointer not found: $POINTER_FILE" >&2
    exit 1
  fi

  BACKUP_DIR="$(cat "$POINTER_FILE")"
fi

SOURCE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Backup file not found: $SOURCE" >&2
  exit 1
fi

cp -a \
  "$TARGET" \
  "${TARGET}.before_professional_log_rollback_$(date +%Y%m%d_%H%M%S)"

cp -a "$SOURCE" "$TARGET"

node --check "$TARGET"

echo "Rollback completed."
echo "Restored from: $SOURCE"
