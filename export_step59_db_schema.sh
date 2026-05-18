#!/bin/bash

set -e

OUT="/home/nix/u01/blockchain-integration/step59-db-schema.txt"

echo "Exporting blockchain schema information to:"
echo "$OUT"

psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev -P pager=off -o "$OUT" <<'SQL'
\echo '===== BLOCKCHAIN TABLES ====='
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'blockchain'
ORDER BY table_name;

\echo '===== WALLETS COLUMNS ====='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'wallets'
ORDER BY ordinal_position;

\echo '===== TRANSACTIONS COLUMNS ====='
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'transactions'
ORDER BY ordinal_position;

\echo '===== ORGANIZATIONS COLUMNS ====='
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name IN ('organizations', 'blockchain_organizations')
ORDER BY table_name, ordinal_position;

\echo '===== WALLET SAMPLE ====='
SELECT *
FROM blockchain.wallets
ORDER BY created_at DESC
LIMIT 3;

\echo '===== TRANSACTION SAMPLE ====='
SELECT *
FROM blockchain.transactions
ORDER BY created_at DESC
LIMIT 3;
SQL

echo "✅ Done:"
echo "$OUT"
