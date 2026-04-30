# 🔹 STEP 13 — CouchDB Indexes & Rich Query Definitions  
## Blockchain Integration Project — Hyperledger Fabric + CouchDB

**Project Path:** `/home/nix/u01/blockchain-integration`  
**Chaincode Path:** `/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js`  
**Channel:** `kycchannelnix1`  
**Chaincode Name:** `kyc-wallet-chaincode-js`  
**Final Working Chaincode Version:** `2.0`  
**Final Working Chaincode Sequence:** `2`  
**Status:** ✅ **COMPLETED AND VERIFIED**

---

## 1. Purpose of Step 13

The purpose of Step 13 is to add CouchDB indexes and rich query definitions to the Hyperledger Fabric JavaScript chaincode package.

These indexes improve query performance when the smart contract searches ledger data by:

- Wallet address
- Customer ID
- Organization ID
- Transaction ID
- Transaction status
- Transaction type
- Created date
- Risk status
- From wallet address
- To wallet address
- Composite transaction filters

Without indexes, CouchDB rich queries may still work, but they can become slow as the ledger grows.

---

## 2. Final Step 13 Result

Step 13 is completed successfully.

Confirmed final result:

```text
[OK] META-INF CouchDB index folder created
[OK] 11 CouchDB index JSON files created
[OK] All JSON index files validated
[OK] CouchDB indexes packaged inside chaincode package
[OK] Chaincode v2.0 committed successfully
[OK] CouchDB state database created
[OK] Chaincode containers running
[OK] Rich query by customer ID tested successfully
[OK] Wallet creation tested successfully
[OK] CouchDB database visible
[OK] Chaincode query returned expected result
```

---

## 3. Correct Folder Path Inside Chaincode

For the current JavaScript chaincode project, CouchDB indexes must be stored here:

```bash
/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js/META-INF/statedb/couchdb/indexes
```

Expected structure:

```text
kyc-wallet-chaincode-js/
├── index.js
├── package.json
├── lib/
│   └── kycWalletContract.js
└── META-INF/
    └── statedb/
        └── couchdb/
            └── indexes/
                ├── indexWalletByAddress.json
                ├── indexWalletByCustomerId.json
                ├── indexOrganizationById.json
                ├── indexTransactionById.json
                ├── indexTransactionByStatus.json
                ├── indexTransactionByType.json
                ├── indexTransactionByCreatedDate.json
                ├── indexTransactionByRiskStatus.json
                ├── indexTransactionByFromWallet.json
                ├── indexTransactionByToWallet.json
                └── indexTransactionComposite.json
```

---

## 4. Create Index Folder

```bash
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js

mkdir -p META-INF/statedb/couchdb/indexes
```

---

# 5. Full CouchDB Index Files

## 5.1 Wallet Address Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexWalletByAddress.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to find wallet records by wallet address.

**Example selector:**

```json
{
  "selector": {
    "docType": "wallet",
    "walletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67"
  },
  "use_index": [
    "indexWalletByAddressDoc",
    "indexWalletByAddress"
  ]
}
```

---

## 5.2 Customer ID Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexWalletByCustomerId.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to find wallet records linked to a customer.

**Example selector:**

```json
{
  "selector": {
    "docType": "wallet",
    "customerId": "CUSTOMER_1001"
  },
  "use_index": [
    "indexWalletByCustomerIdDoc",
    "indexWalletByCustomerId"
  ]
}
```

---

## 5.3 Organization ID Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexOrganizationById.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to query organization records by organization ID.

**Example selector:**

```json
{
  "selector": {
    "docType": "organization",
    "organizationId": "BANK_001"
  },
  "use_index": [
    "indexOrganizationByIdDoc",
    "indexOrganizationById"
  ]
}
```

---

