🔹 STEP 10 — CouchDB Query Model Design
Blockchain Integration Project — Hyperledger Fabric CouchDB Rich Queries

1. Step Objective
The objective of this step is to design and validate the CouchDB rich query model for the Hyperledger Fabric world state.
CouchDB is used as the state database for Fabric peers. It enables JSON-based rich queries against ledger world-state documents, such as:
Wallet lookupWallet lookup by customer IDOrganization lookupTransaction historyTransaction search by statusTransaction search by risk levelTransaction search by date rangeTransaction search by wallet address
In this project, CouchDB indexes are packaged inside the chaincode under:
META-INF/statedb/couchdb/indexes
This allows Hyperledger Fabric to deploy the indexes automatically when the chaincode package is installed and committed.

2. Current Project Status Before Step 10
The network foundation is now ready.
ComponentStatusDocker containers running✅ DoneOrg1 MSP fixed✅ DoneOrg2 MSP fixed✅ DoneCorrect channel block regenerated✅ DoneOrg1 joined kycchannelnix1✅ DoneOrg2 joined kycchannelnix1✅ DoneLifecycle command working✅ DoneChaincode committed❌ Not yetCouchDB index files created✅ DoneContinue to Step 11✅ Yes
Validation command already confirmed:
peer lifecycle chaincode querycommitted -C kycchannelnix1
Current result:
Committed chaincode definitions on channel 'kycchannelnix1':
This means the channel is healthy, but no chaincode has been committed yet.

3. Recommended World State Document Model
The Fabric ledger world state should store documents using a clear docType field. This is important because CouchDB rich queries search across JSON fields.
Every document should include:
"docType": "wallet"
or:
"docType": "organization"
or:
"docType": "transaction"

4. Wallet Document Model
4.1 Ledger Key Format
WALLET_{walletAddress}
Example:
WALLET_WALLET_1000001
Recommended cleaner format:
WALLET_1000001

4.2 Wallet JSON Structure
{  "docType": "wallet",  "walletAddress": "WALLET_1000001",  "customerId": "CUST_1000001",  "organizationId": "ORG_BANK_001",  "walletStatus": "ACTIVE",  "walletType": "CUSTOMER",  "createdAt": "2026-04-29T10:00:00Z",  "updatedAt": "2026-04-29T10:00:00Z"}

4.3 Wallet Query Use Cases
QueryRecommended MethodWallet by wallet addressDirect GetState()Wallet by customer IDCouchDB rich queryWallet by organizationCouchDB rich query if neededActive walletsCouchDB rich query if needed

5. Organization Document Model
5.1 Ledger Key Format
ORG_{organizationId}
Example:
ORG_ORG_BANK_001
Recommended cleaner format:
ORG_BANK_001

5.2 Organization JSON Structure
{  "docType": "organization",  "organizationId": "ORG_BANK_001",  "organizationName": "Bank A",  "organizationType": "BANK",  "status": "ACTIVE",  "country": "LB",  "createdAt": "2026-04-29T10:00:00Z",  "updatedAt": "2026-04-29T10:00:00Z"}

5.3 Organization Query Use Cases
QueryRecommended MethodOrganization by IDDirect GetState()Organization by statusCouchDB rich queryOrganization by typeCouchDB rich queryOrganization by countryCouchDB rich query if needed

6. Transaction Document Model
6.1 Ledger Key Format
TX_{transactionId}
Example:
TX_20260429_000001

6.2 Transaction JSON Structure
{  "docType": "transaction",  "transactionId": "TX_20260429_000001",  "fromWalletAddress": "WALLET_1000001",  "toWalletAddress": "WALLET_1000002",  "fromCustomerId": "CUST_1000001",  "toCustomerId": "CUST_1000002",  "organizationId": "ORG_BANK_001",  "amount": 250.00,  "currency": "USD",  "transactionType": "WALLET_TO_WALLET",  "status": "COMPLETED",  "riskLevel": "LOW",  "riskScore": 15,  "createdAt": "2026-04-29T10:15:00Z",  "updatedAt": "2026-04-29T10:15:00Z"}

