🔹 STEP 14 — Chaincode Deployment
Hyperledger Fabric Chaincode Lifecycle Deployment Guide
Project: Blockchain Integration Project — KYC Wallet Chaincode

1. Deployment Objective
In this step, we deploy and verify the JavaScript chaincode on the Hyperledger Fabric network using the Fabric v2+ lifecycle process.
This step covers:
1. Validate chaincode source2. Fix and verify CouchDB state database configuration3. Package chaincode4. Install chaincode on Org1 peer5. Install chaincode on Org2 peer6. Query installed chaincode package7. Query committed chaincode definition8. Verify Org1 and Org2 approvals9. Test chaincode query10. Test chaincode invoke with correct endorsement11. Verify wallet creation and login12. Confirm Step 14 completion

2. Final Project Values
PROJECT_ROOT=/home/nix/u01/blockchain-integrationFABRIC_NETWORK=/home/nix/u01/blockchain-integration/fabric-networkCHAINCODE_DIR=/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-jsCHANNEL_NAME=kycchannelnix1CC_NAME=kyc-wallet-chaincode-jsCC_LANGUAGE=node
Final committed chaincode definition:
Chaincode Name: kyc-wallet-chaincode-jsChannel: kycchannelnix1Committed Version: 2.0Committed Sequence: 2Org1MSP Approval: trueOrg2MSP Approval: true
Installed package used during verification:
Package Label:kyc-wallet-chaincode-js_1.0Package ID:kyc-wallet-chaincode-js_1.0:bcf812cb741dead1544268383b8fd2f8ce06fd03e318a3addd14aa2c7d0462e7
Important note:
The committed chaincode definition is Version 2.0 / Sequence 2.Do not try to recommit Version 1.0 / Sequence 1 unless you reset the network.

3. Chaincode Folder Location
Chaincode path:
/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-js
Expected structure:
kyc-wallet-chaincode-js/├── index.js├── package.json├── package-lock.json├── lib/│   └── kycWalletContract.js└── META-INF/    └── statedb/        └── couchdb/            └── indexes/

4. Pre-Deployment Validation
Run:
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-jsnpm installnode -c index.jsnode -c lib/kycWalletContract.js
Expected result:
No syntax errors.npm install completes successfully.

5. Correct CouchDB Configuration
The old CouchDB file used:
couchdb0couchdb1
But the Fabric peer configuration expects:
couchdb0.org1couchdb0.org2
Therefore, the updated CouchDB compose file should define only CouchDB services and should not redefine peer services.

6. Updated docker-compose-couchdb.yaml
version: "3.8"volumes:  couchdb0_org1_data:  couchdb0_org2_data:networks:  fabric_test:    external: true    name: fabric_testservices:  couchdb0.org1:    container_name: couchdb0.org1    image: couchdb:3.3.3    restart: unless-stopped    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "5984:5984"    networks:      - fabric_test    volumes:      - couchdb0_org1_data:/opt/couchdb/data  couchdb0.org2:    container_name: couchdb0.org2    image: couchdb:3.3.3    restart: unless-stopped    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "7984:5984"    networks:      - fabric_test    volumes:      - couchdb0_org2_data:/opt/couchdb/data

7. Clean Old CouchDB Containers
Old wrong containers:
couchdb0couchdb1
Remove them:
cd /home/nix/u01/blockchain-integration/fabric-networkdocker stop couchdb0 couchdb1 2>/dev/null || truedocker rm couchdb0 couchdb1 2>/dev/null || true

8. Reset CouchDB Volumes During Local Development
Because CouchDB credentials are initialized when the volume is first created, remove old volumes if password/authentication problems appear.
docker volume ls | grep couchdb
Remove local development CouchDB volumes:
docker volume rm fabric-network_couchdb0_org1_data fabric-network_couchdb0_org2_data 2>/dev/null || truedocker volume rm fabric-network_couchdb0_data fabric-network_couchdb1_data 2>/dev/null || true
Do not do this in production.

9. Start CouchDB
cd /home/nix/u01/blockchain-integration/fabric-networkdocker compose -f docker-compose-couchdb.yaml up -d
Verify:
curl -u admin:adminpw http://localhost:5984curl -u admin:adminpw http://localhost:7984
Expected:
{"couchdb":"Welcome"}

