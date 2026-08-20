#!/usr/bin/env bash
# One-million KYC insert-only benchmark for Hyperledger Fabric.
# Designed for: ~/u01/blockchain-integration
# Default concurrency: 400 (below the current Gateway limit of 500).

set -Eeuo pipefail
shopt -s nullglob

###############################################################################
# 1. CONFIGURATION
###############################################################################
PROJECT_DIR="${PROJECT_DIR:-$HOME/u01/blockchain-integration}"
RESULT_ROOT="${RESULT_ROOT:-$PROJECT_DIR/benchmark-results}"
API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3001}"
BENCHMARK_SCRIPT="${BENCHMARK_SCRIPT:-$PROJECT_DIR/benchmark_kyc.js}"

COUNT="${COUNT:-1000000}"
CONCURRENCY="${CONCURRENCY:-400}"
REQUEST_TIMEOUT_MS="${REQUEST_TIMEOUT_MS:-600000}"
NODE_HEAP_MB="${NODE_HEAP_MB:-8192}"

# Safety controls. Set STOP_ON_REPEATED_ERRORS=false only when you explicitly
# want the test to continue after repeated infrastructure failures.
STOP_ON_REPEATED_ERRORS="${STOP_ON_REPEATED_ERRORS:-true}"
MAX_HTTP_502="${MAX_HTTP_502:-10}"
MAX_CREATE_FAILURES="${MAX_CREATE_FAILURES:-10}"
MAX_GATEWAY_LIMIT_ERRORS="${MAX_GATEWAY_LIMIT_ERRORS:-1}"
MAX_DISK_USED_PERCENT="${MAX_DISK_USED_PERCENT:-94}"
MIN_FREE_GB="${MIN_FREE_GB:-50}"
MONITOR_INTERVAL_SECONDS="${MONITOR_INTERVAL_SECONDS:-15}"
RESOURCE_INTERVAL_SECONDS="${RESOURCE_INTERVAL_SECONDS:-10}"
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-60}"

# Sample validation after completion. This does not delete any customer.
SAMPLE_VERIFY_COUNT="${SAMPLE_VERIFY_COUNT:-20}"

RUN_ID="${RUN_ID:-BKYC_1000000_C${CONCURRENCY}_$(date +%Y%m%d_%H%M%S)}"
RUN_DIR="$RESULT_ROOT/$RUN_ID"

MASTER_LOG="$RUN_DIR/${RUN_ID}_master.log"
CONSOLE_LOG="$RUN_DIR/${RUN_ID}_console.log"
PROGRESS_CSV="$RUN_DIR/${RUN_ID}_progress.csv"
RESOURCE_LOG="$RUN_DIR/${RUN_ID}_resource_snapshots.log"
DOCKER_STATS_LOG="$RUN_DIR/${RUN_ID}_docker_stats.log"
CONTAINER_STATUS_LOG="$RUN_DIR/${RUN_ID}_container_status.log"
VMSTAT_LOG="$RUN_DIR/${RUN_ID}_vmstat.log"
IOSTAT_LOG="$RUN_DIR/${RUN_ID}_iostat.log"
PIDSTAT_LOG="$RUN_DIR/${RUN_ID}_pidstat.log"
HEALTH_LOG="$RUN_DIR/${RUN_ID}_health_monitor.log"
HEALTH_BEFORE_FILE="$RUN_DIR/${RUN_ID}_health_before.json"
HEALTH_AFTER_FILE="$RUN_DIR/${RUN_ID}_health_after.json"
COUNT_BEFORE_FILE="$RUN_DIR/${RUN_ID}_count_before.json"
COUNT_AFTER_FILE="$RUN_DIR/${RUN_ID}_count_after.json"
PREFLIGHT_FILE="$RUN_DIR/${RUN_ID}_preflight.txt"
FINAL_SUMMARY_FILE="$RUN_DIR/${RUN_ID}_final_summary.json"
SAMPLE_VERIFY_FILE="$RUN_DIR/${RUN_ID}_sample_verification.csv"
FAILED_IDS_FILE="$RUN_DIR/${RUN_ID}_failed_ids.txt"
FAILED_RECON_FILE="$RUN_DIR/${RUN_ID}_failed_reconciliation.csv"
CHECKSUM_FILE="$RUN_DIR/${RUN_ID}_checksums.sha256"
ARCHIVE_FILE="$RESULT_ROOT/${RUN_ID}_DETAILED_LOGS.tar.gz"
ABORT_REASON_FILE="$RUN_DIR/${RUN_ID}_abort_reason.txt"

