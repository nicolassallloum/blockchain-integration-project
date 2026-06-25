#!/usr/bin/env bash
set -u

API_BASE="${API_BASE:-http://localhost:3001/api/v1/blockchain-proof/api}"
PG_DSN="${PG_DSN:-host=172.31.13.133 port=5444 dbname=vfds_dev user=pgdata}"

TMP_DIR="/tmp/blockchain-proof-step27"
mkdir -p "$TMP_DIR"

PASS_COUNT=0
FAIL_COUNT=0

print_section() {
  echo ""
  echo "===== $1 ====="
}

pass() {
  PASS_COUNT=$((PASS_COUNT + 1))
  echo "[PASS] $1"
}

fail() {
  FAIL_COUNT=$((FAIL_COUNT + 1))
  echo "[FAIL] $1"
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

assert_json_success() {
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

assert_dashboard_summary_values() {
  local file="$1"

  python3 - "$file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    payload = json.load(f)

data = payload.get("data") or {}
history = data.get("history") or {}
verification = data.get("verification") or {}

checks = {
    "total_history_rows_is_105": history.get("total_history_rows") == 105,
    "rows_without_blockchain_tx_is_105": history.get("rows_without_blockchain_tx") == 105,
    "rows_with_blockchain_tx_is_0": history.get("rows_with_blockchain_tx") == 0,
    "rows_with_retry_is_5": history.get("rows_with_retry") == 5,
    "fake_verified_rows_is_0": verification.get("fake_verified_rows") == 0,
    "fake_blockchain_success_metadata_rows_is_0": verification.get("fake_blockchain_success_metadata_rows") == 0,
}

failed = [name for name, ok in checks.items() if not ok]

if failed:
    print("[ASSERT_FAIL] dashboard summary values failed:", ", ".join(failed))
    print(json.dumps({"history": history, "verification": verification}, indent=2))
    sys.exit(1)

print("[ASSERT_PASS] dashboard summary values are correct")
PY

  if [ $? -eq 0 ]; then
    pass "Dashboard summary expected values"
  else
    fail "Dashboard summary expected values"
  fi
}

assert_dry_run_no_insert() {
  local file="$1"

  python3 - "$file" <<'PY'
import json
import sys

with open(sys.argv[1], "r", encoding="utf-8") as f:
    payload = json.load(f)

data = payload.get("data") or {}

checks = {
    "dryRun_true": data.get("dryRun") is True,
    "verificationLogsInserted_zero": data.get("verificationLogsInserted") == 0,
    "historyRowsUpdated_zero": data.get("historyRowsUpdated") == 0,
    "fakeBlockchainSuccess_false": data.get("fakeBlockchainSuccess") is False,
}

failed = [name for name, ok in checks.items() if not ok]

if failed:
    print("[ASSERT_FAIL] dry-run safety failed:", ", ".join(failed))
    print(json.dumps(data, indent=2))
    sys.exit(1)

print("[ASSERT_PASS] dry-run did not insert logs or update history")
PY

  if [ $? -eq 0 ]; then
    pass "Verification dry-run safety"
  else
    fail "Verification dry-run safety"
  fi
}

print_section "STEP 27 FULL FLOW API TESTS"

curl_json "Blockchain proof API health" "GET" "${API_BASE}/health" "${TMP_DIR}/health.json"
assert_json_success "${TMP_DIR}/health.json" "Blockchain proof API health"

curl_json "Retry health" "GET" "${API_BASE}/retry/health" "${TMP_DIR}/retry_health.json"
assert_json_success "${TMP_DIR}/retry_health.json" "Retry health"

curl_json "Verification logic health" "GET" "${API_BASE}/verification/logic/health" "${TMP_DIR}/verification_health.json"
assert_json_success "${TMP_DIR}/verification_health.json" "Verification logic health"

curl_json "Dashboard health" "GET" "${API_BASE}/dashboard/health" "${TMP_DIR}/dashboard_health.json"
assert_json_success "${TMP_DIR}/dashboard_health.json" "Dashboard health"

curl_json "Dashboard summary" "GET" "${API_BASE}/dashboard/summary" "${TMP_DIR}/dashboard_summary.json"
assert_json_success "${TMP_DIR}/dashboard_summary.json" "Dashboard summary"
assert_dashboard_summary_values "${TMP_DIR}/dashboard_summary.json"

curl_json "Dashboard full" "GET" "${API_BASE}/dashboard/full?limit=5" "${TMP_DIR}/dashboard_full.json"
assert_json_success "${TMP_DIR}/dashboard_full.json" "Dashboard full"

curl_json "Record type breakdown" "GET" "${API_BASE}/dashboard/record-types" "${TMP_DIR}/record_types.json"
assert_json_success "${TMP_DIR}/record_types.json" "Record type breakdown"

curl_json "Sync status breakdown" "GET" "${API_BASE}/dashboard/sync-status" "${TMP_DIR}/sync_status.json"
assert_json_success "${TMP_DIR}/sync_status.json" "Sync status breakdown"

curl_json "Verification status breakdown" "GET" "${API_BASE}/dashboard/verification-status" "${TMP_DIR}/verification_status.json"
assert_json_success "${TMP_DIR}/verification_status.json" "Verification status breakdown"

curl_json "Retry summary" "GET" "${API_BASE}/dashboard/retry-summary" "${TMP_DIR}/retry_summary.json"
assert_json_success "${TMP_DIR}/retry_summary.json" "Retry summary"

curl_json "Latest history" "GET" "${API_BASE}/dashboard/latest-history?limit=5" "${TMP_DIR}/latest_history.json"
assert_json_success "${TMP_DIR}/latest_history.json" "Latest history"

curl_json "Latest verification logs" "GET" "${API_BASE}/dashboard/latest-verification-logs?limit=5" "${TMP_DIR}/latest_verification_logs.json"
assert_json_success "${TMP_DIR}/latest_verification_logs.json" "Latest verification logs"

curl_json "Verification candidates" "GET" "${API_BASE}/verification/candidates?limit=5" "${TMP_DIR}/verification_candidates.json"
assert_json_success "${TMP_DIR}/verification_candidates.json" "Verification candidates"

curl_json "AML verification dry run" "POST" "${API_BASE}/verification/run?recordType=AML&sourceRecordId=44571%3A%3A4184&limit=1&dryRun=true&verifiedBy=STEP_27_FULL_FLOW_DRY_RUN" "${TMP_DIR}/aml_dry_run.json"
assert_json_success "${TMP_DIR}/aml_dry_run.json" "AML verification dry run"
assert_dry_run_no_insert "${TMP_DIR}/aml_dry_run.json"

print_section "STEP 27 POSTGRESQL VALIDATION"

psql "$PG_DSN" <<'SQL'
SELECT
    COUNT(*)::int AS total_history_rows,
    COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS rows_without_blockchain_tx,
    COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS rows_with_blockchain_tx,
    COUNT(*) FILTER (WHERE COALESCE(retry_count, 0) > 0)::int AS rows_with_retry
FROM blockchain.blockchain_sync_history;

SELECT
    record_type,
    COUNT(*)::int AS total_rows
FROM blockchain.blockchain_sync_history
GROUP BY record_type
ORDER BY record_type;

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
SQL

if [ $? -eq 0 ]; then
  pass "PostgreSQL validation query executed"
else
  fail "PostgreSQL validation query executed"
fi

print_section "STEP 27 RESULT"

echo "Passed: ${PASS_COUNT}"
echo "Failed: ${FAIL_COUNT}"

if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "STEP 27 FULL FLOW TEST PASSED"
  exit 0
fi

echo "STEP 27 FULL FLOW TEST FAILED"
exit 1
