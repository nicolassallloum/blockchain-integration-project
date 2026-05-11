🔹 STEP 33 — Spring Boot Integration Design
Spring Boot Backend Integration with Blockchain API
1. Purpose

This document defines how the Spring Boot backend should integrate with the existing Blockchain API used in the Valoores Blockchain Integration Project.

The Spring Boot backend will act as an enterprise middleware layer between the main application and the Blockchain API.

The Blockchain API remains responsible for:

Hyperledger Fabric communication
Wallet creation
Wallet login
Wallet transfers
Organization transfers
Balance queries
Transaction history
Blockchain status checks

The Spring Boot backend will be responsible for:

Calling Blockchain API endpoints securely
Adding required headers
Forwarding JWT when needed
Handling timeout and retry logic
Mapping Blockchain responses to Spring DTOs
Normalizing errors
Logging requests and responses
Propagating correlation IDs across systems
2. High-Level Communication Flow
Frontend / Main Application
        |
        | HTTP Request
        | Authorization: Bearer JWT
        | x-correlation-id
        v
Spring Boot Backend
        |
        | Validate request
        | Validate JWT if required
        | Add x-api-key
        | Forward Authorization if needed
        | Add correlation headers
        v
Blockchain API
        |
        | Validate API Key
        | Validate optional JWT
        | Execute Fabric Gateway call
        | Save off-chain PostgreSQL data
        v
Hyperledger Fabric + PostgreSQL
        |
        v
Blockchain API Response
        |
        v
Spring Boot Backend
        |
        | Map response DTO
        | Normalize error if needed
        | Log audit event
        v
Frontend / Main Application
3. Integration Architecture
3.1 Main Components

The Spring Boot backend should include the following integration components:

src/main/java/com/valoores/blockchainintegration
│
├── config
│   ├── BlockchainApiProperties.java
│   ├── WebClientConfig.java
│
├── controller
│   ├── BlockchainWalletController.java
│   ├── BlockchainTransactionController.java
│   ├── BlockchainQueryController.java
│
├── service
│   ├── BlockchainWalletService.java
│   ├── BlockchainTransactionService.java
│   ├── BlockchainQueryService.java
│
├── client
│   ├── BlockchainApiClient.java
│
├── dto
│   ├── request
│   │   ├── WalletCreateRequest.java
│   │   ├── WalletLoginRequest.java
│   │   ├── WalletTransferRequest.java
│   │   ├── OrganizationTransferRequest.java
│   │
│   ├── response
│   │   ├── WalletCreateResponse.java
│   │   ├── WalletLoginResponse.java
│   │   ├── WalletBalanceResponse.java
│   │   ├── TransactionHistoryResponse.java
│   │   ├── BlockchainApiResponse.java
│
├── exception
│   ├── BlockchainApiException.java
│   ├── BlockchainTimeoutException.java
│   ├── BlockchainUnauthorizedException.java
│   ├── BlockchainBadRequestException.java
│   ├── GlobalExceptionHandler.java
│
├── logging
│   ├── CorrelationIdFilter.java
│   ├── RequestLoggingFilter.java
4. Blockchain API Base Configuration
4.1 Blockchain API Base URL

Example:

blockchain:
  api:
    base-url: http://127.0.0.1:3001/api/v1
    api-key: CHANGE_ME_BLOCKCHAIN_API_KEY
    connect-timeout-ms: 5000
    read-timeout-ms: 15000
    write-timeout-ms: 15000
    retry:
      max-attempts: 3
      backoff-ms: 1000

Recommended environment variable version:

blockchain:
  api:
    base-url: ${BLOCKCHAIN_API_BASE_URL:http://127.0.0.1:3001/api/v1}
    api-key: ${BLOCKCHAIN_API_KEY}
    connect-timeout-ms: ${BLOCKCHAIN_CONNECT_TIMEOUT_MS:5000}
    read-timeout-ms: ${BLOCKCHAIN_READ_TIMEOUT_MS:15000}
    write-timeout-ms: ${BLOCKCHAIN_WRITE_TIMEOUT_MS:15000}
    retry:
      max-attempts: ${BLOCKCHAIN_RETRY_MAX_ATTEMPTS:3}
      backoff-ms: ${BLOCKCHAIN_RETRY_BACKOFF_MS:1000}
5. Required Headers

Every request from Spring Boot to the Blockchain API should include these headers.

5.1 Mandatory Headers
Content-Type: application/json
Accept: application/json
x-api-key: {BLOCKCHAIN_API_KEY}
x-request-id: {generated-or-existing-request-id}
x-correlation-id: {generated-or-existing-correlation-id}
x-source-system: spring-boot-backend
x-request-source: valoores-main-application
5.2 Optional Headers

If the frontend or main application sends a JWT, Spring Boot may forward it:

Authorization: Bearer {JWT_TOKEN}

This is useful if the Blockchain API needs user identity context.

6. Header Propagation Design
6.1 Incoming Request to Spring Boot

The frontend should call Spring Boot using:

Authorization: Bearer {JWT_TOKEN}
x-correlation-id: {UUID}
x-request-id: {UUID}

If the frontend does not send x-correlation-id, Spring Boot should generate one.

6.2 Spring Boot to Blockchain API

Spring Boot should forward:

Authorization: Bearer {JWT_TOKEN}
x-correlation-id: same-correlation-id
x-request-id: same-or-new-request-id
x-api-key: configured-api-key
6.3 Correlation Rules
Header	Rule
x-correlation-id	Same value across the full request journey
x-request-id	Can be same as correlation ID or unique per service call
x-source-system	Always spring-boot-backend
x-request-source	Always valoores-main-application
x-api-key	Added only by Spring Boot, never exposed to frontend
7. API Key Authentication Strategy
7.1 API Key Ownership

The Blockchain API key must be stored only in:

Spring Boot environment variables
Kubernetes secrets
Docker .env
Secure vault

It must never be exposed to:

Angular frontend
Browser localStorage
Browser sessionStorage
Public Git repository
7.2 API Key Injection

Spring Boot should inject the API key automatically in the WebClient layer.

Example header:

x-api-key: ${BLOCKCHAIN_API_KEY}
7.3 Failed API Key Response Handling

If Blockchain API returns:

401 Unauthorized
403 Forbidden

Spring Boot should map this to a controlled enterprise response:

{
  "success": false,
  "message": "Blockchain service authentication failed.",
  "errorCode": "BLOCKCHAIN_AUTH_FAILED",
  "correlationId": "..."
}
8. JWT Forwarding Strategy

JWT forwarding depends on the security model.

8.1 Recommended Approach

Spring Boot should validate the JWT for user authentication.

Then Spring Boot may forward the same JWT to the Blockchain API only if the Blockchain API requires user identity.

Authorization: Bearer {JWT_TOKEN}
8.2 When to Forward JWT

Forward JWT when:

Blockchain API needs user context
Audit logs need authenticated user identity
Blockchain API applies user-level authorization
Blockchain API logs user actions
8.3 When Not to Forward JWT

Do not forward JWT when:

Blockchain API trusts only Spring Boot through API key
User identity is passed in request body
Blockchain API does not validate JWT
8.4 Recommended Final Decision

For this project, use both:

x-api-key: internal blockchain API authentication
Authorization: Bearer JWT: user identity forwarding

This gives:

Service-level security through API key
User-level traceability through JWT
Better audit logging
9. Blockchain API Endpoint Mapping
9.1 Wallet APIs
Spring Boot Endpoint	Blockchain API Endpoint	Method
/api/v1/blockchain/wallets	/api/v1/wallets	POST
/api/v1/blockchain/wallets/login	/api/v1/wallets/login	POST
/api/v1/blockchain/wallets/{walletAddress}	/api/v1/wallets/{walletAddress}	GET
/api/v1/blockchain/wallets/{walletAddress}/balance	/api/v1/wallets/{walletAddress}/balance	GET
9.2 Transaction APIs
Spring Boot Endpoint	Blockchain API Endpoint	Method
/api/v1/blockchain/transactions/wallet-transfer	/api/v1/transactions/wallet-transfer	POST
/api/v1/blockchain/transactions/organization-transfer	/api/v1/transactions/organization-transfer	POST
/api/v1/blockchain/transactions	/api/v1/transactions	GET
/api/v1/blockchain/transactions/{transactionId}	/api/v1/transactions/{transactionId}	GET
9.3 Status APIs
Spring Boot Endpoint	Blockchain API Endpoint	Method
/api/v1/blockchain/status	/api/v1/blockchain/status	GET
/api/v1/blockchain/fabric/status	/api/v1/fabric/status	GET
/api/v1/blockchain/health	/api/v1/health	GET
10. Timeout Strategy

Blockchain calls may take longer than normal database calls because they involve:

Fabric Gateway
Endorsement
Ordering service
Commit confirmation
PostgreSQL off-chain save

Recommended timeout values:

Operation	Timeout
Blockchain health/status	5 seconds
Wallet query	10 seconds
Wallet creation	15 seconds
Wallet login	10 seconds
Wallet transfer	20 seconds
Organization transfer	20 seconds
Transaction history	15 seconds
10.1 Recommended Configuration
blockchain:
  api:
    connect-timeout-ms: 5000
    read-timeout-ms: 20000
    write-timeout-ms: 20000
10.2 Timeout Response

If timeout occurs:

{
  "success": false,
  "message": "Blockchain service did not respond in time.",
  "errorCode": "BLOCKCHAIN_TIMEOUT",
  "correlationId": "..."
}
11. Retry Strategy
11.1 Retryable Operations

Only retry safe operations.

Operation	Retry?	Reason
Health check	Yes	Safe
Status check	Yes	Safe
Wallet query	Yes	Read-only
Balance query	Yes	Read-only
Transaction history	Yes	Read-only
Wallet creation	No by default	May create duplicates
Wallet transfer	No by default	May duplicate money movement
Organization transfer	No by default	May duplicate money movement
11.2 Recommended Retry Policy

For read-only APIs:

Max attempts: 3
Backoff: 1 second
Retry on:
- 502 Bad Gateway
- 503 Service Unavailable
- 504 Gateway Timeout
- Connection timeout
- Network error

Do not retry on:

400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
11.3 Important Rule for Transfers

Transfers must not be retried automatically unless the Blockchain API supports idempotency keys.

Recommended future header:

x-idempotency-key: {UUID}

For now:

No automatic retry for money movement operations.
12. Error Mapping Strategy

Spring Boot should normalize all Blockchain API errors into a consistent enterprise error structure.

12.1 Standard Error Response
{
  "success": false,
  "message": "Readable error message",
  "errorCode": "BLOCKCHAIN_ERROR_CODE",
  "correlationId": "uuid",
  "details": {}
}
12.2 HTTP Error Mapping
Blockchain API Status	Spring Boot Status	Error Code
400	400	BLOCKCHAIN_BAD_REQUEST
401	502 or 401	BLOCKCHAIN_AUTH_FAILED
403	502 or 403	BLOCKCHAIN_FORBIDDEN
404	404	BLOCKCHAIN_RESOURCE_NOT_FOUND
409	409	BLOCKCHAIN_CONFLICT
422	422	BLOCKCHAIN_VALIDATION_ERROR
429	429	BLOCKCHAIN_RATE_LIMITED
500	502	BLOCKCHAIN_INTERNAL_ERROR
502	502	BLOCKCHAIN_BAD_GATEWAY
503	503	BLOCKCHAIN_UNAVAILABLE
504	504	BLOCKCHAIN_TIMEOUT
12.3 Business Error Mapping
Blockchain Message	Spring Error Code
Wallet not found	WALLET_NOT_FOUND
Invalid wallet credentials	WALLET_LOGIN_FAILED
Insufficient balance	INSUFFICIENT_BALANCE
Organization not found	ORGANIZATION_NOT_FOUND
Invalid API KEY	BLOCKCHAIN_AUTH_FAILED
Fabric endorsement failed	FABRIC_ENDORSEMENT_FAILED
Transaction commit failed	FABRIC_COMMIT_FAILED
PostgreSQL save failed	OFFCHAIN_SAVE_FAILED
13. DTO Mapping Design
13.1 Generic Blockchain API Response
public class BlockchainApiResponse<T> {
    private Boolean success;
    private String message;
    private T data;
    private String correlationId;
    private Object error;
}
13.2 Wallet Create Request
public class WalletCreateRequest {
    private String customerId;
    private String fullName;
    private String nationalIdHash;
    private String mobileHash;
    private String emailHash;
    private String organizationId;
    private BigDecimal initialBalance;
    private String currencyCode;
}
13.3 Wallet Create Response
public class WalletCreateResponse {
    private String customerId;
    private String walletAddress;
    private String organizationId;
    private String organizationName;
    private String fullName;
    private BigDecimal currentBalance;
    private String currencyCode;
    private String status;
    private String createdAt;
}
13.4 Wallet Login Request
public class WalletLoginRequest {
    private String customerId;
    private String walletAddress;
    private String pin;
}
13.5 Wallet Login Response
public class WalletLoginResponse {
    private String customerId;
    private String walletAddress;
    private String organizationId;
    private String organizationName;
    private String fullName;
    private BigDecimal currentBalance;
    private String currencyCode;
    private String token;
    private String status;
}
13.6 Wallet Transfer Request
public class WalletTransferRequest {
    private String fromWalletAddress;
    private String toWalletAddress;
    private BigDecimal amount;
    private String currencyCode;
    private String purpose;
    private String description;
}
13.7 Organization Transfer Request
public class OrganizationTransferRequest {
    private String fromWalletAddress;
    private String organizationId;
    private BigDecimal amount;
    private String currencyCode;
    private String purpose;
    private String description;
}
13.8 Transaction Response
public class TransactionResponse {
    private String transactionId;
    private String transactionType;
    private String fromWalletAddress;
    private String toWalletAddress;
    private String organizationId;
    private BigDecimal amount;
    private String currencyCode;
    private String status;
    private String fabricTxId;
    private String createdAt;
}
14. Logging Strategy
14.1 What to Log

Spring Boot should log:

- correlationId
- requestId
- source system
- target endpoint
- HTTP method
- response status
- execution time
- error code
- sanitized error message
14.2 What Not to Log

Never log:

- API key
- JWT token
- PIN
- raw national ID
- raw mobile number
- raw email if sensitive
- private Fabric keys
14.3 Example Log
{
  "timestamp": "2026-05-11T09:30:00Z",
  "level": "INFO",
  "service": "spring-boot-backend",
  "operation": "wallet-transfer",
  "correlationId": "6f7c2b24-2dd3-4db0-a55e-498b9bdf51dd",
  "requestId": "6f7c2b24-2dd3-4db0-a55e-498b9bdf51dd",
  "target": "blockchain-api",
  "endpoint": "/api/v1/transactions/wallet-transfer",
  "status": 200,
  "durationMs": 1380
}
15. Correlation ID Propagation
15.1 Correlation ID Rules

Every incoming request must have a correlation ID.

If missing, Spring Boot should generate one:

UUID.randomUUID().toString()

The same value should be:

Added to MDC logging context
Returned in response headers
Sent to Blockchain API
Included in error responses
15.2 Response Header

Spring Boot should return:

x-correlation-id: {correlationId}
16. Integration Sequence Diagrams
16.1 Wallet Creation Sequence
User / Frontend
    |
    | POST /api/v1/blockchain/wallets
    | Authorization: Bearer JWT
    | x-correlation-id
    v
Spring Boot Backend
    |
    | Validate request body
    | Add x-api-key
    | Forward JWT
    | Add x-correlation-id
    v
Blockchain API
    |
    | Validate x-api-key
    | Validate request
    | Submit CreateWallet to Fabric
    | Save wallet in PostgreSQL
    v
Hyperledger Fabric + PostgreSQL
    |
    | Success
    v
Blockchain API
    |
    | 201 Created
    v
Spring Boot Backend
    |
    | Map response to WalletCreateResponse
    | Log result with correlationId
    v
Frontend
16.2 Wallet Login Sequence
User / Frontend
    |
    | POST /api/v1/blockchain/wallets/login
    v
Spring Boot Backend
    |
    | Validate login request
    | Add API key
    | Add correlation ID
    v
Blockchain API
    |
    | Validate wallet credentials
    | Query wallet from ledger/off-chain DB
    | Return wallet profile
    v
Spring Boot Backend
    |
    | Map wallet profile
    | Return customer session payload
    v
Frontend
    |
    | Store wallet profile in localStorage/sessionStorage
16.3 Wallet-to-Wallet Transfer Sequence
Frontend
    |
    | POST /api/v1/blockchain/transactions/wallet-transfer
    | fromWalletAddress loaded from logged-in wallet session
    v
Spring Boot Backend
    |
    | Validate amount > 0
    | Validate sender wallet exists in session
    | Add API key
    | Add JWT
    | Add correlation ID
    v
Blockchain API
    |
    | Validate API key
    | Validate sender wallet
    | Validate receiver wallet
    | Validate balance
    | Submit TransferBetweenWallets to Fabric
    | Save transaction in PostgreSQL
    v
Hyperledger Fabric + PostgreSQL
    |
    | Commit transaction
    v
Blockchain API
    |
    | Return transaction result
    v
Spring Boot Backend
    |
    | Map response
    | Log transaction metadata
    v
Frontend
16.4 Wallet-to-Organization Transfer Sequence
Frontend
    |
    | POST /api/v1/blockchain/transactions/organization-transfer
    | fromWalletAddress loaded from logged-in wallet session
    v
Spring Boot Backend
    |
    | Validate request
    | Add x-api-key
    | Forward JWT
    | Add correlation headers
    v
Blockchain API
    |
    | Validate organization
    | Validate sender wallet
    | Validate amount
    | Submit TransferToOrganization to Fabric
    | Save transaction in PostgreSQL
    v
Spring Boot Backend
    |
    | Return normalized transaction response
    v
Frontend
17. WebClient Design

Recommended client: Spring WebClient

Reasons:

Non-blocking support
Cleaner timeout handling
Better retry support
Easier header injection
Better error mapping
17.1 WebClient Responsibilities

The WebClient layer should:

- Build target URL
- Inject x-api-key
- Inject correlation headers
- Forward JWT if available
- Apply timeout configuration
- Apply retry for safe read-only calls
- Convert Blockchain errors into Spring exceptions
18. Security Design
18.1 Frontend to Spring Boot
Frontend should authenticate using JWT.
Spring Boot validates JWT.
Frontend never knows Blockchain API key.
18.2 Spring Boot to Blockchain API
Spring Boot authenticates using x-api-key.
Spring Boot may forward Authorization Bearer JWT.
18.3 Sensitive Data Handling

Sensitive values should be hashed before reaching Blockchain API where applicable:

nationalIdHash
mobileHash
emailHash

Never send raw sensitive values to blockchain unless officially required.

19. Validation Rules in Spring Boot

Before sending requests to Blockchain API, Spring Boot should validate:

19.1 Wallet Creation
customerId is required
fullName is required
organizationId is required
currencyCode is required
initialBalance must be >= 0
nationalIdHash is required if used
mobileHash is required if used
emailHash is optional depending on business rule
19.2 Wallet Transfer
fromWalletAddress is required
toWalletAddress is required
amount must be greater than 0
currencyCode is required
purpose is optional
description is optional
fromWalletAddress cannot equal toWalletAddress
19.3 Organization Transfer
fromWalletAddress is required
organizationId is required
amount must be greater than 0
currencyCode is required
purpose is optional
description is optional
20. Recommended Package-Level Responsibility
Controller Layer

Responsible for:

- Accepting HTTP requests
- Reading JWT/correlation headers
- Calling service layer
- Returning normalized responses
Service Layer

Responsible for:

- Business validation
- Request enrichment
- Calling BlockchainApiClient
- Mapping responses
Client Layer

Responsible for:

- External Blockchain API communication
- Headers
- Timeout
- Retry
- Error conversion
Exception Layer

Responsible for:

- Global error handling
- Normalized error responses
- HTTP status mapping
21. Example End-to-End Request
21.1 Frontend to Spring Boot
POST /api/v1/blockchain/transactions/wallet-transfer
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
x-correlation-id: 09fc7858-18ab-4e13-9636-c8aa8924e213
{
  "fromWalletAddress": "WALLET_1001",
  "toWalletAddress": "WALLET_2001",
  "amount": 25.00,
  "currencyCode": "USD",
  "purpose": "Customer Transfer",
  "description": "Wallet transfer test"
}
21.2 Spring Boot to Blockchain API
POST /api/v1/transactions/wallet-transfer
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json
Accept: application/json
x-api-key: ********
x-correlation-id: 09fc7858-18ab-4e13-9636-c8aa8924e213
x-request-id: 09fc7858-18ab-4e13-9636-c8aa8924e213
x-source-system: spring-boot-backend
x-request-source: valoores-main-application
21.3 Spring Boot Response to Frontend
{
  "success": true,
  "message": "Wallet transfer completed successfully.",
  "data": {
    "transactionId": "TXN-20260511-000001",
    "transactionType": "WALLET_TO_WALLET",
    "fromWalletAddress": "WALLET_1001",
    "toWalletAddress": "WALLET_2001",
    "amount": 25.00,
    "currencyCode": "USD",
    "status": "COMPLETED",
    "fabricTxId": "8f7a9c...",
    "createdAt": "2026-05-11T09:30:00"
  },
  "correlationId": "09fc7858-18ab-4e13-9636-c8aa8924e213"
}
22. Production Readiness Checklist
Security
[ ] Blockchain API key stored in environment variable
[ ] API key not exposed to frontend
[ ] JWT validation enabled in Spring Boot
[ ] JWT forwarding enabled only if required
[ ] Sensitive values masked in logs
Reliability
[ ] Timeout configured
[ ] Retry configured only for read-only APIs
[ ] No retry for transfers unless idempotency is implemented
[ ] Circuit breaker planned for future
[ ] Blockchain API downtime handled gracefully
Observability
[ ] Correlation ID generated if missing
[ ] Correlation ID forwarded to Blockchain API
[ ] MDC logging enabled
[ ] Request duration logged
[ ] Error codes logged
[ ] API key and JWT masked
Integration
[ ] Wallet creation endpoint mapped
[ ] Wallet login endpoint mapped
[ ] Wallet query endpoint mapped
[ ] Balance query endpoint mapped
[ ] Wallet transfer endpoint mapped
[ ] Organization transfer endpoint mapped
[ ] Transaction history endpoint mapped
[ ] Blockchain status endpoint mapped
23. Final Recommended Design Decision

The Spring Boot backend should integrate with the Blockchain API using this model:

Frontend
  -> Spring Boot Backend using JWT
  -> Blockchain API using x-api-key + optional forwarded JWT
  -> Hyperledger Fabric + PostgreSQL

The recommended integration client is:

Spring WebClient

The recommended security approach is:

JWT for user identity
x-api-key for service-to-service authentication
correlation ID for full request traceability

The recommended retry approach is:

Retry only read-only operations
Do not retry wallet creation or transfer operations unless idempotency keys are implemented

The recommended logging approach is:

Structured JSON logs with correlationId, requestId, endpoint, duration, status, and sanitized error details
24. DEV Team Implementation Summary

The DEV team should implement:

1. BlockchainApiProperties.java
2. WebClientConfig.java
3. CorrelationIdFilter.java
4. BlockchainApiClient.java
5. Wallet DTOs
6. Transaction DTOs
7. Blockchain response DTOs
8. BlockchainWalletService.java
9. BlockchainTransactionService.java
10. BlockchainQueryService.java
11. Wallet controller
12. Transaction controller
13. Query controller
14. Global exception handler
15. Timeout and retry configuration
16. Structured logging with MDC
17. API key injection
18. JWT forwarding
19. Error mapping
20. Integration test cases