# Files created by benchmark_kyc.js in RESULT_ROOT.
REPORT_FILE="$RESULT_ROOT/${RUN_ID}_report.json"
CREATED_MANIFEST="$RESULT_ROOT/${RUN_ID}_created.jsonl"
CLEANUP_MANIFEST="$RESULT_ROOT/${RUN_ID}_cleanup.jsonl"
PAYLOAD_SAMPLE="$RESULT_ROOT/${RUN_ID}_payload_sample.json"

START_EPOCH="$(date +%s)"
START_ISO="$(date --iso-8601=seconds)"

BENCH_PID=""
VMSTAT_PID=""
IOSTAT_PID=""
PIDSTAT_PID=""
DOCKER_STATS_PID=""
CONTAINER_STATUS_PID=""
RESOURCE_PID=""
HEALTH_PID=""
PROGRESS_PID=""
ABORT_REASON=""
BENCHMARK_EXIT_CODE=999

REQUIRED_CONTAINERS=(
  "peer0.org1.blockchain.local"
  "peer0.org2.blockchain.local"
  "couchdb0.org1"
  "couchdb0.org2"
  "orderer.blockchain.local"
)

###############################################################################
# 2. HELPERS
###############################################################################
set_abort_reason() {
  ABORT_REASON="$1"
  printf '%s\n' "$ABORT_REASON" > "$ABORT_REASON_FILE"
}

