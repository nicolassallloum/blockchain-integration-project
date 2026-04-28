🔹 STEP 7 — CouchDB Setup for Fabric State Database
Full Updated Steps + Script Document
Blockchain Integration Project
Project path:
/home/nix/u01/blockchain-integration/fabric-network
Main Docker Compose file:
docker-compose-fabric.yaml
Your current docker-compose-fabric.yaml already includes CouchDB containers for both peers: couchdb0.org1 and couchdb0.org2, and both peers are already configured with CORE_LEDGER_STATE_STATEDATABASE=CouchDB. 

1. Step 7 Objective
The objective of this step is to configure Apache CouchDB as the world state database for Hyperledger Fabric peers.
Fabric keeps two important data layers:
1. Blockchain ledger   - Immutable transaction log   - Stores blocks and transactions2. World state database   - Stores the latest value of each key   - Used by chaincode for fast reads and queries
By default, Fabric uses LevelDB.
In this project, we use CouchDB because we need JSON documents and rich queries.

2. Why CouchDB Is Needed
CouchDB is needed because this Blockchain Integration Project will store and query structured JSON data such as:
Customer KYC recordsWallet recordsOrganization recordsTransaction metadataCustomer statusKYC approval statusBank/customer relationshipsAML flagsAudit metadata
Example ledger document:
{  "docType": "customer",  "customerId": "CUST-1001",  "walletAddress": "wallet_abc123",  "organizationId": "BANK001",  "kycStatus": "APPROVED",  "createdAt": "2026-04-28T10:00:00Z"}
With CouchDB, Fabric chaincode can run rich queries such as:
Find all approved customersFind customer by wallet addressFind customers by organizationFind transactions by walletFind KYC records by status

3. LevelDB vs CouchDB
FeatureLevelDBCouchDBDefault Fabric state DBYesNoTypeEmbedded key-value DBExternal JSON document DBRuns as separate containerNoYesStores simple key-value dataYesYesStores JSON documentsLimitedYesSupports rich JSON queriesNoYesSupports indexesNoYesGood for simple chaincodeYesYesGood for KYC/customer searchLimitedExcellentOperational complexityLowerHigher
For this project, CouchDB is the correct choice because we need rich JSON queries for KYC, wallet, organization, and transaction records.

4. Current CouchDB Setup Status
Your current Docker Compose file already contains:
couchdb0.org1couchdb0.org2
Your peers are configured like this:
Org1 Peer
- CORE_LEDGER_STATE_STATEDATABASE=CouchDB- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org1:5984- CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin- CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
Org2 Peer
- CORE_LEDGER_STATE_STATEDATABASE=CouchDB- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org2:5984- CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin- CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
So you do not need to create a separate docker-compose-couchdb.yaml.

5. Current CouchDB Containers
Your setup uses:
OrganizationCouchDB ContainerInternal PortHost PortOrg1couchdb0.org159845984Org2couchdb0.org259847984
Access URLs:
Org1 CouchDB:http://SERVER_IP:5984/_utilsOrg2 CouchDB:http://SERVER_IP:7984/_utils
Login:
Username: adminPassword: adminpw

6. Docker Compose CouchDB Configuration
Your current configuration already includes the following pattern.
Org1 CouchDB
couchdb0.org1:  container_name: couchdb0.org1  image: couchdb:3  environment:    - COUCHDB_USER=admin    - COUCHDB_PASSWORD=adminpw  ports:    - "5984:5984"  volumes:    - couchdb0.org1:/opt/couchdb/data  networks:    blockchain_net:      aliases:        - couchdb0.org1
Org2 CouchDB
couchdb0.org2:  container_name: couchdb0.org2  image: couchdb:3  environment:    - COUCHDB_USER=admin    - COUCHDB_PASSWORD=adminpw  ports:    - "7984:5984"  volumes:    - couchdb0.org2:/opt/couchdb/data  networks:    blockchain_net:      aliases:        - couchdb0.org2

