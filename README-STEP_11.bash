🔹 STEP 11 — Chaincode Design
Blockchain Integration Project
Hyperledger Fabric Smart Contract Design Document

1. Step Objective
The objective of Step 11 — Chaincode Design is to define the complete smart contract logic for the Blockchain Integration Project before starting implementation.
This chaincode will manage wallet creation, wallet authentication validation, wallet-to-wallet transfers, organization payments, balance queries, and transaction history retrieval.
The smart contract will run inside Hyperledger Fabric and will write trusted blockchain records into the ledger state database using CouchDB.

2. Chaincode Scope
The chaincode is responsible for:
AreaResponsibilityWallet ManagementCreate wallet records linked to customersWallet Login ValidationValidate wallet login using secure hash comparisonWallet TransfersExecute wallet-to-wallet transactionsOrganization PaymentsExecute wallet-to-organization transactionsBalance ManagementMaintain wallet balance recordsTransaction HistoryStore and retrieve transaction recordsAudit TrailMaintain immutable blockchain transaction recordsRich Query SupportEnable CouchDB-based queries by customer, wallet, status, date, risk level

3. Chaincode Boundary
Inside Chaincode
The chaincode should manage:
Wallet identity referencesWallet balanceWallet statusOrganization wallet referenceTransaction recordsTransaction statusTransaction risk levelBlockchain audit metadata
Outside Chaincode
The chaincode should not manage:
JWT generationAPI authenticationFrontend login sessionsFull customer personal dataPassword plain textOTP generationRecovery phrase generationEmail/SMS notificationPostgreSQL relational reporting logic
These are handled by:
Spring Boot / Blockchain APIPostgreSQLAngular frontendNotification servicesIdentity provider / authentication layer

4. Recommended Chaincode Language
For your current project, use:
Go Chaincode
Recommended folder:
/home/nix/u01/blockchain-integration/chaincode/kyc-wallet-chaincode
Expected structure:
kyc-wallet-chaincode/├── go.mod├── go.sum├── chaincode.go└── META-INF/    └── statedb/        └── couchdb/            └── indexes/                ├── indexWalletByCustomerId.json                ├── indexWalletByAddress.json                ├── indexOrganizationById.json                ├── indexTransactionByStatus.json                ├── indexTransactionByRiskLevel.json                ├── indexTransactionByDate.json                ├── indexTransactionByFromWalletDate.json                ├── indexTransactionByToWalletDate.json                └── indexTransactionByOrganizationDate.json

5. Main Ledger Documents
5.1 Wallet Document
Each wallet should be stored in CouchDB with a deterministic key.
Recommended key format:
WALLET_{walletAddress}
Example:
WALLET_WALLET-CUST-1001-20260429
Wallet JSON Structure
{  "docType": "wallet",  "walletAddress": "WALLET-CUST-1001-20260429",  "customerId": "CUST-1001",  "organizationId": "ORG-BANK-001",  "walletPasswordHash": "bcrypt-or-sha256-hash",  "balance": 1000.00,  "currency": "USD",  "status": "ACTIVE",  "createdAt": "2026-04-29T10:00:00Z",  "updatedAt": "2026-04-29T10:00:00Z",  "createdBy": "blockchain-api",  "lastLoginAt": null}

5.2 Organization Document
Recommended key format:
ORG_{organizationId}
Example:
ORG_ORG-BANK-001
Organization JSON Structure
{  "docType": "organization",  "organizationId": "ORG-BANK-001",  "organizationName": "Bank Organization 001",  "organizationWalletAddress": "ORG-WALLET-001",  "balance": 500000.00,  "currency": "USD",  "status": "ACTIVE",  "createdAt": "2026-04-29T10:00:00Z",  "updatedAt": "2026-04-29T10:00:00Z"}

5.3 Transaction Document
Recommended key format:
TX_{transactionId}
Example:
TX_TXN-20260429-000001
Transaction JSON Structure
{  "docType": "transaction",  "transactionId": "TXN-20260429-000001",  "transactionType": "WALLET_TO_WALLET",  "fromWalletAddress": "WALLET-CUST-1001-20260429",  "toWalletAddress": "WALLET-CUST-2001-20260429",  "organizationId": null,  "amount": 150.00,  "currency": "USD",  "status": "SUCCESS",  "riskLevel": "LOW",  "description": "Wallet transfer",  "createdAt": "2026-04-29T10:30:00Z",  "createdBy": "blockchain-api",  "fabricTxId": "FABRIC_TRANSACTION_ID"}

