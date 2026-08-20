#!/usr/bin/env bash

set -uo pipefail

PROJECT_ROOT="$HOME/u01/blockchain-integration"
RESULT_DIR="$PROJECT_ROOT/benchmark-results"
API_BASE_URL="http://127.0.0.1:3001"

COUNT="1000"
CONCURRENCY="1000"
TIMEOUT_MS="600000"

RUN_ID="BKYC_SMOKE_1000_C1000_$(date +%Y%m%d_%H%M%S)"

CONSOLE_LOG="$RESULT_DIR/${RUN_ID}_console.log"
REPORT_FILE="$RESULT_DIR/${RUN_ID}_report.json"
VMSTAT_LOG="$RESULT_DIR/${RUN_ID}_vmstat.log"
DOCKER_STATS_LOG="$RESULT_DIR/${RUN_ID}_docker_stats.log"

mkdir -p "$RESULT_DIR"
cd "$PROJECT_ROOT" || return 1

VMSTAT_PID=""
DOCKER_STATS_PID=""

stop_monitors() {
  [[ -n "$VMSTAT_PID" ]] &&
    kill "$VMSTAT_PID" 2>/dev/null || true

  [[ -n "$DOCKER_STATS_PID" ]] &&
    kill "$DOCKER_STATS_PID" 2>/dev/null || true

  wait "$VMSTAT_PID" 2>/dev/null || true
  wait "$DOCKER_STATS_PID" 2>/dev/null || true
}

trap stop_monitors EXIT INT TERM

GATEWAY_LIMIT="$(
  docker inspect peer0.org1.blockchain.local \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
  awk -F= '
    $1 == "CORE_PEER_LIMITS_CONCURRENCY_GATEWAYSERVICE" {
      print $2
    }
  '
)"

echo "============================================================"
echo "BKYC CONCURRENCY 1000 SMOKE TEST"
echo "============================================================"
echo "Run ID            : $RUN_ID"
echo "Count             : $COUNT"
echo "Concurrency       : $CONCURRENCY"
echo "Gateway capacity  : $GATEWAY_LIMIT"
echo "Cleanup           : DISABLED"
echo "============================================================"

if [[ ! "$GATEWAY_LIMIT" =~ ^[0-9]+$ ]] ||
   [[ "$GATEWAY_LIMIT" -le "$CONCURRENCY" ]]
then
  echo "[FAIL] Gateway limit must be greater than concurrency."
  return 1
fi

curl \
  --fail \
  --silent \
  --show-error \
  "$API_BASE_URL/api/v1/health" |
jq .

vmstat 1 >"$VMSTAT_LOG" &
VMSTAT_PID=$!

(
  while true
  do
    echo "============================================================"
    date --iso-8601=seconds

    docker stats \
      --no-stream \
      --format \
      'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}'

    sleep 2
  done
) >"$DOCKER_STATS_LOG" 2>&1 &

DOCKER_STATS_PID=$!

ulimit -n 65535 2>/dev/null || true

node \
  --max-old-space-size=8192 \
  benchmark_kyc.js \
  --count "$COUNT" \
  --concurrency "$CONCURRENCY" \
  --timeout-ms "$TIMEOUT_MS" \
  --confirm-large \
  --keep \
  --run-id "$RUN_ID" \
  2>&1 |
tee "$CONSOLE_LOG"

BENCHMARK_STATUS=${PIPESTATUS[0]}

echo
echo "Benchmark status: $BENCHMARK_STATUS"

if [[ -f "$REPORT_FILE" ]]; then
  jq '{
    runId,
    count: .configuration.count,
    concurrency: .configuration.concurrency,
    attempted: .creation.attempted,
    created: .creation.created,
    failed: .creation.failed,
    successRatePercent: .creation.successRatePercent,
    durationMs: .creation.durationMs,
    throughputTps: .creation.throughputTps,
    averageLatencyMs: .creation.averageLatencyMs,
    p50LatencyMs: .creation.p50LatencyMs,
    p95LatencyMs: .creation.p95LatencyMs,
    p99LatencyMs: .creation.p99LatencyMs,
    maxLatencyMs: .creation.maxLatencyMs
  }' "$REPORT_FILE"
else
  echo "[FAIL] Benchmark report was not generated."
  return 1
fi

FAILED="$(
  jq -r '.creation.failed // -1' \
    "$REPORT_FILE"
)"

CREATED="$(
  jq -r '.creation.created // -1' \
    "$REPORT_FILE"
)"

if [[ "$BENCHMARK_STATUS" -eq 0 &&
      "$FAILED" -eq 0 &&
      "$CREATED" -eq "$COUNT" ]]
then
  echo "[PASS] C1000 smoke benchmark completed successfully."
  return 0
fi

echo "[FAIL] C1000 smoke benchmark did not achieve 100% success."
return 1