6.3 Transaction Query Use Cases
QueryRecommended MethodTransaction by IDDirect GetState()Transactions by statusCouchDB rich queryTransactions by risk levelCouchDB rich queryTransactions by date rangeCouchDB rich queryOutgoing transactions by walletCouchDB rich queryIncoming transactions by walletCouchDB rich queryTransactions by organizationCouchDB rich query

7. Current Step 10 Folder Structure
Your current folder structure already exists:
/home/nix/u01/blockchain-integration/└── chaincode/    └── kyc-wallet-chaincode/        ├── chaincode.go        ├── go.mod        ├── go.sum        └── META-INF/            └── statedb/                └── couchdb/                    └── indexes/                        ├── indexOrganizationById.json                        ├── indexTransactionByDate.json                        ├── indexTransactionByFromWalletDate.json                        ├── indexTransactionByOrganizationDate.json                        ├── indexTransactionByRiskLevel.json                        ├── indexTransactionByStatus.json                        ├── indexTransactionByToWalletDate.json                        ├── indexWalletByAddress.json                        └── indexWalletByCustomerId.json
This means the CouchDB index folder is already prepared.

8. Required CouchDB Index Files
8.1 indexWalletByCustomerId.json
{  "index": {    "fields": [      "docType",      "customerId"    ]  },  "ddoc": "indexWalletByCustomerIdDoc",  "name": "indexWalletByCustomerId",  "type": "json"}

8.2 indexWalletByAddress.json
{  "index": {    "fields": [      "docType",      "walletAddress"    ]  },  "ddoc": "indexWalletByAddressDoc",  "name": "indexWalletByAddress",  "type": "json"}

8.3 indexOrganizationById.json
{  "index": {    "fields": [      "docType",      "organizationId"    ]  },  "ddoc": "indexOrganizationByIdDoc",  "name": "indexOrganizationById",  "type": "json"}

8.4 indexTransactionByStatus.json
{  "index": {    "fields": [      "docType",      "status"    ]  },  "ddoc": "indexTransactionByStatusDoc",  "name": "indexTransactionByStatus",  "type": "json"}

8.5 indexTransactionByRiskLevel.json
{  "index": {    "fields": [      "docType",      "riskLevel"    ]  },  "ddoc": "indexTransactionByRiskLevelDoc",  "name": "indexTransactionByRiskLevel",  "type": "json"}

8.6 indexTransactionByDate.json
{  "index": {    "fields": [      "docType",      "createdAt"    ]  },  "ddoc": "indexTransactionByDateDoc",  "name": "indexTransactionByDate",  "type": "json"}

8.7 indexTransactionByFromWalletDate.json
{  "index": {    "fields": [      "docType",      "fromWalletAddress",      "createdAt"    ]  },  "ddoc": "indexTransactionByFromWalletDateDoc",  "name": "indexTransactionByFromWalletDate",  "type": "json"}

8.8 indexTransactionByToWalletDate.json
{  "index": {    "fields": [      "docType",      "toWalletAddress",      "createdAt"    ]  },  "ddoc": "indexTransactionByToWalletDateDoc",  "name": "indexTransactionByToWalletDate",  "type": "json"}

8.9 indexTransactionByOrganizationDate.json
{  "index": {    "fields": [      "docType",      "organizationId",      "createdAt"    ]  },  "ddoc": "indexTransactionByOrganizationDateDoc",  "name": "indexTransactionByOrganizationDate",  "type": "json"}

9. Rich Query Use Cases and Mango Queries
9.1 Wallet Lookup by Wallet Address
For direct wallet lookup, use GetState().
ctx.GetStub().GetState("WALLET_" + walletAddress)
Mango query alternative:
{  "selector": {    "docType": "wallet",    "walletAddress": "WALLET_1000001"  },  "use_index": ["indexWalletByAddressDoc", "indexWalletByAddress"]}

9.2 Wallet Lookup by Customer ID
{  "selector": {    "docType": "wallet",    "customerId": "CUST_1000001"  },  "use_index": ["indexWalletByCustomerIdDoc", "indexWalletByCustomerId"]}