6. Required Chaincode Methods
The chaincode must expose the following methods:
CreateWalletLoginWalletTransferBetweenWalletsTransferToOrganizationGetWalletBalanceGetTransactionHistory

7. Method 1 — CreateWallet
Purpose
Create a new blockchain wallet for a customer and store it on the Fabric ledger.
This method is called after the enterprise application validates the customer identity and approves wallet creation.

Function Name
CreateWallet

Input Parameters
ParameterTypeRequiredDescriptionwalletAddressstringYesUnique wallet addresscustomerIdstringYesEnterprise customer IDorganizationIdstringYesOrganization or bank IDwalletPasswordHashstringYesHashed wallet passwordinitialBalancefloatYesInitial wallet balancecurrencystringYesCurrency codecreatedBystringYesAPI/system user creating the wallet

Example Chaincode Arguments
{  "Args": [    "CreateWallet",    "WALLET-CUST-1001-20260429",    "CUST-1001",    "ORG-BANK-001",    "HASHED_PASSWORD_VALUE",    "1000.00",    "USD",    "blockchain-api"  ]}

Validation Rules
RuleDescriptionWallet address must not be emptyRequired unique wallet identifierCustomer ID must not be emptyRequired enterprise customer mappingOrganization ID must not be emptyRequired institution mappingPassword hash must not be emptyNever store plain-text passwordInitial balance must be greater than or equal to zeroNegative opening balance is not allowedCurrency must not be emptyExample: USD, LBP, EURWallet must not already existPrevent duplicate wallet creationCustomer must not already have active duplicate wallet unless business allows itPrevent duplicated customer wallet

Ledger Read Logic
The chaincode should read:
WALLET_{walletAddress}
If the wallet already exists, return an error.
Optionally query CouchDB by customerId to check whether the customer already has an active wallet.
Example rich query:
{  "selector": {    "docType": "wallet",    "customerId": "CUST-1001",    "status": "ACTIVE"  }}

Ledger Write Logic
The chaincode writes a new wallet document using:
PutState("WALLET_" + walletAddress, walletJSON)
The wallet status should be:
ACTIVE
Default timestamps:
createdAtupdatedAt

Error Handling
Error CaseReturned ErrorMissing wallet addresswalletAddress is requiredMissing customer IDcustomerId is requiredWallet already existswallet already existsInvalid balanceinitial balance cannot be negativeLedger write failedfailed to create wallet on ledger

Returned Response
{  "success": true,  "message": "Wallet created successfully",  "walletAddress": "WALLET-CUST-1001-20260429",  "customerId": "CUST-1001",  "organizationId": "ORG-BANK-001",  "balance": 1000.00,  "currency": "USD",  "status": "ACTIVE"}

Security Considerations
AreaRecommendationPasswordStore only hash, never plain textWallet creationMust be called only by authorized API identityCustomer validationShould be completed outside chaincode before calling FabricDuplicate walletPrevent duplicate wallet per customer unless business allowsAuditFabric transaction ID should be captured by API and PostgreSQLAccess controlUse Fabric client certificate attributes or API-level authorization

8. Method 2 — LoginWallet
Purpose
Validate wallet login by checking whether the wallet exists, is active, and the provided hash matches the stored wallet password hash.
Important: the chaincode should not generate JWT tokens. It should only return whether the wallet login is valid.
JWT/session generation should be handled by the Blockchain API or Spring Boot layer.

Function Name
LoginWallet

Input Parameters
ParameterTypeRequiredDescriptionwalletAddressstringYesWallet addresswalletPasswordHashstringYesPassword hash generated by API layerloginAtstringYesLogin timestamp

Example Chaincode Arguments
{  "Args": [    "LoginWallet",    "WALLET-CUST-1001-20260429",    "HASHED_PASSWORD_VALUE",    "2026-04-29T11:00:00Z"  ]}

