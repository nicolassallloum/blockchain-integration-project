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