🔹 STEP 9 — Ledger Data Model Design
Blockchain Integration Project
Final Updated Document — Completed Version
1. Step Objective

The objective of Step 9 — Ledger Data Model Design is to define the full blockchain ledger data model that will be used by the Blockchain API, Hyperledger Fabric chaincode, CouchDB state database, and PostgreSQL mapping layer.

This step defines:

1. What data will be stored on-chain
2. What data will stay in PostgreSQL
3. Ledger asset structures
4. JSON models for chaincode
5. CouchDB indexing strategy
6. PostgreSQL mapping tables
7. Relationship between enterprise data and blockchain data
8. Server verification status
9. Completion checklist

The ledger does not replace PostgreSQL.

The ledger stores:

Trusted, immutable, auditable blockchain business facts.

PostgreSQL stores:

Operational data, application data, reporting data, reconciliation data, logs, and dashboard data.

This document updates the original Step 9 design and includes the actual completed work from your server environment.

2. Confirmed Environment
Server Path
/home/nix/u01/blockchain-integration
Fabric Network Path
/home/nix/u01/blockchain-integration/fabric-network
Step 9 Folder Path
/home/nix/u01/blockchain-integration/step-09-ledger-data-model
PostgreSQL Database
Host: 172.31.13.133
Port: 5444
Database: vfds_dev
User: postgres
Schema: blockchain
Hyperledger Fabric Runtime Status

The Fabric runtime has been verified and is running.

✅ orderer.blockchain.local
✅ peer0.org1.blockchain.local
✅ peer0.org2.blockchain.local
✅ couchdb0.org1
✅ couchdb0.org2
✅ ca.org1.blockchain.local
✅ ca.org2.blockchain.local
✅ ca.orderer.blockchain.local
3. Step 9 Folder Structure

The following folder structure was created:

step-09-ledger-data-model/
├── chaincode-models
├── couchdb-indexes
├── docs
├── postgresql
└── samples

Confirmed folder verification command:

cd /home/nix/u01/blockchain-integration/step-09-ledger-data-model

find . -maxdepth 2 -type d | sort

Confirmed result:

.
./chaincode-models
./couchdb-indexes
./docs
./postgresql
./samples

Status:

✅ DONE
4. Ledger Data Ownership Rule
What Goes on the Ledger
Data Type	Store on Ledger?	Reason
Wallet identity	Yes	Needed for trusted wallet ownership
Wallet public address	Yes	Core blockchain identifier
Customer reference ID	Yes	Links blockchain wallet to enterprise customer
Organization reference ID	Yes	Links blockchain organization to enterprise data
Transaction record	Yes	Immutable transaction history
Balance snapshot	Optional / Recommended	Useful for fast blockchain-side balance queries
Audit metadata	Yes	Required for traceability
Passwords	No	Never store passwords on-chain
JWT tokens	No	Application security only
OTP values	No	Sensitive and temporary
Private keys	No	Must never be stored on-chain
Recovery words	No	Must never be stored on-chain
Full customer KYC data	No	Keep in PostgreSQL or enterprise systems
Login attempts	Usually No	Store in PostgreSQL unless proof-level audit is required
5. Main Ledger Assets

The ledger model includes the following assets:

1. WalletAsset
2. OrganizationAsset
3. TransactionAsset
4. BalanceAsset
5. AuthMetadataAsset
6. AuditMetadata
6. Global Ledger Key Strategy

Each ledger record should use a deterministic key.

Recommended Ledger Key Format
WALLET#{walletAddress}
ORG#{organizationId}
TX#{transactionId}
BALANCE#{walletAddress}
AUTH#{walletAddress}
AUDIT#{auditId}
Examples
WALLET#wallet_9f8a7c2e001
ORG#BANK001
TX#TXN202604290001
BALANCE#wallet_9f8a7c2e001
AUTH#wallet_9f8a7c2e001
AUDIT#AUD202604290001

This makes ledger records easier to query, debug, synchronize, and audit.

7. Wallet Asset
Purpose