Validation Rules
RuleDescriptionWallet address is requiredCannot login without wallet addressPassword hash is requiredHash comparison is requiredWallet must existInvalid wallet should be rejectedWallet must be ACTIVEBlocked, inactive, or suspended wallets cannot loginPassword hash must matchInvalid credentials should be rejected

Ledger Read Logic
Read wallet document:
GetState("WALLET_" + walletAddress)
Validate:
wallet.status == "ACTIVE"wallet.walletPasswordHash == inputPasswordHash

Ledger Write Logic
Update:
lastLoginAtupdatedAt
Write updated wallet document:
PutState("WALLET_" + walletAddress, updatedWalletJSON)

Error Handling
Error CaseReturned ErrorWallet not foundwallet not foundWallet inactivewallet is not activeInvalid password hashinvalid wallet credentialsFailed updatefailed to update wallet login timestamp

Returned Response
{  "success": true,  "message": "Wallet login validated successfully",  "walletAddress": "WALLET-CUST-1001-20260429",  "customerId": "CUST-1001",  "organizationId": "ORG-BANK-001",  "status": "ACTIVE",  "lastLoginAt": "2026-04-29T11:00:00Z"}

Security Considerations
AreaRecommendationPasswordCompare hashed value onlyLogin tokenGenerate JWT outside FabricFailed attemptsPrefer API/PostgreSQL layer for rate limitingSensitive fieldsDo not return password hashAuditAPI should log login attempts in PostgreSQLFabric identityOnly trusted backend identities should call this method

9. Method 3 — TransferBetweenWallets
Purpose
Transfer funds from one wallet to another wallet.
This method must debit the sender wallet, credit the receiver wallet, and create an immutable transaction document.

Function Name
TransferBetweenWallets

Input Parameters
ParameterTypeRequiredDescriptiontransactionIdstringYesUnique transaction ID from APIfromWalletAddressstringYesSender wallettoWalletAddressstringYesReceiver walletamountfloatYesTransfer amountcurrencystringYesCurrencydescriptionstringNoTransaction descriptionriskLevelstringYesLOW, MEDIUM, HIGHcreatedBystringYesAPI/system usercreatedAtstringYesTransaction timestamp

Example Chaincode Arguments
{  "Args": [    "TransferBetweenWallets",    "TXN-20260429-000001",    "WALLET-CUST-1001-20260429",    "WALLET-CUST-2001-20260429",    "150.00",    "USD",    "Payment for service",    "LOW",    "blockchain-api",    "2026-04-29T11:30:00Z"  ]}

Validation Rules
RuleDescriptionTransaction ID is requiredPrevent missing transaction referenceTransaction ID must be uniquePrevent duplicate transferSender wallet must existSender must be validReceiver wallet must existReceiver must be validSender and receiver cannot be the samePrevent self-transfer unless allowedBoth wallets must be ACTIVESuspended wallets cannot transactAmount must be greater than zeroZero or negative transfers not allowedSender balance must be sufficientPrevent overdraftCurrency must match wallet currencyPrevent currency mismatchRisk level must be validLOW, MEDIUM, HIGH

Ledger Read Logic
Read transaction first:
GetState("TX_" + transactionId)
If transaction already exists, reject.
Read sender wallet:
GetState("WALLET_" + fromWalletAddress)
Read receiver wallet:
GetState("WALLET_" + toWalletAddress)
Validate balances and statuses.

Ledger Write Logic
Debit sender:
sender.balance = sender.balance - amount
Credit receiver:
receiver.balance = receiver.balance + amount
Write sender wallet:
PutState("WALLET_" + fromWalletAddress, senderWalletJSON)
Write receiver wallet:
PutState("WALLET_" + toWalletAddress, receiverWalletJSON)
Create transaction:
PutState("TX_" + transactionId, transactionJSON)
Transaction type:
WALLET_TO_WALLET
Transaction status:
SUCCESS

Error Handling
Error CaseReturned ErrorDuplicate transaction IDtransaction already existsSender wallet not foundsender wallet not foundReceiver wallet not foundreceiver wallet not foundInactive sender walletsender wallet is not activeInactive receiver walletreceiver wallet is not activeInsufficient balanceinsufficient wallet balanceInvalid amountamount must be greater than zeroCurrency mismatchcurrency mismatch between walletsLedger update failedfailed to complete wallet transfer

