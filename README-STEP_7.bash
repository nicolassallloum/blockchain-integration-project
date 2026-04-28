🔹 STEP 7 — CouchDB Setup for Fabric State Database
1. Purpose of This Step
In Hyperledger Fabric, every peer maintains a world state database that stores the latest value of ledger keys.
By default, Fabric uses LevelDB, but for this Blockchain Integration Project, we will configure CouchDB because it supports JSON document storage and rich queries.
Officially, Fabric supports both LevelDB and CouchDB as peer state databases. LevelDB is embedded inside the peer, while CouchDB is an external database that allows JSON-based queries and indexing. 

2. Why CouchDB Is Needed
For this project, CouchDB is useful because we need to query blockchain state data such as:
Customer KYC recordsWallet recordsOrganization recordsTransaction metadataCustomer statusBank/organization relationshipsAML/KYC flags
With CouchDB, chaincode can store JSON documents and query them by fields such as:
{  "docType": "customer",  "customerId": "CUST-1001",  "walletAddress": "wallet_abc123",  "status": "ACTIVE",  "organizationId": "BANK001"}
This allows queries like:
Find all ACTIVE customersFind customers by organizationIdFind wallet by customerIdFind all transactions linked to a walletFind KYC records with pending status
Fabric documentation specifically notes that CouchDB allows modeling ledger data as JSON and issuing rich queries against data values rather than only keys. 

3. LevelDB vs CouchDB
FeatureLevelDBCouchDBTypeEmbedded key-value databaseExternal JSON document databaseDefault in FabricYesNoRuns inside peer processYesNo, separate Docker containerQuery by keyYesYesQuery by key rangeYesYesComposite key queriesYesYesJSON rich queriesNoYesIndex supportNoYesGood for simple key-value dataYesYesGood for KYC/customer searchLimitedExcellentRequires extra containerNoYesPerformanceFaster for simple reads/writesBetter for complex JSON queriesProduction complexityLowerHigher

4. Recommended Folder Structure
Use this structure inside your project:
/u01/blockchain-integration/├── fabric-network/│   ├── docker-compose.yaml│   ├── docker-compose-couchdb.yaml│   ├── configtx/│   ├── channel-artifacts/│   ├── organizations/│   ├── scripts/│   │   ├── start-network.sh│   │   ├── stop-network.sh│   │   ├── verify-couchdb.sh│   │   └── clean-network.sh│   └── README.md│├── chaincode/│   └── kyc-chaincode/│       ├── src/│       ├── META-INF/│       │   └── statedb/│       │       └── couchdb/│       │           └── indexes/│       │               ├── indexCustomerId.json│       │               ├── indexWalletAddress.json│       │               └── indexOrganizationId.json│       └── package.json

5. Docker Compose CouchDB Configuration
Create this file:
cd /u01/blockchain-integration/fabric-networknano docker-compose-couchdb.yaml
Add this full configuration:
version: "3.8"services:  couchdb0:    container_name: couchdb0    image: couchdb:3.3.3    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "5984:5984"    networks:      - fabric_test    volumes:      - couchdb0_data:/opt/couchdb/data  couchdb1:    container_name: couchdb1    image: couchdb:3.3.3    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "6984:5984"    networks:      - fabric_test    volumes:      - couchdb1_data:/opt/couchdb/datavolumes:  couchdb0_data:  couchdb1_data:networks:  fabric_test:    external: true
Explanation
ServicePurposecouchdb0State database for peer0.org1couchdb1State database for peer0.org25984Host port for Org1 CouchDB6984Host port for Org2 CouchDBCOUCHDB_USERCouchDB admin usernameCOUCHDB_PASSWORDCouchDB admin passwordfabric_testDocker network shared with Fabric containers