The WalletAsset represents a blockchain wallet owned by a customer, organization, bank, merchant, or system account.

The wallet is stored on-chain, but the full customer profile remains in PostgreSQL or the enterprise customer system.

Wallet JSON Structure
{
  "docType": "WALLET",
  "walletAddress": "wallet_9f8a7c2e001",
  "walletType": "CUSTOMER",
  "ownerType": "CUSTOMER",
  "ownerReferenceId": "CUST1000001",
  "enterpriseCustomerId": "CUST1000001",
  "organizationId": "BANK001",
  "status": "ACTIVE",
  "currency": "USD",
  "createdBy": "system-api",
  "createdAt": "2026-04-29T10:30:00Z",
  "updatedAt": "2026-04-29T10:30:00Z",
  "version": 1,
  "audit": {
    "createdByUserId": "api-user-001",
    "createdByOrgId": "BANK001",
    "sourceSystem": "SpringBoot-CoreBanking",
    "requestId": "REQ-20260429-0001",
    "correlationId": "CORR-20260429-0001"
  }
}
Wallet Fields
Field	Type	Required	Description
docType	string	Yes	Always WALLET
walletAddress	string	Yes	Unique blockchain wallet address
walletType	string	Yes	CUSTOMER, BANK, MERCHANT, SYSTEM
ownerType	string	Yes	Owner category
ownerReferenceId	string	Yes	Owner ID from enterprise system
enterpriseCustomerId	string	Optional	Customer ID from PostgreSQL or core system
organizationId	string	Yes	Organization that owns or issued the wallet
status	string	Yes	ACTIVE, SUSPENDED, CLOSED, BLACKLISTED
currency	string	Yes	Wallet currency
createdBy	string	Yes	System or API user
createdAt	string	Yes	ISO timestamp
updatedAt	string	Yes	ISO timestamp
version	number	Yes	Asset version
audit	object	Yes	Audit metadata
PostgreSQL Relationship
Ledger.WalletAsset.walletAddress
=
PostgreSQL.blockchain.blockchain_wallet.wallet_address
Ledger.WalletAsset.enterpriseCustomerId
=
Enterprise Customer ID / PostgreSQL customer reference
8. Organization Asset
Purpose

The OrganizationAsset represents banks, companies, merchants, government entities, or financial institutions participating in the blockchain network.

Organization JSON Structure
{
  "docType": "ORGANIZATION",
  "organizationId": "BANK001",
  "organizationName": "Example Bank SAL",
  "organizationType": "BANK",
  "registrationNumber": "REG-987654",
  "countryCode": "LB",
  "status": "ACTIVE",
  "defaultCurrency": "USD",
  "createdAt": "2026-04-29T10:30:00Z",
  "updatedAt": "2026-04-29T10:30:00Z",
  "version": 1,
  "audit": {
    "createdByUserId": "admin001",
    "createdByOrgId": "NETWORK_ADMIN",
    "sourceSystem": "Blockchain-Admin-Portal",
    "requestId": "REQ-20260429-0002",
    "correlationId": "CORR-20260429-0002"
  }
}
Organization Fields
Field	Type	Required	Description
docType	string	Yes	Always ORGANIZATION
organizationId	string	Yes	Unique organization ID
organizationName	string	Yes	Legal or display name
organizationType	string	Yes	BANK, MERCHANT, GOVERNMENT, FINTECH, SYSTEM
registrationNumber	string	Optional	Legal registration reference
countryCode	string	Yes	ISO country code
status	string	Yes	ACTIVE, SUSPENDED, CLOSED
defaultCurrency	string	Yes	Default operating currency
createdAt	string	Yes	ISO timestamp
updatedAt	string	Yes	ISO timestamp
version	number	Yes	Asset version
audit	object	Yes	Audit metadata
PostgreSQL Relationship
Ledger.OrganizationAsset.organizationId
=
PostgreSQL.blockchain.blockchain_organization.organization_id
9. Transaction Asset
Purpose

The TransactionAsset represents an immutable blockchain transaction between wallets or organizations.