log() {
  printf '%s %s\n' "$(date --iso-8601=seconds)" "$*"
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

safe_json_get() {
  local file="$1"
  local filter="$2"
  local fallback="${3:-null}"

  if [[ -s "$file" ]] && jq -e . "$file" >/dev/null 2>&1; then
    jq -r "$filter // $fallback" "$file" 2>/dev/null || printf '%s\n' "$fallback"
  else
    printf '%s\n' "$fallback"
  fi
}

get_manifest_count() {
  if [[ -f "$CREATED_MANIFEST" ]]; then
    wc -l < "$CREATED_MANIFEST" | tr -d '[:space:]'
  else
    printf '0\n'
  fi
}

get_log_count() {
  local pattern="$1"
  local file="$2"

  if [[ -f "$file" ]]; then
    grep -cE "$pattern" "$file" 2>/dev/null || true
  else
    printf '0\n'
  fi
}

get_disk_used_percent() {
  df -P "$PROJECT_DIR" | awk 'NR==2 {gsub("%", "", $5); print $5}'
}

get_free_gb() {
  df -Pk "$PROJECT_DIR" | awk 'NR==2 {printf "%d", $4 / 1024 / 1024}'
}

container_is_running() {
  local container="$1"
  [[ "$(docker inspect -f '{{.State.Running}}' "$container" 2>/dev/null || true)" == "true" ]]
}

stop_process_tree() {
  local pid="${1:-}"

  [[ -n "$pid" ]] || return 0
  kill -0 "$pid" 2>/dev/null || return 0

  log "Sending SIGINT to benchmark PID $pid."
  pkill -INT -P "$pid" 2>/dev/null || true
  kill -INT "$pid" 2>/dev/null || true

  for _ in {1..30}; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done

  log "Benchmark did not stop after SIGINT; sending SIGTERM."
  pkill -TERM -P "$pid" 2>/dev/null || true
  kill -TERM "$pid" 2>/dev/null || true

  for _ in {1..15}; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 1
  done

  log "Benchmark did not stop after SIGTERM; sending SIGKILL."
  pkill -KILL -P "$pid" 2>/dev/null || true
  kill -KILL "$pid" 2>/dev/null || true
}

stop_monitor_pid() {
  local pid="${1:-}"
  [[ -n "$pid" ]] || return 0
  kill "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
}

stop_all_monitors() {
  stop_monitor_pid "$PROGRESS_PID"
  stop_monitor_pid "$HEALTH_PID"
  stop_monitor_pid "$RESOURCE_PID"
  stop_monitor_pid "$CONTAINER_STATUS_PID"
  stop_monitor_pid "$DOCKER_STATS_PID"
  stop_monitor_pid "$PIDSTAT_PID"
  stop_monitor_pid "$IOSTAT_PID"
  stop_monitor_pid "$VMSTAT_PID"
}

capture_container_logs() {
  local container
  local destination="$RUN_DIR/container-logs"

  mkdir -p "$destination"

  while IFS= read -r container; do
    [[ -n "$container" ]] || continue

    docker logs \
      --since "$START_EPOCH" \
      "$container" \
      > "$destination/${container}.log" \
      2>&1 || true
  done < <(
    docker ps -a --format '{{.Names}}' \
      | grep -Ei 'peer|orderer|couch|chaincode|fabric' \
      | sort -u
  )
}

on_signal() {
  local signal_name="$1"
  set_abort_reason "Received $signal_name"
  log "$ABORT_REASON"
  stop_process_tree "$BENCH_PID"
}

cleanup_on_exit() {
  local original_exit=$?
  set +e
  stop_all_monitors
  capture_container_logs
  return "$original_exit"
}

trap 'on_signal SIGINT' INT
trap 'on_signal SIGTERM' TERM
trap cleanup_on_exit EXIT

###############################################################################
# 3. PREPARE LOGGING
###############################################################################
mkdir -p "$RUN_DIR"
cd "$PROJECT_DIR"

if [[ ! -f "$BENCHMARK_SCRIPT" ]]; then
  echo "ERROR: benchmark script not found: $BENCHMARK_SCRIPT" >&2
  exit 2
fi

# Everything printed after this line goes to both terminal and master log.
exec > >(tee -a "$MASTER_LOG") 2>&1

printf '%s\n' \
  'timestamp,elapsed_seconds,manifest_rows,new_rows_last_interval,interval_tps,create_failed,http_502,gateway_limit_errors,disk_used_percent,free_gb,load_1m,mem_available_mb' \
  > "$PROGRESS_CSV"

###############################################################################
# 4. PREFLIGHT VALIDATION
###############################################################################
log "============================================================"
log "ONE-MILLION KYC INSERT-ONLY BENCHMARK"
log "============================================================"
log "Run ID                 : $RUN_ID"
log "Project directory      : $PROJECT_DIR"
log "Result root            : $RESULT_ROOT"
log "Detailed run directory : $RUN_DIR"
log "API                     : $API_BASE_URL"
log "Count                   : $COUNT"
log "Concurrency             : $CONCURRENCY"
log "Request timeout         : $REQUEST_TIMEOUT_MS ms"
log "Cleanup                 : DISABLED (--keep)"
log "Started                 : $START_ISO"
log "============================================================"

{
  echo "================ SYSTEM IDENTITY ================"
  date --iso-8601=seconds
  hostname -f 2>/dev/null || hostname
  uname -a
  uptime
  echo

  echo "================ NODE / SCRIPT =================="
  node --version
  npm --version 2>/dev/null || true
  sha256sum "$BENCHMARK_SCRIPT"
  node --check "$BENCHMARK_SCRIPT"
  grep -nE 'const count =|const concurrency =|confirm-extreme|Math\.min|Math\.max' \
    "$BENCHMARK_SCRIPT" || true
  echo

  echo "================ OPEN FILE LIMIT ================="
  echo "Before: $(ulimit -n)"
  ulimit -n 65535 2>/dev/null || true
  echo "After : $(ulimit -n)"
  echo

  echo "================ MEMORY =========================="
  free -h
  echo

  echo "================ DISK ============================"
  df -h
  echo
  df -i
  echo
  docker system df
  echo

  echo "================ CONTAINERS ======================"
  docker ps -a --format \
    'table {{.Names}}\t{{.Status}}\t{{.Image}}'
  echo

  echo "================ PEER GATEWAY LIMIT =============="
  docker exec peer0.org1.blockchain.local \
    awk '/gatewayService:/ {print; exit}' \
    /etc/hyperledger/fabric/core.yaml 2>/dev/null || true
  echo
} | tee "$PREFLIGHT_FILE"

if ! grep -Eq '1000000|1_000_000' "$BENCHMARK_SCRIPT"; then
  log "ERROR: benchmark_kyc.js does not appear to support a count of 1,000,000."
  exit 2
fi

if (( COUNT != 1000000 )); then
  log "ERROR: COUNT must be exactly 1,000,000 for this script. Current: $COUNT"
  exit 2
fi

if (( CONCURRENCY < 1 )); then
  log "ERROR: CONCURRENCY must be greater than zero."
  exit 2
fi

GATEWAY_LIMIT="$(
  docker exec peer0.org1.blockchain.local \
    awk '/gatewayService:/ {print $2; exit}' \
    /etc/hyperledger/fabric/core.yaml 2>/dev/null \
    | tr -d '[:space:]'
)"

if [[ "$GATEWAY_LIMIT" =~ ^[0-9]+$ ]] && (( GATEWAY_LIMIT > 0 )); then
  log "Detected Org1 Gateway limit: $GATEWAY_LIMIT"

  if (( CONCURRENCY >= GATEWAY_LIMIT )); then
    log "ERROR: concurrency $CONCURRENCY must remain below Gateway limit $GATEWAY_LIMIT."
    exit 2
  fi
else
  log "WARNING: unable to determine the effective Org1 Gateway limit."
fi

for container in "${REQUIRED_CONTAINERS[@]}"; do
  if ! container_is_running "$container"; then
    log "ERROR: required container is not running: $container"
    exit 2
  fi
  log "Container running: $container"
done

