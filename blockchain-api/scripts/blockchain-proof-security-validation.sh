#!/usr/bin/env bash
set -u

API_BASE="${API_BASE:-http://localhost:3001/api/v1/blockchain-proof/api}"
PG_DSN="${PG_DSN:-host=172.31.13.133 port=5444 dbname=vfds_dev user=pgdata}"

TMP_DIR="/tmp/blockchain-proof-step28-security"
mkdir -p "$TMP_DIR"

PASS_COUNT=0
FAIL_COUNT=0

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] $1"
}

section() {
  echo ""
  echo "===== $1 ====="
}

curl_json() {
  local name="$1"
  local url="$2"
  local output_file="$3"

  echo ""
  echo "----- ${name} -----"
  echo "GET ${url}"

  curl -sS "$url" -o "$output_file"
  python3 -m json.tool "$output_file" || true
}

assert_success() {
  local file="$1"
  local label="$2"

  python3 - "$file" "$label" <<'PY'
import json
import sys

path = sys.argv[1]
label = sys.argv[2]

try:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
except Exception as exc:
    print(f"[ASSERT_FAIL] {label}: invalid JSON: {exc}")
    sys.exit(1)

if payload.get("success") is True:
    print(f"[ASSERT_PASS] {label}: success=true")
    sys.exit(0)

print(f"[ASSERT_FAIL] {label}: success is not true")
print(payload.get("message"))
sys.exit(1)
PY

  if [ $? -eq 0 ]; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_no_forbidden_response_keys() {
  local file="$1"
  local label="$2"

  python3 - "$file" "$label" <<'PY'
import json
import sys

path = sys.argv[1]
label = sys.argv[2]

forbidden_key_fragments = [
    "password",
    "secret",
    "token",
    "authorization",
    "authheader",
    "privatekey",
    "apikey",
    "api_key",
    "rule_sql",
    "rulesql",
    "rule_message",
    "rulemessage",
    "raw_row",
    "rawrow",
    "source_row",
    "sourcerow",
    "source_payload",
    "sourcepayload",
    "customer_name",
    "customername",
    "national_id",
    "nationalid",
    "passport",
    "iban",
    "card_number",
    "cardnumber"
]

allowed_exact_keys = {
    "blockchainKey",
    "blockchainTransactionId",
    "hasBlockchainTransaction",
    "blockchainVerificationStatus",
    "blockchainVerificationMessage",
    "fakeBlockchainSuccess",
    "fakeBlockchainSuccessAllowed",
    "fake_blockchain_success_metadata_rows",
    "fake_verified_rows",
    "sensitiveFieldsReturned",
    "sensitiveFieldsExcluded",
    "rawRowsReturned",
    "rawSourceRowExcluded",
    "sourceRecordId",
    "sourceView",
    "sourceViewName",
    "totalSourceRecords"
}

try:
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
except Exception as exc:
    print(f"[ASSERT_FAIL] {label}: invalid JSON: {exc}")
    sys.exit(1)

bad_paths = []

def walk(value, path="root"):
    if isinstance(value, dict):
        for key, child in value.items():
            key_text = str(key)
            key_lower = key_text.lower()

            if key_text not in allowed_exact_keys:
                for fragment in forbidden_key_fragments:
                    if fragment in key_lower:
                        bad_paths.append(f"{path}.{key_text}")
                        break

            walk(child, f"{path}.{key_text}")
    elif isinstance(value, list):
        for index, item in enumerate(value):
            walk(item, f"{path}[{index}]")

walk(payload)

if bad_paths:
    print(f"[ASSERT_FAIL] {label}: forbidden response keys found")
    for item in bad_paths[:50]:
        print(item)
    sys.exit(1)

print(f"[ASSERT_PASS] {label}: no forbidden response keys")
PY

  if [ $? -eq 0 ]; then
    pass "$label forbidden-key scan"
  else
    fail "$label forbidden-key scan"
  fi
}

assert_security_policy_flags() {
  local file="$1"
  local label="$2"

  python3 - "$file" "$label" <<'PY'
import json
import sys

path = sys.argv[1]
label = sys.argv[2]

with open(path, "r", encoding="utf-8") as f:
    payload = json.load(f)

policy_blocks = []

def walk(value):
    if isinstance(value, dict):
        if "securityPolicy" in value and isinstance(value["securityPolicy"], dict):
            policy_blocks.append(value["securityPolicy"])
        for child in value.values():
            walk(child)
    elif isinstance(value, list):
        for item in value:
            walk(item)

walk(payload)

if not policy_blocks:
    print(f"[ASSERT_FAIL] {label}: no securityPolicy block found")
    sys.exit(1)

failed = []

for index, policy in enumerate(policy_blocks):
    if policy.get("rawRowsReturned") is not False:
        failed.append(f"policy[{index}].rawRowsReturned is not false")

    if policy.get("sensitiveFieldsReturned") is not False:
        failed.append(f"policy[{index}].sensitiveFieldsReturned is not false")

    if "fakeBlockchainSuccessAllowed" in policy and policy.get("fakeBlockchainSuccessAllowed") is not False:
        failed.append(f"policy[{index}].fakeBlockchainSuccessAllowed is not false")

    if "fakeBlockchainSuccess" in policy and policy.get("fakeBlockchainSuccess") is not False:
        failed.append(f"policy[{index}].fakeBlockchainSuccess is not false")

if failed:
    print(f"[ASSERT_FAIL] {label}: security policy failed")
    for item in failed:
        print(item)
    sys.exit(1)

print(f"[ASSERT_PASS] {label}: securityPolicy blocks are safe")
PY

  if [ $? -eq 0 ]; then
    pass "$label security policy"
  else
    fail "$label security policy"
  fi
}

section "STEP 28 API SECURITY RESPONSE VALIDATION"

curl_json "Dashboard health" "${API_BASE}/dashboard/health" "${TMP_DIR}/dashboard_health.json"
assert_success "${TMP_DIR}/dashboard_health.json" "Dashboard health"
assert_security_policy_flags "${TMP_DIR}/dashboard_health.json" "Dashboard health"
assert_no_forbidden_response_keys "${TMP_DIR}/dashboard_health.json" "Dashboard health"

curl_json "Dashboard summary" "${API_BASE}/dashboard/summary" "${TMP_DIR}/dashboard_summary.json"
assert_success "${TMP_DIR}/dashboard_summary.json" "Dashboard summary"
assert_security_policy_flags "${TMP_DIR}/dashboard_summary.json" "Dashboard summary"
assert_no_forbidden_response_keys "${TMP_DIR}/dashboard_summary.json" "Dashboard summary"

curl_json "Dashboard full" "${API_BASE}/dashboard/full?limit=5" "${TMP_DIR}/dashboard_full.json"
assert_success "${TMP_DIR}/dashboard_full.json" "Dashboard full"
assert_security_policy_flags "${TMP_DIR}/dashboard_full.json" "Dashboard full"
assert_no_forbidden_response_keys "${TMP_DIR}/dashboard_full.json" "Dashboard full"

curl_json "Latest history" "${API_BASE}/dashboard/latest-history?limit=10" "${TMP_DIR}/latest_history.json"
assert_success "${TMP_DIR}/latest_history.json" "Latest history"
assert_no_forbidden_response_keys "${TMP_DIR}/latest_history.json" "Latest history"

curl_json "Latest verification logs" "${API_BASE}/dashboard/latest-verification-logs?limit=10" "${TMP_DIR}/latest_verification_logs.json"
assert_success "${TMP_DIR}/latest_verification_logs.json" "Latest verification logs"
assert_no_forbidden_response_keys "${TMP_DIR}/latest_verification_logs.json" "Latest verification logs"

curl_json "Retry health" "${API_BASE}/retry/health" "${TMP_DIR}/retry_health.json"
assert_success "${TMP_DIR}/retry_health.json" "Retry health"
assert_security_policy_flags "${TMP_DIR}/retry_health.json" "Retry health"
assert_no_forbidden_response_keys "${TMP_DIR}/retry_health.json" "Retry health"

curl_json "Verification logic health" "${API_BASE}/verification/logic/health" "${TMP_DIR}/verification_logic_health.json"
assert_success "${TMP_DIR}/verification_logic_health.json" "Verification logic health"
assert_no_forbidden_response_keys "${TMP_DIR}/verification_logic_health.json" "Verification logic health"

section "STEP 28 POSTGRESQL SECURITY VALIDATION"

psql "$PG_DSN" <<'SQL'
\echo '--- 1. Fake verified rows must be zero ---'
SELECT
    COUNT(*)::int AS fake_verified_rows
FROM blockchain.blockchain_verification_logs
WHERE blockchain_transaction_id IS NULL
  AND verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED');

\echo '--- 2. Fake blockchain success metadata must be zero ---'
SELECT
    COUNT(*)::int AS fake_blockchain_success_metadata_rows
FROM blockchain.blockchain_verification_logs
WHERE metadata ->> 'fakeBlockchainSuccess' = 'true';

\echo '--- 3. History rows must not contain raw/sensitive metadata keys ---'
SELECT
    COUNT(*)::int AS history_rows_with_forbidden_metadata_keys
FROM blockchain.blockchain_sync_history
WHERE metadata ?| ARRAY[
    'rawRow',
    'sourceRow',
    'sourcePayload',
    'payload',
    'ruleSql',
    'ruleSQL',
    'ruleMessage',
    'customerName',
    'nationalId',
    'passport',
    'password',
    'token',
    'secret'
];

\echo '--- 4. Verification logs must not contain raw/sensitive metadata keys ---'
SELECT
    COUNT(*)::int AS verification_logs_with_forbidden_metadata_keys
FROM blockchain.blockchain_verification_logs
WHERE metadata ?| ARRAY[
    'rawRow',
    'sourceRow',
    'sourcePayload',
    'payload',
    'ruleSql',
    'ruleSQL',
    'ruleMessage',
    'customerName',
    'nationalId',
    'passport',
    'password',
    'token',
    'secret'
];

\echo '--- 5. History rows proof-only flags ---'
SELECT
    COUNT(*)::int AS history_rows_total,
    COUNT(*) FILTER (WHERE metadata ->> 'proofOnly' = 'true')::int AS proof_only_rows,
    COUNT(*) FILTER (WHERE metadata ->> 'rawSourceRowExcluded' = 'true')::int AS raw_source_excluded_rows,
    COUNT(*) FILTER (WHERE metadata ->> 'sensitiveFieldsExcluded' = 'true')::int AS sensitive_fields_excluded_rows
FROM blockchain.blockchain_sync_history;

\echo '--- 6. Verification logs proof-only flags ---'
SELECT
    COUNT(*)::int AS verification_logs_total,
    COUNT(*) FILTER (WHERE metadata ->> 'proofOnly' = 'true')::int AS proof_only_logs,
    COUNT(*) FILTER (WHERE metadata ->> 'rawSourceRowExcluded' = 'true')::int AS raw_source_excluded_logs,
    COUNT(*) FILTER (WHERE metadata ->> 'sensitiveFieldsExcluded' = 'true')::int AS sensitive_fields_excluded_logs
FROM blockchain.blockchain_verification_logs;

\echo '--- 7. Blockchain TX link safety ---'
SELECT
    COUNT(*)::int AS rows_with_blockchain_tx,
    COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL AND sync_status IN ('PENDING', 'FAILED'))::int AS linked_tx_pending_or_failed_rows