9.3 Organization Lookup by Organization ID
Recommended direct lookup:
ctx.GetStub().GetState("ORG_" + organizationId)
Mango query alternative:
{  "selector": {    "docType": "organization",    "organizationId": "ORG_BANK_001"  },  "use_index": ["indexOrganizationByIdDoc", "indexOrganizationById"]}

9.4 Transaction by Status
{  "selector": {    "docType": "transaction",    "status": "COMPLETED"  },  "use_index": ["indexTransactionByStatusDoc", "indexTransactionByStatus"]}

9.5 Transaction by Risk Level
{  "selector": {    "docType": "transaction",    "riskLevel": "HIGH"  },  "use_index": ["indexTransactionByRiskLevelDoc", "indexTransactionByRiskLevel"]}

9.6 Transaction by Date Range
{  "selector": {    "docType": "transaction",    "createdAt": {      "$gte": "2026-04-01T00:00:00Z",      "$lte": "2026-04-29T23:59:59Z"    }  },  "use_index": ["indexTransactionByDateDoc", "indexTransactionByDate"]}

9.7 Outgoing Transactions by Wallet and Date Range
{  "selector": {    "docType": "transaction",    "fromWalletAddress": "WALLET_1000001",    "createdAt": {      "$gte": "2026-04-01T00:00:00Z",      "$lte": "2026-04-29T23:59:59Z"    }  },  "use_index": ["indexTransactionByFromWalletDateDoc", "indexTransactionByFromWalletDate"]}

9.8 Incoming Transactions by Wallet and Date Range
{  "selector": {    "docType": "transaction",    "toWalletAddress": "WALLET_1000001",    "createdAt": {      "$gte": "2026-04-01T00:00:00Z",      "$lte": "2026-04-29T23:59:59Z"    }  },  "use_index": ["indexTransactionByToWalletDateDoc", "indexTransactionByToWalletDate"]}

9.9 Transactions by Organization and Date Range
{  "selector": {    "docType": "transaction",    "organizationId": "ORG_BANK_001",    "createdAt": {      "$gte": "2026-04-01T00:00:00Z",      "$lte": "2026-04-29T23:59:59Z"    }  },  "use_index": ["indexTransactionByOrganizationDateDoc", "indexTransactionByOrganizationDate"]}

10. Chaincode Query Usage Examples — Go
10.1 Generic Rich Query Helper
func getQueryResultForQueryString(ctx contractapi.TransactionContextInterface, queryString string) ([]map[string]interface{}, error) {	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)	if err != nil {		return nil, err	}	defer resultsIterator.Close()	var results []map[string]interface{}	for resultsIterator.HasNext() {		queryResponse, err := resultsIterator.Next()		if err != nil {			return nil, err		}		var record map[string]interface{}		err = json.Unmarshal(queryResponse.Value, &record)		if err != nil {			return nil, err		}		record["_key"] = queryResponse.Key		results = append(results, record)	}	return results, nil}

10.2 Get Wallet by Customer ID
func (s *SmartContract) GetWalletByCustomerID(ctx contractapi.TransactionContextInterface, customerId string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "wallet",			"customerId": "%s"		},		"use_index": ["indexWalletByCustomerIdDoc", "indexWalletByCustomerId"]	}`, customerId)	return getQueryResultForQueryString(ctx, queryString)}

10.3 Get Organization by ID
func (s *SmartContract) GetOrganizationByID(ctx contractapi.TransactionContextInterface, organizationId string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "organization",			"organizationId": "%s"		},		"use_index": ["indexOrganizationByIdDoc", "indexOrganizationById"]	}`, organizationId)	return getQueryResultForQueryString(ctx, queryString)}

10.4 Get Transactions by Status
func (s *SmartContract) GetTransactionsByStatus(ctx contractapi.TransactionContextInterface, status string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "transaction",			"status": "%s"		},		"use_index": ["indexTransactionByStatusDoc", "indexTransactionByStatus"]	}`, status)	return getQueryResultForQueryString(ctx, queryString)}

10.5 Get Transactions by Risk Level
func (s *SmartContract) GetTransactionsByRiskLevel(ctx contractapi.TransactionContextInterface, riskLevel string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "transaction",			"riskLevel": "%s"		},		"use_index": ["indexTransactionByRiskLevelDoc", "indexTransactionByRiskLevel"]	}`, riskLevel)	return getQueryResultForQueryString(ctx, queryString)}