Returned Response
{  "success": true,  "message": "Transfer completed successfully",  "transactionId": "TXN-20260429-000001",  "transactionType": "WALLET_TO_WALLET",  "fromWalletAddress": "WALLET-CUST-1001-20260429",  "toWalletAddress": "WALLET-CUST-2001-20260429",  "amount": 150.00,  "currency": "USD",  "status": "SUCCESS",  "riskLevel": "LOW",  "senderNewBalance": 850.00,  "receiverNewBalance": 1150.00,  "createdAt": "2026-04-29T11:30:00Z"}

Security Considerations
AreaRecommendationAuthorizationAPI must ensure sender owns wallet or is authorizedAmount validationValidate amount in API and chaincodeReplay attackUse unique transaction IDAML rulesAPI should calculate risk level before calling chaincodeHigh-risk transferChaincode may block HIGH risk or mark for review depending on business ruleAuditEvery successful transfer must create a transaction documentConcurrencyFabric MVCC protects against double-spend conflicts

10. Method 4 — TransferToOrganization
Purpose
Transfer funds from a wallet to an organization.
This is used for payments, government fees, bank fees, stamp purchases, service payments, or organization settlement.

Function Name
TransferToOrganization

Input Parameters
ParameterTypeRequiredDescriptiontransactionIdstringYesUnique transaction IDfromWalletAddressstringYesSource walletorganizationIdstringYesTarget organizationamountfloatYesTransfer amountcurrencystringYesCurrencydescriptionstringNoPayment descriptionriskLevelstringYesLOW, MEDIUM, HIGHcreatedBystringYesAPI/system usercreatedAtstringYesTransaction timestamp

Example Chaincode Arguments
{  "Args": [    "TransferToOrganization",    "TXN-20260429-000002",    "WALLET-CUST-1001-20260429",    "ORG-BANK-001",    "250.00",    "USD",    "Organization service payment",    "LOW",    "blockchain-api",    "2026-04-29T12:00:00Z"  ]}

Validation Rules
RuleDescriptionTransaction ID is requiredRequired unique transactionTransaction ID must not already existPrevent duplicate transactionSource wallet must existWallet must be validOrganization must existTarget organization must be validWallet must be ACTIVEInactive wallets cannot payOrganization must be ACTIVEInactive organizations cannot receiveAmount must be greater than zeroInvalid payment amount rejectedWallet balance must be sufficientPrevent overdraftCurrency must matchPrevent currency mismatchRisk level must be validLOW, MEDIUM, HIGH

Ledger Read Logic
Read transaction:
GetState("TX_" + transactionId)
Read wallet:
GetState("WALLET_" + fromWalletAddress)
Read organization:
GetState("ORG_" + organizationId)

Ledger Write Logic
Debit wallet:
wallet.balance = wallet.balance - amount
Credit organization:
organization.balance = organization.balance + amount
Create transaction document:
transactionType = "WALLET_TO_ORGANIZATION"
Write:
PutState("WALLET_" + fromWalletAddress, walletJSON)PutState("ORG_" + organizationId, organizationJSON)PutState("TX_" + transactionId, transactionJSON)

Error Handling
Error CaseReturned ErrorDuplicate transactiontransaction already existsWallet not foundwallet not foundOrganization not foundorganization not foundWallet inactivewallet is not activeOrganization inactiveorganization is not activeInsufficient balanceinsufficient wallet balanceInvalid amountamount must be greater than zeroCurrency mismatchcurrency mismatchLedger write failedfailed to complete organization transfer

Returned Response
{  "success": true,  "message": "Organization transfer completed successfully",  "transactionId": "TXN-20260429-000002",  "transactionType": "WALLET_TO_ORGANIZATION",  "fromWalletAddress": "WALLET-CUST-1001-20260429",  "organizationId": "ORG-BANK-001",  "amount": 250.00,  "currency": "USD",  "status": "SUCCESS",  "riskLevel": "LOW",  "walletNewBalance": 600.00,  "organizationNewBalance": 500250.00,  "createdAt": "2026-04-29T12:00:00Z"}

