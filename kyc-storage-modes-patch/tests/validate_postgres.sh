#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/kyc_storage_mode_test_YYYYMMDD_HHMMSS/test_ids.env" >&2
  exit 1
fi

TEST_ENV="$1"
# shellcheck disable=SC1090
source "$TEST_ENV"

OUT_FILE="${2:-$(dirname "$TEST_ENV")/04_postgres_validation.txt}"

psql -X -v ON_ERROR_STOP=1 \
  -v pg_customer_id="$PG_CUSTOMER_ID" \
  -v chain_customer_id="$CHAIN_CUSTOMER_ID" \
  -v both_customer_id="$BOTH_CUSTOMER_ID" \
  > "$OUT_FILE" <<'SQL'
\pset pager off
\x off

\echo '===== KYC REQUEST ROWS ====='
SELECT
  request_id,
  customer_id,
  full_name,
  storage_mode,
  request_status,
  wallet_address,
  ledger_reference,
  blockchain_tx_id,
  created_at,
  updated_at
FROM blockchain.blockchain_kyc_wallet_requests
WHERE customer_id IN (
  :'pg_customer_id',
  :'chain_customer_id',
  :'both_customer_id'
)
ORDER BY created_at;

\echo '===== EXPECTED KYC REQUEST COUNTS ====='
SELECT
  customer_id,
  COUNT(*) AS request_count
FROM blockchain.blockchain_kyc_wallet_requests
WHERE customer_id IN (
  :'pg_customer_id',
  :'chain_customer_id',
  :'both_customer_id'
)
GROUP BY customer_id
ORDER BY customer_id;

\echo 'Expected: POSTGRES_ONLY=1, BLOCKCHAIN_ONLY=0, POSTGRES_AND_BLOCKCHAIN=1'

\echo '===== POSTGRES WALLET ROWS ====='
SELECT
  wallet_id,
  customer_id,
  wallet_address,
  organization_id,
  organization_code,
  wallet_type,
  status,
  password_hash IS NOT NULL AS has_password_hash,
  CASE
    WHEN password_hash LIKE '$2%' THEN 'BCRYPT'
    WHEN password_hash IS NULL THEN 'NONE'
    ELSE 'OTHER'
  END AS password_hash_type,
  fabric_tx_id,
  fabric_transaction_id,
  created_at
FROM blockchain.wallets
WHERE customer_id IN (
  :'pg_customer_id',
  :'chain_customer_id',
  :'both_customer_id'
)
ORDER BY created_at;

\echo '===== EXPECTED WALLET COUNTS ====='
SELECT
  customer_id,
  COUNT(*) AS wallet_count
FROM blockchain.wallets
WHERE customer_id IN (
  :'pg_customer_id',
  :'chain_customer_id',
  :'both_customer_id'
)
GROUP BY customer_id
ORDER BY customer_id;

\echo 'Expected: POSTGRES_ONLY=0, BLOCKCHAIN_ONLY=0, POSTGRES_AND_BLOCKCHAIN=1'
SQL

cat "$OUT_FILE"
echo
echo "PostgreSQL validation saved to: $OUT_FILE"