It is one of the most important ledger assets because it stores the official blockchain transaction proof.

Transaction JSON Structure
{
  "docType": "TRANSACTION",
  "transactionId": "TXN202604290001",
  "transactionType": "WALLET_TRANSFER",
  "fromWalletAddress": "wallet_sender_001",
  "toWalletAddress": "wallet_receiver_001",
  "fromOrganizationId": "BANK001",
  "toOrganizationId": "BANK002",
  "amount": "250.00",
  "currency": "USD",
  "status": "COMPLETED",
  "businessReferenceId": "PAYMENT-REQ-10001",
  "enterpriseTransactionId": "CORE-TXN-800001",
  "description": "Wallet to wallet transfer",
  "createdAt": "2026-04-29T10:45:00Z",
  "completedAt": "2026-04-29T10:45:02Z",
  "version": 1,
  "audit": {
    "createdByUserId": "api-user-001",
    "createdByOrgId": "BANK001",
    "sourceSystem": "SpringBoot-CoreBanking",
    "requestId": "REQ-20260429-0003",
    "correlationId": "CORR-20260429-0003",
    "clientIp": "172.31.13.90"
  }
}
Transaction Fields
Field	Type	Required	Description
docType	string	Yes	Always TRANSACTION
transactionId	string	Yes	Unique blockchain transaction reference
transactionType	string	Yes	Type of transfer
fromWalletAddress	string	Yes	Sender wallet
toWalletAddress	string	Yes	Receiver wallet
fromOrganizationId	string	Optional	Sender organization
toOrganizationId	string	Optional	Receiver organization
amount	string	Yes	Amount stored as string to avoid floating-point issues
currency	string	Yes	Transaction currency
status	string	Yes	PENDING, COMPLETED, FAILED, REVERSED
businessReferenceId	string	Optional	External business request ID
enterpriseTransactionId	string	Optional	PostgreSQL or core banking transaction ID
description	string	Optional	Business description
createdAt	string	Yes	Transaction creation timestamp
completedAt	string	Optional	Completion timestamp
version	number	Yes	Asset version
audit	object	Yes	Audit metadata
Recommended Transaction Types
WALLET_TRANSFER
ORGANIZATION_TRANSFER
BANK_TO_BANK_TRANSFER
CUSTOMER_TO_BANK_TRANSFER
BANK_TO_CUSTOMER_TRANSFER
SYSTEM_ADJUSTMENT
REVERSAL
PostgreSQL Relationship
Ledger.TransactionAsset.transactionId
=
PostgreSQL.blockchain.blockchain_transaction.transaction_id
Ledger.TransactionAsset.enterpriseTransactionId
=
PostgreSQL.blockchain.blockchain_transaction.enterprise_transaction_id
10. Balance Asset
Purpose

The BalanceAsset stores the current blockchain balance of a wallet.

This is recommended for performance because calculating balance from transaction history every time is expensive.

Balance JSON Structure
{
  "docType": "BALANCE",
  "walletAddress": "wallet_9f8a7c2e001",
  "organizationId": "BANK001",
  "currency": "USD",
  "availableBalance": "1500.00",
  "blockedBalance": "0.00",
  "totalBalance": "1500.00",
  "lastTransactionId": "TXN202604290001",
  "lastUpdatedAt": "2026-04-29T10:45:02Z",
  "version": 4,
  "audit": {
    "updatedByUserId": "api-user-001",
    "updatedByOrgId": "BANK001",
    "sourceSystem": "Blockchain-API",
    "requestId": "REQ-20260429-0003",
    "correlationId": "CORR-20260429-0003"
  }
}
Balance Fields
Field	Type	Required	Description
docType	string	Yes	Always BALANCE
walletAddress	string	Yes	Wallet address
organizationId	string	Yes	Wallet organization
currency	string	Yes	Balance currency
availableBalance	string	Yes	Spendable balance
blockedBalance	string	Yes	Held or frozen amount
totalBalance	string	Yes	Available + blocked
lastTransactionId	string	Optional	Last transaction affecting balance
lastUpdatedAt	string	Yes	Last update timestamp
version	number	Yes	Version number
audit	object	Yes	Audit metadata
PostgreSQL Relationship
Ledger.BalanceAsset.walletAddress
=
PostgreSQL.blockchain.blockchain_wallet_balance.wallet_address
11. Auth Metadata Asset
Important Security Rule

