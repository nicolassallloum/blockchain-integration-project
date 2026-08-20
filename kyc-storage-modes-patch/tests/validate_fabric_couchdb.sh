#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/kyc_storage_mode_test_YYYYMMDD_HHMMSS [project_dir]" >&2
  exit 1
fi

TEST_DIR="$1"
PROJECT_DIR="${2:-$HOME/u01/blockchain-integration}"
API_BASE="${API_BASE:-http://127.0.0.1:3001}"
COUCHDB_URL="${COUCHDB_URL:-http://127.0.0.1:5984}"
COUCHDB_DATABASE="${COUCHDB_DATABASE:-kycchannelnix1_kyc-wallet-chaincode-js}"

# shellcheck disable=SC1090
source "$TEST_DIR/test_ids.env"

CHAIN_RESPONSE="$TEST_DIR/02_blockchain_only_response.json"
BOTH_RESPONSE="$TEST_DIR/03_postgres_and_blockchain_response.json"
OUT_FILE="$TEST_DIR/05_fabric_couchdb_validation.txt"

CHAIN_WALLET="$(jq -r '.data.walletResult.wallet.walletAddress // .data.blockchain.walletAddress // empty' "$CHAIN_RESPONSE")"
BOTH_WALLET="$(jq -r '.data.walletResult.wallet.walletAddress // .data.blockchain.walletAddress // empty' "$BOTH_RESPONSE")"
CHAIN_TX="$(jq -r '.data.walletResult.blockchain.fabricTransactionId // .data.blockchain.fabricTransactionId // empty' "$CHAIN_RESPONSE")"
BOTH_TX="$(jq -r '.data.walletResult.blockchain.fabricTransactionId // .data.blockchain.fabricTransactionId // empty' "$BOTH_RESPONSE")"

COUCH_AUTH=()
if [[ -n "${COUCHDB_USER:-}" && -n "${COUCHDB_PASSWORD:-}" ]]; then
  COUCH_AUTH=( -u "$COUCHDB_USER:$COUCHDB_PASSWORD" )
fi

query_couchdb_wallet() {
  local wallet_address="$1"
  local output_file="$2"

  curl -sS "${COUCH_AUTH[@]}" \
    -H 'Content-Type: application/json' \
    -X POST \
    "$COUCHDB_URL/$COUCHDB_DATABASE/_find" \
    -d "$(jq -nc --arg wallet "$wallet_address" '{selector:{walletAddress:$wallet},limit:10}')" \
    > "$output_file"
}

query_gateway_wallet() {
  local wallet_address="$1"
  local output_file="$2"

  (
    cd "$PROJECT_DIR/blockchain-api"
    node - "$wallet_address" <<'NODE'
const fabricService = require('./src/services/fabric.service');
const walletAddress = process.argv[2];
const readFunctions = ['GetWallet', 'ReadWallet', 'QueryWallet'];

(async () => {
  const failures = [];

  for (const functionName of readFunctions) {
    try {
      const result = await fabricService.evaluateTransaction(
        functionName,
        [walletAddress],
        {
          requestSource: 'KYC_STORAGE_MODE_VALIDATION',
          sourceSystem: 'KYC_STORAGE_MODE_VALIDATION',
          createdBy: 'kyc-storage-mode-validation'
        }
      );

      console.log(JSON.stringify({
        success: true,
        functionName,
        walletAddress,
        result
      }, null, 2));

      await fabricService.disconnect();
      process.exit(0);
    } catch (error) {
      failures.push({ functionName, message: error.message });
    }
  }

  console.log(JSON.stringify({
    success: false,
    walletAddress,
    message: 'No configured read function succeeded. Use the CouchDB result below as the state validation.',
    failures
  }, null, 2));

  await fabricService.disconnect();
  process.exit(0);
})().catch(async (error) => {
  console.error(JSON.stringify({ success: false, message: error.message }, null, 2));
  try { await fabricService.disconnect(); } catch (_) {}
  process.exit(0);
});
NODE
  ) > "$output_file" 2>&1
}

{
  echo "===== RESPONSE TRANSACTION IDS ====="
  echo "BLOCKCHAIN_ONLY wallet=$CHAIN_WALLET tx=$CHAIN_TX"
  echo "POSTGRES_AND_BLOCKCHAIN wallet=$BOTH_WALLET tx=$BOTH_TX"
  echo
} > "$OUT_FILE"

if [[ -n "$CHAIN_WALLET" ]]; then
  query_gateway_wallet "$CHAIN_WALLET" "$TEST_DIR/05a_gateway_blockchain_only.json"
  query_couchdb_wallet "$CHAIN_WALLET" "$TEST_DIR/05b_couchdb_blockchain_only.json"
fi

if [[ -n "$BOTH_WALLET" ]]; then
  query_gateway_wallet "$BOTH_WALLET" "$TEST_DIR/05c_gateway_combined.json"
  query_couchdb_wallet "$BOTH_WALLET" "$TEST_DIR/05d_couchdb_combined.json"
fi

{
  echo "===== FABRIC GATEWAY: BLOCKCHAIN_ONLY ====="
  cat "$TEST_DIR/05a_gateway_blockchain_only.json" 2>/dev/null || true
  echo
  echo "===== COUCHDB: BLOCKCHAIN_ONLY ====="
  jq . "$TEST_DIR/05b_couchdb_blockchain_only.json" 2>/dev/null || cat "$TEST_DIR/05b_couchdb_blockchain_only.json" 2>/dev/null || true
  echo
  echo "===== FABRIC GATEWAY: COMBINED ====="
  cat "$TEST_DIR/05c_gateway_combined.json" 2>/dev/null || true
  echo
  echo "===== COUCHDB: COMBINED ====="
  jq . "$TEST_DIR/05d_couchdb_combined.json" 2>/dev/null || cat "$TEST_DIR/05d_couchdb_combined.json" 2>/dev/null || true
  echo
  echo "===== PLAIN PASSWORD CHECK ====="

  if grep -R --fixed-strings --quiet "$CHAIN_PASSWORD" \
    "$TEST_DIR/05a_gateway_blockchain_only.json" \
    "$TEST_DIR/05b_couchdb_blockchain_only.json" 2>/dev/null; then
    echo "FAIL: Blockchain-only plain password was found in Fabric/CouchDB output."
  else
    echo "PASS: Blockchain-only plain password was not found in Fabric/CouchDB output."
  fi

  if grep -R --fixed-strings --quiet "$BOTH_PASSWORD" \
    "$TEST_DIR/05c_gateway_combined.json" \
    "$TEST_DIR/05d_couchdb_combined.json" 2>/dev/null; then
    echo "FAIL: Combined-mode plain password was found in Fabric/CouchDB output."
  else
    echo "PASS: Combined-mode plain password was not found in Fabric/CouchDB output."
  fi

  echo
  echo "===== POSTGRES-BACKED WALLET API EXPECTATIONS ====="
  echo "BLOCKCHAIN_ONLY should return not found:"
  curl -sS -w '\nHTTP %{http_code}\n' "$API_BASE/api/v1/wallets/$CHAIN_WALLET" || true
  echo
  echo "POSTGRES_AND_BLOCKCHAIN should return the wallet:"
  curl -sS -w '\nHTTP %{http_code}\n' "$API_BASE/api/v1/wallets/$BOTH_WALLET" || true
} >> "$OUT_FILE"

cat "$OUT_FILE"
echo
echo "Fabric/CouchDB validation saved to: $OUT_FILE"