Security Considerations
AreaRecommendationAuthorizationAPI must validate wallet ownerOrganization validationOrganization must be registered before transferHigh-risk transactionsOptionally reject HIGH risk or mark pendingTransaction uniquenessRequired to prevent duplicate paymentAuditabilityFabric transaction ID should be linked to PostgreSQL transaction recordSensitive dataDo not store personal payment details on-chain

11. Method 5 — GetWalletBalance
Purpose
Return the current balance of a wallet from the blockchain ledger.
This is used by the API to display trusted wallet balance to the customer or enterprise user.

Function Name
GetWalletBalance

Input Parameters
ParameterTypeRequiredDescriptionwalletAddressstringYesWallet address

Example Chaincode Arguments
{  "Args": [    "GetWalletBalance",    "WALLET-CUST-1001-20260429"  ]}

Validation Rules
RuleDescriptionWallet address is requiredRequired lookup valueWallet must existBalance cannot be returned for missing walletWallet should be ACTIVEOptional depending on business rule

Ledger Read Logic
Read wallet:
GetState("WALLET_" + walletAddress)

Ledger Write Logic
No write operation.
This method is read-only.

Error Handling
Error CaseReturned ErrorMissing wallet addresswalletAddress is requiredWallet not foundwallet not foundLedger read failedfailed to read wallet balance

Returned Response
{  "success": true,  "walletAddress": "WALLET-CUST-1001-20260429",  "customerId": "CUST-1001",  "organizationId": "ORG-BANK-001",  "balance": 600.00,  "currency": "USD",  "status": "ACTIVE",  "updatedAt": "2026-04-29T12:00:00Z"}

Security Considerations
AreaRecommendationAccess controlAPI must ensure user can only view authorized walletPrivacyDo not expose password hashQuery loadUse PostgreSQL read model for dashboards; Fabric for trusted balanceAuditBalance query may be logged outside chaincode if required

12. Method 6 — GetTransactionHistory
Purpose
Return transaction history for a wallet or organization using CouchDB rich queries.
This method is used for wallet transaction history, organization payment history, and audit review.

Function Name
GetTransactionHistory

Input Parameters
ParameterTypeRequiredDescriptionentityTypestringYesWALLET or ORGANIZATIONentityIdstringYesWallet address or organization IDfromDatestringNoStart datetoDatestringNoEnd datetransactionTypestringNoWALLET_TO_WALLET or WALLET_TO_ORGANIZATIONstatusstringNoSUCCESS, FAILED, PENDINGlimitintNoResult limit

Example Chaincode Arguments — Wallet History
{  "Args": [    "GetTransactionHistory",    "WALLET",    "WALLET-CUST-1001-20260429",    "2026-04-01T00:00:00Z",    "2026-04-29T23:59:59Z",    "ALL",    "SUCCESS",    "50"  ]}

Example Chaincode Arguments — Organization History
{  "Args": [    "GetTransactionHistory",    "ORGANIZATION",    "ORG-BANK-001",    "2026-04-01T00:00:00Z",    "2026-04-29T23:59:59Z",    "WALLET_TO_ORGANIZATION",    "SUCCESS",    "50"  ]}

Validation Rules
RuleDescriptionEntity type is requiredMust be WALLET or ORGANIZATIONEntity ID is requiredWallet address or organization IDLimit must be validPrevent very large query resultsDate format must be validISO timestamp recommendedStatus must be valid when providedSUCCESS, FAILED, PENDINGTransaction type must be valid when providedWALLET_TO_WALLET, WALLET_TO_ORGANIZATION, ALL

Ledger Read Logic
For wallet history, query transactions where:
fromWalletAddress = walletAddressORtoWalletAddress = walletAddress
Example CouchDB query:
{  "selector": {    "docType": "transaction",    "$or": [      {        "fromWalletAddress": "WALLET-CUST-1001-20260429"      },      {        "toWalletAddress": "WALLET-CUST-1001-20260429"      }    ],    "status": "SUCCESS"  },  "sort": [    {      "createdAt": "desc"    }  ],  "limit": 50}
For organization history:
{  "selector": {    "docType": "transaction",    "organizationId": "ORG-BANK-001",    "transactionType": "WALLET_TO_ORGANIZATION",    "status": "SUCCESS"  },  "sort": [    {      "createdAt": "desc"    }  ],  "limit": 50}

