🔹 STEP 2 — API Contract Definition
Blockchain Integration Project
API Contract Between Spring Boot Application and Blockchain API
1. API Overview
This API contract defines how the Spring Boot backend will communicate with the Blockchain API / Middleware.
The Spring Boot application will not directly connect to Hyperledger Fabric.
It will call the Blockchain API, and the Blockchain API will handle:


Wallet creation


Wallet authentication


Blockchain transaction submission


Balance query


Transaction history query


Communication with Hyperledger Fabric


PostgreSQL / CouchDB synchronization if needed



2. Base API Information
Base URL
http://localhost:8081/api/v1/blockchain
For production:
https://blockchain-api.company.com/api/v1/blockchain

Standard Headers
All secured endpoints must include:
Content-Type: application/jsonAccept: application/jsonAuthorization: Bearer <ACCESS_TOKEN>X-Request-Id: <unique-request-id>X-Client-App: spring-boot-core-app

Standard Success Response Format
{  "success": true,  "message": "Operation completed successfully",  "data": {},  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000001"}

Standard Error Response Format
{  "success": false,  "message": "Validation failed",  "errorCode": "VALIDATION_ERROR",  "errors": [    {      "field": "walletAddress",      "message": "walletAddress is required"    }  ],  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000001"}

3. Authentication Model
Token Type
The Blockchain API should use:
Bearer JWT Token
Authentication Flow
Spring Boot → Blockchain API Login Endpoint → Blockchain API validates wallet credentials → returns JWT token
Secured Endpoints
The following endpoints require authentication:


Wallet-to-wallet transaction


Organization transaction


Wallet balance query


Wallet transaction history


The following endpoints do not require authentication:


Wallet creation


Wallet login



4. Endpoint 1 — Wallet Creation
Purpose
Create a new blockchain wallet for a customer, organization, or system user.

HTTP Method
POST

URL
/api/v1/blockchain/wallets

Request Headers
Content-Type: application/jsonAccept: application/jsonX-Request-Id: REQ-20260428-000001X-Client-App: spring-boot-core-app

Authentication Requirement
No Bearer token required.
Optional internal API key can be added for system-to-system security:
X-API-Key: <internal-api-key>

Request Payload
{  "ownerType": "CUSTOMER",  "ownerId": "CUST-100001",  "fullName": "Nicolas Salloum",  "email": "nicolas@example.com",  "phoneNumber": "+96170123456",  "nationalId": "123456789",  "password": "StrongPassword@123",  "metadata": {    "sourceSystem": "SpringBootApp",    "branchCode": "BR001",    "createdBy": "system"  }}

Field Description
FieldTypeRequiredDescriptionownerTypestringYesCUSTOMER, ORGANIZATION, BANK, SYSTEMownerIdstringYesUnique ID from Spring Boot systemfullNamestringYesWallet owner nameemailstringYesOwner emailphoneNumberstringNoOwner phone numbernationalIdstringNoNational ID or registration numberpasswordstringYesWallet login passwordmetadataobjectNoExtra system information

Validation Rules
FieldRuleownerTypeMust be one of: CUSTOMER, ORGANIZATION, BANK, SYSTEMownerIdRequired, uniquefullNameRequired, minimum 3 charactersemailRequired, valid email formatpasswordRequired, minimum 8 characters, must include uppercase, lowercase, number, and symbolphoneNumberOptional, valid international formatnationalIdOptional, max 50 characters

Success Response
{  "success": true,  "message": "Wallet created successfully",  "data": {    "walletId": "WLT-000001",    "walletAddress": "0x9f8a7b6c5d4e3f2a1b0c",    "ownerType": "CUSTOMER",    "ownerId": "CUST-100001",    "status": "ACTIVE",    "createdAt": "2026-04-28T12:00:00Z",    "blockchainTxId": "fabtx-8f9a7c6d5e4b3a2"  },  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000001"}

Error Response — Duplicate Wallet
{  "success": false,  "message": "Wallet already exists for this owner",  "errorCode": "WALLET_ALREADY_EXISTS",  "errors": [    {      "field": "ownerId",      "message": "A wallet already exists for ownerId CUST-100001"    }  ],  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000001"}

5. Endpoint 2 — Wallet Login
Purpose
Authenticate a wallet owner and return an access token.

HTTP Method
POST

URL
/api/v1/blockchain/wallets/login

Request Headers
Content-Type: application/jsonAccept: application/jsonX-Request-Id: REQ-20260428-000002X-Client-App: spring-boot-core-app

Authentication Requirement
No Bearer token required.

Request Payload
{  "walletAddress": "0x9f8a7b6c5d4e3f2a1b0c",  "password": "StrongPassword@123"}

Validation Rules
FieldRulewalletAddressRequiredpasswordRequired

Success Response
{  "success": true,  "message": "Wallet login successful",  "data": {    "walletAddress": "0x9f8a7b6c5d4e3f2a1b0c",    "ownerId": "CUST-100001",    "ownerType": "CUSTOMER",    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",    "tokenType": "Bearer",    "expiresIn": 3600  },  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000002"}

Error Response — Invalid Credentials
{  "success": false,  "message": "Invalid wallet address or password",  "errorCode": "INVALID_CREDENTIALS",  "errors": [],  "timestamp": "2026-04-28T12:00:00Z",  "requestId": "REQ-20260428-000002"}

6. Endpoint 3 — Wallet-to-Wallet Transaction
Purpose
Transfer value from one wallet to another wallet.

HTTP Method
POST

URL
/api/v1/blockchain/transactions/wallet-transfer

Request Headers
Content-Type: application/jsonAccept: application/jsonAuthorization: Bearer <ACCESS_TOKEN>X-Request-Id: REQ-20260428-000003X-Client-App: spring-boot-core-appIdempotency-Key: TRX-CUST-100001-20260428-000001

Authentication Requirement
Bearer token required.
The authenticated wallet must match the fromWalletAddress.

Request Payload
{  "fromWalletAddress": "0x9f8a7b6c5d4e3f2a1b0c",  "toWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",  "amount": 150.75,  "currency": "TOKEN",  "transactionType": "WALLET_TO_WALLET",  "description": "Customer wallet transfer",  "referenceNumber": "REF-20260428-000001",  "metadata": {    "sourceSystem": "SpringBootApp",    "channel": "WEB",    "initiatedBy": "CUST-100001"  }}

Validation Rules
FieldRulefromWalletAddressRequired, must be activetoWalletAddressRequired, must be activeamountRequired, greater than 0currencyRequiredtransactionTypeMust be WALLET_TO_WALLETreferenceNumberRequired, uniqueIdempotency-KeyRequired to prevent duplicate transactionfromWalletAddressCannot equal toWalletAddressbalanceSender must have sufficient balance

Success Response
{  "success": true,  "message": "Wallet transfer completed successfully",  "data": {    "transactionId": "TRX-000001",    "blockchainTxId": "fabtx-123abc456def",    "fromWalletAddress": "0x9f8a7b6c5d4e3f2a1b0c",    "toWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",    "amount": 150.75,    "currency": "TOKEN",    "status": "CONFIRMED",    "createdAt": "2026-04-28T12:05:00Z"  },  "timestamp": "2026-04-28T12:05:00Z",  "requestId": "REQ-20260428-000003"}

Error Response — Insufficient Balance
{  "success": false,  "message": "Insufficient wallet balance",  "errorCode": "INSUFFICIENT_BALANCE",  "errors": [    {      "field": "amount",      "message": "Available balance is lower than requested transfer amount"    }  ],  "timestamp": "2026-04-28T12:05:00Z",  "requestId": "REQ-20260428-000003"}

7. Endpoint 4 — Organization Transaction
Purpose
Allow an organization, bank, government entity, or system account to perform a blockchain transaction.
Example use cases:


Bank-to-bank transaction


Organization-to-wallet transaction


Government fee payment


Digital stamp issuance


Internal institutional settlement



HTTP Method
POST

URL
/api/v1/blockchain/transactions/organization

Request Headers
Content-Type: application/jsonAccept: application/jsonAuthorization: Bearer <ACCESS_TOKEN>X-Request-Id: REQ-20260428-000004X-Client-App: spring-boot-core-appIdempotency-Key: ORG-TRX-20260428-000001

Authentication Requirement
Bearer token required.
The authenticated user must have one of these roles:
ORGANIZATION_ADMINBANK_ADMINGOVERNMENT_OPERATORSYSTEM_OPERATOR

Request Payload
{  "organizationId": "ORG-100001",  "organizationWalletAddress": "0xorgwallet123456789",  "targetWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",  "amount": 5000.00,  "currency": "TOKEN",  "transactionType": "ORGANIZATION_TRANSFER",  "businessPurpose": "Digital stamp issuance",  "referenceNumber": "ORG-REF-20260428-000001",  "metadata": {    "sourceSystem": "SpringBootApp",    "department": "MinistryOfFinance",    "approvedBy": "admin-user-001"  }}

Validation Rules
FieldRuleorganizationIdRequiredorganizationWalletAddressRequired, must belong to organizationtargetWalletAddressRequired, must be activeamountRequired, greater than 0currencyRequiredtransactionTypeRequiredbusinessPurposeRequiredreferenceNumberRequired, uniqueIdempotency-KeyRequiredroleMust be authorized organization-level role

Success Response
{  "success": true,  "message": "Organization transaction completed successfully",  "data": {    "transactionId": "ORG-TRX-000001",    "blockchainTxId": "fabtx-org-987xyz654",    "organizationId": "ORG-100001",    "organizationWalletAddress": "0xorgwallet123456789",    "targetWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",    "amount": 5000.00,    "currency": "TOKEN",    "transactionType": "ORGANIZATION_TRANSFER",    "status": "CONFIRMED",    "createdAt": "2026-04-28T12:10:00Z"  },  "timestamp": "2026-04-28T12:10:00Z",  "requestId": "REQ-20260428-000004"}

Error Response — Unauthorized Role
{  "success": false,  "message": "User is not authorized to perform organization transaction",  "errorCode": "UNAUTHORIZED_ORGANIZATION_TRANSACTION",  "errors": [],  "timestamp": "2026-04-28T12:10:00Z",  "requestId": "REQ-20260428-000004"}

8. Endpoint 5 — Wallet Balance Query
Purpose
Return the current blockchain wallet balance.

HTTP Method
GET

URL
/api/v1/blockchain/wallets/{walletAddress}/balance

Example URL
/api/v1/blockchain/wallets/0x9f8a7b6c5d4e3f2a1b0c/balance

Request Headers
Accept: application/jsonAuthorization: Bearer <ACCESS_TOKEN>X-Request-Id: REQ-20260428-000005X-Client-App: spring-boot-core-app

Authentication Requirement
Bearer token required.
A customer can only view their own wallet balance.
Organization admins may view balances for wallets under their organization.

Path Parameter
ParameterTypeRequiredDescriptionwalletAddressstringYesBlockchain wallet address

Query Parameters
Optional:
?currency=TOKEN

Validation Rules
FieldRulewalletAddressRequired, must existcurrencyOptionalauthorizationUser must own the wallet or have organization permission

Success Response
{  "success": true,  "message": "Wallet balance retrieved successfully",  "data": {    "walletAddress": "0x9f8a7b6c5d4e3f2a1b0c",    "ownerId": "CUST-100001",    "currency": "TOKEN",    "availableBalance": 12500.50,    "lockedBalance": 0.00,    "totalBalance": 12500.50,    "lastUpdatedAt": "2026-04-28T12:15:00Z"  },  "timestamp": "2026-04-28T12:15:00Z",  "requestId": "REQ-20260428-000005"}

Error Response — Wallet Not Found
{  "success": false,  "message": "Wallet not found",  "errorCode": "WALLET_NOT_FOUND",  "errors": [    {      "field": "walletAddress",      "message": "No wallet exists with the provided wallet address"    }  ],  "timestamp": "2026-04-28T12:15:00Z",  "requestId": "REQ-20260428-000005"}

9. Endpoint 6 — Wallet Transaction History
Purpose
Return transaction history for a wallet.

HTTP Method
GET

URL
/api/v1/blockchain/wallets/{walletAddress}/transactions

Example URL
/api/v1/blockchain/wallets/0x9f8a7b6c5d4e3f2a1b0c/transactions?page=1&size=20&sort=createdAt,desc

Request Headers
Accept: application/jsonAuthorization: Bearer <ACCESS_TOKEN>X-Request-Id: REQ-20260428-000006X-Client-App: spring-boot-core-app

Authentication Requirement
Bearer token required.
A customer can only view their own transaction history.
Organization admins may view transaction history for wallets under their organization.

Path Parameter
ParameterTypeRequiredDescriptionwalletAddressstringYesBlockchain wallet address

Query Parameters
ParameterTypeRequiredDescriptionpageintegerNoDefault: 1sizeintegerNoDefault: 20sortstringNoExample: createdAt,descfromDatestringNoISO datetoDatestringNoISO datetransactionTypestringNoWALLET_TO_WALLET, ORGANIZATION_TRANSFERstatusstringNoPENDING, CONFIRMED, FAILEDdirectionstringNoINCOMING, OUTGOING

Validation Rules
FieldRulewalletAddressRequired, must existpageMust be greater than or equal to 1sizeMust be between 1 and 100fromDateMust be valid ISO datetoDateMust be valid ISO datetransactionTypeMust be valid enumstatusMust be valid enumauthorizationUser must own wallet or have organization permission

Success Response
{  "success": true,  "message": "Wallet transaction history retrieved successfully",  "data": {    "walletAddress": "0x9f8a7b6c5d4e3f2a1b0c",    "page": 1,    "size": 20,    "totalElements": 2,    "totalPages": 1,    "transactions": [      {        "transactionId": "TRX-000001",        "blockchainTxId": "fabtx-123abc456def",        "fromWalletAddress": "0x9f8a7b6c5d4e3f2a1b0c",        "toWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",        "amount": 150.75,        "currency": "TOKEN",        "transactionType": "WALLET_TO_WALLET",        "direction": "OUTGOING",        "status": "CONFIRMED",        "createdAt": "2026-04-28T12:05:00Z"      },      {        "transactionId": "TRX-000002",        "blockchainTxId": "fabtx-456def789ghi",        "fromWalletAddress": "0x5a4b3c2d1e0f9a8b7c6d",        "toWalletAddress": "0x9f8a7b6c5d4e3f2a1b0c",        "amount": 75.25,        "currency": "TOKEN",        "transactionType": "WALLET_TO_WALLET",        "direction": "INCOMING",        "status": "CONFIRMED",        "createdAt": "2026-04-28T12:20:00Z"      }    ]  },  "timestamp": "2026-04-28T12:25:00Z",  "requestId": "REQ-20260428-000006"}

Error Response — Access Denied
{  "success": false,  "message": "Access denied for this wallet transaction history",  "errorCode": "ACCESS_DENIED",  "errors": [],  "timestamp": "2026-04-28T12:25:00Z",  "requestId": "REQ-20260428-000006"}

10. Recommended HTTP Status Codes
ScenarioHTTP StatusSuccess200 OKCreated201 CreatedValidation error400 Bad RequestInvalid credentials401 UnauthorizedAccess denied403 ForbiddenResource not found404 Not FoundDuplicate record409 ConflictInsufficient balance422 Unprocessable EntityBlockchain/Fabric error502 Bad GatewayInternal server error500 Internal Server Error

11. Common Error Codes
Error CodeDescriptionVALIDATION_ERRORInvalid request payloadWALLET_ALREADY_EXISTSWallet already existsWALLET_NOT_FOUNDWallet does not existWALLET_INACTIVEWallet is not activeINVALID_CREDENTIALSInvalid wallet address or passwordACCESS_DENIEDUser does not have permissionINSUFFICIENT_BALANCEWallet balance is not enoughDUPLICATE_TRANSACTIONDuplicate transaction detectedBLOCKCHAIN_SUBMISSION_FAILEDFailed to submit transaction to FabricBLOCKCHAIN_TIMEOUTBlockchain request timed outINTERNAL_SERVER_ERRORUnexpected server error

12. Security Requirements
API Security
The Blockchain API must enforce:
JWT authenticationRole-based access controlRequest validationIdempotency keys for financial transactionsAudit loggingRate limitingPayload size limitsHTTPS in production

Recommended Roles
CUSTOMERORGANIZATION_ADMINBANK_ADMINGOVERNMENT_OPERATORSYSTEM_OPERATORAUDITOR

Idempotency Requirement
For every transaction endpoint, Spring Boot must send:
Idempotency-Key: <unique-business-key>
Example:
Idempotency-Key: TRX-CUST-100001-20260428-000001
This prevents duplicate transactions if Spring Boot retries the request.

13. Blockchain API Internal Responsibility
The Blockchain API should handle:
1. Validate request payload2. Validate JWT token3. Validate wallet ownership4. Validate balance5. Generate internal transaction ID6. Submit transaction to Hyperledger Fabric7. Receive Fabric transaction ID8. Store transaction metadata in PostgreSQL9. Return response to Spring Boot10. Write audit trail

14. Spring Boot Responsibility
The Spring Boot application should handle:
1. Collect request from Angular frontend2. Validate business-level input3. Call Blockchain API4. Store application-side reference if needed5. Return friendly response to Angular6. Never call Hyperledger Fabric directly7. Never expose Fabric credentials to frontend

15. Recommended Endpoint Summary
FeatureMethodEndpointAuth RequiredWallet creationPOST/api/v1/blockchain/walletsNo / Internal API KeyWallet loginPOST/api/v1/blockchain/wallets/loginNoWallet transferPOST/api/v1/blockchain/transactions/wallet-transferYesOrganization transactionPOST/api/v1/blockchain/transactions/organizationYesWallet balanceGET/api/v1/blockchain/wallets/{walletAddress}/balanceYesWallet historyGET/api/v1/blockchain/wallets/{walletAddress}/transactionsYes

16. Example Spring Boot Integration Flow
Wallet Transfer Flow
Angular frontend        ↓Spring Boot backend        ↓POST /api/v1/blockchain/transactions/wallet-transfer        ↓Blockchain API validates request        ↓Blockchain API calls Hyperledger Fabric chaincode        ↓Fabric commits transaction        ↓Blockchain API stores transaction metadata in PostgreSQL        ↓Blockchain API returns blockchainTxId        ↓Spring Boot returns response to Angular

17. Final Notes for DEV Team
The development team should treat this contract as the official integration boundary.
Spring Boot should only communicate with the Blockchain API using HTTP REST endpoints.
Angular should never communicate directly with the Blockchain API or Hyperledger Fabric.
The Blockchain API is responsible for blockchain-specific processing, including Fabric SDK usage, transaction submission, ledger queries, wallet validation, transaction audit, and blockchain synchronization.
This separation keeps the architecture clean, secure, and production-ready.