FROM blockchain.blockchain_sync_history;
SQL

if [ $? -eq 0 ]; then
  pass "PostgreSQL security validation query executed"
else
  fail "PostgreSQL security validation query executed"
fi

section "STEP 28 AUTOMATED POSTGRESQL ASSERTIONS"

psql "$PG_DSN" -t -A <<'SQL' > "${TMP_DIR}/pg_security_assertions.txt"
WITH checks AS (
    SELECT
        'fake_verified_rows' AS check_name,
        COUNT(*)::int AS bad_count
    FROM blockchain.blockchain_verification_logs
    WHERE blockchain_transaction_id IS NULL
      AND verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED')

    UNION ALL

    SELECT
        'fake_blockchain_success_metadata_rows' AS check_name,
        COUNT(*)::int AS bad_count
    FROM blockchain.blockchain_verification_logs
    WHERE metadata ->> 'fakeBlockchainSuccess' = 'true'

    UNION ALL

    SELECT
        'history_rows_with_forbidden_metadata_keys' AS check_name,
        COUNT(*)::int AS bad_count
    FROM blockchain.blockchain_sync_history
    WHERE metadata ?| ARRAY[
        'rawRow',
        'sourceRow',
        'sourcePayload',
        'payload',
        'ruleSql',
        'ruleSQL',
        'ruleMessage',
        'customerName',
        'nationalId',
        'passport',
        'password',
        'token',
        'secret'
    ]

    UNION ALL

    SELECT
        'verification_logs_with_forbidden_metadata_keys' AS check_name,
        COUNT(*)::int AS bad_count
    FROM blockchain.blockchain_verification_logs
    WHERE metadata ?| ARRAY[
        'rawRow',
        'sourceRow',
        'sourcePayload',
        'payload',
        'ruleSql',
        'ruleSQL',
        'ruleMessage',
        'customerName',
        'nationalId',
        'passport',
        'password',
        'token',
        'secret'
    ]
)
SELECT check_name || '=' || bad_count
FROM checks
ORDER BY check_name;
SQL

cat "${TMP_DIR}/pg_security_assertions.txt"

BAD_TOTAL=$(awk -F= '{sum += $2} END {print sum + 0}' "${TMP_DIR}/pg_security_assertions.txt")

if [ "$BAD_TOTAL" -eq 0 ]; then
  pass "PostgreSQL security assertions"
else
  fail "PostgreSQL security assertions"
fi

section "STEP 28 RESULT"

echo "Passed: ${PASS_COUNT}"
echo "Failed: ${FAIL_COUNT}"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "STEP 28 SECURITY VALIDATION PASSED"
  exit 0
fi

echo "STEP 28 SECURITY VALIDATION FAILED"
exit 1