## 5.4 Transaction ID Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionById.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to find one transaction by transaction ID.

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "transactionId": "4d64c1086391ef2c04d6b42e47c238088ddf6096e6618a35c2a868725b24b547"
  },
  "use_index": [
    "indexTransactionByIdDoc",
    "indexTransactionById"
  ]
}
```

---

## 5.5 Transaction Status Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByStatus.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to query transactions by status.

**Current working statuses used by chaincode:**

```text
SUCCESS
FAILED
PENDING
REJECTED
BLOCKED
```

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "status": "SUCCESS"
  },
  "use_index": [
    "indexTransactionByStatusDoc",
    "indexTransactionByStatus"
  ]
}
```

---

## 5.6 Transaction Type Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByType.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to query transactions by type.

**Current transaction types:**

```text
WALLET_CREATED
WALLET_TO_WALLET
WALLET_TO_ORGANIZATION
```

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "transactionType": "WALLET_CREATED"
  },
  "use_index": [
    "indexTransactionByTypeDoc",
    "indexTransactionByType"
  ]
}
```

---

## 5.7 Created Date Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByCreatedDate.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to query transactions by date range.

**Important:**  
Use ISO date format in the ledger:

```text
2026-04-30T10:32:36.748Z
```

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "createdAt": {
      "$gte": "2026-04-01T00:00:00.000Z",
      "$lte": "2026-04-30T23:59:59.999Z"
    }
  },
  "use_index": [
    "indexTransactionByCreatedDateDoc",
    "indexTransactionByCreatedDate"
  ]
}
```

---

## 5.8 Risk Status Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByRiskStatus.json
```

**Content:**

```json
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
```

**Purpose:**  
Used for AML and suspicious transaction queries.

**Current risk statuses:**

```text
LOW
MEDIUM
HIGH
BLOCKED
UNDER_REVIEW
```

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "riskStatus": "LOW"
  },
  "use_index": [
    "indexTransactionByRiskStatusDoc",
    "indexTransactionByRiskStatus"
  ]
}
```

---

## 5.9 From Wallet Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByFromWallet.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to get all outgoing transactions from a wallet.

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "fromWalletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67"
  },
  "use_index": [
    "indexTransactionByFromWalletDoc",
    "indexTransactionByFromWallet"
  ]
}
```

---

## 5.10 To Wallet Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionByToWallet.json
```

**Content:**

```json
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
```

**Purpose:**  
Used to get all incoming transactions to a wallet.

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "toWalletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67"
  },
  "use_index": [
    "indexTransactionByToWalletDoc",
    "indexTransactionByToWallet"
  ]
}
```

---

## 5.11 Composite Transaction Index

**File:**

```bash
META-INF/statedb/couchdb/indexes/indexTransactionComposite.json
```

**Content:**

```json
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
```

**Purpose:**  
Used for advanced transaction history filters.

**Example use case:**  
Get successful wallet-to-wallet transactions from a specific wallet in a date range.

**Example selector:**

```json
{
  "selector": {
    "docType": "transaction",
    "fromWalletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67",
    "transactionType": "WALLET_TO_WALLET",
    "status": "SUCCESS",
    "createdAt": {
      "$gte": "2026-04-01T00:00:00.000Z",
      "$lte": "2026-04-30T23:59:59.999Z"
    }
  },
  "use_index": [
    "indexTransactionCompositeDoc",
    "indexTransactionComposite"
  ]
}
```

---

# 6. One Script to Create All Index Files

Create this script:

```bash
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js

