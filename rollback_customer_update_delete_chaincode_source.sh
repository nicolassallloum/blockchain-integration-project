#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"
BACKUP_DIR="${1:-}"

if [[ -z "$BACKUP_DIR" ]]; then
  POINTER_FILE="$PROJECT_ROOT/.last_customer_crud_chaincode_source_backup"

  if [[ ! -f "$POINTER_FILE" ]]; then
    echo "ERROR: Backup pointer not found: $POINTER_FILE" >&2
    exit 1
  fi

  BACKUP_DIR="$(cat "$POINTER_FILE")"
fi

SOURCE="$BACKUP_DIR/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
TARGET="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"

if [[ ! -f "$SOURCE" ]]; then
  echo "ERROR: Backup source not found: $SOURCE" >&2
  exit 1
fi

cp -a \
  "$TARGET" \
  "${TARGET}.before_customer_crud_rollback_$(date +%Y%m%d_%H%M%S)"

cp -a "$SOURCE" "$TARGET"

node --check "$TARGET"

echo "Rollback completed."
echo "Restored from: $SOURCE"
echo "Restored to:   $TARGET"