for org in org1 org2; do
  if ! docker ps --format '{{.Names}}' \
      | grep -Eq "^dev-peer0\.${org}\.blockchain\.local-kyc-wallet-chaincode-js"; then
    log "ERROR: no running KYC chaincode container was found for $org."
    exit 2
  fi
  log "KYC chaincode container running for $org."
done

DISK_USED_PERCENT="$(get_disk_used_percent)"
FREE_GB="$(get_free_gb)"

log "Disk used: ${DISK_USED_PERCENT}%"
log "Disk free: ${FREE_GB} GB"

if (( DISK_USED_PERCENT >= MAX_DISK_USED_PERCENT )); then
  log "ERROR: disk usage is already ${DISK_USED_PERCENT}%, threshold is ${MAX_DISK_USED_PERCENT}%."
  exit 2
fi

if (( FREE_GB < MIN_FREE_GB )); then
  log "ERROR: only ${FREE_GB} GB is free; minimum configured free space is ${MIN_FREE_GB} GB."
  exit 2
fi

log "Running API health check."
curl --silent --show-error --fail \
  "$API_BASE_URL/api/v1/health" \
  | tee "$HEALTH_BEFORE_FILE" \
  | jq .

log "Capturing informational customer count before the run."
curl --silent --show-error \
  --max-time 120 \
  "$API_BASE_URL/api/v1/valoores-blockchain/customers/count" \
  | tee "$COUNT_BEFORE_FILE" \
  | jq . 2>/dev/null || true

###############################################################################
# 5. START SYSTEM MONITORS
###############################################################################
log "Starting system monitors."

vmstat "$RESOURCE_INTERVAL_SECONDS" > "$VMSTAT_LOG" 2>&1 &
VMSTAT_PID=$!

if command_exists iostat; then
  iostat -xz "$RESOURCE_INTERVAL_SECONDS" > "$IOSTAT_LOG" 2>&1 &
  IOSTAT_PID=$!
else
  echo "iostat is not installed." > "$IOSTAT_LOG"
fi

(
  while true; do
    echo "============================================================"
    date --iso-8601=seconds
    docker stats --no-stream --format \
      'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}\t{{.PIDs}}'
    sleep "$RESOURCE_INTERVAL_SECONDS"
  done
) > "$DOCKER_STATS_LOG" 2>&1 &
DOCKER_STATS_PID=$!

(
  while true; do
    echo "============================================================"
    date --iso-8601=seconds
    uptime
    free -m
    df -h "$PROJECT_DIR"
    df -i "$PROJECT_DIR"
    docker system df
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
) > "$RESOURCE_LOG" 2>&1 &
RESOURCE_PID=$!

(
  while true; do
    echo "============================================================"
    date --iso-8601=seconds

    docker ps -a --format \
      'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'

    echo
    for container in "${REQUIRED_CONTAINERS[@]}"; do
      printf '%s\t' "$container"
      docker inspect -f \
        'running={{.State.Running}} status={{.State.Status}} restart_count={{.RestartCount}} oom={{.State.OOMKilled}}' \
        "$container" 2>/dev/null || echo "inspect_failed=true"
    done

    sleep "$HEALTH_INTERVAL_SECONDS"
  done
) > "$CONTAINER_STATUS_LOG" 2>&1 &
CONTAINER_STATUS_PID=$!

(
  while true; do
    timestamp="$(date --iso-8601=seconds)"
    http_code="$({
      curl --silent --show-error \
        --max-time 30 \
        --output /tmp/${RUN_ID}_health.json \
        --write-out '%{http_code}' \
        "$API_BASE_URL/api/v1/health"
    } 2>/dev/null || printf '000')"

    printf '%s http_status=%s ' "$timestamp" "$http_code"
    jq -c . /tmp/${RUN_ID}_health.json 2>/dev/null || true
    echo

    sleep "$HEALTH_INTERVAL_SECONDS"
  done
) > "$HEALTH_LOG" 2>&1 &
HEALTH_PID=$!

###############################################################################
# 6. START THE BENCHMARK
###############################################################################
log "Starting benchmark process."

node \
  --max-old-space-size="$NODE_HEAP_MB" \
  "$BENCHMARK_SCRIPT" \
  --count "$COUNT" \
  --concurrency "$CONCURRENCY" \
  --timeout-ms "$REQUEST_TIMEOUT_MS" \
  --confirm-large \
  --confirm-extreme I_UNDERSTAND_BLOCKCHAIN_HISTORY_IS_PERMANENT \
  --keep \
  --run-id "$RUN_ID" \
  > >(tee -a "$CONSOLE_LOG") \
  2>&1 &

BENCH_PID=$!
echo "$BENCH_PID" > "$RUN_DIR/${RUN_ID}.pid"
log "Benchmark PID: $BENCH_PID"

