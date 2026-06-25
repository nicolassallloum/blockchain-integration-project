#!/usr/bin/env bash
set -u

API_BASE="${API_BASE:-http://localhost:3001/api/v1/blockchain-proof/api}"
PG_DSN="${PG_DSN:-host=172.31.13.133 port=5444 dbname=vfds_dev user=pgdata}"

TMP_DIR="/tmp/blockchain-proof-step29-final-e2e"
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
  local method="$2"
  local url="$3"
  local output_file="$4"

  echo ""
  echo "----- ${name} -----"
  echo "${method} ${url}"

  if [ "$method" = "POST" ]; then
    curl -sS -X POST "$url" -o "$output_file"
  else
    curl -sS "$url" -o "$output_file"
  fi

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

assert_dashboard_core_values() {
  local file="$1"

  python3 - "$file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    payload = json.load(f)

data = payload.get("data") or {}
history = data.get("history") or {}
verification = data.get("verification") or {}
policy = data.get("securityPolicy") or {}

checks = {
    "total_history_rows_105": history.get("total_history_rows") == 105,
    "rows_without_blockchain_tx_105": history.get("rows_without_blockchain_tx") == 105,
    "rows_with_blockchain_tx_0": history.get("rows_with_blockchain_tx") == 0,
    "rows_with_retry_5": history.get("rows_with_retry") == 5,
    "total_verification_logs_10": verification.get("total_verification_logs") == 10,
    "fake_verified_rows_0": verification.get("fake_verified_rows") == 0,
    "fake_blockchain_success_metadata_rows_0": verification.get("fake_blockchain_success_metadata_rows") == 0,
    "raw_rows_returned_false": policy.get("rawRowsReturned") is False,
    "sensitive_fields_returned_false": policy.get("sensitiveFieldsReturned") is False,
    "fake_blockchain_success_allowed_false": policy.get("fakeBlockchainSuccessAllowed") is False,
}

failed = [name for name, ok in checks.items() if not ok]

if failed:
    print("[ASSERT_FAIL] Final dashboard core values failed:", ", ".join(failed))
    print(json.dumps({"history": history, "verification": verification, "securityPolicy": policy}, indent=2))
    sys.exit(1)

print("[ASSERT_PASS] Final dashboard core values are correct")
PY

  if [ $? -eq 0 ]; then
    pass "Final dashboard core values"
  else
    fail "Final dashboard core values"
  fi
}

assert_dry_run_safety() {
  local file="$1"

  python3 - "$file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    payload = json.load(f)

data = payload.get("data") or {}

checks = {
    "dryRun_true": data.get("dryRun") is True,
    "verificationLogsInserted_0": data.get("verificationLogsInserted") == 0,
    "historyRowsUpdated_0": data.get("historyRowsUpdated") == 0,
    "fakeBlockchainSuccess_false": data.get("fakeBlockchainSuccess") is False,
}

failed = [name for name, ok in checks.items() if not ok]

if failed:
    print("[ASSERT_FAIL] Final dry-run safety failed:", ", ".join(failed))
    print(json.dumps(data, indent=2))
    sys.exit(1)

print("[ASSERT_PASS] Final dry-run safety passed")
PY

  if [ $? -eq 0 ]; then
    pass "Final dry-run safety"
  else
    fail "Final dry-run safety"
  fi
}

section "STEP 29 FINAL API VALIDATION"

curl_json "Blockchain proof health" "GET" "${API_BASE}/health" "${TMP_DIR}/health.json"
assert_success "${TMP_DIR}/health.json" "Blockchain proof health"

curl_json "Retry health" "GET" "${API_BASE}/retry/health" "${TMP_DIR}/retry_health.json"
assert_success "${TMP_DIR}/retry_health.json" "Retry health"

curl_json "Verification health" "GET" "${API_BASE}/verification/logic/health" "${TMP_DIR}/verification_health.json"
assert_success "${TMP_DIR}/verification_health.json" "Verification health"

curl_json "Dashboard health" "GET" "${API_BASE}/dashboard/health" "${TMP_DIR}/dashboard_health.json"
assert_success "${TMP_DIR}/dashboard_health.json" "Dashboard health"

curl_json "Dashboard summary" "GET" "${API_BASE}/dashboard/summary" "${TMP_DIR}/dashboard_summary.json"
assert_success "${TMP_DIR}/dashboard_summary.json" "Dashboard summary"
assert_dashboard_core_values "${TMP_DIR}/dashboard_summary.json"

curl_json "Dashboard full" "GET" "${API_BASE}/dashboard/full?limit=5" "${TMP_DIR}/dashboard_full.json"
assert_success "${TMP_DIR}/dashboard_full.json" "Dashboard full"