7. Peer Environment Variables
Org1 Peer CouchDB Settings
- CORE_LEDGER_STATE_STATEDATABASE=CouchDB- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org1:5984- CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin- CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
Org2 Peer CouchDB Settings
- CORE_LEDGER_STATE_STATEDATABASE=CouchDB- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org2:5984- CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin- CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
Important:
Inside Docker, the peer must use the CouchDB container name:
couchdb0.org1:5984couchdb0.org2:5984
Do not use:
localhost:5984localhost:7984
inside peer configuration.

8. Start Fabric Network with CouchDB
Go to your project folder:
cd /home/nix/u01/blockchain-integration/fabric-network
Start the network:
docker compose -f docker-compose-fabric.yaml up -d
Check containers:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Expected containers:
orderer.blockchain.localpeer0.org1.blockchain.localpeer0.org2.blockchain.localcouchdb0.org1couchdb0.org2

9. Verification Commands
9.1 Verify Org1 CouchDB
curl -u admin:adminpw http://localhost:5984
Expected result:
{  "couchdb": "Welcome"}

9.2 Verify Org2 CouchDB
curl -u admin:adminpw http://localhost:7984
Expected result:
{  "couchdb": "Welcome"}

9.3 List Org1 CouchDB Databases
curl -u admin:adminpw http://localhost:5984/_all_dbs
Your verified result includes:
[  "_replicator",  "_users",  "fabric__internal",  "kycchannelnix1_",  "kycchannelnix1__lifecycle"]

9.4 List Org2 CouchDB Databases
curl -u admin:adminpw http://localhost:7984/_all_dbs
Your verified result includes:
[  "_replicator",  "_users",  "fabric__internal",  "kycchannelnix1_",  "kycchannelnix1__lifecycle"]
This confirms Fabric is using CouchDB for your channel state database.

10. Verify Peer CouchDB Environment
Org1
docker exec peer0.org1.blockchain.local printenv | grep COUCHDB
Expected:
CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=adminCORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org1:5984CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
Org2
docker exec peer0.org2.blockchain.local printenv | grep COUCHDB
Expected:
CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=adminCORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org2:5984CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw

11. Peer-to-CouchDB Connectivity
Important note:
The Fabric peer container does not include curl, so this command fails:
docker exec -it peer0.org1.blockchain.local bashcurl -u admin:adminpw http://couchdb0.org1:5984
You saw:
bash: curl: command not found
This is not a CouchDB issue.
It only means the peer image does not include curl.
Instead, verify Docker DNS resolution from the peer container.
Org1 Peer DNS Test
docker exec peer0.org1.blockchain.local sh -c 'getent hosts couchdb0.org1'
Expected result:
172.x.x.x couchdb0.org1
Org2 Peer DNS Test
docker exec peer0.org2.blockchain.local sh -c 'getent hosts couchdb0.org2'
Expected result:
172.x.x.x couchdb0.org2

12. Corrected Verification Script
Create or replace the script:
cd /home/nix/u01/blockchain-integration/fabric-networknano verify-couchdb.sh
Paste this full script:
#!/bin/bashset -ePROJECT_DIR="/home/nix/u01/blockchain-integration/fabric-network"cd "$PROJECT_DIR"echo "=========================================="echo "Verifying CouchDB Setup for Fabric"echo "Project Path: $PROJECT_DIR"echo "=========================================="echo ""echo "1. Checking running containers..."docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"echo ""echo "2. Testing Org1 CouchDB on localhost:5984..."curl -s -u admin:adminpw http://localhost:5984 | jq .echo ""echo "3. Testing Org2 CouchDB on localhost:7984..."curl -s -u admin:adminpw http://localhost:7984 | jq .echo ""echo "4. Listing Org1 CouchDB databases..."curl -s -u admin:adminpw http://localhost:5984/_all_dbs | jq .echo ""echo "5. Listing Org2 CouchDB databases..."curl -s -u admin:adminpw http://localhost:7984/_all_dbs | jq .echo ""echo "6. Checking Org1 peer CouchDB environment..."docker exec peer0.org1.blockchain.local printenv | grep COUCHDBecho ""echo "7. Checking Org2 peer CouchDB environment..."docker exec peer0.org2.blockchain.local printenv | grep COUCHDBecho ""echo "8. Testing peer0.org1 can resolve couchdb0.org1..."docker exec peer0.org1.blockchain.local sh -c 'getent hosts couchdb0.org1'echo ""echo "9. Testing peer0.org2 can resolve couchdb0.org2..."docker exec peer0.org2.blockchain.local sh -c 'getent hosts couchdb0.org2'echo ""echo "10. Testing CouchDB container local response for Org1..."docker exec couchdb0.org1 curl -s -u admin:adminpw http://localhost:5984 | jq .echo ""echo "11. Testing CouchDB container local response for Org2..."docker exec couchdb0.org2 curl -s -u admin:adminpw http://localhost:5984 | jq .echo ""echo "=========================================="echo "CouchDB verification completed successfully."echo "=========================================="
Make it executable:
chmod +x verify-couchdb.sh
Install jq if needed:
sudo apt updatesudo apt install jq -y
Run:
./verify-couchdb.sh

