🔹 STEP 15 — PostgreSQL Integration Setup
Blockchain Integration Project
Role

You are acting as a Senior PostgreSQL Database Engineer responsible for preparing the PostgreSQL integration layer between:

Hyperledger Fabric / Blockchain API
        ↓
PostgreSQL Integration Database
        ↓
Existing KYC / Customer / Organization Systems
1. Step Objective

The objective of STEP 15 is to prepare PostgreSQL for blockchain integration by creating a dedicated schema, permissions, mapping tables, extensions, indexes, and verification scripts.

Existing database:

Host:     172.31.13.133
Port:     5444
Database: vfds_dev
Schema:   blockchain

The PostgreSQL layer will be used for:

1. Syncing blockchain wallet data
2. Syncing blockchain transaction data
3. Mapping blockchain customer IDs to existing KYC/customer IDs
4. Mapping blockchain organization IDs to existing bank/organization IDs
5. Supporting API queries
6. Supporting audit, reporting, and monitoring
7. Supporting future event-listener integration
2. PostgreSQL Connection Setup
2.1 Connect as PostgreSQL Admin

Run this from your Ubuntu server:

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev

Expected result:

vfds_dev=#
2.2 Check Current Database
SELECT current_database();

Expected:

vfds_dev
2.3 Check Current User
SELECT current_user;

Expected:

postgres
3. Full PostgreSQL Setup Script

Save this file as:

/home/nix/u01/blockchain-integration/postgresql/step-15-postgresql-integration-setup.sql

Create the folder first:

mkdir -p /home/nix/u01/blockchain-integration/postgresql

Then create the SQL file:

nano /home/nix/u01/blockchain-integration/postgresql/step-15-postgresql-integration-setup.sql

Paste the full script below.

4. Complete SQL Script
/* ============================================================
   STEP 15 — PostgreSQL Integration Setup
   Project: Blockchain Integration Project
   Database: vfds_dev
   Host: 172.31.13.133
   Port: 5444
   Schema: blockchain
   ============================================================ */

BEGIN;

-- ============================================================
-- 1. Required PostgreSQL Extensions
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Optional but useful for case-insensitive search
CREATE EXTENSION IF NOT EXISTS citext;

-- ============================================================
-- 2. Create Blockchain Schema
-- ============================================================

CREATE SCHEMA IF NOT EXISTS blockchain;

COMMENT ON SCHEMA blockchain IS
'Dedicated schema for Blockchain Integration Project including wallet, transaction, audit, and mapping data.';

-- ============================================================
-- 3. Create Application Role / User
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_roles
        WHERE rolname = 'blockchain_app_user'
    ) THEN
        CREATE ROLE blockchain_app_user
        LOGIN
        PASSWORD 'ChangeThisStrongPassword_2026!';
    END IF;
END
$$;

COMMENT ON ROLE blockchain_app_user IS
'Application database user used by Blockchain API / Middleware to access blockchain schema.';

-- ============================================================
-- 4. Grant Database and Schema Permissions
-- ============================================================

GRANT CONNECT ON DATABASE vfds_dev TO blockchain_app_user;

GRANT USAGE ON SCHEMA blockchain TO blockchain_app_user;
GRANT CREATE ON SCHEMA blockchain TO blockchain_app_user;

-- Existing object permissions
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA blockchain
TO blockchain_app_user;

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA blockchain
TO blockchain_app_user;

GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA blockchain
TO blockchain_app_user;

-- Future object permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA blockchain
GRANT SELECT, INSERT, UPDATE, DELETE
ON TABLES TO blockchain_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA blockchain
GRANT USAGE, SELECT, UPDATE
ON SEQUENCES TO blockchain_app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA blockchain
GRANT EXECUTE
ON FUNCTIONS TO blockchain_app_user;

