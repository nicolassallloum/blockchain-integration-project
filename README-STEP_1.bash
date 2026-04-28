Your boundary becomes:

DEV Team Side
Angular → Spring Boot

Your Side
Blockchain API → Hyperledger Fabric → CouchDB / PostgreSQL Sync
Updated Integration Ownership
What You Should Deliver to the DEV Team

You should provide them with:

1. Blockchain API base URL

2. Authentication method

3. API endpoints

4. Request body examples

5. Response body examples

6. Error response format

7. Transaction status lifecycle

8. Required headers

9. API documentation file

10. Postman collection
Your Main Deliverable

Your main deliverable is the Blockchain API / Middleware.

It should expose clean REST APIs like:

POST /api/v1/blockchain/customers/register
POST /api/v1/blockchain/wallets/create
POST /api/v1/blockchain/transfers/execute
GET  /api/v1/blockchain/transactions/{txId}/status
GET  /api/v1/blockchain/customers/{customerId}
GET  /api/v1/blockchain/wallets/{walletAddress}
GET  /api/v1/blockchain/health

The DEV team will call these APIs from Spring Boot.

Updated Architecture
Angular
  ↓
Spring Boot
  ↓
Your Blockchain API
  ↓
Hyperledger Fabric
  ↓
CouchDB
  ↓
Fabric Events
  ↓
PostgreSQL Sync
Your Responsibility
1. Build Blockchain API

Your API should act as the gateway to Hyperledger Fabric.

Responsibilities:

Receive requests from Spring Boot
Validate API token / service token
Validate blockchain request payload
Call Hyperledger Fabric chaincode
Return transaction ID
Return blockchain status
Return blockchain query results
Normalize Fabric errors
Log all requests and responses
2. Build Hyperledger Fabric Network

You manage the blockchain layer:

Organizations
Peers
Orderer
Channel
Chaincode
CouchDB
Fabric CA
Certificates
Connection profile
3. Build Chaincode / Smart Contracts

You provide the blockchain business logic:

Register customer on-chain
Create wallet on-chain
Execute wallet transfer
Query customer
Query wallet
Query transaction
Get asset history
Emit blockchain events
4. Build Event Listener

You should listen to Fabric events and sync them into PostgreSQL.

Responsibilities:

Listen for chaincode events
Capture transaction ID
Capture block number
Capture event name
Capture payload
Update PostgreSQL transaction status
Store blockchain audit records
Provide status query APIs
5. Build PostgreSQL Sync Database

PostgreSQL on your side should store:

Blockchain transaction references
Fabric transaction status
Fabric events
Block numbers
Event payloads
API audit logs
Failed blockchain requests
Retry records

It is not the same as the DEV team’s main application database unless you both agree to share one database.

DEV Team Responsibility

The DEV team handles:

Angular frontend
Spring Boot backend
User login
User roles
Business forms
Business validation
Approval workflow
Calling your Blockchain API
Displaying blockchain status
Storing application-side data

They should not touch:

Fabric peers
CouchDB
Chaincode internals
Fabric certificates
Private keys
Blockchain wallet files
API Contract You Should Give to DEV Team
Base URL

For development:

http://localhost:9090/api/v1/blockchain

For production:

https://blockchain-api.company.com/api/v1/blockchain
Required Headers

Every request from Spring Boot to your Blockchain API should include:

Content-Type: application/json
Accept: application/json
Authorization: Bearer <SERVICE_TOKEN>
X-Correlation-ID: <unique-request-id>
X-Source-System: SPRINGBOOT-BACKEND