Ledger Write Logic
No write operation.
This method is read-only.

Error Handling
Error CaseReturned ErrorMissing entity typeentityType is requiredMissing entity IDentityId is requiredInvalid entity typeentityType must be WALLET or ORGANIZATIONInvalid limitinvalid query limitQuery failedfailed to retrieve transaction historyNo transactions foundReturn empty list, not error

Returned Response
{  "success": true,  "entityType": "WALLET",  "entityId": "WALLET-CUST-1001-20260429",  "totalReturned": 2,  "transactions": [    {      "transactionId": "TXN-20260429-000001",      "transactionType": "WALLET_TO_WALLET",      "fromWalletAddress": "WALLET-CUST-1001-20260429",      "toWalletAddress": "WALLET-CUST-2001-20260429",      "organizationId": null,      "amount": 150.00,      "currency": "USD",      "status": "SUCCESS",      "riskLevel": "LOW",      "createdAt": "2026-04-29T11:30:00Z"    },    {      "transactionId": "TXN-20260429-000002",      "transactionType": "WALLET_TO_ORGANIZATION",      "fromWalletAddress": "WALLET-CUST-1001-20260429",      "toWalletAddress": null,      "organizationId": "ORG-BANK-001",      "amount": 250.00,      "currency": "USD",      "status": "SUCCESS",      "riskLevel": "LOW",      "createdAt": "2026-04-29T12:00:00Z"    }  ]}

Security Considerations
AreaRecommendationPrivacyAPI must restrict users to their own wallet historyPaginationUse limit and bookmarks for productionPerformanceUse CouchDB indexes for query fieldsReportingUse PostgreSQL read model for large analytics dashboardsAuditBlockchain remains trusted source, PostgreSQL used for fast reporting

13. Recommended Response Format from All Chaincode Methods
Each method should return a consistent JSON response.
Success Format
{  "success": true,  "message": "Operation completed successfully",  "data": {}}
Error Format
{  "success": false,  "message": "Error message",  "errorCode": "ERROR_CODE"}
Recommended error codes:
WALLET_NOT_FOUNDWALLET_ALREADY_EXISTSINVALID_CREDENTIALSINSUFFICIENT_BALANCEDUPLICATE_TRANSACTIONORGANIZATION_NOT_FOUNDINVALID_AMOUNTINVALID_STATUSLEDGER_READ_ERRORLEDGER_WRITE_ERROR

14. Recommended Chaincode Constants
const (    DocTypeWallet       = "wallet"    DocTypeOrganization = "organization"    DocTypeTransaction  = "transaction"    WalletStatusActive    = "ACTIVE"    WalletStatusInactive  = "INACTIVE"    WalletStatusSuspended = "SUSPENDED"    OrgStatusActive    = "ACTIVE"    OrgStatusInactive  = "INACTIVE"    TxTypeWalletToWallet       = "WALLET_TO_WALLET"    TxTypeWalletToOrganization = "WALLET_TO_ORGANIZATION"    TxStatusSuccess = "SUCCESS"    TxStatusFailed  = "FAILED"    TxStatusPending = "PENDING"    RiskLow    = "LOW"    RiskMedium = "MEDIUM"    RiskHigh   = "HIGH")

