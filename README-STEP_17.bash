🔹 STEP 17 — Blockchain-to-Database Sync Strategy
Blockchain Integration Project
Hyperledger Fabric → PostgreSQL Synchronization Strategy
1. Objective

The goal of Step 17 — Blockchain-to-Database Sync Strategy is to define how blockchain ledger data from Hyperledger Fabric will be synchronized into the PostgreSQL off-chain database designed in Step 16.

This step ensures that:

Hyperledger Fabric remains the source of truth
PostgreSQL becomes the query, reporting, integration, and audit database
Data is synchronized securely, consistently, and without duplication
Failed synchronization events can be retried
Ledger and database records can be reconciled
APIs and downstream systems can read from PostgreSQL without directly querying the blockchain
2. High-Level Sync Architecture
Angular / Spring Boot Application
            |
            v
Blockchain API / Middleware
            |
            v
Hyperledger Fabric Chaincode
            |
            v
Fabric Ledger + CouchDB World State
            |
            v
Fabric Block / Chaincode Events
            |
            v
Blockchain Event Listener Service
            |
            v
PostgreSQL Off-Chain Database
            |
            v
Reports / Dashboards / Audit / Integration APIs
3. Main Principle
3.1 Source of Truth
Hyperledger Fabric Ledger = Source of Truth
PostgreSQL = Off-chain Mirror / Query Store

The blockchain ledger must always be considered the trusted source for:

Wallet ownership
Wallet balance state
Transactions
Transaction history
Audit-sensitive blockchain actions
Smart contract execution results

PostgreSQL is used for:

Fast queries
Dashboards
Reporting
Integration with Spring Boot / Angular
Audit log searching
Operational monitoring
Reconciliation
External system mappings
4. What Data Is Mirrored Off-Chain

The following blockchain data should be mirrored from Fabric into PostgreSQL.

4.1 Wallet Data

Mirrored into:

blockchain.wallets

Example mirrored fields:

wallet_address
customer_id
organization_id
owner_name
national_id_hash
mobile_hash
email_hash
wallet_status
kyc_status
current_balance
ledger_tx_id
ledger_block_number
created_at
updated_at

Purpose:

Fast wallet lookup
API response acceleration
Customer-wallet mapping
Wallet status checking
Balance reporting
4.2 Organization Data

Mirrored into:

blockchain.organizations

Example mirrored fields:

organization_id
organization_name
organization_type
wallet_address
status
ledger_tx_id
ledger_block_number
created_at
updated_at

Purpose:

Bank / merchant / government organization mapping
Wallet-to-organization transfer validation
Reporting by organization
Future multi-organization governance
4.3 Transaction Data

Mirrored into:

blockchain.transactions

Example mirrored fields:

transaction_id
ledger_tx_id
from_wallet_address
to_wallet_address
organization_id
transaction_type
amount
currency
transaction_status
risk_level
aml_status
ledger_timestamp
ledger_block_number
metadata
created_at

Purpose:

Fast transaction history
Dashboard analytics
AML monitoring
Reporting
Integration with external systems
4.4 Audit Logs

Mirrored into:

blockchain.audit_logs

Example mirrored fields:

audit_id
ledger_tx_id
actor_id
actor_type
action_type
entity_type
entity_id
request_payload
response_payload
ip_address
user_agent
status
created_at

Purpose:

Operational audit
Security investigation
Compliance evidence
User activity tracing
4.5 Integration Requests

Mirrored into:

blockchain.integration_requests

Example mirrored fields:

request_id
source_system
target_system
request_type
request_payload
response_payload
status
retry_count
error_message
created_at
updated_at

Purpose:

Track API calls to blockchain middleware
Monitor failed integration attempts
Support retry and troubleshooting
4.6 System Mappings

Mirrored into:

blockchain.system_mappings

Example mirrored fields:

mapping_id
source_system
source_entity_type
source_entity_id
blockchain_entity_type
blockchain_entity_id
wallet_address
ledger_tx_id
status
created_at
updated_at

Purpose:

Link enterprise systems to blockchain records
Map Spring Boot customer IDs to blockchain wallet IDs
Avoid duplicate wallet creation
Support future external integration
5. What Data Stays Only On-Chain

Some data should remain only on-chain and should not be duplicated fully into PostgreSQL.

5.1 Full Immutable Ledger History

The full blockchain block structure should remain inside Fabric.

Do not fully copy:

Complete blocks
Complete read/write sets
Complete endorsement data
Complete private data collections
Full Fabric transaction envelope

PostgreSQL should only store useful business-level references such as:

ledger_tx_id
ledger_block_number
ledger_timestamp
chaincode_name
channel_name
event_name
5.2 Sensitive Raw Identity Data

Do not store sensitive personal data in PostgreSQL if it is already hashed or tokenized on-chain.

Avoid storing:

Raw national ID
Raw password
Raw mobile number
Raw email address
Raw recovery phrase
Raw OTP
Raw private keys

Store only:

national_id_hash
mobile_hash
email_hash
password_hash reference if needed
masked values if required
5.3 Private Keys and Cryptographic Secrets

Never store the following in PostgreSQL:

Private keys
Fabric user private keys
Wallet signing keys
Recovery phrase plain text
JWT signing secrets
Admin enrollment secrets
Fabric CA admin passwords

These must stay in secured identity stores, vaults, or Fabric MSP folders with strict access controls.

5.4 Chaincode Internal Logic

Chaincode business rules should stay inside the smart contract layer.

PostgreSQL should not become the authority for:

Balance calculation
Transaction validation
Wallet creation rules
AML approval enforcement
Ledger ownership validation

PostgreSQL may cache the result, but it should not override chaincode truth.

6. Sync Direction
6.1 Primary Sync Direction
Hyperledger Fabric → PostgreSQL

This is the main synchronization direction.

Whenever a blockchain transaction is committed successfully, the event listener captures the event and mirrors the result into PostgreSQL.

6.2 API-Initiated Flow
Application → Blockchain API → Fabric Chaincode → Ledger Commit → Event Listener → PostgreSQL

The API should not directly insert final blockchain state into PostgreSQL before Fabric commit.

Correct approach:

API receives request
API invokes Fabric chaincode
Fabric commits transaction
Chaincode emits event
Event listener receives committed event
PostgreSQL is updated
API may optionally update request status
6.3 PostgreSQL-to-Blockchain Direction

PostgreSQL should not directly update blockchain ledger data.

Allowed PostgreSQL → Blockchain usage:

Read reference data
Read pending integration requests
Read system mappings
Read retry queue
Trigger API workflow

Not allowed:

Directly changing wallet balance
Directly creating ledger transaction
Directly modifying blockchain status
7. Event Listener Strategy
7.1 Recommended Approach

Use a dedicated Blockchain Event Listener Service.

Recommended technology:

Node.js Fabric Gateway SDK
or
Java Fabric Gateway SDK
or
Spring Boot Fabric Client

For this project, because the chaincode is currently JavaScript-based, a Node.js listener is recommended.

7.2 Event Listener Responsibilities

The event listener should:

Connect to Fabric Gateway
Subscribe to chaincode events
Subscribe to block events if needed
Parse event payload
Validate event type
Check if event was already processed
Insert or update PostgreSQL records
Log sync status
Retry failed events
Support reconciliation
7.3 Event Types to Emit from Chaincode

The chaincode should emit business events such as:

WalletCreated
WalletLogin
WalletBalanceUpdated
WalletTransferCreated
WalletTransferCompleted
WalletTransferFailed
OrganizationTransferCreated
OrganizationCreated
AMLStatusUpdated
WalletStatusChanged
7.4 Example Chaincode Event Payload
{
  "eventType": "WalletCreated",
  "ledgerTxId": "FABRIC_TX_123456789",
  "channelName": "kycchannelnix1",
  "chaincodeName": "kyc-wallet-chaincode-js",
  "walletAddress": "WALLET_77AE48A0CA2BD9C5BE97EB0AECF",
  "customerId": "CUST1002",
  "organizationId": "BANK001",
  "status": "ACTIVE",
  "blockNumber": 125,
  "ledgerTimestamp": "2026-04-30T14:43:21Z"
}
7.5 Event Listener Processing Flow
Receive Fabric Event
        |
        v
Validate Event Payload
        |
        v
Check ledger_tx_id in sync log
        |
        v
If already processed → skip
        |
        v
If not processed → begin DB transaction
        |
        v
Insert / update business table
        |
        v
Insert audit log
        |
        v
Mark sync event as SUCCESS
        |
        v
Commit DB transaction
8. API-Based Sync Strategy

Event-based sync should be the main method, but API-based sync is also required for backup, recovery, and reconciliation.

8.1 When API-Based Sync Is Used

