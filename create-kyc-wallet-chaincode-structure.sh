#!/usr/bin/env bash
set -e

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
CHAINCODE_DIR="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode"
INDEX_DIR="$CHAINCODE_DIR/META-INF/statedb/couchdb/indexes"

echo "=========================================="
echo "Creating KYC Wallet Chaincode Structure"
echo "=========================================="

mkdir -p "$CHAINCODE_DIR"
mkdir -p "$INDEX_DIR"

# Create Go chaincode files
touch "$CHAINCODE_DIR/go.mod"
touch "$CHAINCODE_DIR/go.sum"
touch "$CHAINCODE_DIR/chaincode.go"

# Create CouchDB index files
touch "$INDEX_DIR/indexWalletByCustomerId.json"
touch "$INDEX_DIR/indexWalletByAddress.json"
touch "$INDEX_DIR/indexOrganizationById.json"
touch "$INDEX_DIR/indexTransactionByStatus.json"
touch "$INDEX_DIR/indexTransactionByRiskLevel.json"
touch "$INDEX_DIR/indexTransactionByDate.json"
touch "$INDEX_DIR/indexTransactionByFromWalletDate.json"
touch "$INDEX_DIR/indexTransactionByToWalletDate.json"
touch "$INDEX_DIR/indexTransactionByOrganizationDate.json"

echo ""
echo "Folders and files created successfully."
echo ""

echo "Final structure:"
echo "------------------------------------------"

if command -v tree >/dev/null 2>&1; then
    tree "$PROJECT_ROOT/chaincode/kyc-wallet-chaincode"
else
    find "$PROJECT_ROOT/chaincode/kyc-wallet-chaincode" -print
fi

echo "------------------------------------------"
echo "Done."