curl_json "Latest history" "GET" "${API_BASE}/dashboard/latest-history?limit=5" "${TMP_DIR}/latest_history.json"
assert_success "${TMP_DIR}/latest_history.json" "Latest history"

curl_json "Latest verification logs" "GET" "${API_BASE}/dashboard/latest-verification-logs?limit=5" "${TMP_DIR}/latest_verification_logs.json"
assert_success "${TMP_DIR}/latest_verification_logs.json" "Latest verification logs"

curl_json "Verification candidates" "GET" "${API_BASE}/verification/candidates?limit=5" "${TMP_DIR}/verification_candidates.json"
assert_success "${TMP_DIR}/verification_candidates.json" "Verification candidates"

curl_json "Final AML verification dry run" "POST" "${API_BASE}/verification/run?recordType=AML&sourceRecordId=44571%3A%3A4184&limit=1&dryRun=true&verifiedBy=STEP_29_FINAL_E2E_DRY_RUN" "${TMP_DIR}/aml_dry_run.json"
assert_success "${TMP_DIR}/aml_dry_run.json" "Final AML verification dry run"
assert_dry_run_safety "${TMP_DIR}/aml_dry_run.json"

section "STEP 29 FINAL POSTGRESQL VALIDATION"

psql "$PG_DSN" <<'SQL'
\echo '--- Final proof history totals ---'
SELECT
    COUNT(*)::int AS total_history_rows,
    COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx,
    COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
    COUNT(*) FILTER (WHERE COALESCE(retry_count, 0) > 0)::int AS rows_with_retry
FROM blockchain.blockchain_sync_history;

\echo '--- Final record type totals ---'
SELECT
    record_type,
    COUNT(*)::int AS total_rows
FROM blockchain.blockchain_sync_history
GROUP BY record_type
ORDER BY record_type;

\echo '--- Final fake verification safety ---'
SELECT
    COUNT(*)::int AS total_verification_logs,
    COUNT(*) FILTER (
      WHERE blockchain_transaction_id IS NULL
        AND verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED')
    )::int AS fake_verified_rows,
    COUNT(*) FILTER (
      WHERE metadata ->> 'fakeBlockchainSuccess' = 'true'
    )::int AS fake_blockchain_success_metadata_rows
FROM blockchain.blockchain_verification_logs;

\echo '--- Final forbidden metadata key safety ---'
WITH forbidden AS (
    SELECT
        (
          SELECT COUNT(*)::int
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
        ) AS history_forbidden_metadata_rows,
        (
          SELECT COUNT(*)::int
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
        ) AS verification_forbidden_metadata_rows
)
SELECT *
FROM forbidden;
SQL

if [ $? -eq 0 ]; then
  pass "Final PostgreSQL validation query executed"
else
  fail "Final PostgreSQL validation query executed"
fi

section "STEP 29 FINAL AUTOMATED DATABASE ASSERTIONS"

psql "$PG_DSN" -t -A <<'SQL' > "${TMP_DIR}/final_pg_assertions.txt"
WITH checks AS (
    SELECT 'fake_verified_rows' AS check_name,
           COUNT(*)::int AS bad_count
    FROM blockchain.blockchain_verification_logs
    WHERE blockchain_transaction_id IS NULL
      AND verification_status IN ('VERIFIED', 'SUCCESS', 'PASSED', 'MATCHED')

    UNION ALL

    SELECT 'fake_blockchain_success_metadata_rows',
           COUNT(*)::int
    FROM blockchain.blockchain_verification_logs
    WHERE metadata ->> 'fakeBlockchainSuccess' = 'true'

    UNION ALL

    SELECT 'history_forbidden_metadata_rows',
           COUNT(*)::int
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

    SELECT 'verification_forbidden_metadata_rows',
           COUNT(*)::int
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

cat "${TMP_DIR}/final_pg_assertions.txt"

BAD_TOTAL=$(awk -F= '{sum += $2} END {print sum + 0}' "${TMP_DIR}/final_pg_assertions.txt")

if [ "$BAD_TOTAL" -eq 0 ]; then
  pass "Final PostgreSQL automated assertions"
else
  fail "Final PostgreSQL automated assertions"
fi

section "STEP 29 RESULT"

echo "Passed: ${PASS_COUNT}"
echo "Failed: ${FAIL_COUNT}"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "STEP 29 FINAL E2E VALIDATION PASSED"
  exit 0
fi

echo "STEP 29 FINAL E2E VALIDATION FAILED"
exit 1