if command_exists pidstat; then
  pidstat -rud -p "$BENCH_PID" "$RESOURCE_INTERVAL_SECONDS" \
    > "$PIDSTAT_LOG" 2>&1 &
  PIDSTAT_PID=$!
else
  echo "pidstat is not installed." > "$PIDSTAT_LOG"
fi

###############################################################################
# 7. PROGRESS AND AUTOMATIC SAFETY MONITOR
###############################################################################
(
  previous_manifest_rows=0

  while kill -0 "$BENCH_PID" 2>/dev/null; do
    sleep "$MONITOR_INTERVAL_SECONDS"

    now_epoch="$(date +%s)"
    elapsed_seconds=$((now_epoch - START_EPOCH))
    manifest_rows="$(get_manifest_count)"
    create_failed="$(get_log_count '^\[CREATE FAILED\]' "$CONSOLE_LOG")"
    http_502="$(get_log_count 'HTTP 502' "$CONSOLE_LOG")"
    gateway_errors="$(get_log_count 'too many requests for /gateway\.Gateway|exceeding concurrency limit' "$CONSOLE_LOG")"
    disk_used="$(get_disk_used_percent)"
    free_gb="$(get_free_gb)"
    load_1m="$(awk '{print $1}' /proc/loadavg)"
    mem_available_mb="$(awk '/MemAvailable:/ {printf "%d", $2 / 1024}' /proc/meminfo)"

    new_rows=$((manifest_rows - previous_manifest_rows))
    interval_tps="$(awk -v rows="$new_rows" -v seconds="$MONITOR_INTERVAL_SECONDS" 'BEGIN {printf "%.3f", rows / seconds}')"
    previous_manifest_rows="$manifest_rows"

    printf '%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s\n' \
      "$(date --iso-8601=seconds)" \
      "$elapsed_seconds" \
      "$manifest_rows" \
      "$new_rows" \
      "$interval_tps" \
      "$create_failed" \
      "$http_502" \
      "$gateway_errors" \
      "$disk_used" \
      "$free_gb" \
      "$load_1m" \
      "$mem_available_mb" \
      >> "$PROGRESS_CSV"

    log "PROGRESS created_manifest=$manifest_rows/$COUNT interval_tps=$interval_tps failures=$create_failed http502=$http_502 gateway_errors=$gateway_errors disk=${disk_used}% free=${free_gb}GB load1m=$load_1m mem_available=${mem_available_mb}MB"

    for container in "${REQUIRED_CONTAINERS[@]}"; do
      if ! container_is_running "$container"; then
        set_abort_reason "Required container stopped: $container"
        log "SAFETY STOP: $ABORT_REASON"
        stop_process_tree "$BENCH_PID"
        exit 0
      fi
    done

    if (( disk_used >= MAX_DISK_USED_PERCENT )); then
      set_abort_reason "Disk usage reached ${disk_used}%"
      log "SAFETY STOP: $ABORT_REASON"
      stop_process_tree "$BENCH_PID"
      exit 0
    fi

    if [[ "$STOP_ON_REPEATED_ERRORS" == "true" ]]; then
      if (( http_502 >= MAX_HTTP_502 )); then
        set_abort_reason "HTTP 502 count reached $http_502"
        log "SAFETY STOP: $ABORT_REASON"
        stop_process_tree "$BENCH_PID"
        exit 0
      fi

      if (( create_failed >= MAX_CREATE_FAILURES )); then
        set_abort_reason "Create failure count reached $create_failed"
        log "SAFETY STOP: $ABORT_REASON"
        stop_process_tree "$BENCH_PID"
        exit 0
      fi

      if (( gateway_errors >= MAX_GATEWAY_LIMIT_ERRORS )); then
        set_abort_reason "Gateway limit errors reached $gateway_errors"
        log "SAFETY STOP: $ABORT_REASON"
        stop_process_tree "$BENCH_PID"
        exit 0
      fi
    fi
  done
) &
PROGRESS_PID=$!

###############################################################################
# 8. WAIT FOR COMPLETION
###############################################################################
set +e
wait "$BENCH_PID"
BENCHMARK_EXIT_CODE=$?
set -e

log "Benchmark process exited with code: $BENCHMARK_EXIT_CODE"
stop_all_monitors

if [[ -s "$ABORT_REASON_FILE" ]]; then
  ABORT_REASON="$(cat "$ABORT_REASON_FILE")"
fi

###############################################################################
# 9. POST-RUN SNAPSHOTS
###############################################################################
log "Capturing API health after the run."
curl --silent --show-error \
  --max-time 60 \
  "$API_BASE_URL/api/v1/health" \
  | tee "$HEALTH_AFTER_FILE" \
  | jq . 2>/dev/null || true