The following must never be stored on-chain:

Passwords
OTP values
JWT tokens
Session tokens
Private keys
Recovery words
Full login credentials

The ledger may store only non-sensitive authentication proof/status if required.

Auth Metadata JSON Structure
{
  "docType": "AUTH_METADATA",
  "walletAddress": "wallet_9f8a7c2e001",
  "ownerReferenceId": "CUST1000001",
  "authStatus": "ACTIVE",
  "lastLoginAt": "2026-04-29T09:15:00Z",
  "lastLoginChannel": "WEB",
  "failedLoginCount": 0,
  "isLocked": false,
  "lockedAt": null,
  "updatedAt": "2026-04-29T09:15:00Z",
  "version": 2,
  "audit": {
    "updatedByUserId": "auth-service",
    "updatedByOrgId": "BANK001",
    "sourceSystem": "SpringBoot-Auth-Service",
    "requestId": "REQ-20260429-0004",
    "correlationId": "CORR-20260429-0004"
  }
}
Auth Metadata Fields
Field	Type	Required	Description
docType	string	Yes	Always AUTH_METADATA
walletAddress	string	Yes	Related wallet
ownerReferenceId	string	Yes	Customer or organization reference
authStatus	string	Yes	ACTIVE, LOCKED, SUSPENDED
lastLoginAt	string	Optional	Last login timestamp
lastLoginChannel	string	Optional	WEB, MOBILE, API
failedLoginCount	number	Yes	Failed login counter
isLocked	boolean	Yes	Lock flag
lockedAt	string/null	Optional	Lock timestamp
updatedAt	string	Yes	Last update timestamp
version	number	Yes	Version
audit	object	Yes	Audit metadata
Recommended Placement
Sensitive authentication data: PostgreSQL only
Proof-level auth status: Optional on ledger
12. Audit Metadata
Purpose

Audit metadata should exist inside every important ledger asset.

It provides traceability across:

Angular / DEV Application
        ↓
Spring Boot
        ↓
Blockchain API
        ↓
Hyperledger Fabric
        ↓
CouchDB / PostgreSQL
Standard Audit JSON Structure
{
  "createdByUserId": "api-user-001",
  "createdByOrgId": "BANK001",
  "updatedByUserId": "api-user-001",
  "updatedByOrgId": "BANK001",
  "sourceSystem": "SpringBoot-CoreBanking",
  "requestId": "REQ-20260429-0001",
  "correlationId": "CORR-20260429-0001",
  "clientIp": "172.31.13.90",
  "channelName": "kycchannelnix1",
  "chaincodeName": "blockchain-integration",
  "fabricTxId": "FABRIC-TX-ID-HERE"
}
Audit Fields
Field	Type	Required	Description
createdByUserId	string	Optional	User or service that created record
createdByOrgId	string	Optional	Creating organization
updatedByUserId	string	Optional	Last updater
updatedByOrgId	string	Optional	Updating organization
sourceSystem	string	Yes	Calling system
requestId	string	Yes	API request ID
correlationId	string	Yes	End-to-end tracking ID
clientIp	string	Optional	Client IP
channelName	string	Optional	Fabric channel
chaincodeName	string	Optional	Chaincode name
fabricTxId	string	Optional	Fabric transaction ID
13. PostgreSQL Mapping Tables — Completed

PostgreSQL mapping tables were created successfully in:

Database: vfds_dev
Schema: blockchain
Host: 172.31.13.133
Port: 5444
Confirmed Tables
✅ blockchain.blockchain_audit_log
✅ blockchain.blockchain_auth_metadata
✅ blockchain.blockchain_organization
✅ blockchain.blockchain_transaction
✅ blockchain.blockchain_wallet
✅ blockchain.blockchain_wallet_balance
Existing Related Blockchain Tables