API-based sync is used when:

Event listener was down
PostgreSQL data is missing
Reconciliation found mismatch
Manual recovery is needed
A specific wallet or transaction needs resync
Historical backfill is required
8.2 API Sync Sources

The API sync service can read from:

Fabric chaincode query methods
CouchDB rich queries
Fabric block query
Transaction history methods
8.3 Required Chaincode Query Methods

The chaincode should support query methods such as:

GetWalletByAddress
GetWalletByCustomerId
GetWalletBalance
GetTransactionById
GetTransactionHistory
GetTransactionsByWallet
GetOrganizationById
GetAllWalletsByOrganization
GetTransactionsByDateRange
8.4 Manual Resync API Examples

The Blockchain API should expose admin-only endpoints such as:

POST /api/v1/sync/wallet/{walletAddress}
POST /api/v1/sync/transaction/{transactionId}
POST /api/v1/sync/organization/{organizationId}
POST /api/v1/sync/reconcile/wallet-balances
POST /api/v1/sync/reconcile/transactions
POST /api/v1/sync/retry-failed-events
9. Reconciliation Strategy

Reconciliation ensures that PostgreSQL still matches Hyperledger Fabric.

9.1 Reconciliation Objectives

The reconciliation process should detect:

Missing PostgreSQL records
Duplicate PostgreSQL records
Incorrect wallet balances
Transaction status mismatch
Missing audit logs
Missing ledger transaction IDs
Failed sync events
Unprocessed Fabric events
9.2 Reconciliation Frequency

Recommended schedule:

Real-time event sync        → continuously
Retry failed events         → every 1 to 5 minutes
Wallet balance check        → every 15 minutes
Transaction reconciliation  → every 30 minutes
Full reconciliation         → daily
Historical audit check      → weekly
9.3 Reconciliation Types
Type	Description
Wallet reconciliation	Compare wallets in Fabric with PostgreSQL
Balance reconciliation	Compare Fabric wallet balance with PostgreSQL balance
Transaction reconciliation	Compare ledger transactions with PostgreSQL transactions
Audit reconciliation	Verify every important ledger action has audit log
Sync-log reconciliation	Verify event processing status
Organization reconciliation	Compare organization records
10. Retry Mechanism
10.1 Retry Rules

Every failed sync event should be stored and retried.

Recommended retry policy:

Retry 1: after 1 minute
Retry 2: after 5 minutes
Retry 3: after 15 minutes
Retry 4: after 30 minutes
Retry 5: after 1 hour
After max retries: mark as FAILED_PERMANENT
10.2 Retry Fields

The sync tracking table should include:

sync_event_id
ledger_tx_id
event_type
event_payload
sync_status
retry_count
max_retry_count
last_retry_at
next_retry_at
error_message
created_at
updated_at
10.3 Recommended Sync Event Statuses
PENDING
PROCESSING
SUCCESS
FAILED_RETRYABLE
FAILED_PERMANENT
SKIPPED_DUPLICATE
RECONCILED
11. Failure Handling
11.1 Failure Scenarios
Failure	Handling
PostgreSQL unavailable	Keep event in failed queue and retry
Invalid event payload	Mark as FAILED_PERMANENT
Duplicate ledger transaction	Mark as SKIPPED_DUPLICATE
Missing required wallet	Trigger wallet resync
Transaction amount mismatch	Mark as RECONCILIATION_FAILED
Listener crash	Restart service and resume from last checkpoint
Fabric gateway unavailable	Retry connection with backoff
Chaincode query failure	Retry API-based sync
11.2 Critical Rule

Never mark an event as successful unless the PostgreSQL transaction is fully committed.

Correct pattern:

BEGIN;
Insert or update business data;
Insert audit log;
Update sync event as SUCCESS;
COMMIT;

If any step fails:

ROLLBACK;
Mark event as FAILED_RETRYABLE;
Schedule retry;
12. Duplicate Prevention
12.1 Duplicate Prevention Keys

Use the following unique keys:

ledger_tx_id
transaction_id
wallet_address
customer_id + organization_id
source_system + source_entity_id
12.2 Recommended Constraints
ALTER TABLE blockchain.wallets
ADD CONSTRAINT uq_wallets_wallet_address
UNIQUE (wallet_address);

ALTER TABLE blockchain.wallets
ADD CONSTRAINT uq_wallets_customer_org
UNIQUE (customer_id, organization_id);