6. Peer Docker Compose Configuration with CouchDB
Update your peer service in docker-compose.yaml.
Example: Org1 Peer
peer0.org1.blockchain.local:  container_name: peer0.org1.blockchain.local  image: hyperledger/fabric-peer:2.5  labels:    service: hyperledger-fabric  environment:    - FABRIC_CFG_PATH=/etc/hyperledger/peercfg    - FABRIC_LOGGING_SPEC=INFO    - CORE_PEER_TLS_ENABLED=true    - CORE_PEER_PROFILE_ENABLED=false    - CORE_PEER_ID=peer0.org1.blockchain.local    - CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051    - CORE_PEER_LISTENADDRESS=0.0.0.0:7051    - CORE_PEER_CHAINCODEADDRESS=peer0.org1.blockchain.local:7052    - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052    - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.blockchain.local:7051    - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.blockchain.local:7051    - CORE_PEER_LOCALMSPID=Org1MSP    # CouchDB state database configuration    - CORE_LEDGER_STATE_STATEDATABASE=CouchDB    - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984    - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin    - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw    # Recommended for development    - CORE_LEDGER_STATE_COUCHDBCONFIG_REQUESTTIMEOUT=35s    - CORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIES=3    - CORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIESONSTARTUP=10  volumes:    - ./organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local:/etc/hyperledger/fabric    - ./organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msp:/etc/hyperledger/fabric/msp    - ./organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls:/etc/hyperledger/fabric/tls    - peer0_org1_data:/var/hyperledger/production  ports:    - "7051:7051"  depends_on:    - couchdb0  networks:    - fabric_test

Example: Org2 Peer
peer0.org2.blockchain.local:  container_name: peer0.org2.blockchain.local  image: hyperledger/fabric-peer:2.5  labels:    service: hyperledger-fabric  environment:    - FABRIC_CFG_PATH=/etc/hyperledger/peercfg    - FABRIC_LOGGING_SPEC=INFO    - CORE_PEER_TLS_ENABLED=true    - CORE_PEER_PROFILE_ENABLED=false    - CORE_PEER_ID=peer0.org2.blockchain.local    - CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051    - CORE_PEER_LISTENADDRESS=0.0.0.0:9051    - CORE_PEER_CHAINCODEADDRESS=peer0.org2.blockchain.local:9052    - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052    - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.blockchain.local:9051    - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.blockchain.local:9051    - CORE_PEER_LOCALMSPID=Org2MSP    # CouchDB state database configuration    - CORE_LEDGER_STATE_STATEDATABASE=CouchDB    - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb1:5984    - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin    - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw    - CORE_LEDGER_STATE_COUCHDBCONFIG_REQUESTTIMEOUT=35s    - CORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIES=3    - CORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIESONSTARTUP=10  volumes:    - ./organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local:/etc/hyperledger/fabric    - ./organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/msp:/etc/hyperledger/fabric/msp    - ./organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls:/etc/hyperledger/fabric/tls    - peer0_org2_data:/var/hyperledger/production  ports:    - "9051:9051"  depends_on:    - couchdb1  networks:    - fabric_test