The schema also contains existing blockchain-related tables:

✅ blockchain.fabric_transactions
✅ blockchain.kyc_hashes
✅ blockchain.kyc_requests
✅ blockchain.kyc_users
14. PostgreSQL Indexes — Completed

Confirmed indexes:

✅ blockchain_audit_log_pkey
✅ idx_blockchain_audit_entity
✅ idx_blockchain_audit_request

✅ blockchain_auth_metadata_pkey

✅ blockchain_organization_pkey

✅ blockchain_transaction_pkey
✅ idx_blockchain_tx_business_ref
✅ idx_blockchain_tx_created_at
✅ idx_blockchain_tx_enterprise_txn
✅ idx_blockchain_tx_from_wallet
✅ idx_blockchain_tx_to_wallet

✅ blockchain_wallet_pkey
✅ blockchain_wallet_wallet_address_key
✅ idx_blockchain_wallet_customer
✅ idx_blockchain_wallet_org
✅ idx_blockchain_wallet_status

✅ blockchain_wallet_balance_pkey

Status:

✅ PostgreSQL mapping tables completed
✅ PostgreSQL indexes completed
15. PostgreSQL Verification Commands

Used command:

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev

Verify tables:

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

Verify indexes:

SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'blockchain'
ORDER BY tablename, indexname;
16. CouchDB Index Files — Completed

The following CouchDB index files were saved:

✅ couchdb-indexes/organization-indexes.json
✅ couchdb-indexes/transaction-indexes.json
✅ couchdb-indexes/balance-indexes.json
✅ couchdb-indexes/wallet-indexes.json
✅ couchdb-indexes/auth-indexes.json

Status:

✅ CouchDB index files saved
17. CouchDB Indexing Strategy
Wallet Indexes
{
  "index": {
    "fields": ["docType", "walletAddress"]
  },
  "name": "idxWalletByAddress",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "enterpriseCustomerId"]
  },
  "name": "idxWalletByCustomer",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "organizationId"]
  },
  "name": "idxWalletByOrganization",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "status"]
  },
  "name": "idxWalletByStatus",
  "type": "json"
}
Organization Indexes
{
  "index": {
    "fields": ["docType", "organizationId"]
  },
  "name": "idxOrganizationById",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "organizationType"]
  },
  "name": "idxOrganizationByType",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "status"]
  },
  "name": "idxOrganizationByStatus",
  "type": "json"
}
Transaction Indexes
{
  "index": {
    "fields": ["docType", "transactionId"]
  },
  "name": "idxTransactionById",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "fromWalletAddress"]
  },
  "name": "idxTransactionBySenderWallet",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "toWalletAddress"]
  },
  "name": "idxTransactionByReceiverWallet",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "enterpriseTransactionId"]
  },
  "name": "idxTransactionByEnterpriseTxn",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "createdAt"]
  },
  "name": "idxTransactionByCreatedAt",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "status"]
  },
  "name": "idxTransactionByStatus",
  "type": "json"
}
Balance Indexes
{
  "index": {
    "fields": ["docType", "walletAddress"]
  },
  "name": "idxBalanceByWallet",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "organizationId"]
  },
  "name": "idxBalanceByOrganization",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "currency"]
  },
  "name": "idxBalanceByCurrency",
  "type": "json"
}
Auth Metadata Indexes
{
  "index": {
    "fields": ["docType", "walletAddress"]
  },
  "name": "idxAuthByWallet",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "authStatus"]
  },
  "name": "idxAuthByStatus",
  "type": "json"
}
{
  "index": {
    "fields": ["docType", "isLocked"]
  },
  "name": "idxAuthByLockedStatus",
  "type": "json"
}
18. CouchDB Verification
Org1 CouchDB
docker exec couchdb0.org1 curl -u admin:adminpw http://localhost:5984

Expected:

{
  "couchdb": "Welcome",
  "version": "3.5.1"
}
Org2 CouchDB
docker exec couchdb0.org2 curl -u admin:adminpw http://localhost:5984

Expected:

{
  "couchdb": "Welcome",
  "version": "3.5.1"
}

Status:

✅ CouchDB Org1 verified
✅ CouchDB Org2 verified
19. PostgreSQL vs Ledger Responsibility Matrix
Entity	PostgreSQL Responsibility	Ledger Responsibility
Customer	Full customer/KYC profile	Customer reference only
Organization	Full organization profile and reporting data	Trusted organization proof
Wallet	Operational wallet table, status, dashboard queries	Immutable wallet identity
Transaction	Reporting, reconciliation, dashboard analytics	Official transaction proof
Balance	Dashboard queries, reconciliation	Trusted current state
Auth	Login, password, OTP, session handling	Optional non-sensitive auth proof
Audit	API logs, request/response logs	Immutable request/correlation proof
20. Recommended Go Chaincode Structs
Audit Struct
type Audit struct {
    CreatedByUserId string `json:"createdByUserId,omitempty"`
    CreatedByOrgId  string `json:"createdByOrgId,omitempty"`
    UpdatedByUserId string `json:"updatedByUserId,omitempty"`
    UpdatedByOrgId  string `json:"updatedByOrgId,omitempty"`
    SourceSystem    string `json:"sourceSystem"`
    RequestId       string `json:"requestId"`
    CorrelationId   string `json:"correlationId"`
    ClientIp        string `json:"clientIp,omitempty"`
    ChannelName     string `json:"channelName,omitempty"`
    ChaincodeName   string `json:"chaincodeName,omitempty"`
    FabricTxId      string `json:"fabricTxId,omitempty"`
}
Wallet Struct
type Wallet struct {
    DocType              string `json:"docType"`
    WalletAddress        string `json:"walletAddress"`
    WalletType           string `json:"walletType"`
    OwnerType            string `json:"ownerType"`
    OwnerReferenceId     string `json:"ownerReferenceId"`
    EnterpriseCustomerId string `json:"enterpriseCustomerId,omitempty"`
    OrganizationId       string `json:"organizationId"`
    Status               string `json:"status"`
    Currency             string `json:"currency"`
    CreatedBy            string `json:"createdBy"`
    CreatedAt            string `json:"createdAt"`
    UpdatedAt            string `json:"updatedAt"`
    Version              int    `json:"version"`
    Audit                Audit  `json:"audit"`
}
Organization Struct
type Organization struct {
    DocType            string `json:"docType"`
    OrganizationId     string `json:"organizationId"`
    OrganizationName   string `json:"organizationName"`
    OrganizationType   string `json:"organizationType"`
    RegistrationNumber string `json:"registrationNumber,omitempty"`
    CountryCode        string `json:"countryCode"`
    Status             string `json:"status"`
    DefaultCurrency    string `json:"defaultCurrency"`
    CreatedAt          string `json:"createdAt"`
    UpdatedAt          string `json:"updatedAt"`
    Version            int    `json:"version"`
    Audit              Audit  `json:"audit"`
}
Transaction Struct
type Transaction struct {
    DocType                 string `json:"docType"`
    TransactionId           string `json:"transactionId"`
    TransactionType         string `json:"transactionType"`
    FromWalletAddress       string `json:"fromWalletAddress"`
    ToWalletAddress         string `json:"toWalletAddress"`
    FromOrganizationId      string `json:"fromOrganizationId,omitempty"`
    ToOrganizationId        string `json:"toOrganizationId,omitempty"`
    Amount                  string `json:"amount"`
    Currency                string `json:"currency"`
    Status                  string `json:"status"`
    BusinessReferenceId     string `json:"businessReferenceId,omitempty"`
    EnterpriseTransactionId string `json:"enterpriseTransactionId,omitempty"`
    Description             string `json:"description,omitempty"`
    CreatedAt               string `json:"createdAt"`
    CompletedAt             string `json:"completedAt,omitempty"`
    Version                 int    `json:"version"`
    Audit                   Audit  `json:"audit"`
}
Balance Struct
type Balance struct {
    DocType           string `json:"docType"`
    WalletAddress     string `json:"walletAddress"`
    OrganizationId    string `json:"organizationId"`
    Currency          string `json:"currency"`
    AvailableBalance  string `json:"availableBalance"`
    BlockedBalance    string `json:"blockedBalance"`
    TotalBalance      string `json:"totalBalance"`
    LastTransactionId string `json:"lastTransactionId,omitempty"`
    LastUpdatedAt     string `json:"lastUpdatedAt"`
    Version           int    `json:"version"`
    Audit             Audit  `json:"audit"`
}
Auth Metadata Struct
type AuthMetadata struct {
    DocType          string `json:"docType"`
    WalletAddress    string `json:"walletAddress"`
    OwnerReferenceId string `json:"ownerReferenceId"`
    AuthStatus       string `json:"authStatus"`
    LastLoginAt      string `json:"lastLoginAt,omitempty"`
    LastLoginChannel string `json:"lastLoginChannel,omitempty"`
    FailedLoginCount int    `json:"failedLoginCount"`
    IsLocked         bool   `json:"isLocked"`
    LockedAt         string `json:"lockedAt,omitempty"`
    UpdatedAt        string `json:"updatedAt"`
    Version          int    `json:"version"`
    Audit            Audit  `json:"audit"`
}
21. Chaincode Function Recommendations