ALTER TABLE blockchain.transactions
ADD CONSTRAINT uq_transactions_ledger_tx_id
UNIQUE (ledger_tx_id);

ALTER TABLE blockchain.transactions
ADD CONSTRAINT uq_transactions_transaction_id
UNIQUE (transaction_id);

ALTER TABLE blockchain.system_mappings
ADD CONSTRAINT uq_system_mapping_source
UNIQUE (source_system, source_entity_type, source_entity_id);
12.3 Idempotent Insert Pattern

Use PostgreSQL ON CONFLICT logic.

Example:

INSERT INTO blockchain.transactions (
    transaction_id,
    ledger_tx_id,
    from_wallet_address,
    to_wallet_address,
    transaction_type,
    amount,
    currency,
    transaction_status,
    ledger_block_number,
    ledger_timestamp,
    created_at,
    updated_at
)
VALUES (
    :transaction_id,
    :ledger_tx_id,
    :from_wallet_address,
    :to_wallet_address,
    :transaction_type,
    :amount,
    :currency,
    :transaction_status,
    :ledger_block_number,
    :ledger_timestamp,
    NOW(),
    NOW()
)
ON CONFLICT (ledger_tx_id)
DO UPDATE SET
    transaction_status = EXCLUDED.transaction_status,
    ledger_block_number = EXCLUDED.ledger_block_number,
    ledger_timestamp = EXCLUDED.ledger_timestamp,
    updated_at = NOW();
13. Ledger vs PostgreSQL Validation
13.1 Validation Rules

For each synced record, PostgreSQL must keep enough ledger references to validate against Fabric.

Required validation fields:

ledger_tx_id
ledger_block_number
ledger_timestamp
channel_name
chaincode_name
event_name
sync_status
13.2 Validation Checklist
Validation Item	Rule
Wallet exists on-chain	Wallet must exist in Fabric before PostgreSQL confirms it
Transaction exists on-chain	PostgreSQL transaction must have valid ledger_tx_id
Balance matches ledger	PostgreSQL cached balance must equal Fabric balance
Status matches chaincode result	PostgreSQL status must match latest ledger state
Event was processed once	One ledger_tx_id should not generate duplicate business records
Audit log exists	Important events must have audit records
14. Recommended Additional Sync Table

Although Step 16 includes the main business tables, Step 17 should add a dedicated table for sync tracking.

14.1 Create Sync Events Table
CREATE TABLE IF NOT EXISTS blockchain.sync_events (
    sync_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ledger_tx_id VARCHAR(128) NOT NULL,
    ledger_block_number BIGINT,
    ledger_timestamp TIMESTAMPTZ,

    channel_name VARCHAR(100) NOT NULL,
    chaincode_name VARCHAR(150) NOT NULL,
    event_name VARCHAR(150) NOT NULL,
    event_type VARCHAR(100) NOT NULL,

    event_payload JSONB NOT NULL,

    sync_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retry_count INTEGER NOT NULL DEFAULT 5,

    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    error_code VARCHAR(100),
    error_message TEXT,

    processed_at TIMESTAMPTZ,

    created_by VARCHAR(100) DEFAULT 'fabric-event-listener',
    updated_by VARCHAR(100) DEFAULT 'fabric-event-listener',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sync_events_ledger_tx_event
        UNIQUE (ledger_tx_id, event_name),

    CONSTRAINT chk_sync_events_status
        CHECK (
            sync_status IN (
                'PENDING',
                'PROCESSING',
                'SUCCESS',
                'FAILED_RETRYABLE',
                'FAILED_PERMANENT',
                'SKIPPED_DUPLICATE',
                'RECONCILED'
            )
        )
);
14.2 Sync Events Indexes
CREATE INDEX IF NOT EXISTS idx_sync_events_status
ON blockchain.sync_events (sync_status);

CREATE INDEX IF NOT EXISTS idx_sync_events_ledger_tx_id
ON blockchain.sync_events (ledger_tx_id);

CREATE INDEX IF NOT EXISTS idx_sync_events_event_type
ON blockchain.sync_events (event_type);