10. Start Fabric Peers
cd /home/nix/u01/blockchain-integration/fabric-networkdocker compose -f docker-compose-fabric.yaml up -d --force-recreate peer0.org1.blockchain.local peer0.org2.blockchain.local
Verify:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "peer0|couchdb"
Expected:
peer0.org1.blockchain.localpeer0.org2.blockchain.localcouchdb0.org1couchdb0.org2
You should not see:
couchdb0couchdb1

11. Verify Peer Logs
docker logs peer0.org1.blockchain.local --tail=80
Healthy signs:
Initialized LedgerMgrLoading chain kycchannelnix1Opened ledger with id = kycchannelnix1Started peer with ID=[peer0.org1.blockchain.local]
Bad signs that must be fixed:
lookup couchdb0 ... no such hostStatus Code:401, Reason:Name or password is incorrectENDORSEMENT_POLICY_FAILURE

12. Package Chaincode
Run from host:
cd /home/nix/u01/blockchain-integrationexport CC_NAME=kyc-wallet-chaincode-jsexport CC_VERSION=1.0export CC_LABEL=kyc-wallet-chaincode-js_1.0export CC_PACKAGE_FILE=${CC_LABEL}.tar.gzexport CC_SRC_PATH=/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode-jsexport CC_LANG=nodepeer lifecycle chaincode package ${CC_PACKAGE_FILE} \  --path ${CC_SRC_PATH} \  --lang ${CC_LANG} \  --label ${CC_LABEL}
Verify:
ls -lh ${CC_PACKAGE_FILE}
Expected:
kyc-wallet-chaincode-js_1.0.tar.gz

13. Install Chaincode on Org1
Use host paths, not Docker internal paths.
cd /home/nix/u01/blockchain-integrationexport CC_PACKAGE_FILE=kyc-wallet-chaincode-js_1.0.tar.gzexport CORE_PEER_TLS_ENABLED=trueexport CORE_PEER_LOCALMSPID=Org1MSPexport CORE_PEER_ADDRESS=localhost:7051export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.org1.blockchain.localexport CORE_PEER_TLS_ROOTCERT_FILE=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crtexport CORE_PEER_MSPCONFIGPATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msppeer channel listpeer lifecycle chaincode install ${CC_PACKAGE_FILE}
Successful result:
Chaincode code package identifier:kyc-wallet-chaincode-js_1.0:bcf812cb741dead1544268383b8fd2f8ce06fd03e318a3addd14aa2c7d0462e7

14. Install Chaincode on Org2
cd /home/nix/u01/blockchain-integrationexport CC_PACKAGE_FILE=kyc-wallet-chaincode-js_1.0.tar.gzexport CORE_PEER_TLS_ENABLED=trueexport CORE_PEER_LOCALMSPID=Org2MSPexport CORE_PEER_ADDRESS=localhost:9051export CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.org2.blockchain.localexport CORE_PEER_TLS_ROOTCERT_FILE=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crtexport CORE_PEER_MSPCONFIGPATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msppeer channel listpeer lifecycle chaincode install ${CC_PACKAGE_FILE}
If you see:
chaincode already successfully installed
This is not an error. It means the package already exists on the peer.

15. Query Installed Chaincode
peer lifecycle chaincode queryinstalled
Expected package:
Package ID: kyc-wallet-chaincode-js_1.0:bcf812cb741dead1544268383b8fd2f8ce06fd03e318a3addd14aa2c7d0462e7Label: kyc-wallet-chaincode-js_1.0
Export:
export PACKAGE_ID=kyc-wallet-chaincode-js_1.0:bcf812cb741dead1544268383b8fd2f8ce06fd03e318a3addd14aa2c7d0462e7

16. Query Committed Chaincode
peer lifecycle chaincode querycommitted \  --channelID kycchannelnix1 \  --name kyc-wallet-chaincode-js
Final verified result:
Committed chaincode definition for chaincode 'kyc-wallet-chaincode-js' on channel 'kycchannelnix1':Version: 2.0Sequence: 2Endorsement Plugin: esccValidation Plugin: vsccApprovals: [Org1MSP: true, Org2MSP: true]
This confirms:
Org1 approved: trueOrg2 approved: trueChaincode committed: true