-- ============================================================
-- 5. Customer Mapping Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_customer_mapping (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blockchain_customer_id VARCHAR(100) NOT NULL,
    source_customer_id VARCHAR(100) NOT NULL,

    customer_reference_type VARCHAR(50) DEFAULT 'KYC_CUSTOMER_ID',

    wallet_address VARCHAR(150),

    customer_hash VARCHAR(255),
    national_id_hash VARCHAR(255),
    mobile_hash VARCHAR(255),
    email_hash VARCHAR(255),

    mapping_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by VARCHAR(100) DEFAULT current_user,
    updated_by VARCHAR(100),

    CONSTRAINT uq_blockchain_customer_mapping_customer
        UNIQUE (blockchain_customer_id),

    CONSTRAINT uq_blockchain_customer_mapping_source_customer
        UNIQUE (source_customer_id),

    CONSTRAINT chk_customer_mapping_status
        CHECK (mapping_status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED'))
);

COMMENT ON TABLE blockchain.blockchain_customer_mapping IS
'Maps blockchain customer IDs and wallet addresses to existing customer/KYC IDs.';

COMMENT ON COLUMN blockchain.blockchain_customer_mapping.blockchain_customer_id IS
'Customer identifier used by blockchain chaincode and Blockchain API.';

COMMENT ON COLUMN blockchain.blockchain_customer_mapping.source_customer_id IS
'Customer identifier from existing core/KYC/customer system.';

COMMENT ON COLUMN blockchain.blockchain_customer_mapping.wallet_address IS
'Wallet address generated by blockchain chaincode.';

-- ============================================================
-- 6. Organization Mapping Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_organization_mapping (
    mapping_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blockchain_organization_id VARCHAR(100) NOT NULL,
    source_organization_id VARCHAR(100) NOT NULL,

    organization_code VARCHAR(100),
    organization_name VARCHAR(255),

    organization_type VARCHAR(50) DEFAULT 'BANK',

    mapping_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_by VARCHAR(100) DEFAULT current_user,
    updated_by VARCHAR(100),

    CONSTRAINT uq_blockchain_org_mapping_blockchain_org
        UNIQUE (blockchain_organization_id),

    CONSTRAINT uq_blockchain_org_mapping_source_org
        UNIQUE (source_organization_id),

    CONSTRAINT chk_org_mapping_status
        CHECK (mapping_status IN ('ACTIVE', 'INACTIVE', 'BLOCKED', 'DELETED')),

    CONSTRAINT chk_org_type
        CHECK (organization_type IN ('BANK', 'MERCHANT', 'GOVERNMENT', 'PARTNER', 'OTHER'))
);

COMMENT ON TABLE blockchain.blockchain_organization_mapping IS
'Maps blockchain organization IDs to existing bank, merchant, government, or partner organization IDs.';

-- ============================================================
-- 7. Blockchain Wallet Integration Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_wallet_integration (
    wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_address VARCHAR(150) NOT NULL,
    blockchain_customer_id VARCHAR(100) NOT NULL,
    blockchain_organization_id VARCHAR(100),

    customer_name VARCHAR(255),

    wallet_status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',

    current_balance NUMERIC(20, 6) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'TOKEN',

    fabric_channel_name VARCHAR(100),
    chaincode_name VARCHAR(100),
    fabric_tx_id VARCHAR(150),

    created_on_blockchain_at TIMESTAMP,
    synced_to_postgres_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_blockchain_wallet_address
        UNIQUE (wallet_address),

    CONSTRAINT chk_wallet_status
        CHECK (wallet_status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED', 'BLOCKED'))
);

COMMENT ON TABLE blockchain.blockchain_wallet_integration IS
'PostgreSQL integration copy of blockchain wallet data for API, reporting, and analytics.';

-- ============================================================
-- 8. Blockchain Transaction Integration Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_transaction_integration (
    transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    blockchain_transaction_id VARCHAR(150) NOT NULL,
    fabric_tx_id VARCHAR(150),

    transaction_type VARCHAR(50) NOT NULL,

    from_wallet_address VARCHAR(150),
    to_wallet_address VARCHAR(150),

    from_organization_id VARCHAR(100),
    to_organization_id VARCHAR(100),

    amount NUMERIC(20, 6) NOT NULL,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'TOKEN',

    transaction_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',

    risk_level VARCHAR(30) DEFAULT 'LOW',
    risk_score NUMERIC(10, 4),

    transaction_description TEXT,

    fabric_channel_name VARCHAR(100),
    chaincode_name VARCHAR(100),

    blockchain_created_at TIMESTAMP,
    synced_to_postgres_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_blockchain_transaction_id
        UNIQUE (blockchain_transaction_id),

    CONSTRAINT chk_transaction_type
        CHECK (
            transaction_type IN (
                'WALLET_TO_WALLET',
                'WALLET_TO_ORGANIZATION',
                'ORGANIZATION_TO_WALLET',
                'ORGANIZATION_TO_ORGANIZATION',
                'INITIAL_BALANCE',
                'ADJUSTMENT'
            )
        ),

    CONSTRAINT chk_transaction_status
        CHECK (
            transaction_status IN (
                'PENDING',
                'SUCCESS',
                'FAILED',
                'REJECTED',
                'REVERSED'
            )
        ),

    CONSTRAINT chk_risk_level
        CHECK (
            risk_level IN (
                'LOW',
                'MEDIUM',
                'HIGH',
                'CRITICAL'
            )
        )
);

COMMENT ON TABLE blockchain.blockchain_transaction_integration IS
'PostgreSQL integration copy of blockchain transaction data for reporting, analytics, dashboard, and reconciliation.';

-- ============================================================
-- 9. Blockchain Audit Log Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_postgres_audit_log (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(100) NOT NULL DEFAULT 'POSTGRESQL',

    entity_type VARCHAR(100),
    entity_id VARCHAR(150),

    action_name VARCHAR(100),
    action_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',

    request_payload JSONB,
    response_payload JSONB,
    error_message TEXT,

    performed_by VARCHAR(100) DEFAULT current_user,
    performed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    client_ip VARCHAR(100),
    api_endpoint VARCHAR(255),

    fabric_tx_id VARCHAR(150),
    wallet_address VARCHAR(150),
    blockchain_customer_id VARCHAR(100)
);

COMMENT ON TABLE blockchain.blockchain_postgres_audit_log IS
'Audit table for PostgreSQL-side blockchain integration events, API calls, sync operations, and errors.';

-- ============================================================
-- 10. Event Sync Status Table
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain.blockchain_event_sync_status (
    sync_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    fabric_tx_id VARCHAR(150) NOT NULL,
    event_name VARCHAR(100) NOT NULL,

    event_payload JSONB,

    sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',

    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retry_count INTEGER NOT NULL DEFAULT 3,

    error_message TEXT,

    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,

    CONSTRAINT uq_blockchain_event_sync_fabric_tx
        UNIQUE (fabric_tx_id, event_name),

    CONSTRAINT chk_event_sync_status
        CHECK (
            sync_status IN (
                'PENDING',
                'PROCESSING',
                'SUCCESS',
                'FAILED',
                'RETRY'
            )
        )
);

COMMENT ON TABLE blockchain.blockchain_event_sync_status IS
'Tracks synchronization status of Hyperledger Fabric events into PostgreSQL.';

-- ============================================================
-- 11. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customer_mapping_blockchain_customer_id
ON blockchain.blockchain_customer_mapping (blockchain_customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_mapping_source_customer_id
ON blockchain.blockchain_customer_mapping (source_customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_mapping_wallet_address
ON blockchain.blockchain_customer_mapping (wallet_address);

CREATE INDEX IF NOT EXISTS idx_org_mapping_blockchain_org_id
ON blockchain.blockchain_organization_mapping (blockchain_organization_id);

CREATE INDEX IF NOT EXISTS idx_org_mapping_source_org_id
ON blockchain.blockchain_organization_mapping (source_organization_id);

CREATE INDEX IF NOT EXISTS idx_wallet_integration_wallet_address
ON blockchain.blockchain_wallet_integration (wallet_address);

CREATE INDEX IF NOT EXISTS idx_wallet_integration_customer_id
ON blockchain.blockchain_wallet_integration (blockchain_customer_id);

CREATE INDEX IF NOT EXISTS idx_wallet_integration_org_id
ON blockchain.blockchain_wallet_integration (blockchain_organization_id);

CREATE INDEX IF NOT EXISTS idx_transaction_blockchain_tx_id
ON blockchain.blockchain_transaction_integration (blockchain_transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_fabric_tx_id
ON blockchain.blockchain_transaction_integration (fabric_tx_id);

CREATE INDEX IF NOT EXISTS idx_transaction_from_wallet
ON blockchain.blockchain_transaction_integration (from_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transaction_to_wallet
ON blockchain.blockchain_transaction_integration (to_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transaction_status
ON blockchain.blockchain_transaction_integration (transaction_status);

CREATE INDEX IF NOT EXISTS idx_transaction_risk_level
ON blockchain.blockchain_transaction_integration (risk_level);

CREATE INDEX IF NOT EXISTS idx_transaction_created_at
ON blockchain.blockchain_transaction_integration (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_event_type
ON blockchain.blockchain_postgres_audit_log (event_type);

CREATE INDEX IF NOT EXISTS idx_audit_entity
ON blockchain.blockchain_postgres_audit_log (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_performed_at
ON blockchain.blockchain_postgres_audit_log (performed_at);

CREATE INDEX IF NOT EXISTS idx_event_sync_status
ON blockchain.blockchain_event_sync_status (sync_status);

CREATE INDEX IF NOT EXISTS idx_event_sync_fabric_tx_id
ON blockchain.blockchain_event_sync_status (fabric_tx_id);

-- JSONB indexes
CREATE INDEX IF NOT EXISTS idx_audit_request_payload_gin
ON blockchain.blockchain_postgres_audit_log
USING GIN (request_payload);

CREATE INDEX IF NOT EXISTS idx_audit_response_payload_gin
ON blockchain.blockchain_postgres_audit_log
USING GIN (response_payload);

CREATE INDEX IF NOT EXISTS idx_event_payload_gin
ON blockchain.blockchain_event_sync_status
USING GIN (event_payload);

-- ============================================================
-- 12. Trigger Function for updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION blockchain.fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;

-- ============================================================
-- 13. Triggers
-- ============================================================

DROP TRIGGER IF EXISTS trg_customer_mapping_updated_at
ON blockchain.blockchain_customer_mapping;

CREATE TRIGGER trg_customer_mapping_updated_at
BEFORE UPDATE ON blockchain.blockchain_customer_mapping
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_org_mapping_updated_at
ON blockchain.blockchain_organization_mapping;

CREATE TRIGGER trg_org_mapping_updated_at
BEFORE UPDATE ON blockchain.blockchain_organization_mapping
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_wallet_integration_updated_at
ON blockchain.blockchain_wallet_integration;

CREATE TRIGGER trg_wallet_integration_updated_at
BEFORE UPDATE ON blockchain.blockchain_wallet_integration
FOR EACH ROW
EXECUTE FUNCTION blockchain.fn_set_updated_at();

-- ============================================================
-- 14. Useful Integration View
-- ============================================================

CREATE OR REPLACE VIEW blockchain.vw_blockchain_customer_wallet AS
SELECT
    cm.mapping_id,
    cm.blockchain_customer_id,
    cm.source_customer_id,
    cm.wallet_address,
    cm.mapping_status,
    wi.customer_name,
    wi.blockchain_organization_id,
    wi.wallet_status,
    wi.current_balance,
    wi.currency_code,
    wi.fabric_channel_name,
    wi.chaincode_name,
    wi.fabric_tx_id,
    wi.created_on_blockchain_at,
    wi.synced_to_postgres_at
FROM blockchain.blockchain_customer_mapping cm
LEFT JOIN blockchain.blockchain_wallet_integration wi
    ON wi.wallet_address = cm.wallet_address;

COMMENT ON VIEW blockchain.vw_blockchain_customer_wallet IS
'Unified customer-wallet integration view for Blockchain API and reporting.';

GRANT SELECT ON blockchain.vw_blockchain_customer_wallet TO blockchain_app_user;

-- ============================================================
-- 15. Sample Seed Data for Testing
-- ============================================================

INSERT INTO blockchain.blockchain_organization_mapping (
    blockchain_organization_id,
    source_organization_id,
    organization_code,
    organization_name,
    organization_type
)
VALUES
(
    'BANK001',
    'BANK001',
    'BANK001',
    'Default Test Bank',
    'BANK'
)
ON CONFLICT (blockchain_organization_id)
DO NOTHING;

INSERT INTO blockchain.blockchain_customer_mapping (
    blockchain_customer_id,
    source_customer_id,
    wallet_address,
    customer_hash,
    mapping_status
)
VALUES
(
    'CUST1002',
    'CUST1002',
    'WALLET_77AE48A0CA2BD9C5BE97EB0AECF_TEST',
    'NID_HASH_1002',
    'ACTIVE'
)
ON CONFLICT (blockchain_customer_id)
DO NOTHING;

INSERT INTO blockchain.blockchain_wallet_integration (
    wallet_address,
    blockchain_customer_id,
    blockchain_organization_id,
    customer_name,
    wallet_status,
    current_balance,
    currency_code,
    fabric_channel_name,
    chaincode_name,
    fabric_tx_id,
    created_on_blockchain_at
)
VALUES
(
    'WALLET_77AE48A0CA2BD9C5BE97EB0AECF_TEST',
    'CUST1002',
    'BANK001',
    'Nicolas Salloum',
    'ACTIVE',
    1000,
    'TOKEN',
    'kycchannelnix1',
    'kyc-wallet-chaincode-js',
    'TEST_FABRIC_TX_1002',
    CURRENT_TIMESTAMP
)
ON CONFLICT (wallet_address)
DO NOTHING;

COMMIT;
5. Run the SQL Script

Run:

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \
-f /home/nix/u01/blockchain-integration/postgresql/step-15-postgresql-integration-setup.sql

Expected output should include:

CREATE EXTENSION
CREATE SCHEMA
CREATE TABLE
CREATE INDEX
CREATE FUNCTION
CREATE TRIGGER
CREATE VIEW
GRANT
COMMIT
6. Verify Schema Creation

Connect again:

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev

Run:

SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'blockchain';

Expected:

 blockchain
7. Verify Blockchain Tables
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

Expected tables:

blockchain_customer_mapping
blockchain_event_sync_status
blockchain_organization_mapping
blockchain_postgres_audit_log
blockchain_transaction_integration
blockchain_wallet_integration

You may also already have previous tables from earlier steps, such as:

blockchain_wallet
blockchain_transaction
blockchain_wallet_balance
kyc_users
kyc_hashes
kyc_requests
fabric_transactions
blockchain_audit_log

That is okay.

8. Verify Required Extensions
SELECT extname
FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp', 'citext')
ORDER BY extname;

Expected:

citext
pgcrypto
uuid-ossp
9. Verify Application User Permissions
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'blockchain_app_user'
  AND table_schema = 'blockchain'
ORDER BY table_name, privilege_type;

Expected privileges:

SELECT
INSERT
UPDATE
DELETE
10. Test Login With Application User

From terminal:

psql -h 172.31.13.133 -p 5444 -U blockchain_app_user -d vfds_dev

Password:

ChangeThisStrongPassword_2026!

Then test:

SELECT current_user;

Expected:

blockchain_app_user

Test schema access:

SELECT *
FROM blockchain.vw_blockchain_customer_wallet;
11. Customer ID Mapping Logic

The purpose of the customer mapping table is to connect:

Existing KYC/customer system customer_id
        ↓
Blockchain customer_id
        ↓
Blockchain wallet address

Example:

SELECT
    blockchain_customer_id,
    source_customer_id,
    wallet_address,
    mapping_status
FROM blockchain.blockchain_customer_mapping
WHERE blockchain_customer_id = 'CUST1002';

Expected:

CUST1002 | CUST1002 | WALLET_... | ACTIVE
12. Organization ID Mapping Logic

The organization mapping table connects:

Existing bank / organization ID
        ↓
Blockchain organization ID
        ↓
Blockchain wallet / transaction ownership

Example:

SELECT
    blockchain_organization_id,
    source_organization_id,
    organization_code,
    organization_name,
    organization_type,
    mapping_status
FROM blockchain.blockchain_organization_mapping
WHERE blockchain_organization_id = 'BANK001';
13. Cross-Schema Integration With Existing KYC / Customer Schema

Because your existing KYC/customer tables may be stored in another schema, use this discovery query first:

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name ILIKE '%customer%'
   OR table_name ILIKE '%kyc%'
   OR table_name ILIKE '%organization%'
   OR table_name ILIKE '%bank%'
ORDER BY table_schema, table_name;

From your current database, you already have blockchain-related KYC tables like:

blockchain.kyc_users
blockchain.kyc_hashes
blockchain.kyc_requests

If your existing enterprise KYC schema is something like:

kyc.customer
customer.customer_master
public.customer
sdedba.customer

Then you can create cross-schema views.

13.1 Example Cross-Schema Customer View

Adjust the source table and column names based on your real KYC schema.

CREATE OR REPLACE VIEW blockchain.vw_existing_customer_mapping AS
SELECT
    c.customer_id::VARCHAR AS source_customer_id,
    c.customer_name,
    c.mobile_number,
    c.email,
    cm.blockchain_customer_id,
    cm.wallet_address,
    cm.mapping_status
FROM existing_kyc_schema.customer c
LEFT JOIN blockchain.blockchain_customer_mapping cm
    ON cm.source_customer_id = c.customer_id::VARCHAR;

If your existing table is not called existing_kyc_schema.customer, replace it with the real table name.

Example:

FROM sdedba.customer c

or:

FROM public.customer c
13.2 Example Cross-Schema Organization View
CREATE OR REPLACE VIEW blockchain.vw_existing_organization_mapping AS
SELECT
    o.organization_id::VARCHAR AS source_organization_id,
    o.organization_code,
    o.organization_name,
    om.blockchain_organization_id,
    om.organization_type,
    om.mapping_status
FROM existing_org_schema.organization o
LEFT JOIN blockchain.blockchain_organization_mapping om
    ON om.source_organization_id = o.organization_id::VARCHAR;

Replace:

existing_org_schema.organization

with the real organization table.

14. Recommended Integration API Database User

For your .env file in the Blockchain API / Middleware:

DB_HOST=172.31.13.133
DB_PORT=5444
DB_DATABASE=vfds_dev
DB_USERNAME=blockchain_app_user
DB_PASSWORD=ChangeThisStrongPassword_2026!
DB_SCHEMA=blockchain

For Node.js / Express PostgreSQL connection:

const { Pool } = require("pg");

const pool = new Pool({
  host: "172.31.13.133",
  port: 5444,
  database: "vfds_dev",
  user: "blockchain_app_user",
  password: "ChangeThisStrongPassword_2026!",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

module.exports = pool;
15. Verification SQL Queries
15.1 Verify Wallet Integration
SELECT
    wallet_address,
    blockchain_customer_id,
    blockchain_organization_id,
    customer_name,
    wallet_status,
    current_balance,
    currency_code,
    fabric_channel_name,
    chaincode_name
FROM blockchain.blockchain_wallet_integration
ORDER BY created_at DESC;
15.2 Verify Customer Wallet View
SELECT *
FROM blockchain.vw_blockchain_customer_wallet
ORDER BY synced_to_postgres_at DESC;
15.3 Verify Organization Mapping
SELECT *
FROM blockchain.blockchain_organization_mapping
ORDER BY created_at DESC;
15.4 Verify Audit Log
SELECT
    event_type,
    event_source,
    entity_type,
    entity_id,
    action_status,
    performed_by,
    performed_at
FROM blockchain.blockchain_postgres_audit_log
ORDER BY performed_at DESC;
15.5 Verify Event Sync Status
SELECT
    fabric_tx_id,
    event_name,
    sync_status,
    retry_count,
    received_at,
    processed_at
FROM blockchain.blockchain_event_sync_status
ORDER BY received_at DESC;
16. Test Insert As Application User

Login as:

psql -h 172.31.13.133 -p 5444 -U blockchain_app_user -d vfds_dev

Run:

INSERT INTO blockchain.blockchain_postgres_audit_log (
    event_type,
    event_source,
    entity_type,
    entity_id,
    action_name,
    action_status,
    request_payload,
    response_payload
)
VALUES (
    'TEST_CONNECTION',
    'POSTGRESQL',
    'DATABASE',
    'vfds_dev',
    'VERIFY_APP_USER_PERMISSION',
    'SUCCESS',
    '{"test": true}'::jsonb,
    '{"message": "Application user can insert successfully"}'::jsonb
);

Then verify:

SELECT
    event_type,
    action_name,
    action_status,
    performed_by,
    performed_at
FROM blockchain.blockchain_postgres_audit_log
WHERE event_type = 'TEST_CONNECTION'
ORDER BY performed_at DESC;

Expected:

TEST_CONNECTION | VERIFY_APP_USER_PERMISSION | SUCCESS | blockchain_app_user
17. Troubleshooting Permission Errors
Error 1
permission denied for schema blockchain

Fix:

GRANT USAGE ON SCHEMA blockchain TO blockchain_app_user;
GRANT CREATE ON SCHEMA blockchain TO blockchain_app_user;
Error 2
permission denied for table blockchain_wallet_integration

Fix:

GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA blockchain
TO blockchain_app_user;
Error 3
permission denied for sequence

Fix:

GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA blockchain
TO blockchain_app_user;
Error 4
function gen_random_uuid() does not exist

Fix:

CREATE EXTENSION IF NOT EXISTS pgcrypto;
Error 5
schema "blockchain" does not exist

Fix:

CREATE SCHEMA IF NOT EXISTS blockchain;
Error 6
role "blockchain_app_user" does not exist

Fix:

CREATE ROLE blockchain_app_user
LOGIN
PASSWORD 'ChangeThisStrongPassword_2026!';
Error 7
could not connect to server: Connection refused

Check PostgreSQL service:

sudo systemctl status postgresql

Check port:

ss -ltnp | grep 5444

Check remote connection config:

sudo nano /etc/postgresql/*/main/postgresql.conf

Make sure:

listen_addresses = '*'

Check pg_hba.conf:

sudo nano /etc/postgresql/*/main/pg_hba.conf

Example:

host    vfds_dev    blockchain_app_user    0.0.0.0/0    md5

Restart PostgreSQL:

sudo systemctl restart postgresql
18. Recommended File Structure

Create this structure:

/home/nix/u01/blockchain-integration/
└── postgresql/
    ├── step-15-postgresql-integration-setup.sql
    ├── verify-step-15-postgresql.sql
    └── README-step-15-postgresql-integration.md
19. Verification Script File

Save as:

nano /home/nix/u01/blockchain-integration/postgresql/verify-step-15-postgresql.sql

Paste:

/* ============================================================
   STEP 15 Verification Script
   ============================================================ */

\echo 'Checking current database...'
SELECT current_database();

\echo 'Checking current user...'
SELECT current_user;

\echo 'Checking blockchain schema...'
SELECT schema_name
FROM information_schema.schemata
WHERE schema_name = 'blockchain';

\echo 'Checking required extensions...'
SELECT extname
FROM pg_extension
WHERE extname IN ('pgcrypto', 'uuid-ossp', 'citext')
ORDER BY extname;

\echo 'Checking blockchain tables...'
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

\echo 'Checking blockchain views...'
SELECT table_schema, table_name
FROM information_schema.views
WHERE table_schema = 'blockchain'
ORDER BY table_name;

\echo 'Checking application user privileges...'
SELECT
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'blockchain_app_user'
  AND table_schema = 'blockchain'
ORDER BY table_name, privilege_type;

\echo 'Checking customer mapping data...'
SELECT *
FROM blockchain.blockchain_customer_mapping
ORDER BY created_at DESC;

\echo 'Checking organization mapping data...'
SELECT *
FROM blockchain.blockchain_organization_mapping
ORDER BY created_at DESC;

\echo 'Checking wallet integration data...'
SELECT *
FROM blockchain.blockchain_wallet_integration
ORDER BY created_at DESC;

\echo 'Checking customer wallet view...'
SELECT *
FROM blockchain.vw_blockchain_customer_wallet
ORDER BY synced_to_postgres_at DESC;

Run it:

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \
-f /home/nix/u01/blockchain-integration/postgresql/verify-step-15-postgresql.sql
20. STEP 15 Completion Checklist
Item	Status
PostgreSQL connection verified	✅
blockchain schema created	✅
Required extensions installed	✅
Application user created	✅
Permissions granted	✅
Customer mapping table created	✅
Organization mapping table created	✅
Wallet integration table created	✅
Transaction integration table created	✅
Audit log table created	✅
Event sync status table created	✅
Indexes created	✅
Updated-at trigger created	✅
Integration view created	✅
Verification SQL prepared	✅
Troubleshooting section prepared	✅
21. Final STEP 15 Status
STEP 15 — PostgreSQL Integration Setup: READY

This step prepares PostgreSQL as the structured integration layer between:

Blockchain API
Hyperledger Fabric
CouchDB State Database
Existing KYC / Customer Systems
PostgreSQL Reporting and Audit Layer

After this step, you are ready to continue with:

🔹 STEP 16 — Blockchain Event Listener + PostgreSQL Sync