CREATE INDEX IF NOT EXISTS idx_sync_events_next_retry_at
ON blockchain.sync_events (next_retry_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_created_at
ON blockchain.sync_events (created_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_payload_gin
ON blockchain.sync_events USING GIN (event_payload);
14.3 Table Comment
COMMENT ON TABLE blockchain.sync_events IS
'Tracks Hyperledger Fabric events synchronized into PostgreSQL, including retry state, error handling, idempotency, and reconciliation status.';
15. SQL Reconciliation Queries
15.1 Find Transactions Without Ledger Transaction ID
SELECT
    transaction_id,
    from_wallet_address,
    to_wallet_address,
    amount,
    transaction_status,
    created_at
FROM blockchain.transactions
WHERE ledger_tx_id IS NULL
ORDER BY created_at DESC;

Purpose:

Find PostgreSQL transactions that are not linked to blockchain ledger transactions.
15.2 Find Duplicate Ledger Transactions
SELECT
    ledger_tx_id,
    COUNT(*) AS duplicate_count
FROM blockchain.transactions
WHERE ledger_tx_id IS NOT NULL
GROUP BY ledger_tx_id
HAVING COUNT(*) > 1;

Purpose:

Detect duplicate transaction records created from the same Fabric transaction.
15.3 Find Failed Sync Events
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    sync_status,
    retry_count,
    error_message,
    created_at,
    updated_at
FROM blockchain.sync_events
WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
ORDER BY updated_at DESC;

Purpose:

Review failed blockchain-to-database sync events.
15.4 Find Retryable Sync Events
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    retry_count,
    next_retry_at
FROM blockchain.sync_events
WHERE sync_status = 'FAILED_RETRYABLE'
  AND retry_count < max_retry_count
  AND next_retry_at <= NOW()
ORDER BY next_retry_at ASC;

Purpose:

Fetch failed sync events that are ready to be retried.
15.5 Find Events Stuck in Processing
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    sync_status,
    updated_at
FROM blockchain.sync_events
WHERE sync_status = 'PROCESSING'
  AND updated_at < NOW() - INTERVAL '10 minutes'
ORDER BY updated_at ASC;

Purpose:

Detect sync events that started processing but never completed.
15.6 Find Wallets Without Ledger Reference
SELECT
    wallet_id,
    wallet_address,
    customer_id,
    organization_id,
    wallet_status,
    created_at
FROM blockchain.wallets
WHERE ledger_tx_id IS NULL
ORDER BY created_at DESC;

Purpose:

Find wallets in PostgreSQL that are not linked to Fabric transactions.
15.7 Find Transactions Missing Audit Logs
SELECT
    t.transaction_id,
    t.ledger_tx_id,
    t.transaction_type,
    t.transaction_status,
    t.created_at
FROM blockchain.transactions t
LEFT JOIN blockchain.audit_logs a
    ON a.ledger_tx_id = t.ledger_tx_id
WHERE a.audit_id IS NULL
ORDER BY t.created_at DESC;

Purpose:

Find blockchain transactions without corresponding audit records.
15.8 Daily Sync Summary
SELECT
    DATE(created_at) AS sync_date,
    event_type,
    sync_status,
    COUNT(*) AS total_events
FROM blockchain.sync_events
GROUP BY
    DATE(created_at),
    event_type,
    sync_status
ORDER BY
    sync_date DESC,
    event_type,
    sync_status;

Purpose:

Monitor daily sync health.
15.9 Failed Event Percentage by Day
SELECT
    DATE(created_at) AS sync_date,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (
        WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
    ) AS failed_events,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
            )::NUMERIC
            / NULLIF(COUNT(*), 0)
        ) * 100,
        2
    ) AS failure_percentage
FROM blockchain.sync_events
GROUP BY DATE(created_at)
ORDER BY sync_date DESC;

Purpose:

Measure sync failure rate over time.
15.10 Wallet Balance Reconciliation Placeholder Query

PostgreSQL can calculate transaction-based balance and compare it with the cached wallet balance.

WITH calculated_balances AS (
    SELECT
        wallet_address,
        SUM(balance_delta) AS calculated_balance
    FROM (
        SELECT
            from_wallet_address AS wallet_address,
            -amount AS balance_delta
        FROM blockchain.transactions
        WHERE transaction_status = 'COMPLETED'

        UNION ALL

        SELECT
            to_wallet_address AS wallet_address,
            amount AS balance_delta
        FROM blockchain.transactions
        WHERE transaction_status = 'COMPLETED'
    ) x
    GROUP BY wallet_address
)
SELECT
    w.wallet_address,
    w.current_balance AS postgres_wallet_balance,
    COALESCE(c.calculated_balance, 0) AS calculated_transaction_balance,
    w.current_balance - COALESCE(c.calculated_balance, 0) AS difference