log "Capturing informational customer count after the run."
curl --silent --show-error \
  --max-time 120 \
  "$API_BASE_URL/api/v1/valoores-blockchain/customers/count" \
  | tee "$COUNT_AFTER_FILE" \
  | jq . 2>/dev/null || true

capture_container_logs

{
  echo "================ FINAL SYSTEM SNAPSHOT ==========="
  date --iso-8601=seconds
  uptime
  free -h
  df -h
  df -i
  docker system df
  docker ps -a --format \
    'table {{.Names}}\t{{.Status}}\t{{.Image}}'
  echo
  echo "================ RECENT KERNEL WARNINGS ==========="
  journalctl -k --since "@$START_EPOCH" --no-pager 2>/dev/null \
    | grep -Ei 'oom|out of memory|killed process|i/o error|filesystem|nvme|ext4|xfs' \
    || true
} | tee "$RUN_DIR/${RUN_ID}_postrun_snapshot.txt"

###############################################################################
# 10. FAILURE RECONCILIATION
###############################################################################
if [[ -f "$CONSOLE_LOG" ]]; then
  grep '^\[CREATE FAILED\]' "$CONSOLE_LOG" \
    | awk '{print $3}' \
    | sort -u \
    > "$FAILED_IDS_FILE" || true
else
  : > "$FAILED_IDS_FILE"
fi

FAILED_ID_COUNT="$(wc -l < "$FAILED_IDS_FILE" | tr -d '[:space:]')"

if (( FAILED_ID_COUNT > 0 )); then
  log "Reconciling $FAILED_ID_COUNT failed-response customer IDs."
  echo 'customer_id,http_status,reconciliation_status' > "$FAILED_RECON_FILE"

  while IFS= read -r customer_id; do
    [[ -n "$customer_id" ]] || continue

    http_code="$({
      curl --silent --show-error \
        --max-time 60 \
        --output /dev/null \
        --write-out '%{http_code}' \
        "$API_BASE_URL/api/v1/valoores-blockchain/customers/$customer_id"
    } 2>/dev/null || printf '000')"

    case "$http_code" in
      200) reconciliation_status='COMMITTED' ;;
      404) reconciliation_status='NOT_FOUND' ;;
      *)   reconciliation_status='INCONCLUSIVE' ;;
    esac

    printf '%s,%s,%s\n' \
      "$customer_id" \
      "$http_code" \
      "$reconciliation_status" \
      >> "$FAILED_RECON_FILE"
  done < "$FAILED_IDS_FILE"
fi

###############################################################################
# 11. SAMPLE RECORD VERIFICATION
###############################################################################
echo 'customer_id,http_status,verification_status' > "$SAMPLE_VERIFY_FILE"

if [[ -s "$CREATED_MANIFEST" ]]; then
  # First N/2 and last N/2 successful records provide deterministic coverage.
  half=$((SAMPLE_VERIFY_COUNT / 2))
  (( half < 1 )) && half=1

  {
    head -n "$half" "$CREATED_MANIFEST"
    tail -n "$half" "$CREATED_MANIFEST"
  } \
    | jq -r '.customerId // .customer_id // .payload.customerId // .payload.customer_id // empty' \
    | awk 'NF' \
    | sort -u \
    | while IFS= read -r customer_id; do
        http_code="$({
          curl --silent --show-error \
            --max-time 60 \
            --output /dev/null \
            --write-out '%{http_code}' \
            "$API_BASE_URL/api/v1/valoores-blockchain/customers/$customer_id"
        } 2>/dev/null || printf '000')"

        if [[ "$http_code" == "200" ]]; then
          verification_status='FOUND'
        else
          verification_status='NOT_VERIFIED'
        fi

        printf '%s,%s,%s\n' \
          "$customer_id" \
          "$http_code" \
          "$verification_status" \
          >> "$SAMPLE_VERIFY_FILE"
      done
fi

###############################################################################
# 12. FINAL VALIDATION AND SUMMARY
###############################################################################
MANIFEST_ROWS="$(get_manifest_count)"
CREATE_FAILED_LOG_COUNT="$(get_log_count '^\[CREATE FAILED\]' "$CONSOLE_LOG")"
HTTP_502_COUNT="$(get_log_count 'HTTP 502' "$CONSOLE_LOG")"
GATEWAY_ERROR_COUNT="$(get_log_count 'too many requests for /gateway\.Gateway|exceeding concurrency limit' "$CONSOLE_LOG")"