17. Important Version and Sequence Rule
Current committed definition:
Version: 2.0Sequence: 2
Therefore:
Do not approve or commit Version 1.0 / Sequence 1 again.
For the next chaincode upgrade, use:
export CC_VERSION=3.0export CC_SEQUENCE=3
Fabric sequence must always increase.

18. Set Common Test Variables
cd /home/nix/u01/blockchain-integrationexport CHANNEL_NAME=kycchannelnix1export CC_NAME=kyc-wallet-chaincode-jsexport ORDERER_ADDRESS=localhost:7050export ORDERER_HOSTNAME=orderer.blockchain.localexport ORDERER_CA=/home/nix/u01/blockchain-integration/fabric-network/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pemexport ORG1_TLS_ROOTCERT=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crtexport ORG2_TLS_ROOTCERT=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crtexport CORE_PEER_TLS_ENABLED=trueexport CORE_PEER_LOCALMSPID=Org1MSPexport CORE_PEER_ADDRESS=localhost:7051export CORE_PEER_TLS_ROOTCERT_FILE=${ORG1_TLS_ROOTCERT}export CORE_PEER_MSPCONFIGPATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
Important for multi-peer invoke:
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE

19. Chaincode Function Parameters
CreateWallet Signature
From the chaincode:
CreateWallet(ctx, customerId, organizationId, fullName, nationalIdHash, mobileHash, emailHash, passwordHash, initialBalance)
Correct argument order:
1. customerId2. organizationId3. fullName4. nationalIdHash5. mobileHash6. emailHash7. passwordHash8. initialBalance
Example:
{  "Args": [    "CreateWallet",    "CUST1003",    "BANK001",    "Nicolas Salloum",    "NID_HASH_1003",    "MOBILE_HASH_1003",    "EMAIL_HASH_1003",    "PASSWORD_HASH_1003",    "1000"  ]}
LoginWallet Signature
LoginWallet(ctx, walletAddress, passwordHash)
Correct argument order:
1. walletAddress2. passwordHash

20. Important Endorsement Policy Note
The channel endorsement policy requires both organizations.
If you invoke with Org1 only, the peer may return:
Chaincode invoke successful
But the transaction may later be marked invalid during block validation.
Invalid reason:
ENDORSEMENT_POLICY_FAILURE
Therefore, for ledger writes, invoke with both peers:
Org1 peer: localhost:7051Org2 peer: localhost:9051

21. Correct CreateWallet Invoke with Two-Org Endorsement
cd /home/nix/u01/blockchain-integrationunset CORE_PEER_TLS_SERVERHOSTOVERRIDEpeer chaincode invoke \  -o ${ORDERER_ADDRESS} \  --ordererTLSHostnameOverride ${ORDERER_HOSTNAME} \  --tls \  --cafile ${ORDERER_CA} \  -C ${CHANNEL_NAME} \  -n ${CC_NAME} \  --peerAddresses localhost:7051 \  --tlsRootCertFiles ${ORG1_TLS_ROOTCERT} \  --peerAddresses localhost:9051 \  --tlsRootCertFiles ${ORG2_TLS_ROOTCERT} \  -c '{"Args":["CreateWallet","CUST1003","BANK001","Nicolas Salloum","NID_HASH_1003","MOBILE_HASH_1003","EMAIL_HASH_1003","PASSWORD_HASH_1003","1000"]}'
Expected:
Chaincode invoke successful. result: status:200
Final verified wallet:
Customer ID:CUST1003Wallet Address:WALLET_E0528A533BB32A0C85D72C1384E16A103D1E9BC3Organization:BANK001Balance:1000 TOKENStatus:ACTIVE

22. Query Wallet by Customer ID
peer chaincode query \  -C ${CHANNEL_NAME} \  -n ${CC_NAME} \  -c '{"Args":["GetWalletByCustomerId","CUST1003"]}'
Expected:
{  "success": true,  "message": "Wallet retrieved successfully"}

23. Query Wallet Balance
peer chaincode query \  -C ${CHANNEL_NAME} \  -n ${CC_NAME} \  -c '{"Args":["GetWalletBalance","WALLET_E0528A533BB32A0C85D72C1384E16A103D1E9BC3"]}'
Expected:
{  "success": true,  "message": "Wallet balance retrieved successfully"}

