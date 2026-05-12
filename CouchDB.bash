cd /home/nix/u01/blockchain-integration/fabric-network

1. Create Postman request: Test CouchDB
Method: GET
URL: http://172.31.13.90:5984/
Type: Basic Auth
Username: admin
Password: adminpw


2. List all CouchDB databases
Method: GET
URL: http://172.31.13.90:5984/_all_dbs
Type: Basic Auth
Username: admin
Password: adminpw

3. Check Fabric database info
Method: GET
URL: http://172.31.13.90:5984/kycchannelnix1_kyc-wallet-chaincode-js


4. Query wallet by customer ID
Method: POST
URL: http://172.31.13.90:5984/kycchannelnix1_kyc-wallet-chaincode-js/_find
Type: Basic Auth
Username: admin
Password: adminpw
Content-Type: application/json
Body → raw → JSON:
{
  "selector": {
    "docType": "wallet",
    "customerId": "1026688"
  },
  "use_index": [
    "indexWalletByCustomerIdDoc",
    "indexWalletByCustomerId"
  ],
  "limit": 10
}


5. Query transaction by type
Method: POST
URL: http://172.31.13.90:5984/kycchannelnix1_kyc-wallet-chaincode-js/_find
Body:
{
  "selector": {
    "docType": "transaction",
    "transactionType": "WALLET_CREATED"
  },
  "use_index": [
    "indexTransactionByTypeDoc",
    "indexTransactionByType"
  ],
  "limit": 20
}


6. Query successful transactions
{
  "selector": {
    "docType": "transaction",
    "status": "SUCCESS"
  },
  "use_index": [
    "indexTransactionByStatusDoc",
    "indexTransactionByStatus"
  ],
  "limit": 20
}