REPORT_CREATED=0
REPORT_FAILED="$COUNT"
REPORT_SUCCESS_RATE=0
REPORT_TPS=0
REPORT_AVG_MS=0
REPORT_P50_MS=0
REPORT_P95_MS=0
REPORT_P99_MS=0
REPORT_MAX_MS=0
REPORT_DURATION_MS=0

if [[ -s "$REPORT_FILE" ]] && jq -e . "$REPORT_FILE" >/dev/null 2>&1; then
  REPORT_CREATED="$(jq -r '.creation.created // 0' "$REPORT_FILE")"
  REPORT_FAILED="$(jq -r '.creation.failed // 0' "$REPORT_FILE")"
  REPORT_SUCCESS_RATE="$(jq -r '.creation.successRatePercent // 0' "$REPORT_FILE")"
  REPORT_TPS="$(jq -r '.creation.throughputTps // 0' "$REPORT_FILE")"
  REPORT_AVG_MS="$(jq -r '.creation.averageLatencyMs // 0' "$REPORT_FILE")"
  REPORT_P50_MS="$(jq -r '.creation.p50LatencyMs // 0' "$REPORT_FILE")"
  REPORT_P95_MS="$(jq -r '.creation.p95LatencyMs // 0' "$REPORT_FILE")"
  REPORT_P99_MS="$(jq -r '.creation.p99LatencyMs // 0' "$REPORT_FILE")"
  REPORT_MAX_MS="$(jq -r '.creation.maxLatencyMs // 0' "$REPORT_FILE")"
  REPORT_DURATION_MS="$(jq -r '.creation.durationMs // 0' "$REPORT_FILE")"
fi

SAMPLE_FOUND_COUNT="$(awk -F, 'NR>1 && $3=="FOUND" {count++} END {print count+0}' "$SAMPLE_VERIFY_FILE")"
SAMPLE_TOTAL_COUNT="$(awk 'END {print NR>0 ? NR-1 : 0}' "$SAMPLE_VERIFY_FILE")"

FINAL_STATUS='FAILED'

if [[ "$BENCHMARK_EXIT_CODE" -eq 0 ]] \
   && [[ "$REPORT_CREATED" -eq "$COUNT" ]] \
   && [[ "$REPORT_FAILED" -eq 0 ]] \
   && [[ "$MANIFEST_ROWS" -eq "$COUNT" ]] \
   && [[ "$CREATE_FAILED_LOG_COUNT" -eq 0 ]]; then
  FINAL_STATUS='PASSED'
elif (( REPORT_CREATED > 0 || MANIFEST_ROWS > 0 )); then
  FINAL_STATUS='PARTIAL'
fi

END_EPOCH="$(date +%s)"
END_ISO="$(date --iso-8601=seconds)"
ELAPSED_SECONDS=$((END_EPOCH - START_EPOCH))

jq -n \
  --arg runId "$RUN_ID" \
  --arg status "$FINAL_STATUS" \
  --arg startedAt "$START_ISO" \
  --arg finishedAt "$END_ISO" \
  --arg abortReason "$ABORT_REASON" \
  --arg reportFile "$REPORT_FILE" \
  --arg createdManifest "$CREATED_MANIFEST" \
  --arg masterLog "$MASTER_LOG" \
  --arg consoleLog "$CONSOLE_LOG" \
  --arg progressCsv "$PROGRESS_CSV" \
  --argjson elapsedSeconds "$ELAPSED_SECONDS" \
  --argjson benchmarkExitCode "$BENCHMARK_EXIT_CODE" \
  --argjson count "$COUNT" \
  --argjson concurrency "$CONCURRENCY" \
  --argjson reportCreated "$REPORT_CREATED" \
  --argjson reportFailed "$REPORT_FAILED" \
  --argjson manifestRows "$MANIFEST_ROWS" \
  --argjson createFailedLogCount "$CREATE_FAILED_LOG_COUNT" \
  --argjson http502Count "$HTTP_502_COUNT" \
  --argjson gatewayErrorCount "$GATEWAY_ERROR_COUNT" \
  --argjson failedIds "$FAILED_ID_COUNT" \
  --argjson successRatePercent "$REPORT_SUCCESS_RATE" \
  --argjson throughputTps "$REPORT_TPS" \
  --argjson durationMs "$REPORT_DURATION_MS" \
  --argjson averageLatencyMs "$REPORT_AVG_MS" \
  --argjson p50LatencyMs "$REPORT_P50_MS" \
  --argjson p95LatencyMs "$REPORT_P95_MS" \
  --argjson p99LatencyMs "$REPORT_P99_MS" \
  --argjson maxLatencyMs "$REPORT_MAX_MS" \
  --argjson sampleVerified "$SAMPLE_FOUND_COUNT" \
  --argjson sampleTotal "$SAMPLE_TOTAL_COUNT" \
  '{
    runId: $runId,
    status: $status,
    startedAt: $startedAt,
    finishedAt: $finishedAt,
    elapsedSeconds: $elapsedSeconds,
    benchmarkExitCode: $benchmarkExitCode,
    abortReason: (if $abortReason == "" then null else $abortReason end),
    configuration: {
      count: $count,
      concurrency: $concurrency,
      cleanupEnabled: false
    },
    creation: {
      created: $reportCreated,
      failed: $reportFailed,
      successRatePercent: $successRatePercent,
      durationMs: $durationMs,
      throughputTps: $throughputTps,
      averageLatencyMs: $averageLatencyMs,
      p50LatencyMs: $p50LatencyMs,
      p95LatencyMs: $p95LatencyMs,
      p99LatencyMs: $p99LatencyMs,
      maxLatencyMs: $maxLatencyMs
    },
    validation: {
      createdManifestRows: $manifestRows,
      createFailuresSeenInLog: $createFailedLogCount,
      http502Count: $http502Count,
      gatewayLimitErrorCount: $gatewayErrorCount,
      failedResponseIds: $failedIds,
      sampleRecordsVerified: $sampleVerified,
      sampleRecordsChecked: $sampleTotal,
      countEndpointAuthoritative: false
    },
    files: {
      report: $reportFile,
      createdManifest: $createdManifest,
      masterLog: $masterLog,
      consoleLog: $consoleLog,
      progressCsv: $progressCsv
    }
  }' > "$FINAL_SUMMARY_FILE"