10.6 Get Transactions by Date Range
func (s *SmartContract) GetTransactionsByDateRange(ctx contractapi.TransactionContextInterface, fromDate string, toDate string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "transaction",			"createdAt": {				"$gte": "%s",				"$lte": "%s"			}		},		"use_index": ["indexTransactionByDateDoc", "indexTransactionByDate"]	}`, fromDate, toDate)	return getQueryResultForQueryString(ctx, queryString)}

10.7 Get Outgoing Transactions by Wallet
func (s *SmartContract) GetOutgoingTransactionsByWallet(ctx contractapi.TransactionContextInterface, walletAddress string, fromDate string, toDate string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "transaction",			"fromWalletAddress": "%s",			"createdAt": {				"$gte": "%s",				"$lte": "%s"			}		},		"use_index": ["indexTransactionByFromWalletDateDoc", "indexTransactionByFromWalletDate"]	}`, walletAddress, fromDate, toDate)	return getQueryResultForQueryString(ctx, queryString)}

10.8 Get Incoming Transactions by Wallet
func (s *SmartContract) GetIncomingTransactionsByWallet(ctx contractapi.TransactionContextInterface, walletAddress string, fromDate string, toDate string) ([]map[string]interface{}, error) {	queryString := fmt.Sprintf(`{		"selector": {			"docType": "transaction",			"toWalletAddress": "%s",			"createdAt": {				"$gte": "%s",				"$lte": "%s"			}		},		"use_index": ["indexTransactionByToWalletDateDoc", "indexTransactionByToWalletDate"]	}`, walletAddress, fromDate, toDate)	return getQueryResultForQueryString(ctx, queryString)}

11. CLI Query Examples
Important: These commands must be run after Step 12, when the chaincode is packaged, installed, approved, and committed.
11.1 Query Wallet by Customer ID
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetWalletByCustomerID","CUST_1000001"]}'

11.2 Query Transactions by Status
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetTransactionsByStatus","COMPLETED"]}'

11.3 Query Transactions by Risk Level
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetTransactionsByRiskLevel","HIGH"]}'

11.4 Query Transactions by Date Range
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetTransactionsByDateRange","2026-04-01T00:00:00Z","2026-04-29T23:59:59Z"]}'

11.5 Query Outgoing Wallet Transactions
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetOutgoingTransactionsByWallet","WALLET_1000001","2026-04-01T00:00:00Z","2026-04-29T23:59:59Z"]}'

11.6 Query Incoming Wallet Transactions
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetIncomingTransactionsByWallet","WALLET_1000001","2026-04-01T00:00:00Z","2026-04-29T23:59:59Z"]}'

12. Verification Commands
12.1 Verify Index Folder
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincodels -lah META-INF/statedb/couchdb/indexes
Expected files:
indexOrganizationById.jsonindexTransactionByDate.jsonindexTransactionByFromWalletDate.jsonindexTransactionByOrganizationDate.jsonindexTransactionByRiskLevel.jsonindexTransactionByStatus.jsonindexTransactionByToWalletDate.jsonindexWalletByAddress.jsonindexWalletByCustomerId.json