nano create-step-13-couchdb-indexes.sh
```

Paste:

```bash
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
```

Run:

```bash
chmod +x create-step-13-couchdb-indexes.sh
./create-step-13-couchdb-indexes.sh
```

---

# 7. Chaincode Data Field Requirements

The chaincode ledger objects must use the same field names as the indexes.

## Wallet Object Example

```json
{
  "docType": "wallet",
  "walletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67",
  "customerId": "CUSTOMER_1001",
  "organizationId": "BANK_001",
  "fullName": "Nix Customer",
  "balance": 1000,
  "currency": "TOKEN",
  "status": "ACTIVE",
  "createdAt": "2026-04-30T10:32:36.748Z",
  "updatedAt": "2026-04-30T10:32:36.748Z"
}
```

## Organization Object Example

```json
{
  "docType": "organization",
  "organizationId": "BANK_001",
  "balance": 1000,
  "currency": "TOKEN",
  "status": "ACTIVE",
  "createdAt": "2026-04-30T10:32:36.748Z",
  "updatedAt": "2026-04-30T10:32:36.748Z"
}
```

## Transaction Object Example

```json
{
  "docType": "transaction",
  "transactionId": "4d64c1086391ef2c04d6b42e47c238088ddf6096e6618a35c2a868725b24b547",
  "transactionType": "WALLET_CREATED",
  "fromWalletAddress": null,
  "toWalletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67",
  "organizationId": "BANK_001",
  "amount": 1000,
  "currency": "TOKEN",
  "status": "SUCCESS",
  "riskStatus": "LOW",
  "createdAt": "2026-04-30T10:32:36.748Z"
}
```

---

# 8. Rich Query Methods Added to Chaincode

The final working chaincode includes these rich query methods:

```text
QueryWalletByAddress
QueryWalletByCustomerId
QueryOrganizationById
QueryTransactionById
QueryTransactionsByStatus
QueryTransactionsByType
QueryTransactionsByRiskStatus
QueryTransactionsByDateRange
QueryTransactionHistoryByWallet
```

The helper method used is:

```javascript
async _queryLedgerWithKeys(ctx, query) {
    const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
    const results = [];

    try {
        while (true) {
            const result = await iterator.next();

            if (result.value && result.value.value.toString()) {
                const record = JSON.parse(result.value.value.toString('utf8'));

                results.push({
                    key: result.value.key,
                    record
                });
            }

            if (result.done) {
                break;
            }
        }
    } finally {
        await iterator.close();
    }

    return results;
}
```

---

# 9. How to Package Indexes with Chaincode

The `META-INF` folder must be inside the chaincode root before packaging.

Go to your chaincode folder:

```bash
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js
```

Verify:

```bash
find META-INF -type f | sort
```

Expected output:

```text
META-INF/statedb/couchdb/indexes/indexOrganizationById.json
META-INF/statedb/couchdb/indexes/indexTransactionByCreatedDate.json
META-INF/statedb/couchdb/indexes/indexTransactionByFromWallet.json
META-INF/statedb/couchdb/indexes/indexTransactionById.json
META-INF/statedb/couchdb/indexes/indexTransactionByRiskStatus.json
META-INF/statedb/couchdb/indexes/indexTransactionByStatus.json
META-INF/statedb/couchdb/indexes/indexTransactionByToWallet.json
META-INF/statedb/couchdb/indexes/indexTransactionByType.json
META-INF/statedb/couchdb/indexes/indexTransactionComposite.json
META-INF/statedb/couchdb/indexes/indexWalletByAddress.json
META-INF/statedb/couchdb/indexes/indexWalletByCustomerId.json
```

Package chaincode:

```bash
export FABRIC_CFG_PATH=/home/nix/u01/blockchain-integration/fabric/fabric-samples/config

peer lifecycle chaincode package kyc-wallet-chaincode-js.tar.gz \
  --path /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js \
  --lang node \
  --label kyc-wallet-chaincode-js_2.0
```

---

# 10. How to Verify Indexes Before Packaging

## 10.1 Validate JSON Files

```bash
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js

find META-INF/statedb/couchdb/indexes -name "*.json" -exec python3 -m json.tool {} \; >/dev/null

echo "All CouchDB index JSON files are valid."
```

Or with `jq`:

```bash
find META-INF/statedb/couchdb/indexes -name "*.json" -exec jq empty {} \;