FROM blockchain.wallets w
LEFT JOIN calculated_balances c
    ON c.wallet_address = w.wallet_address
WHERE w.current_balance <> COALESCE(c.calculated_balance, 0)
ORDER BY ABS(w.current_balance - COALESCE(c.calculated_balance, 0)) DESC;

Purpose:

Compare PostgreSQL wallet balance with balance calculated from completed transactions.

Important:

Final validation must still compare against Fabric ledger balance.
16. Event Listener Pseudocode
async function processFabricEvent(event) {
  const client = await postgresPool.connect();

  try {
    const payload = JSON.parse(event.payload.toString());

    await client.query('BEGIN');

    const existingEvent = await client.query(
      `
      SELECT sync_event_id, sync_status
      FROM blockchain.sync_events
      WHERE ledger_tx_id = $1
        AND event_name = $2
      `,
      [payload.ledgerTxId, event.eventName]
    );

    if (existingEvent.rowCount > 0) {
      await client.query(
        `
        UPDATE blockchain.sync_events
        SET sync_status = 'SKIPPED_DUPLICATE',
            updated_at = NOW()
        WHERE ledger_tx_id = $1
          AND event_name = $2
        `,
        [payload.ledgerTxId, event.eventName]
      );

      await client.query('COMMIT');
      return;
    }

    await client.query(
      `
      INSERT INTO blockchain.sync_events (
          ledger_tx_id,
          ledger_block_number,
          ledger_timestamp,
          channel_name,
          chaincode_name,
          event_name,
          event_type,
          event_payload,
          sync_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING')
      `,
      [
        payload.ledgerTxId,
        payload.blockNumber,
        payload.ledgerTimestamp,
        payload.channelName,
        payload.chaincodeName,
        event.eventName,
        payload.eventType,
        payload
      ]
    );

    if (payload.eventType === 'WalletCreated') {
      await syncWalletCreated(client, payload);
    }

    if (payload.eventType === 'WalletTransferCompleted') {
      await syncTransactionCompleted(client, payload);
    }

    await client.query(
      `
      UPDATE blockchain.sync_events
      SET sync_status = 'SUCCESS',
          processed_at = NOW(),
          updated_at = NOW()
      WHERE ledger_tx_id = $1
        AND event_name = $2
      `,
      [payload.ledgerTxId, event.eventName]
    );

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');

    await markSyncEventFailed(event, error);

  } finally {
    client.release();
  }
}
17. Sync Strategy by Event Type
17.1 WalletCreated

Target table:

blockchain.wallets

Action:

Insert wallet if not exists
Update wallet if already exists
Insert audit log
Mark sync event as SUCCESS

Duplicate key:

wallet_address
customer_id + organization_id
ledger_tx_id
17.2 WalletTransferCompleted

Target table:

blockchain.transactions
blockchain.wallets
blockchain.audit_logs

Action:

Insert transaction
Update sender wallet balance
Update receiver wallet balance
Insert audit log
Mark sync event as SUCCESS

Duplicate key:

transaction_id
ledger_tx_id
17.3 WalletStatusChanged

Target table:

blockchain.wallets
blockchain.audit_logs

Action:

Update wallet_status
Insert audit log
Mark sync event as SUCCESS

Duplicate key:

ledger_tx_id + event_name
17.4 OrganizationCreated

Target table:

blockchain.organizations
blockchain.audit_logs

Action:

Insert organization
Insert audit log
Mark sync event as SUCCESS

Duplicate key:

organization_id
wallet_address
ledger_tx_id
18. Recommended Folder Structure
/home/nix/u01/blockchain-integration/
├── sync-service/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js
│   │   ├── fabric/
│   │   │   ├── gateway.js
│   │   │   ├── listener.js
│   │   │   └── queryClient.js
│   │   ├── db/
│   │   │   ├── postgres.js
│   │   │   ├── migrations/
│   │   │   └── queries/
│   │   ├── processors/
│   │   │   ├── walletProcessor.js
│   │   │   ├── transactionProcessor.js
│   │   │   ├── organizationProcessor.js
│   │   │   └── auditProcessor.js
│   │   ├── retry/
│   │   │   ├── retryWorker.js
│   │   │   └── retryPolicy.js
│   │   ├── reconciliation/
│   │   │   ├── walletReconciliation.js
│   │   │   ├── transactionReconciliation.js
│   │   │   └── ledgerValidation.js
│   │   ├── logs/
│   │   │   └── logger.js
│   │   └── config/
│   │       └── config.js
│   └── sql/
│       ├── 01-create-sync-events-table.sql
│       ├── 02-sync-indexes.sql
│       └── 03-reconciliation-queries.sql
19. Environment Variables
# PostgreSQL
PG_HOST=172.31.13.133
PG_PORT=5444
PG_DATABASE=vfds_dev
PG_USER=postgres
PG_PASSWORD=your_password
PG_SCHEMA=blockchain