15. Recommended Go Structs
Wallet Struct
type Wallet struct {    DocType            string  `json:"docType"`    WalletAddress      string  `json:"walletAddress"`    CustomerID         string  `json:"customerId"`    OrganizationID     string  `json:"organizationId"`    WalletPasswordHash string  `json:"walletPasswordHash"`    Balance            float64 `json:"balance"`    Currency           string  `json:"currency"`    Status             string  `json:"status"`    CreatedAt          string  `json:"createdAt"`    UpdatedAt          string  `json:"updatedAt"`    CreatedBy          string  `json:"createdBy"`    LastLoginAt        string  `json:"lastLoginAt,omitempty"`}
Organization Struct
type Organization struct {    DocType                   string  `json:"docType"`    OrganizationID            string  `json:"organizationId"`    OrganizationName          string  `json:"organizationName"`    OrganizationWalletAddress string  `json:"organizationWalletAddress"`    Balance                   float64 `json:"balance"`    Currency                  string  `json:"currency"`    Status                    string  `json:"status"`    CreatedAt                 string  `json:"createdAt"`    UpdatedAt                 string  `json:"updatedAt"`}
Transaction Struct
type Transaction struct {    DocType           string  `json:"docType"`    TransactionID     string  `json:"transactionId"`    TransactionType   string  `json:"transactionType"`    FromWalletAddress string  `json:"fromWalletAddress"`    ToWalletAddress   string  `json:"toWalletAddress,omitempty"`    OrganizationID    string  `json:"organizationId,omitempty"`    Amount            float64 `json:"amount"`    Currency          string  `json:"currency"`    Status            string  `json:"status"`    RiskLevel         string  `json:"riskLevel"`    Description       string  `json:"description"`    CreatedAt         string  `json:"createdAt"`    CreatedBy         string  `json:"createdBy"`    FabricTxID        string  `json:"fabricTxId"`}

16. CouchDB Index Requirements
The following indexes should support Step 10 and Step 11.
Wallet by Customer ID
{  "index": {    "fields": ["docType", "customerId"]  },  "ddoc": "indexWalletByCustomerId",  "name": "indexWalletByCustomerId",  "type": "json"}
Wallet by Address
{  "index": {    "fields": ["docType", "walletAddress"]  },  "ddoc": "indexWalletByAddress",  "name": "indexWalletByAddress",  "type": "json"}
Organization by ID
{  "index": {    "fields": ["docType", "organizationId"]  },  "ddoc": "indexOrganizationById",  "name": "indexOrganizationById",  "type": "json"}
Transaction by Status
{  "index": {    "fields": ["docType", "status"]  },  "ddoc": "indexTransactionByStatus",  "name": "indexTransactionByStatus",  "type": "json"}
Transaction by Risk Level
{  "index": {    "fields": ["docType", "riskLevel"]  },  "ddoc": "indexTransactionByRiskLevel",  "name": "indexTransactionByRiskLevel",  "type": "json"}
Transaction by Date
{  "index": {    "fields": ["docType", "createdAt"]  },  "ddoc": "indexTransactionByDate",  "name": "indexTransactionByDate",  "type": "json"}
Transaction by From Wallet and Date
{  "index": {    "fields": ["docType", "fromWalletAddress", "createdAt"]  },  "ddoc": "indexTransactionByFromWalletDate",  "name": "indexTransactionByFromWalletDate",  "type": "json"}
Transaction by To Wallet and Date
{  "index": {    "fields": ["docType", "toWalletAddress", "createdAt"]  },  "ddoc": "indexTransactionByToWalletDate",  "name": "indexTransactionByToWalletDate",  "type": "json"}
Transaction by Organization and Date
{  "index": {    "fields": ["docType", "organizationId", "createdAt"]  },  "ddoc": "indexTransactionByOrganizationDate",  "name": "indexTransactionByOrganizationDate",  "type": "json"}

17. Chaincode Access Control Design
For production, chaincode methods should be protected by identity rules.
Recommended Fabric identity model:
MethodAllowed CallerCreateWalletBlockchain API admin identityLoginWalletBlockchain API service identityTransferBetweenWalletsBlockchain API service identityTransferToOrganizationBlockchain API service identityGetWalletBalanceBlockchain API service identityGetTransactionHistoryBlockchain API service identity, auditor identity
Recommended client certificate attributes:
role=adminrole=apirole=auditororganization=org1
Example rule:
Only identities with role=api or role=admin can invoke transfer methods.Only identities with role=auditor can run full transaction history queries.

18. Chaincode Business Rule Summary
RuleDescriptionWallet must be uniqueNo duplicate wallet addressCustomer wallet must be controlledOne active wallet per customer unless business allows multipleWallet must be ACTIVEOnly active wallets can login and transactOrganization must be ACTIVEOnly active organizations can receive paymentsAmount must be positiveNo zero or negative transferBalance must be sufficientPrevent overdraftTransaction ID must be uniquePrevent duplicate/replay transactionsCurrency must matchPrevent cross-currency inconsistencyPassword hash onlyNever store or return plain passwordTransaction must be written for every successful movementAudit and traceability