echo "All CouchDB index JSON files are valid."
```

## 10.2 Confirm Index Files Are Inside Chaincode Package

Fabric lifecycle packages are nested. The outer package contains:

```text
metadata.json
code.tar.gz
```

So this command may show nothing:

```bash
tar -tzf kyc-wallet-chaincode-js.tar.gz | grep META-INF
```

Use this correct command:

```bash
tar -xOzf kyc-wallet-chaincode-js.tar.gz code.tar.gz | tar -tzf - | grep META-INF
```

Expected output:

```text
META-INF/statedb/couchdb/indexes/indexWalletByAddress.json
META-INF/statedb/couchdb/indexes/indexWalletByCustomerId.json
META-INF/statedb/couchdb/indexes/indexOrganizationById.json
META-INF/statedb/couchdb/indexes/indexTransactionById.json
META-INF/statedb/couchdb/indexes/indexTransactionByStatus.json
META-INF/statedb/couchdb/indexes/indexTransactionByType.json
META-INF/statedb/couchdb/indexes/indexTransactionByCreatedDate.json
META-INF/statedb/couchdb/indexes/indexTransactionByRiskStatus.json
META-INF/statedb/couchdb/indexes/indexTransactionByFromWallet.json
META-INF/statedb/couchdb/indexes/indexTransactionByToWallet.json
META-INF/statedb/couchdb/indexes/indexTransactionComposite.json
```

---

# 11. How to Verify Indexes Are Working in CouchDB

After chaincode is installed, approved, committed, and invoked at least once, CouchDB creates databases per channel and chaincode namespace.

## 11.1 Check CouchDB Containers

```bash
docker ps | grep couch
```

Expected containers:

```text
couchdb0.org1
couchdb0.org2
```

## 11.2 Access CouchDB

Org1 CouchDB:

```bash
curl -u admin:adminpw http://localhost:5984/_all_dbs
```

Org2 CouchDB:

```bash
curl -u admin:adminpw http://localhost:7984/_all_dbs
```

## 11.3 Confirm Chaincode Database Exists

Confirmed working database:

```text
kycchannelnix1_kyc-wallet-chaincode-js
```

Command:

```bash
curl -s -u admin:adminpw http://localhost:5984/_all_dbs | python3 -m json.tool
```

Expected database list should include:

```text
kycchannelnix1_kyc-wallet-chaincode-js
kycchannelnix1__lifecycle
kycchannelnix1_lscc
```

## 11.4 List CouchDB Design Documents

```bash
curl -s -u admin:adminpw \
'http://localhost:5984/kycchannelnix1_kyc-wallet-chaincode-js/_all_docs?startkey="_design/"&endkey="_design0"' \
| python3 -m json.tool
```

Expected design documents:

```text
_design/indexWalletByAddressDoc
_design/indexWalletByCustomerIdDoc
_design/indexOrganizationByIdDoc
_design/indexTransactionByIdDoc
_design/indexTransactionByStatusDoc
_design/indexTransactionByTypeDoc
_design/indexTransactionByCreatedDateDoc
_design/indexTransactionByRiskStatusDoc
_design/indexTransactionByFromWalletDoc
_design/indexTransactionByToWalletDoc
_design/indexTransactionCompositeDoc
```

## 11.5 Test Index Usage with CouchDB `_explain`

Example:

```bash
curl -s -u admin:adminpw \
-H "Content-Type: application/json" \
-X POST http://localhost:5984/kycchannelnix1_kyc-wallet-chaincode-js/_explain \
-d '{
  "selector": {
    "docType": "wallet",
    "walletAddress": "WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67"
  },
  "use_index": [
    "indexWalletByAddressDoc",
    "indexWalletByAddress"
  ]
}' | python3 -m json.tool
```

The output should reference:

```text
indexWalletByAddress
```

---

# 12. Final Peer Chaincode Query Examples

## 12.1 Query Wallet by Address

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryWalletByAddress","WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67"]}'
```