24. Test LoginWallet
peer chaincode query \  -C ${CHANNEL_NAME} \  -n ${CC_NAME} \  -c '{"Args":["LoginWallet","WALLET_E0528A533BB32A0C85D72C1384E16A103D1E9BC3","PASSWORD_HASH_1003"]}'
Verified successful result:
{  "success": true,  "message": "Wallet login successful"}
Returned wallet:
walletAddress: WALLET_E0528A533BB32A0C85D72C1384E16A103D1E9BC3customerId: CUST1003organizationId: BANK001balance: 1000currency: TOKENstatus: ACTIVE

25. Check Peer Logs for Invalid Transactions
Use:
docker logs peer0.org1.blockchain.local --tail=200 | grep -i "invalid\|endorsement\|ENDORSEMENT_POLICY_FAILURE"
Earlier invalid transactions were caused by one-peer endorsement only.
Example issue:
1 sub-policies were satisfied, but this policy requires 2 of the 'Endorsement' sub-policiesReason code [ENDORSEMENT_POLICY_FAILURE]
Correct fix:
Use both Org1 and Org2 peer addresses in invoke commands.

26. Troubleshooting Summary
Error: MSP path does not exist
Bad path on host:
/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
Correct host path:
/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp

Error: lookup couchdb0 ... no such host
Cause:
Peer expected couchdb0, but correct container is couchdb0.org1.
Fix:
CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org1:5984
For Org2:
CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org2:5984

Error: CouchDB 401 unauthorized
Cause:
CouchDB volume kept old credentials.
Fix:
docker volume rm fabric-network_couchdb0_org1_data fabric-network_couchdb0_org2_data
Then recreate CouchDB.

Error: TLS hostname mismatch between Org1 and Org2
Cause:
CORE_PEER_TLS_SERVERHOSTOVERRIDE=peer0.org1.blockchain.local
was being applied while connecting to Org2.
Fix before multi-peer invoke:
unset CORE_PEER_TLS_SERVERHOSTOVERRIDE
Use:
--peerAddresses localhost:7051--tlsRootCertFiles ${ORG1_TLS_ROOTCERT}--peerAddresses localhost:9051--tlsRootCertFiles ${ORG2_TLS_ROOTCERT}

Error: Expected 8 parameters
Cause:
CreateWallet received wrong number of arguments.
Correct:
-c '{"Args":["CreateWallet","CUST1003","BANK001","Nicolas Salloum","NID_HASH_1003","MOBILE_HASH_1003","EMAIL_HASH_1003","PASSWORD_HASH_1003","1000"]}'

Error: initialBalance must be a valid number
Cause:
Password was placed in the initialBalance position.
Correct parameter order:
customerId, organizationId, fullName, nationalIdHash, mobileHash, emailHash, passwordHash, initialBalance

Error: Wallet not found after successful invoke
Cause:
Transaction was endorsed by only Org1, then marked invalid by endorsement policy.
Fix:
Invoke with both Org1 and Org2 peers.

27. Final Verification Checklist
✅ CouchDB containers fixed:   couchdb0.org1   couchdb0.org2✅ Peer containers healthy:   peer0.org1.blockchain.local   peer0.org2.blockchain.local✅ Channel active:   kycchannelnix1✅ Chaincode installed:   Org1   Org2✅ Chaincode committed:   Version 2.0   Sequence 2✅ Approvals:   Org1MSP: true   Org2MSP: true✅ Query test:   chaincode reachable✅ Invoke test:   CreateWallet successful with two-org endorsement✅ Login test:   LoginWallet successful✅ Ledger state verified:   CUST1003 wallet exists

28. Final Step 14 Completion Status
🔹 STEP 14 — Chaincode Deployment: COMPLETEDProject:Blockchain Integration ProjectChannel:kycchannelnix1Chaincode:kyc-wallet-chaincode-jsCommitted Version:2.0Committed Sequence:2Organizations:Org1MSP approvedOrg2MSP approvedState Database:CouchDBCouchDB Containers:couchdb0.org1couchdb0.org2Verified Wallet:CUST1003Verified Wallet Address:WALLET_E0528A533BB32A0C85D72C1384E16A103D1E9BC3Verified Login:SUCCESSFinal Status:READY FOR STEP 15

29. Next Step
Continue to:
🔹 STEP 15 — Blockchain API / Middleware Integration
Step 15 should connect the backend API layer to Hyperledger Fabric so the application teams can call REST APIs instead of manual peer chaincode commands.