13. Optional Restart Script
Create a restart script for Step 7:
cd /home/nix/u01/blockchain-integration/fabric-networknano restart-fabric-couchdb.sh
Paste:
#!/bin/bashset -ePROJECT_DIR="/home/nix/u01/blockchain-integration/fabric-network"cd "$PROJECT_DIR"echo "=========================================="echo "Restarting Fabric Network with CouchDB"echo "Project Path: $PROJECT_DIR"echo "=========================================="echo ""echo "1. Stopping current containers..."docker compose -f docker-compose-fabric.yaml downecho ""echo "2. Starting Fabric network..."docker compose -f docker-compose-fabric.yaml up -decho ""echo "3. Waiting for containers to stabilize..."sleep 5echo ""echo "4. Checking running containers..."docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"echo ""echo "5. Verifying CouchDB..."./verify-couchdb.shecho ""echo "=========================================="echo "Fabric Network with CouchDB restarted successfully."echo "=========================================="
Make executable:
chmod +x restart-fabric-couchdb.sh
Run:
./restart-fabric-couchdb.sh

14. Optional Clean Development Reset Script
Use this only in development.
Warning:
This removes Docker volumes and deletes ledger/world-state data.Use only when you want to recreate the network from zero.
Create:
cd /home/nix/u01/blockchain-integration/fabric-networknano clean-fabric-couchdb.sh
Paste:
#!/bin/bashset -ePROJECT_DIR="/home/nix/u01/blockchain-integration/fabric-network"cd "$PROJECT_DIR"echo "=========================================="echo "Cleaning Fabric Network with CouchDB"echo "WARNING: This removes Docker volumes."echo "Project Path: $PROJECT_DIR"echo "=========================================="read -p "Are you sure you want to delete Fabric and CouchDB volumes? Type YES: " CONFIRMif [ "$CONFIRM" != "YES" ]; then  echo "Clean cancelled."  exit 0fiecho ""echo "1. Stopping and removing containers with volumes..."docker compose -f docker-compose-fabric.yaml down -vecho ""echo "2. Removing unused Docker volumes..."docker volume prune -fecho ""echo "3. Removing unused Docker networks..."docker network prune -fecho ""echo "4. Clean completed."echo "You can restart with:"echo "docker compose -f docker-compose-fabric.yaml up -d"echo ""echo "=========================================="echo "Clean completed successfully."echo "=========================================="
Make executable:
chmod +x clean-fabric-couchdb.sh
Run only when needed:
./clean-fabric-couchdb.sh

15. How CouchDB Supports Rich Queries
CouchDB allows Fabric chaincode to query JSON document fields.
Example customer document:
{  "docType": "customer",  "customerId": "CUST-1001",  "fullName": "Customer Name",  "walletAddress": "wallet_abc123",  "organizationId": "BANK001",  "kycStatus": "APPROVED",  "createdAt": "2026-04-28T10:00:00Z"}
Example rich query selector:
{  "selector": {    "docType": "customer",    "organizationId": "BANK001",    "kycStatus": "APPROVED"  }}
This can be used in chaincode with:
const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));

