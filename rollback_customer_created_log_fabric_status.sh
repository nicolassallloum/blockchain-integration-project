#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"
BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  POINTER="$PROJECT_ROOT/.last_customer_created_log_scope_fix_backup"

  if [[ ! -f "$POINTER" ]]; then
    echo "ERROR: No backup directory supplied and pointer file is missing." >&2
    exit 1
  fi

  BACKUP_DIR="$(cat "$POINTER")"
fi

SOURCE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"
TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Backup source not found: $SOURCE" >&2
  exit 1
fi

cp -a "$TARGET" "${TARGET}.before_scope_fix_rollback_$(date +%Y%m%d_%H%M%S)"
cp -a "$SOURCE" "$TARGET"

node --check "$TARGET"

echo "Rollback completed."
echo "Restored from: $SOURCE"
