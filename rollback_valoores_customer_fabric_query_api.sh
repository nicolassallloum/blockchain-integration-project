#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_DIR="${1:?Usage: $0 <backup-directory> [project-root]}"
PROJECT_ROOT="${2:-$HOME/u01/blockchain-integration}"

CHAINCODE_SOURCE="$BACKUP_DIR/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
ROUTE_SOURCE="$BACKUP_DIR/blockchain-api/src/routes/valoores-blockchain.routes.js"

CHAINCODE_TARGET="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"
ROUTE_TARGET="$PROJECT_ROOT/blockchain-api/src/routes/valoores-blockchain.routes.js"

for file in "$CHAINCODE_SOURCE" "$ROUTE_SOURCE"; do
  if [[ ! -f "$file" ]]; then
    echo "ERROR: Missing backup file: $file" >&2
    exit 1
  fi
done

cp -a "$CHAINCODE_SOURCE" "$CHAINCODE_TARGET"
cp -a "$ROUTE_SOURCE" "$ROUTE_TARGET"

node --check "$CHAINCODE_TARGET"
node --check "$ROUTE_TARGET"

echo "Source rollback completed."
echo "Restored chaincode: $CHAINCODE_TARGET"
echo "Restored route: $ROUTE_TARGET"