# Fabric
FABRIC_CHANNEL_NAME=kycchannelnix1
FABRIC_CHAINCODE_NAME=kyc-wallet-chaincode-js
FABRIC_MSP_ID=Org1MSP
FABRIC_PEER_ENDPOINT=peer0.org1.blockchain.local:7051
FABRIC_TLS_CERT_PATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt
FABRIC_CERT_PATH=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp/signcerts/cert.pem
FABRIC_KEY_DIRECTORY=/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp/keystore

# Sync
SYNC_MAX_RETRY_COUNT=5
SYNC_RETRY_INTERVAL_SECONDS=60
SYNC_BATCH_SIZE=100
SYNC_LOG_LEVEL=info
20. Security Controls
20.1 Listener Security

The sync listener must:

Use Fabric MSP identity
Use TLS connection to peer
Use read-only database user where possible
Use restricted PostgreSQL permissions
Never expose private keys in logs
Never log raw sensitive payloads
Validate all event payloads
20.2 PostgreSQL Role Recommendation

Create a dedicated database role:

CREATE ROLE blockchain_sync_user LOGIN PASSWORD 'change_this_password';

GRANT USAGE ON SCHEMA blockchain TO blockchain_sync_user;

GRANT SELECT, INSERT, UPDATE
ON ALL TABLES IN SCHEMA blockchain
TO blockchain_sync_user;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA blockchain
TO blockchain_sync_user;

Avoid using the main postgres superuser for the sync service in production.

21. Operational Monitoring

The sync service should expose health endpoints:

GET /health
GET /metrics
GET /sync/status
GET /sync/failed-events
GET /sync/reconciliation-summary

Recommended metrics:

Total events received
Total events processed successfully
Total failed events
Retry queue size
Average sync latency
Last processed block number
Last processed ledger transaction ID
Database connection status
Fabric gateway connection status
22. Final Enterprise Rules
Rule 1 — Fabric First
Never treat PostgreSQL as the final source of truth for blockchain state.
Rule 2 — Event Sync Must Be Idempotent
Processing the same Fabric event more than once must not create duplicate business records.
Rule 3 — Every Synced Record Needs Ledger Reference
Every wallet, transaction, organization, and audit record mirrored from Fabric must include ledger_tx_id.
Rule 4 — Failed Sync Events Must Never Disappear
Every failed event must be stored, retried, and visible for support investigation.
Rule 5 — Reconciliation Must Be Scheduled
Real-time sync is not enough. Scheduled reconciliation is mandatory.
Rule 6 — Sensitive Data Must Stay Protected
Only hashes, references, masked values, and non-sensitive metadata should be mirrored.
23. Final Output Summary

At the end of Step 17, the Blockchain Integration Project should have:

1. Clear Fabric-to-PostgreSQL sync direction
2. Defined mirrored data rules
3. Defined on-chain-only data rules
4. Event listener strategy
5. API-based fallback sync strategy
6. Retry mechanism
7. Failure handling rules
8. Duplicate prevention rules
9. Ledger-vs-PostgreSQL validation rules
10. SQL reconciliation queries
11. Recommended sync tracking table
12. Security and monitoring controls
24. Step 17 Completion Criteria

Step 17 is considered complete when:

The sync architecture is documented
The mirrored and non-mirrored data are clearly defined
The event listener strategy is approved
The API-based sync strategy is approved
The sync_events table is created
Retry and failure rules are documented
Duplicate prevention constraints are defined
Ledger validation rules are documented
Reconciliation SQL queries are prepared
The folder structure for the sync service is defined
25. Recommended Next Step

After Step 17, continue with:

🔹 STEP 18 — Blockchain Event Listener Service Implementation

Recommended Step 18 scope:

Build the Node.js event listener service that connects to Hyperledger Fabric, listens to chaincode events, proces