7. Full Combined Docker Compose Example
If you want everything in one file, use this pattern:
version: "3.8"volumes:  peer0_org1_data:  peer0_org2_data:  couchdb0_data:  couchdb1_data:networks:  fabric_test:    name: fabric_testservices:  couchdb0:    container_name: couchdb0    image: couchdb:3.3.3    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "5984:5984"    networks:      - fabric_test    volumes:      - couchdb0_data:/opt/couchdb/data  couchdb1:    container_name: couchdb1    image: couchdb:3.3.3    environment:      - COUCHDB_USER=admin      - COUCHDB_PASSWORD=adminpw    ports:      - "6984:5984"    networks:      - fabric_test    volumes:      - couchdb1_data:/opt/couchdb/data  peer0.org1.blockchain.local:    container_name: peer0.org1.blockchain.local    image: hyperledger/fabric-peer:2.5    environment:      - FABRIC_LOGGING_SPEC=INFO      - CORE_PEER_ID=peer0.org1.blockchain.local      - CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051      - CORE_PEER_LOCALMSPID=Org1MSP      - CORE_PEER_TLS_ENABLED=true      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw    ports:      - "7051:7051"    depends_on:      - couchdb0    networks:      - fabric_test    volumes:      - peer0_org1_data:/var/hyperledger/production  peer0.org2.blockchain.local:    container_name: peer0.org2.blockchain.local    image: hyperledger/fabric-peer:2.5    environment:      - FABRIC_LOGGING_SPEC=INFO      - CORE_PEER_ID=peer0.org2.blockchain.local      - CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051      - CORE_PEER_LOCALMSPID=Org2MSP      - CORE_PEER_TLS_ENABLED=true      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb1:5984      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw    ports:      - "9051:9051"    depends_on:      - couchdb1    networks:      - fabric_test    volumes:      - peer0_org2_data:/var/hyperledger/production

8. Start CouchDB Containers
From your Fabric network folder:
cd /u01/blockchain-integration/fabric-network
Start only CouchDB:
docker compose -f docker-compose-couchdb.yaml up -d
Check containers:
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
Expected:
couchdb0    Up    0.0.0.0:5984->5984/tcpcouchdb1    Up    0.0.0.0:6984->5984/tcp

9. Verify CouchDB from Browser
Open:
http://SERVER_IP:5984/_utils
For Org1 CouchDB:
Username: adminPassword: adminpw
For Org2 CouchDB:
http://SERVER_IP:6984/_utils

10. Verify CouchDB from Terminal
Check Org1 CouchDB
curl -u admin:adminpw http://localhost:5984
Expected output:
{  "couchdb": "Welcome",  "version": "3.x.x"}
Check Org2 CouchDB
curl -u admin:adminpw http://localhost:6984
Expected output:
{  "couchdb": "Welcome",  "version": "3.x.x"}

11. Verify Peer-to-CouchDB Connectivity
Enter the peer container:
docker exec -it peer0.org1.blockchain.local bash
Inside the peer container, test connection to CouchDB:
curl -u admin:adminpw http://couchdb0:5984
Expected result:
{  "couchdb": "Welcome"}
Exit:
exit
Test Org2:
docker exec -it peer0.org2.blockchain.local bashcurl -u admin:adminpw http://couchdb1:5984exit

12. Important Peer Environment Variables
VariablePurposeCORE_LEDGER_STATE_STATEDATABASE=CouchDBEnables CouchDB instead of LevelDBCORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984Tells peer where CouchDB isCORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=adminCouchDB usernameCORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpwCouchDB passwordCORE_LEDGER_STATE_COUCHDBCONFIG_REQUESTTIMEOUT=35sTimeout for CouchDB requestsCORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIES=3Retry count for failed CouchDB requestsCORE_LEDGER_STATE_COUCHDBCONFIG_MAXRETRIESONSTARTUP=10Startup retries before peer fails

13. Important Rule
You must configure CouchDB before creating/joining channels and deploying chaincode.
Do not switch an existing peer from LevelDB to CouchDB after it already has ledger data unless you clean the peer ledger volume and rebuild the network.
For development, clean with:
docker compose down -vdocker volume prune -f
Then restart the network.

14. CouchDB Databases Created by Fabric
After the peer joins a channel and chaincode writes data, CouchDB will create databases automatically.
Example database names:
mychannel_mychannel_kycmychannel_lscc
For your project channel:
kycchannelnix1_kycchannelnix1_kyc
Check databases:
curl -u admin:adminpw http://localhost:5984/_all_dbs
Expected example:
[  "_replicator",  "_users",  "kycchannelnix1_",  "kycchannelnix1_kyc"]