Example:

Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
X-Correlation-ID: 7f7c2a0e-92c8-4f59-ae3c-5d91e983b001
X-Source-System: SPRINGBOOT-BACKEND
Core APIs to Provide
1. Health Check API
GET /api/v1/blockchain/health
Response
{
  "status": "UP",
  "fabricNetwork": "CONNECTED",
  "channel": "kycchannel",
  "chaincode": "kyc_cc",
  "timestamp": "2026-04-28T10:00:00Z"
}
2. Register Customer On Blockchain
POST /api/v1/blockchain/customers/register
Request
{
  "requestId": "REQ-10001",
  "customerId": "CUS-10001",
  "fullNameHash": "9f2c5a7b...",
  "nationalIdHash": "1a7b8c9d...",
  "dateOfBirthHash": "77aa88bb...",
  "bankCode": "BANK001",
  "kycStatus": "VERIFIED",
  "createdBy": "springboot-user-001"
}
Response
{
  "success": true,
  "message": "Customer registration submitted to blockchain",
  "data": {
    "requestId": "REQ-10001",
    "customerId": "CUS-10001",
    "fabricTxId": "b8f56c2a98f4...",
    "status": "SUBMITTED",
    "submittedAt": "2026-04-28T10:02:00Z"
  }
}
3. Create Wallet
POST /api/v1/blockchain/wallets/create
Request
{
  "requestId": "REQ-10002",
  "customerId": "CUS-10001",
  "walletAddress": "WALLET-CUS-10001-001",
  "walletType": "CUSTOMER",
  "bankCode": "BANK001",
  "createdBy": "springboot-user-001"
}
Response
{
  "success": true,
  "message": "Wallet creation submitted to blockchain",
  "data": {
    "requestId": "REQ-10002",
    "customerId": "CUS-10001",
    "walletAddress": "WALLET-CUS-10001-001",
    "fabricTxId": "c91a64e3df11...",
    "status": "SUBMITTED",
    "submittedAt": "2026-04-28T10:05:00Z"
  }
}
4. Execute Transfer
POST /api/v1/blockchain/transfers/execute
Request
{
  "requestId": "REQ-10003",
  "transferId": "TRX-10001",
  "fromWalletAddress": "WALLET-CUS-10001-001",
  "toWalletAddress": "WALLET-CUS-20002-001",
  "amount": 250.75,
  "currency": "USD",
  "transferType": "WALLET_TO_WALLET",
  "approvedBy": "checker-user-001",
  "metadata": {
    "reason": "Customer transfer",
    "sourceSystem": "SPRINGBOOT"
  }
}
Response
{
  "success": true,
  "message": "Transfer submitted to blockchain",
  "data": {
    "requestId": "REQ-10003",
    "transferId": "TRX-10001",
    "fabricTxId": "ad831fa8329d...",
    "status": "SUBMITTED",
    "submittedAt": "2026-04-28T10:08:00Z"
  }
}
5. Get Blockchain Transaction Status
GET /api/v1/blockchain/transactions/{fabricTxId}/status
Example
GET /api/v1/blockchain/transactions/ad831fa8329d/status
Response
{
  "success": true,
  "data": {
    "fabricTxId": "ad831fa8329d...",
    "status": "CONFIRMED",
    "blockNumber": 1023,
    "channelName": "kycchannel",
    "chaincodeName": "kyc_cc",
    "eventName": "TransferExecuted",
    "confirmedAt": "2026-04-28T10:08:05Z"
  }
}
6. Get Customer From Blockchain
GET /api/v1/blockchain/customers/{customerId}
Response
{
  "success": true,
  "data": {
    "customerId": "CUS-10001",
    "fullNameHash": "9f2c5a7b...",
    "nationalIdHash": "1a7b8c9d...",
    "walletAddress": "WALLET-CUS-10001-001",
    "bankCode": "BANK001",
    "kycStatus": "VERIFIED",
    "createdAt": "2026-04-28T10:02:00Z",
    "updatedAt": "2026-04-28T10:02:00Z"
  }
}
7. Get Wallet From Blockchain
GET /api/v1/blockchain/wallets/{walletAddress}
Response
{
  "success": true,
  "data": {
    "walletAddress": "WALLET-CUS-10001-001",
    "customerId": "CUS-10001",
    "walletType": "CUSTOMER",
    "bankCode": "BANK001",
    "status": "ACTIVE",
    "createdAt": "2026-04-28T10:05:00Z"
  }
}
Standard Error Response

Give the DEV team one consistent error format.

{
  "success": false,
  "error": {
    "code": "BLOCKCHAIN_TX_FAILED",
    "message": "Failed to submit transaction to Hyperledger Fabric",
    "details": "Endorsement policy failure",
    "correlationId": "7f7c2a0e-92c8-4f59-ae3c-5d91e983b001",
    "timestamp": "2026-04-28T10:12:00Z"
  }
}
Recommended Error Codes
INVALID_REQUEST
UNAUTHORIZED_SERVICE
FORBIDDEN_OPERATION
CUSTOMER_ALREADY_EXISTS
CUSTOMER_NOT_FOUND
WALLET_ALREADY_EXISTS
WALLET_NOT_FOUND
INSUFFICIENT_BALANCE
BLOCKCHAIN_TX_FAILED
FABRIC_NETWORK_UNAVAILABLE
FABRIC_TIMEOUT
CHAINCODE_ERROR
EVENT_SYNC_PENDING
INTERNAL_SERVER_ERROR
Transaction Status Lifecycle

DEV team should understand this status flow:

RECEIVED
   ↓
VALIDATED
   ↓
SUBMITTED
   ↓
ENDORSED
   ↓
COMMITTED
   ↓
CONFIRMED

Failure states:

VALIDATION_FAILED
SUBMISSION_FAILED
ENDORSEMENT_FAILED
COMMIT_FAILED
EVENT_SYNC_FAILED
REJECTED