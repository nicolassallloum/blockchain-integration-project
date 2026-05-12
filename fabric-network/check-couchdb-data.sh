#!/bin/bash

COUCH_USER="admin"
COUCH_PASS="adminpw"
COUCH_URL="http://127.0.0.1:5984"
DB="kycchannelnix1_kyc-wallet-chaincode-js"

echo "===== COUCHDB CONTAINERS ====="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -i couch || true

echo ""
echo "===== ALL DATABASES ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" "$COUCH_URL/_all_dbs" | jq

echo ""
echo "===== DATABASE INFO ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" "$COUCH_URL/$DB" | jq

echo ""
echo "===== FIRST 20 DOCUMENT IDS ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" "$COUCH_URL/$DB/_all_docs?limit=20" | jq

echo ""
echo "===== WALLET BY CUSTOMER ID ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" -X POST "$COUCH_URL/$DB/_find" \
-H "Content-Type: application/json" \
-d '{
  "selector": {
    "docType": "wallet",
    "customerId": "1026688"
  },
  "use_index": [
    "indexWalletByCustomerIdDoc",
    "indexWalletByCustomerId"
  ],
  "limit": 10
}' | jq

echo ""
echo "===== WALLET BY WALLET ADDRESS ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" -X POST "$COUCH_URL/$DB/_find" \
-H "Content-Type: application/json" \
-d '{
  "selector": {
    "docType": "wallet",
    "walletAddress": "WALLET_AA82C9C7E87AB15FE4127CC57FF56E0DC25405EF"
  },
  "use_index": [
    "indexWalletByAddressDoc",
    "indexWalletByAddress"
  ],
  "limit": 10
}' | jq

echo ""
echo "===== TRANSACTIONS BY TYPE ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" -X POST "$COUCH_URL/$DB/_find" \
-H "Content-Type: application/json" \
-d '{
  "selector": {
    "docType": "transaction",
    "transactionType": "WALLET_CREATED"
  },
  "use_index": [
    "indexTransactionByTypeDoc",
    "indexTransactionByType"
  ],
  "limit": 20
}' | jq

echo ""
echo "===== TRANSACTIONS BY STATUS ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" -X POST "$COUCH_URL/$DB/_find" \
-H "Content-Type: application/json" \
-d '{
  "selector": {
    "docType": "transaction",
    "status": "SUCCESS"
  },
  "use_index": [
    "indexTransactionByStatusDoc",
    "indexTransactionByStatus"
  ],
  "limit": 20
}' | jq

echo ""
echo "===== INDEXES ====="
curl -s -u "$COUCH_USER:$COUCH_PASS" "$COUCH_URL/$DB/_index" | jq