15. Rich Query Example in Chaincode
CouchDB supports rich queries when the ledger values are stored as JSON documents. Fabric documentation explains that CouchDB enables rich queries against JSON values and supports indexes for query performance. 
Example Customer JSON Stored on Ledger
{  "docType": "customer",  "customerId": "CUST-1001",  "fullName": "Nicolas Salloum",  "walletAddress": "wallet_abc123",  "organizationId": "BANK001",  "kycStatus": "APPROVED",  "createdAt": "2026-04-28T10:00:00Z"}

Example Rich Query
{  "selector": {    "docType": "customer",    "kycStatus": "APPROVED",    "organizationId": "BANK001"  }}

Node.js Chaincode Example
async getApprovedCustomersByOrganization(ctx, organizationId) {  const query = {    selector: {      docType: "customer",      organizationId: organizationId,      kycStatus: "APPROVED"    }  };  const iterator = await ctx.stub.getQueryResult(JSON.stringify(query));  const results = [];  while (true) {    const res = await iterator.next();    if (res.value && res.value.value.toString()) {      const record = JSON.parse(res.value.value.toString("utf8"));      results.push(record);    }    if (res.done) {      await iterator.close();      break;    }  }  return JSON.stringify(results);}

Go Chaincode Example
func (s *SmartContract) GetApprovedCustomersByOrganization(	ctx contractapi.TransactionContextInterface,	organizationId string,) (string, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "customer",			"organizationId": "%s",			"kycStatus": "APPROVED"		}	}`, organizationId)	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)	if err != nil {		return "", err	}	defer resultsIterator.Close()	var results []map[string]interface{}	for resultsIterator.HasNext() {		queryResponse, err := resultsIterator.Next()		if err != nil {			return "", err		}		var record map[string]interface{}		err = json.Unmarshal(queryResponse.Value, &record)		if err != nil {			return "", err		}		results = append(results, record)	}	response, err := json.Marshal(results)	if err != nil {		return "", err	}	return string(response), nil}

16. CouchDB Indexes for Fabric Chaincode
Indexes improve rich query performance.
Inside your chaincode folder, create:
mkdir -p META-INF/statedb/couchdb/indexes
Example:
nano META-INF/statedb/couchdb/indexes/indexCustomerId.json
Add:
{  "index": {    "fields": [      "docType",      "customerId"    ]  },  "ddoc": "indexCustomerIdDoc",  "name": "indexCustomerId",  "type": "json"}
Create wallet index:
nano META-INF/statedb/couchdb/indexes/indexWalletAddress.json
Add:
{  "index": {    "fields": [      "docType",      "walletAddress"    ]  },  "ddoc": "indexWalletAddressDoc",  "name": "indexWalletAddress",  "type": "json"}
Create organization index:
nano META-INF/statedb/couchdb/indexes/indexOrganizationId.json
Add:
{  "index": {    "fields": [      "docType",      "organizationId",      "kycStatus"    ]  },  "ddoc": "indexOrganizationIdDoc",  "name": "indexOrganizationId",  "type": "json"}
Fabric supports packaging CouchDB index definitions inside the chaincode metadata folder so indexes can be deployed with chaincode. 

17. Package Chaincode with CouchDB Indexes
From your chaincode folder:
cd /u01/blockchain-integration/chaincode/kyc-chaincode
Verify index files:
find META-INF -type f
Expected:
META-INF/statedb/couchdb/indexes/indexCustomerId.jsonMETA-INF/statedb/couchdb/indexes/indexWalletAddress.jsonMETA-INF/statedb/couchdb/indexes/indexOrganizationId.json
When you package the chaincode, Fabric will include these index files.
Example:
peer lifecycle chaincode package kyc.tar.gz \  --path /u01/blockchain-integration/chaincode/kyc-chaincode \  --lang node \  --label kyc_1.0

18. Start Network with CouchDB
If your files are separate:
docker compose \  -f docker-compose.yaml \  -f docker-compose-couchdb.yaml \  up -d
Check logs:
docker logs peer0.org1.blockchain.local --tail=100docker logs couchdb0 --tail=100
Look for messages showing the peer is using CouchDB.

19. Verification Script
Create:
nano scripts/verify-couchdb.sh
Add:
#!/bin/bashset -eecho "=========================================="echo "Verifying CouchDB Setup for Fabric"echo "=========================================="echo ""echo "1. Checking CouchDB containers..."docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep couchdb || trueecho ""echo "2. Testing Org1 CouchDB on localhost:5984..."curl -s -u admin:adminpw http://localhost:5984 | jq .echo ""echo "3. Testing Org2 CouchDB on localhost:6984..."curl -s -u admin:adminpw http://localhost:6984 | jq .echo ""echo "4. Listing Org1 CouchDB databases..."curl -s -u admin:adminpw http://localhost:5984/_all_dbs | jq .echo ""echo "5. Listing Org2 CouchDB databases..."curl -s -u admin:adminpw http://localhost:6984/_all_dbs | jq .echo ""echo "6. Testing peer0.org1 to couchdb0 connectivity..."docker exec peer0.org1.blockchain.local curl -s -u admin:adminpw http://couchdb0:5984 | jq .echo ""echo "7. Testing peer0.org2 to couchdb1 connectivity..."docker exec peer0.org2.blockchain.local curl -s -u admin:adminpw http://couchdb1:5984 | jq .echo ""echo "=========================================="echo "CouchDB verification completed."echo "=========================================="
Make it executable:
chmod +x scripts/verify-couchdb.sh
Run it:
./scripts/verify-couchdb.sh

20. Install jq if Needed
If jq is missing:
sudo apt updatesudo apt install jq -y

21. Common CouchDB/Fabric Errors and Fixes
Error 1: Peer cannot connect to CouchDB
Example
Error calling CouchDBconnection refused
Cause
CouchDB container is not running or peer has wrong CouchDB address.
Fix
Check containers:
docker ps | grep couchdb
Check Docker network:
docker network inspect fabric_test
Check peer variable:
docker exec peer0.org1.blockchain.local printenv | grep COUCHDB
Correct value should be:
CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984
Restart:
docker compose downdocker compose up -d

Error 2: CouchDB authentication failed
Example
unauthorizedName or password is incorrect
Cause
Peer username/password does not match CouchDB container environment.
Fix
CouchDB service:
environment:  - COUCHDB_USER=admin  - COUCHDB_PASSWORD=adminpw
Peer service:
- CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin- CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
Then restart:
docker compose downdocker compose up -d

Error 3: CouchDB container exits immediately
Check logs
docker logs couchdb0
Common causes
Permission issue on volumeBad environment variablePort already used
Fix
Remove old volume:
docker compose down -vdocker volume prune -fdocker compose up -d
Check port:
sudo lsof -i :5984

Error 4: Port already allocated
Example
Bind for 0.0.0.0:5984 failed: port is already allocated
Fix
Find process:
sudo lsof -i :5984
Or change host port:
ports:  - "15984:5984"
Then access:
http://localhost:15984/_utils
Important: the peer should still use the internal Docker address:
- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0:5984
Not:
- CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=localhost:15984

Error 5: Rich query returns empty result
Cause
The data is not stored as valid JSON, or the field names do not match.
Fix
Verify ledger value format:
{  "docType": "customer",  "customerId": "CUST-1001"}
Wrong example:
customer:CUST-1001:APPROVED
CouchDB rich queries work best when chaincode values are JSON documents.

Error 6: Query works but is slow
Cause
Missing CouchDB index.
Fix
Add index files under:
META-INF/statedb/couchdb/indexes/
Then repackage and redeploy chaincode.

Error 7: Changed from LevelDB to CouchDB but peer fails
Cause
Existing peer ledger data was created using LevelDB.
Fix for development
docker compose down -vdocker volume prune -fdocker compose up -d
Then recreate channel and redeploy chaincode.

22. Recommended CouchDB Credentials for Development
For local development:
Username: adminPassword: adminpw
For production, do not use this. Use strong secrets:
Username: fabric_couch_adminPassword: StrongPasswordHere
Recommended production password example:
openssl rand -base64 32

23. Production Recommendations
For production or enterprise setup:
AreaRecommendationAuthenticationUse strong CouchDB admin credentialsNetworkDo not expose CouchDB publiclyPortsAvoid public 5984 accessTLSUse TLS between peer and CouchDB if requiredBackupsBackup CouchDB data volumesMonitoringMonitor disk, memory, and response timeIndexesAlways create indexes for rich queriesData modelStore JSON documents with docTypeSecurityNever store private secrets directly in world statePerformanceAvoid unindexed selectorsOperationsKeep one CouchDB instance per peer

24. Recommended KYC CouchDB Document Types
For this project, use clear docType fields.
Customer
{  "docType": "customer",  "customerId": "CUST-1001",  "fullName": "Customer Name",  "walletAddress": "wallet_abc123",  "organizationId": "BANK001",  "kycStatus": "APPROVED",  "createdAt": "2026-04-28T10:00:00Z"}
Wallet
{  "docType": "wallet",  "walletAddress": "wallet_abc123",  "customerId": "CUST-1001",  "organizationId": "BANK001",  "status": "ACTIVE",  "createdAt": "2026-04-28T10:00:00Z"}
Transaction
{  "docType": "transaction",  "transactionId": "TXN-1001",  "fromWallet": "wallet_abc123",  "toWallet": "wallet_xyz789",  "amount": 100,  "currency": "USD",  "status": "COMPLETED",  "createdAt": "2026-04-28T10:05:00Z"}
Organization
{  "docType": "organization",  "organizationId": "BANK001",  "organizationName": "Bank One",  "organizationType": "BANK",  "status": "ACTIVE",  "createdAt": "2026-04-28T10:00:00Z"}

25. Best Practice Query Pattern
Always include docType in CouchDB selectors.
Good:
{  "selector": {    "docType": "customer",    "organizationId": "BANK001"  }}
Avoid:
{  "selector": {    "organizationId": "BANK001"  }}
Why?
Because docType makes indexes cleaner and avoids scanning unrelated documents.

26. Quick Commands Summary
cd /u01/blockchain-integration/fabric-network
Start CouchDB:
docker compose -f docker-compose-couchdb.yaml up -d
Start full network:
docker compose \  -f docker-compose.yaml \  -f docker-compose-couchdb.yaml \  up -d
Check CouchDB:
curl -u admin:adminpw http://localhost:5984curl -u admin:adminpw http://localhost:6984
List databases:
curl -u admin:adminpw http://localhost:5984/_all_dbs
Check peer variables:
docker exec peer0.org1.blockchain.local printenv | grep COUCHDB
Check logs:
docker logs couchdb0 --tail=100docker logs peer0.org1.blockchain.local --tail=100
Clean development network:
docker compose down -vdocker volume prune -f

27. Final Step 7 Checklist
ItemStatusCouchDB purpose understood✅LevelDB vs CouchDB difference clear✅CouchDB Docker services created✅Peer environment variables configured✅CouchDB username/password configured✅Peer-to-CouchDB connectivity tested✅CouchDB browser access tested✅Rich query support explained✅CouchDB indexes added to chaincode✅Common errors documented✅

28. Step 7 Completion Result
After completing this step, your Hyperledger Fabric peers will use CouchDB as their world state database.
Your project will now support:
JSON-based blockchain state storageRich customer KYC queriesWallet lookup by addressOrganization-based customer filteringTransaction search by metadataCouchDB indexing for performanceBetter API support for Spring Boot integration
This prepares the project for the next phase:
STEP 8 — Chaincode Design and Smart Contract Business Logic
