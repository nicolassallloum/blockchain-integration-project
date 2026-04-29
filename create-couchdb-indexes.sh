#!/bin/bash

set -e

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
CHAINCODE_DIR="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode"
INDEX_DIR="$CHAINCODE_DIR/META-INF/statedb/couchdb/indexes"

echo "=========================================="
echo "Creating CouchDB Indexes for Fabric"
echo "Project Root: $PROJECT_ROOT"
echo "Index Folder: $INDEX_DIR"
echo "=========================================="

mkdir -p "$INDEX_DIR"

cat > "$INDEX_DIR/indexWalletByCustomerId.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "customerId"
    ]
  },
  "ddoc": "indexWalletByCustomerIdDoc",
  "name": "indexWalletByCustomerId",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexWalletByAddress.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "walletAddress"
    ]
  },
  "ddoc": "indexWalletByAddressDoc",
  "name": "indexWalletByAddress",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexOrganizationById.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "organizationId"
    ]
  },
  "ddoc": "indexOrganizationByIdDoc",
  "name": "indexOrganizationById",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByStatus.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "status"
    ]
  },
  "ddoc": "indexTransactionByStatusDoc",
  "name": "indexTransactionByStatus",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByRiskLevel.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "riskLevel"
    ]
  },
  "ddoc": "indexTransactionByRiskLevelDoc",
  "name": "indexTransactionByRiskLevel",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByDate.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionByDateDoc",
  "name": "indexTransactionByDate",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByFromWalletDate.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "fromWalletAddress",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionByFromWalletDateDoc",
  "name": "indexTransactionByFromWalletDate",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByToWalletDate.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "toWalletAddress",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionByToWalletDateDoc",
  "name": "indexTransactionByToWalletDate",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByOrganizationDate.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "organizationId",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionByOrganizationDateDoc",
  "name": "indexTransactionByOrganizationDate",
  "type": "json"
}
EOF

echo "=========================================="
echo "CouchDB index files created successfully"
echo "=========================================="

ls -lah "$INDEX_DIR"