## 12.2 Query Wallet by Customer ID

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryWalletByCustomerId","CUSTOMER_1001"]}'
```

This was tested successfully and returned the created wallet.

## 12.3 Query Transaction by ID

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryTransactionById","4d64c1086391ef2c04d6b42e47c238088ddf6096e6618a35c2a868725b24b547"]}'
```

## 12.4 Query Transactions by Status

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryTransactionsByStatus","SUCCESS"]}'
```

## 12.5 Query Transactions by Risk Status

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryTransactionsByRiskStatus","LOW"]}'
```

## 12.6 Query Transactions by Date Range

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryTransactionsByDateRange","2026-04-01T00:00:00.000Z","2026-04-30T23:59:59.999Z"]}'
```

---

# 13. Final Functional Verification Completed

## 13.1 Chaincode Version 2.0 Committed

```bash
peer lifecycle chaincode querycommitted \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js
```

Confirmed:

```text
Committed chaincode definition for chaincode 'kyc-wallet-chaincode-js' on channel 'kycchannelnix1':
Version: 2.0, Sequence: 2, Endorsement Plugin: escc, Validation Plugin: vscc, Approvals: [Org1MSP: true, Org2MSP: true]
```

## 13.2 Chaincode Containers Running

```bash
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "dev-peer|kyc|peer0|orderer|couch"
```

Confirmed:

```text
dev-peer0.org1.blockchain.local-kyc-wallet-chaincode-js_2.0...   Up
dev-peer0.org2.blockchain.local-kyc-wallet-chaincode-js_2.0...   Up
```

## 13.3 Wallet Created Successfully

Invoke:

```bash
peer chaincode invoke \
  -o orderer.blockchain.local:7050 \
  --ordererTLSHostnameOverride orderer.blockchain.local \
  --tls \
  --cafile /home/nix/u01/blockchain-integration/fabric-network/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pem \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  --peerAddresses peer0.org1.blockchain.local:7051 \
  --tlsRootCertFiles /home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt \
  --peerAddresses peer0.org2.blockchain.local:9051 \
  --tlsRootCertFiles /home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt \
  -c '{"Args":["CreateWallet","CUSTOMER_1001","BANK_001","Nix Customer","NID_HASH_1001","MOBILE_HASH_1001","EMAIL_HASH_1001","PASSWORD_HASH_1001","1000"]}'
