#!/bin/bash

set -e

PROJECT_DIR="/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js"
INDEX_DIR="$PROJECT_DIR/META-INF/statedb/couchdb/indexes"

echo "=================================================="
echo "STEP 13 - Creating CouchDB Indexes for Fabric"
echo "Project: $PROJECT_DIR"
echo "Index Directory: $INDEX_DIR"
echo "=================================================="

mkdir -p "$INDEX_DIR"

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

cat > "$INDEX_DIR/indexTransactionById.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "transactionId"
    ]
  },
  "ddoc": "indexTransactionByIdDoc",
  "name": "indexTransactionById",
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

cat > "$INDEX_DIR/indexTransactionByType.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "transactionType"
    ]
  },
  "ddoc": "indexTransactionByTypeDoc",
  "name": "indexTransactionByType",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByCreatedDate.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionByCreatedDateDoc",
  "name": "indexTransactionByCreatedDate",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByRiskStatus.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "riskStatus"
    ]
  },
  "ddoc": "indexTransactionByRiskStatusDoc",
  "name": "indexTransactionByRiskStatus",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByFromWallet.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "fromWalletAddress"
    ]
  },
  "ddoc": "indexTransactionByFromWalletDoc",
  "name": "indexTransactionByFromWallet",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionByToWallet.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "toWalletAddress"
    ]
  },
  "ddoc": "indexTransactionByToWalletDoc",
  "name": "indexTransactionByToWallet",
  "type": "json"
}
EOF

cat > "$INDEX_DIR/indexTransactionComposite.json" <<'EOF'
{
  "index": {
    "fields": [
      "docType",
      "fromWalletAddress",
      "transactionType",
      "status",
      "createdAt"
    ]
  },
  "ddoc": "indexTransactionCompositeDoc",
  "name": "indexTransactionComposite",
  "type": "json"
}
EOF

echo ""
echo "Generated CouchDB index files:"
find "$INDEX_DIR" -type f -name "*.json" -print | sort

echo ""
echo "Validating JSON files..."

for file in "$INDEX_DIR"/*.json; do
  if command -v jq >/dev/null 2>&1; then
    jq empty "$file"
    echo "VALID: $file"
  else
    python3 -m json.tool "$file" >/dev/null
    echo "VALID: $file"
  fi
done

echo ""
echo "=================================================="
echo "STEP 13 CouchDB indexes created successfully."
echo "=================================================="