12.2 Validate JSON Files
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincodefor f in META-INF/statedb/couchdb/indexes/*.json; do  echo "Validating $f"  jq . "$f" > /dev/nulldone
If jq is missing:
sudo apt install jq -y
Expected result: no error.

12.3 Verify Chaincode Files
cd /home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincodels -lah
Expected:
chaincode.gogo.modgo.sumMETA-INF/

12.4 Verify Chaincode Functions
grep -n "func (.*SmartContract" chaincode.go
Expected functions:
CreateWalletGetWalletGetWalletByCustomerIDCreateOrganizationGetOrganizationByIDCreateTransactionGetTransactionsByStatusGetTransactionsByRiskLevelGetTransactionsByDateRangeGetOutgoingTransactionsByWalletGetIncomingTransactionsByWallet

13. Query Optimization Rules
13.1 Always Use docType
Every document must have a docType.
Example:
{  "docType": "wallet"}
This avoids unnecessary scans across unrelated document types.

13.2 Use Direct Key Lookup When Possible
Use:
ctx.GetStub().GetState(key)
for direct lookup by ledger key.
Use rich queries only when searching by JSON fields.

13.3 Avoid Heavy $or Queries
This is valid:
{  "selector": {    "docType": "transaction",    "$or": [      {        "fromWalletAddress": "WALLET_1000001"      },      {        "toWalletAddress": "WALLET_1000001"      }    ]  }}
But for production, use two separate queries:
Outgoing transactionsIncoming transactions
Then merge results in the Blockchain API layer.

13.4 Use ISO 8601 Date Format
Always store dates like this:
2026-04-29T10:15:00Z
This allows correct lexical date filtering in CouchDB.

13.5 Use Pagination for Large Results
Do not return thousands of transactions in one call.
Recommended API design:
GET /api/blockchain/wallets/{walletAddress}/transactions?pageSize=50&bookmark=...
Pagination should be implemented in Step 11 or Step 14 depending on whether you want pagination at the chaincode layer or API layer.

13.6 Keep Analytics Outside CouchDB
CouchDB is for Fabric world state, not reporting.
Use CouchDB for:
Current wallet stateCurrent organization stateCurrent transaction stateRich query access
Use PostgreSQL for:
DashboardsReportingAggregationsBI queriesAnalyticsHistorical archive

14. Recommended Blockchain API Mapping
API Use CaseChaincode FunctionCouchDB IndexWallet by wallet addressGetWalletNot requiredWallet by customer IDGetWalletByCustomerIDindexWalletByCustomerIdOrganization by IDGetOrganizationByIDindexOrganizationByIdTransaction by statusGetTransactionsByStatusindexTransactionByStatusTransaction by risk levelGetTransactionsByRiskLevelindexTransactionByRiskLevelTransaction by date rangeGetTransactionsByDateRangeindexTransactionByDateOutgoing wallet transactionsGetOutgoingTransactionsByWalletindexTransactionByFromWalletDateIncoming wallet transactionsGetIncomingTransactionsByWalletindexTransactionByToWalletDateOrganization transactionsGetTransactionsByOrganizationindexTransactionByOrganizationDate

15. Step 10 Completion Checklist
ItemStatusWallet JSON model designed✅ DoneOrganization JSON model designed✅ DoneTransaction JSON model designed✅ DoneWallet lookup model defined✅ DoneWallet by customer ID query defined✅ DoneOrganization lookup query defined✅ DoneTransaction history query defined✅ DoneTransaction by status query defined✅ DoneTransaction by risk level query defined✅ DoneTransaction by date range query defined✅ DoneTransaction by wallet address query defined✅ DoneCouchDB indexes created✅ DoneIndex folder exists✅ DoneChaincode folder exists✅ DoneChaincode query examples defined✅ DoneCLI query examples defined✅ DoneOptimization rules documented✅ DoneReady for Step 11✅ Yes

16. Final Step 10 Result
Step 10 is now complete.
The project now has:
A professional CouchDB query modelA clean world-state document modelWallet, organization, and transaction query designProduction-ready Mango query patternsCouchDB index files under META-INF/statedb/couchdb/indexesChaincode query examplesCLI query examplesVerification commandsOptimization rules

17. Next Step
Continue to:
STEP 11 — Chaincode Implementation
Step 11 should now focus on reviewing and finalizing:
chaincode.gogo.modgo.sumwallet functionsorganization functionstransaction functionsrich query functionsevent emissionvalidation ruleserror handling
After Step 11 is completed, move to:
STEP 12 — Package / Install / Approve / Commit Chaincode
Only after Step 12 should you run:
peer chaincode query \  -C kycchannelnix1 \  -n kyc-wallet-chaincode \  -c '{"Args":["GetWalletByCustomerID","CUST_1000001"]}'