```

Confirmed wallet:

```text
Wallet Address: WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67
Customer ID: CUSTOMER_1001
Organization ID: BANK_001
Balance: 1000 TOKEN
Status: ACTIVE
```

## 13.4 Query by Customer ID Successful

```bash
peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryWalletByCustomerId","CUSTOMER_1001"]}'
```

Confirmed result returned:

```text
WALLET_FD7AD395ADCB2D11E2300CD1919EEF8D45C44A67
CUSTOMER_1001
BANK_001
ACTIVE
1000 TOKEN
```

---

# 14. Important Best Practices

## 14.1 Always Include `docType`

Every ledger object should include:

```json
"docType": "wallet"
```

or:

```json
"docType": "transaction"
```

or:

```json
"docType": "organization"
```

## 14.2 Use ISO Date Format

Always store date fields like this:

```text
2026-04-30T10:32:36.748Z
```

Do not store dates like:

```text
30/04/2026
```

## 14.3 Do Not Query Without Indexes in Production

Avoid:

```json
{
  "selector": {
    "status": "SUCCESS"
  }
}
```

Use:

```json
{
  "selector": {
    "docType": "transaction",
    "status": "SUCCESS"
  },
  "use_index": [
    "indexTransactionByStatusDoc",
    "indexTransactionByStatus"
  ]
}
```

## 14.4 Avoid Heavy `$or` Queries

This may be slower:

```json
{
  "selector": {
    "$or": [
      {
        "fromWalletAddress": "WALLET_1001"
      },
      {
        "toWalletAddress": "WALLET_1001"
      }
    ]
  }
}
```

Better approach:

1. Query by `fromWalletAddress`.
2. Query by `toWalletAddress`.
3. Merge results in chaincode or API layer.

This approach was implemented in the updated `GetTransactionHistory` and `QueryTransactionHistoryByWallet`.

---

# 15. Common Errors and Fixes

## Error 1: Rich query works but is slow

**Cause:**  
Index is missing or not used.

**Fix:**  
Add `use_index` inside the query and confirm the index file exists in `META-INF`.

---

## Error 2: Index does not appear in CouchDB

**Cause:**  
Chaincode package did not include the `META-INF` folder.

**Fix:**  
Check package using nested `code.tar.gz` inspection:

```bash
tar -xOzf kyc-wallet-chaincode-js.tar.gz code.tar.gz | tar -tzf - | grep META-INF
```

---

## Error 3: Query says index not found

**Cause:**  
Wrong `ddoc` or index `name`.

**Fix:**  
Ensure `use_index` matches the file exactly.

Example:

```json
"use_index": [
  "indexWalletByAddressDoc",
  "indexWalletByAddress"
]
```

Must match:

```json
"ddoc": "indexWalletByAddressDoc",
"name": "indexWalletByAddress"
```

---

## Error 4: Date range query returns wrong results

**Cause:**  
Dates are not stored in ISO format.

**Fix:**  
Use:

```javascript
new Date().toISOString()
```

---

## Error 5: Chaincode container exits with Node.js ESM/CommonJS error

**Cause:**  
The contract file used ES Module syntax or top-level `await`.

**Fix:**  
Use CommonJS only:

```javascript
const { Contract } = require('fabric-contract-api');

module.exports = KycWalletContract;
```

Remove top-level code like:

```javascript
const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));
```

This issue was fixed in version `2.0`.

---

# 16. Final Step 13 Verification Checklist

```text
[x] META-INF/statedb/couchdb/indexes folder created
[x] Wallet address index created
[x] Customer ID index created
[x] Organization ID index created
[x] Transaction ID index created
[x] Transaction status index created
[x] Transaction type index created
[x] Created date index created
[x] Risk status index created
[x] From wallet index created
[x] To wallet index created
[x] Composite transaction index created
[x] All JSON files validated
[x] Chaincode package includes META-INF folder
[x] Chaincode installed with indexes
[x] Chaincode approved and committed
[x] CouchDB database visible
[x] Rich queries tested through peer CLI
[x] Chaincode containers running
[x] CreateWallet tested successfully
[x] QueryWalletByCustomerId tested successfully
```

---

# 17. Recommended Final Step 13 Verification Commands

```bash
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js

find META-INF/statedb/couchdb/indexes -name "*.json" -exec python3 -m json.tool {} \; >/dev/null

tar -xOzf kyc-wallet-chaincode-js.tar.gz code.tar.gz | tar -tzf - | grep META-INF

peer lifecycle chaincode querycommitted \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js

peer chaincode query \
  -C kycchannelnix1 \
  -n kyc-wallet-chaincode-js \
  -c '{"Args":["QueryWalletByCustomerId","CUSTOMER_1001"]}'

curl -s -u admin:adminpw http://localhost:5984/_all_dbs | python3 -m json.tool
```

---

# 18. Final Result

After Step 13, the JavaScript chaincode now has a professional CouchDB indexing and rich query layer.

You now have:

```text
[OK] CouchDB index files
[OK] Rich query methods
[OK] Query performance foundation
[OK] Transaction search optimization
[OK] Wallet search optimization
[OK] AML / risk query support
[OK] Date-range query support
[OK] Chaincode packaging readiness
[OK] CouchDB verification commands
[OK] Successful wallet creation
[OK] Successful rich query test
```

Final status:

```text
STEP 13 — COMPLETED SUCCESSFULLY ✅
```

You are ready to continue with:

```text
STEP 15 — Chaincode Invoke, Query, and Functional Testing
```