19. Recommended API-to-Chaincode Mapping
API EndpointChaincode MethodPOST /api/v1/blockchain/walletsCreateWalletPOST /api/v1/blockchain/wallets/loginLoginWalletPOST /api/v1/blockchain/transactions/wallet-transferTransferBetweenWalletsPOST /api/v1/blockchain/transactions/organization-transferTransferToOrganizationGET /api/v1/blockchain/wallets/{walletAddress}/balanceGetWalletBalanceGET /api/v1/blockchain/wallets/{walletAddress}/transactionsGetTransactionHistory

20. PostgreSQL Synchronization Design
The chaincode writes the trusted blockchain state.
The Blockchain API or event listener should sync successful chaincode transactions into PostgreSQL tables.
Recommended PostgreSQL tables:
blockchain.blockchain_walletblockchain.blockchain_wallet_balanceblockchain.blockchain_transactionblockchain.fabric_transactionsblockchain.blockchain_audit_log
Recommended sync flow:
API calls chaincodeFabric commits transactionAPI receives Fabric transaction IDAPI writes transaction metadata to PostgreSQLEvent listener confirms block commitPostgreSQL reporting tables are updated

21. Fabric Transaction ID Handling
Inside chaincode, capture Fabric transaction ID using:
ctx.GetStub().GetTxID()
Store it in transaction document:
{  "fabricTxId": "FABRIC_TX_ID"}
This allows linking:
PostgreSQL transaction IDBlockchain transaction IDFabric transaction IDCouchDB document key

22. Recommended Transaction Status Logic
Simple Version
For the first implementation:
All successful ledger updates create transaction status = SUCCESSFailed validations return error before writing transaction
Advanced Version
Later, you may add:
PENDINGAPPROVEDREJECTEDFAILEDREVERSED
For maker-checker workflow, AML review, or manual approval.

23. Recommended Risk Level Logic
For the first implementation, the API can calculate risk level before invoking chaincode.
Recommended values:
LOWMEDIUMHIGH
Example:
Risk LevelMeaningLOWNormal transactionMEDIUMRequires monitoringHIGHRequires review or blocking
Recommended first implementation:
LOW and MEDIUM allowedHIGH can be rejected or written as PENDING depending on business rules
For your first chaincode version, I recommend:
Reject HIGH-risk transfers until maker-checker is implemented.

24. Recommended Chaincode Method Final Design Table
MethodTypeWrites LedgerUses CouchDB QueryMain PurposeCreateWalletInvokeYesOptionalCreate walletLoginWalletInvokeYesNoValidate login and update last loginTransferBetweenWalletsInvokeYesNoWallet-to-wallet transferTransferToOrganizationInvokeYesNoWallet-to-organization transferGetWalletBalanceQueryNoNoRead wallet balanceGetTransactionHistoryQueryNoYesRead transaction history

25. Implementation Readiness Checklist
Before implementing chaincode, confirm the following:
[ ] Chaincode folder exists[ ] go.mod is initialized[ ] chaincode.go is created[ ] Wallet struct is finalized[ ] Organization struct is finalized[ ] Transaction struct is finalized[ ] CouchDB indexes are placed under META-INF[ ] Channel is created[ ] Peer joined channel[ ] Chaincode lifecycle is working[ ] CouchDB is connected to peer[ ] PostgreSQL blockchain schema exists[ ] API contract is already defined[ ] API will hash password before chaincode call[ ] API will generate unique transaction IDs[ ] API will handle JWT/session management[ ] API will sync Fabric results into PostgreSQL

26. Final Professional Summary
In Step 11, the Blockchain Integration Project chaincode is designed as the trusted ledger layer for wallet and transaction operations.
The chaincode will provide six core methods:
CreateWalletLoginWalletTransferBetweenWalletsTransferToOrganizationGetWalletBalanceGetTransactionHistory
It will store wallet, organization, and transaction documents in the Fabric ledger with CouchDB as the state database. Sensitive operations such as JWT generation, password hashing, OTP, recovery words, and user session handling remain outside the chaincode and are handled by the API layer.
This design is ready to move into the next step:
STEP 12 — Chaincode Implementation