The ledger model should support these chaincode functions:

CreateWallet
GetWallet
UpdateWalletStatus
CreateOrganization
GetOrganization
CreateTransaction
GetTransaction
GetTransactionsByWallet
GetTransactionsByOrganization
CreateOrUpdateBalance
GetBalance
UpdateAuthMetadata
GetAuthMetadata
GetAssetHistory
22. Validation Rules
Wallet Validation
walletAddress must be unique
walletType must be valid
ownerReferenceId is required
organizationId must exist
status must be valid
currency must be valid
Organization Validation
organizationId must be unique
organizationName is required
organizationType must be valid
countryCode is required
status must be valid
Transaction Validation
transactionId must be unique
fromWalletAddress must exist
toWalletAddress must exist
amount must be greater than zero
currency must match wallet currency rules
sender balance must be sufficient
status must be valid
duplicate businessReferenceId should be rejected or handled idempotently
Balance Validation
walletAddress must exist
availableBalance cannot be negative
blockedBalance cannot be negative
totalBalance = availableBalance + blockedBalance
lastTransactionId should reference valid transaction
23. Idempotency Design

The API and chaincode should support idempotency to prevent duplicate transactions.

Recommended Idempotency Fields
{
  "requestId": "REQ-20260429-0001",
  "correlationId": "CORR-20260429-0001",
  "businessReferenceId": "PAYMENT-REQ-10001"
}
Rule
Before creating a transaction:

If the same businessReferenceId or requestId already exists:
    Return the existing transaction

Else:
    Create a new transaction
24. Asset Relationship Diagram
Enterprise Customer
        |
        | enterpriseCustomerId
        v
+------------------+
|   WalletAsset    |
+------------------+
        |
        | walletAddress
        v
+------------------+
|   BalanceAsset   |
+------------------+

WalletAsset  ---> TransactionAsset <--- WalletAsset
   Sender              Transfer            Receiver

OrganizationAsset ---> WalletAsset
OrganizationAsset ---> TransactionAsset

PostgreSQL stores:
- Customer profile
- API logs
- Reporting data
- Dashboard data
- Reconciliation data
- Mapping tables

Ledger stores:
- Wallet proof
- Organization proof
- Transaction proof
- Balance state
- Audit metadata
25. Fabric Runtime Verification Commands
Check Containers
cd /home/nix/u01/blockchain-integration/fabric-network

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Expected running containers:

orderer.blockchain.local
peer0.org1.blockchain.local
peer0.org2.blockchain.local
couchdb0.org1
couchdb0.org2
ca.org1.blockchain.local
ca.org2.blockchain.local
ca.orderer.blockchain.local
Check Orderer Logs
docker logs orderer.blockchain.local --tail=30

Expected successful message:

Beginning to serve requests
Check Org1 Peer Logs
docker logs peer0.org1.blockchain.local --tail=50

Expected successful message:

Started peer with ID=[peer0.org1.blockchain.local]
Check Org2 Peer Logs
docker logs peer0.org2.blockchain.local --tail=50

Expected successful message:

Started peer with ID=[peer0.org2.blockchain.local]
26. Issues Fixed During Step 9
Issue 1 — Wrong CouchDB Container Name

Originally checked:

docker exec -it couchdb0 bash

This failed because the actual containers are:

couchdb0.org1
couchdb0.org2

Correct commands:

docker exec couchdb0.org1 curl -u admin:adminpw http://localhost:5984
docker exec couchdb0.org2 curl -u admin:adminpw http://localhost:5984

Status:

✅ FIXED
Issue 2 — Peer and Orderer Containers Were Stopped

The following containers were initially stopped:

peer0.org1.blockchain.local
peer0.org2.blockchain.local
orderer.blockchain.local

The logs showed missing MSP signer certificate paths inside containers.

After checking MSP folders and Docker mounts, the volume mapping was corrected/recreated.

Status:

✅ FIXED
Issue 3 — Org1 Peer TLS Key Mismatch

Org1 peer initially failed with:

tls: private key does not match public key

This was caused by a TLS server.key and server.crt mismatch.

After correcting the TLS key/certificate pair and restarting Org1 peer, the peer started successfully.

Confirmed log:

Started peer with ID=[peer0.org1.blockchain.local]

Status:

✅ FIXED
27. Final Step 9 Completion Checklist
Task	Status
Ledger data model designed	✅ Done
Wallet asset defined	✅ Done
Organization asset defined	✅ Done
Transaction asset defined	✅ Done
Balance asset defined	✅ Done
Auth metadata asset defined	✅ Done
Audit metadata defined	✅ Done
PostgreSQL responsibility defined	✅ Done
Ledger responsibility defined	✅ Done
PostgreSQL mapping tables created	✅ Done
PostgreSQL indexes created	✅ Done
CouchDB index files saved	✅ Done
Step 9 folders created	✅ Done
CouchDB Org1 verified	✅ Done
CouchDB Org2 verified	✅ Done
Orderer verified	✅ Done
Peer Org1 verified	✅ Done
Peer Org2 verified	✅ Done
CA containers verified	✅ Done
Server issues fixed	✅ Done
28. Final Step 9 Status
🔹 STEP 9 — Ledger Data Model Design

STATUS: COMPLETED

Completed items:

✅ Ledger model designed
✅ Server folder structure created
✅ PostgreSQL mapping tables created
✅ PostgreSQL indexes created
✅ CouchDB index files saved
✅ CouchDB verified
✅ Fabric runtime verified
✅ Orderer running
✅ Peer Org1 running
✅ Peer Org2 running
✅ CA containers running
✅ Environment issues fixed
29. Output Ready For

This Step 9 output is ready to be used for:

1. Hyperledger Fabric chaincode development
2. Blockchain API implementation
3. PostgreSQL synchronization
4. CouchDB index deployment
5. Spring Boot integration
6. Audit and transaction traceability
7. Wallet lifecycle management
8. Organization lifecycle management
9. Transaction lifecycle management
10. Step 10 chaincode implementation
30. Recommended Next Step
🔹 STEP 10 — Chaincode Design and Implementation

In Step 10, you should create the actual Go chaincode using this ledger model and implement:

CreateWallet
GetWallet
UpdateWalletStatus
CreateOrganization
GetOrganization
CreateTransaction
GetTransaction
GetTransactionsByWallet
GetTransactionsByOrganization
CreateOrUpdateBalance
GetBalance
UpdateAuthMetadata
GetAuthMetadata
GetAssetHistory