# Link benchmark-generated files into the detailed run directory without
# duplicating the large one-million-row manifest.
[[ -f "$REPORT_FILE" ]] && ln -sfn "../$(basename "$REPORT_FILE")" "$RUN_DIR/report.json"
[[ -f "$CREATED_MANIFEST" ]] && ln -sfn "../$(basename "$CREATED_MANIFEST")" "$RUN_DIR/created_manifest.jsonl"
[[ -f "$CLEANUP_MANIFEST" ]] && ln -sfn "../$(basename "$CLEANUP_MANIFEST")" "$RUN_DIR/cleanup_manifest.jsonl"
[[ -f "$PAYLOAD_SAMPLE" ]] && ln -sfn "../$(basename "$PAYLOAD_SAMPLE")" "$RUN_DIR/payload_sample.json"

{
  [[ -f "$REPORT_FILE" ]] && sha256sum "$REPORT_FILE"
  [[ -f "$CREATED_MANIFEST" ]] && sha256sum "$CREATED_MANIFEST"
  [[ -f "$PAYLOAD_SAMPLE" ]] && sha256sum "$PAYLOAD_SAMPLE"
  sha256sum "$MASTER_LOG" "$CONSOLE_LOG" "$FINAL_SUMMARY_FILE"
} > "$CHECKSUM_FILE"

# Archive detailed logs only. The large manifest remains separate and is
# referenced by path and SHA-256 checksum.
tar -czf "$ARCHIVE_FILE" \
  --exclude='created_manifest.jsonl' \
  -C "$RUN_DIR" .

log "============================================================"
log "FINAL ONE-MILLION BENCHMARK RESULT"
log "============================================================"
log "Status                  : $FINAL_STATUS"
log "Run ID                  : $RUN_ID"
log "Benchmark exit code     : $BENCHMARK_EXIT_CODE"
log "Created (report)        : $REPORT_CREATED"
log "Failed (report)         : $REPORT_FAILED"
log "Created manifest rows   : $MANIFEST_ROWS"
log "Success rate            : ${REPORT_SUCCESS_RATE}%"
log "Throughput              : ${REPORT_TPS} TPS"
log "Average latency         : ${REPORT_AVG_MS} ms"
log "P50 latency             : ${REPORT_P50_MS} ms"
log "P95 latency             : ${REPORT_P95_MS} ms"
log "P99 latency             : ${REPORT_P99_MS} ms"
log "Maximum latency         : ${REPORT_MAX_MS} ms"
log "HTTP 502 count          : $HTTP_502_COUNT"
log "Gateway limit errors    : $GATEWAY_ERROR_COUNT"
log "Sample records verified : $SAMPLE_FOUND_COUNT/$SAMPLE_TOTAL_COUNT"
log "Cleanup                 : DISABLED"
log "Final summary           : $FINAL_SUMMARY_FILE"
log "Created manifest        : $CREATED_MANIFEST"
log "Detailed logs archive   : $ARCHIVE_FILE"
log "Checksums               : $CHECKSUM_FILE"
log "============================================================"

jq . "$FINAL_SUMMARY_FILE"

if [[ "$FINAL_STATUS" != 'PASSED' ]]; then
  exit 1
fi

exit 0
