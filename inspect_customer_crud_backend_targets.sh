#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
BACKEND="$PROJECT_ROOT/blockchain-api"
ROUTE="$BACKEND/src/routes/valoores-blockchain.routes.js"

STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="$PROJECT_ROOT/customer_crud_backend_targets_${STAMP}.txt"

if [[ ! -f "$ROUTE" ]]; then
  echo "ERROR: Route file not found: $ROUTE" >&2
  exit 1
fi

exec > >(tee "$REPORT") 2>&1

section() {
  echo
  echo "======================================================================"
  echo "$1"
  echo "======================================================================"
}

section "CUSTOMER CRUD BACKEND TARGETS — READ-ONLY INSPECTION"
echo "Generated At: $(date -Is)"
echo "Project Root: $PROJECT_ROOT"
echo "Backend:      $BACKEND"
echo "Route:        $ROUTE"
echo "Report:       $REPORT"

section "1. ROUTE SYNTAX AND SIZE"
node --check "$ROUTE"
wc -l "$ROUTE"

section "2. ACTIVE IMPORTS AND HELPERS"
sed -n '1,180p' "$ROUTE"

section "3. LOGGER MARKERS"
grep -nE \
  "BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2|END BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2|BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1|function logCreatedBlockchainCustomer|function appendBlockchainCustomerLog|BLOCKCHAIN_CUSTOMER_STARTUP" \
  "$ROUTE" || true

section "4. CURRENT LOGGER BLOCK"
START_LINE="$(
  grep -n \
    "BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2" \
    "$ROUTE" \
    | head -n 1 \
    | cut -d: -f1
)"

END_LINE="$(
  grep -n \
    "END BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2" \
    "$ROUTE" \
    | head -n 1 \
    | cut -d: -f1
)"

if [[ -n "$START_LINE" && -n "$END_LINE" ]]; then
  sed -n "${START_LINE},${END_LINE}p" "$ROUTE"
else
  echo "Professional logger markers were not found."
fi

section "5. CUSTOMER ROUTE DECLARATIONS"
grep -nE \
  "router\.(get|post|put|patch|delete)\([^)]*customers" \
  "$ROUTE" || true

section "6. ACTIVE CREATE CUSTOMER ROUTE"
CREATE_LINE="$(
  grep -nE \
    "router\.post\(['\"]\/customers['\"]" \
    "$ROUTE" \
    | head -n 1 \
    | cut -d: -f1
)"

if [[ -n "$CREATE_LINE" ]]; then
  CREATE_END=$((CREATE_LINE + 260))
  sed -n "${CREATE_LINE},${CREATE_END}p" "$ROUTE"
else
  echo "Create customer route was not found."
fi

section "7. FABRIC SERVICE REQUIRE"
grep -nE \
  "require\(.*fabric\.service.*\)" \
  "$ROUTE" || true

FABRIC_REQUIRE="$(
  sed -nE \
    "s/.*require\(['\"]([^'\"]*fabric\.service)['\"]\).*/\1/p" \
    "$ROUTE" \
    | head -n 1
)"

if [[ -n "$FABRIC_REQUIRE" ]]; then
  if [[ "$FABRIC_REQUIRE" == ./* ]]; then
    FABRIC_SERVICE="$BACKEND/src/routes/${FABRIC_REQUIRE#./}.js"
  elif [[ "$FABRIC_REQUIRE" == ../* ]]; then
    FABRIC_SERVICE="$BACKEND/src/routes/$FABRIC_REQUIRE.js"
  else
    FABRIC_SERVICE=""
  fi

  FABRIC_SERVICE="$(
    python3 - "$FABRIC_SERVICE" <<'PY'
from pathlib import Path
import sys
print(Path(sys.argv[1]).resolve() if sys.argv[1] else "")
PY
  )"

  echo "Resolved Fabric service: $FABRIC_SERVICE"

  if [[ -f "$FABRIC_SERVICE" ]]; then
    section "8. FABRIC SERVICE TRANSACTION METHODS"
    grep -nA 90 -B 20 -E \
      "async function (submitTransaction|evaluateTransaction)|submitTransaction[[:space:]]*[:=]|evaluateTransaction[[:space:]]*[:=]|module\.exports" \
      "$FABRIC_SERVICE" || true

    node --check "$FABRIC_SERVICE"
  else
    echo "Fabric service file could not be resolved from the active require."
  fi
else
  echo "Fabric service require was not found."
fi

section "9. HASH AND SAFE JSON HELPERS"
grep -nA 30 -B 5 -E \
  "function sha256|const sha256|function toSafeJson|const toSafeJson" \
  "$ROUTE" || true

section "10. REQUEST IDENTITY AND AUTH REFERENCES"
grep -nE \
  "req\.user|req\.auth|routeSecurity|authorization|requireAuth|requireRoles|COMPLIANCE|AUDIT|x-audit-role" \
  "$ROUTE" || true

section "11. ROUTE FILE END"
TOTAL_LINES="$(wc -l < "$ROUTE")"
START_TAIL=$((TOTAL_LINES > 180 ? TOTAL_LINES - 179 : 1))
sed -n "${START_TAIL},${TOTAL_LINES}p" "$ROUTE"

section "12. CURRENT CUSTOMER LOG METADATA"
CUSTOMER_LOG="$BACKEND/logs/blockchain-customers.log"

if [[ -f "$CUSTOMER_LOG" ]]; then
  stat -c \
    'Path: %n%nPermissions: %a%nOwner: %U:%G%nSize: %s bytes%nModified: %y' \
    "$CUSTOMER_LOG"

  echo
  echo "Explicit successful Fabric CRUD event counts:"

  jq -s '
    [
      .[]
      | select(
          .source == "FABRIC_BLOCKCHAIN"
          and
          .outcome == "SUCCESS"
          and
          (
            .eventType == "BLOCKCHAIN_CUSTOMER_CREATED"
            or
            .eventType == "BLOCKCHAIN_CUSTOMER_UPDATED"
            or
            .eventType == "BLOCKCHAIN_CUSTOMER_DELETED"
          )
        )
    ]
    | group_by(.eventType)
    | map({
        eventType: .[0].eventType,
        count: length
      })
  ' "$CUSTOMER_LOG" 2>/dev/null || \
    echo "The JSONL file contains malformed lines."
else
  echo "Customer log file does not exist yet."
fi

section "INSPECTION COMPLETE"
echo "No source file was modified."
echo "Upload this report for the backend implementation phase:"
echo "$REPORT"