16. Recommended CouchDB Indexes
Inside your chaincode folder, create:
mkdir -p META-INF/statedb/couchdb/indexes
Customer ID Index
nano META-INF/statedb/couchdb/indexes/indexCustomerId.json
{  "index": {    "fields": [      "docType",      "customerId"    ]  },  "ddoc": "indexCustomerIdDoc",  "name": "indexCustomerId",  "type": "json"}
Wallet Address Index
nano META-INF/statedb/couchdb/indexes/indexWalletAddress.json
{  "index": {    "fields": [      "docType",      "walletAddress"    ]  },  "ddoc": "indexWalletAddressDoc",  "name": "indexWalletAddress",  "type": "json"}
Organization and KYC Status Index
nano META-INF/statedb/couchdb/indexes/indexOrganizationKycStatus.json
{  "index": {    "fields": [      "docType",      "organizationId",      "kycStatus"    ]  },  "ddoc": "indexOrganizationKycStatusDoc",  "name": "indexOrganizationKycStatus",  "type": "json"}

17. Recommended Chaincode Query Example
JavaScript Example
async getApprovedCustomersByOrganization(ctx, organizationId) {  const query = {    selector: {      docType: "customer",      organizationId: organizationId,      kycStatus: "APPROVED"    }  };  const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));  const results = [];  while (true) {    const res = await iterator.next();    if (res.value && res.value.value.toString()) {      const record = JSON.parse(res.value.value.toString("utf8"));      results.push(record);    }    if (res.done) {      await iterator.close();      break;    }  }  return JSON.stringify(results);}

18. Common CouchDB/Fabric Errors and Fixes
Error 1: curl: command not found inside peer
Cause
Fabric peer image does not include curl.
Fix
Do not test using curl inside the peer container.
Use:
docker exec peer0.org1.blockchain.local sh -c 'getent hosts couchdb0.org1'
And:
docker exec peer0.org2.blockchain.local sh -c 'getent hosts couchdb0.org2'

Error 2: Wrong CouchDB hostname
Wrong
http://couchdb0:5984
Correct for your project
http://couchdb0.org1:5984http://couchdb0.org2:5984

Error 3: Using wrong host port for Org2
Your Org2 CouchDB uses:
ports:  - "7984:5984"
So this is correct:
curl -u admin:adminpw http://localhost:7984
This is wrong for your current setup:
curl -u admin:adminpw http://localhost:6984

Error 4: Authentication failed
Example
unauthorizedName or password is incorrect
Fix
Make sure CouchDB and peer use the same credentials:
COUCHDB_USER=adminCOUCHDB_PASSWORD=adminpw
Peer:
CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=adminCORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw

Error 5: Peer cannot connect to CouchDB
Check peer environment
docker exec peer0.org1.blockchain.local printenv | grep COUCHDB
Check Docker network
docker network inspect blockchain_net
Restart
docker compose -f docker-compose-fabric.yaml downdocker compose -f docker-compose-fabric.yaml up -d

Error 6: CouchDB database not created
Cause
The peer has not joined the channel yet, or chaincode has not written data.
Check databases
curl -u admin:adminpw http://localhost:5984/_all_dbs
You already have:
kycchannelnix1_kycchannelnix1__lifecycle
So this is already correct.

Error 7: Rich query returns empty result
Causes
Data is not stored as JSONWrong field namesMissing docTypeNo matching records
Fix
Store documents like:
{  "docType": "customer",  "customerId": "CUST-1001",  "kycStatus": "APPROVED"}
Always include docType in queries.

Error 8: Rich query is slow
Cause
Missing CouchDB indexes.
Fix
Add index files under:
META-INF/statedb/couchdb/indexes/
Then repackage and redeploy chaincode.

19. Final Step 7 Verification Checklist
ItemStatusCouchDB purpose understood✅LevelDB vs CouchDB difference documented✅CouchDB containers configured✅Org1 CouchDB running✅Org2 CouchDB running✅CouchDB username/password configured✅Org1 peer configured for CouchDB✅Org2 peer configured for CouchDB✅Peer CouchDB environment verified✅CouchDB databases created✅kycchannelnix1_ database exists✅kycchannelnix1__lifecycle database exists✅Corrected verification script provided✅Rich query support documented✅CouchDB indexes documented✅Common errors and fixes documented✅

20. Final Status
🔹 STEP 7 — CouchDB Setup for Fabric State Database: COMPLETED ✅
Your Fabric peers are now using CouchDB as the state database.
You are ready to continue to:
🔹 STEP 8 — Chaincode Design and Smart Contract Business Logic