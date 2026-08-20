#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
BACKEND="$PROJECT_ROOT/blockchain-api"
FRONTEND="$PROJECT_ROOT/blockchain-test-ui"
STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="$PROJECT_ROOT/customer_activity_logs_source_inspection_${STAMP}.txt"

if [[ ! -d "$BACKEND" ]]; then
  echo "ERROR: Backend directory not found: $BACKEND" >&2
  exit 1
fi

if [[ ! -d "$FRONTEND" ]]; then
  echo "ERROR: Frontend directory not found: $FRONTEND" >&2
  exit 1
fi

exec > >(tee "$REPORT") 2>&1

section() {
  echo
  echo "======================================================================"
  echo "$1"
  echo "======================================================================"
}

safe_find() {
  find "$@" \
    -not -path "*/node_modules/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    -not -path "*/coverage/*" \
    -not -path "*/backups/*" \
    -not -path "*/logs/*" \
    -not -path "*/.git/*"
}

section "CUSTOMER ACTIVITY LOGS — READ-ONLY SOURCE INSPECTION"
echo "Generated At: $(date -Is)"
echo "Project Root: $PROJECT_ROOT"
echo "Backend:      $BACKEND"
echo "Frontend:     $FRONTEND"
echo "Report:       $REPORT"

section "1. GIT STATUS"
if git -C "$PROJECT_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$PROJECT_ROOT" status --short
  echo
  git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD
  git -C "$PROJECT_ROOT" log -1 --oneline
else
  echo "Project root is not a Git working tree."
fi

section "2. TARGET BACKEND ROUTE FILE"
TARGET_ROUTE="$BACKEND/src/routes/valoores-blockchain.routes.js"

if [[ -f "$TARGET_ROUTE" ]]; then
  echo "$TARGET_ROUTE"
  wc -l "$TARGET_ROUTE"
  node --check "$TARGET_ROUTE"
else
  echo "NOT FOUND: $TARGET_ROUTE"
fi

section "3. EXPRESS CUSTOMER ROUTES"
if [[ -f "$TARGET_ROUTE" ]]; then
  grep -nE \
    "router\.(get|post|put|patch|delete)\(|CreateResident|UpdateResident|DeleteResident|submitTransaction|evaluateTransaction|BLOCKCHAIN_CUSTOMER_" \
    "$TARGET_ROUTE" || true
fi

section "4. CREATE CUSTOMER ROUTE CONTEXT"
if [[ -f "$TARGET_ROUTE" ]]; then
  grep -nA 100 -B 20 \
    "router\.post('/customers'" \
    "$TARGET_ROUTE" || true
fi

section "5. UPDATE/DELETE ROUTE CANDIDATES ACROSS BACKEND"
grep -RInE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "router\.(put|patch|delete)\(.*customer|UpdateResident|DeleteResident|UpdateCustomer|DeleteCustomer|update.*customer|delete.*customer|remove.*customer|tombstone" \
  "$BACKEND/src" || true

section "6. FABRIC SUBMIT FUNCTIONS USED BY CUSTOMER CODE"
grep -RInE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "submitTransaction\(|CreateResident|UpdateResident|DeleteResident|UpdateCustomer|DeleteCustomer" \
  "$BACKEND/src" || true

section "7. CHAINCODE FILE CANDIDATES"
safe_find "$PROJECT_ROOT" -type f \
  \( -name "*.js" -o -name "*.ts" \) \
  | grep -Ei \
    "chaincode|contract|fabric|kyc|resident" \
  | sort || true

section "8. CHAINCODE CUSTOMER FUNCTIONS"
CHAINCODE_FILES="$(safe_find "$PROJECT_ROOT" -type f \
  \( -name "*.js" -o -name "*.ts" \) \
  | grep -Ei "chaincode|contract|fabric|kyc|resident" || true)"

if [[ -n "$CHAINCODE_FILES" ]]; then
  while IFS= read -r file; do
    [[ -f "$file" ]] || continue
    matches="$(
      grep -nE \
        "async[[:space:]]+(CreateResident|UpdateResident|DeleteResident|UpdateCustomer|DeleteCustomer|.*Resident.*|.*Customer.*)|PutState|DeleteState|GetState|GetHistoryForKey" \
        "$file" || true
    )"

    if [[ -n "$matches" ]]; then
      echo
      echo "--- $file"
      echo "$matches"
    fi
  done <<< "$CHAINCODE_FILES"
fi

section "9. FULL CONTEXT FOR DISCOVERED UPDATE/DELETE CHAINCODE FUNCTIONS"
if [[ -n "$CHAINCODE_FILES" ]]; then
  while IFS= read -r file; do
    [[ -f "$file" ]] || continue

    grep -nA 120 -B 20 \
      -E "async[[:space:]]+(UpdateResident|DeleteResident|UpdateCustomer|DeleteCustomer)" \
      "$file" || true
  done <<< "$CHAINCODE_FILES"
fi

section "10. CURRENT PROFESSIONAL CUSTOMER LOGGER"
if [[ -f "$TARGET_ROUTE" ]]; then
  grep -nA 180 -B 10 \
    "BLOCKCHAIN_CUSTOMER_CREATED_ONLY_LOGGER_V2" \
    "$TARGET_ROUTE" || true

  grep -nA 35 -B 8 \
    "BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1" \
    "$TARGET_ROUTE" || true
fi

section "11. BACKEND ROUTE MOUNTING"
grep -RInE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "valoores-blockchain|app\.use\(|router\.use\(" \
  "$BACKEND/src" || true

section "12. BACKEND AUTHORIZATION MIDDLEWARE CANDIDATES"
grep -RInE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "requireAuth|authorize|authorization|roles|permissions|compliance|audit|req\.user|authenticated" \
  "$BACKEND/src" || true

section "13. BACKEND PACKAGE SCRIPTS"
if [[ -f "$BACKEND/package.json" ]]; then
  node -e '
    const p = require(process.argv[1]);
    console.log(JSON.stringify({
      name: p.name,
      version: p.version,
      scripts: p.scripts || {},
      dependencies: Object.keys(p.dependencies || {}),
      devDependencies: Object.keys(p.devDependencies || {})
    }, null, 2));
  ' "$BACKEND/package.json"
fi

section "14. ANGULAR ROUTING FILES"
safe_find "$FRONTEND/src" -type f \
  \( -name "*routing*.ts" -o -name "app.routes.ts" -o -name "app-routing.module.ts" \) \
  | sort || true

section "15. ANGULAR ROUTES AND SIDEBAR/NAVIGATION"
grep -RInE \
  --include="*.ts" \
  --include="*.html" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  "Routes|path:|routerLink|sidebar|navigation|Blockchain Services|Audit Portal|Customer Activity" \
  "$FRONTEND/src/app" || true

section "16. ANGULAR API SERVICES"
grep -RInE \
  --include="*.ts" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  "HttpClient|valoores-blockchain|environment\.api|apiUrl|baseUrl|customers/count|customer-activity" \
  "$FRONTEND/src/app" || true

section "17. EXISTING AUDIT/LOG SCREEN COMPONENTS"
safe_find "$FRONTEND/src/app" -type f \
  \( -name "*.ts" -o -name "*.html" -o -name "*.scss" -o -name "*.css" \) \
  | grep -Ei \
    "audit|log|activity|blockchain|proof|transaction" \
  | sort || true

section "18. FRONTEND PACKAGE SCRIPTS"
if [[ -f "$FRONTEND/package.json" ]]; then
  node -e '
    const p = require(process.argv[1]);
    console.log(JSON.stringify({
      name: p.name,
      version: p.version,
      scripts: p.scripts || {},
      dependencies: Object.keys(p.dependencies || {}),
      devDependencies: Object.keys(p.devDependencies || {})
    }, null, 2));
  ' "$FRONTEND/package.json"
fi

section "19. ANGULAR CONFIGURATION"
for file in \
  "$FRONTEND/angular.json" \
  "$FRONTEND/tsconfig.json" \
  "$FRONTEND/tsconfig.app.json"; do
  if [[ -f "$file" ]]; then
    echo
    echo "--- $file"
    sed -n '1,240p' "$file"
  fi
done

section "20. CUSTOMER LOG FILE METADATA — NO CUSTOMER VALUES PRINTED"
CUSTOMER_LOG="$BACKEND/logs/blockchain-customers.log"

if [[ -f "$CUSTOMER_LOG" ]]; then
  stat -c \
    'Path: %n%nPermissions: %a%nOwner: %U:%G%nSize: %s bytes%nModified: %y' \
    "$CUSTOMER_LOG"

  echo
  echo "Event counts:"
  jq -s '
    group_by(.eventType)
    | map({
        eventType: .[0].eventType,
        count: length
      })
  ' "$CUSTOMER_LOG" 2>/dev/null || \
    echo "Log contains malformed/non-JSON lines."
else
  echo "Customer log file does not exist yet: $CUSTOMER_LOG"
fi

section "21. SUMMARY CHECKS"
echo "Create route marker count:"
grep -c \
  "BLOCKCHAIN_CUSTOMER_CREATED_LOG_CALL_V1" \
  "$TARGET_ROUTE" 2>/dev/null || true

echo "Startup snapshot token count:"
grep -cE \
  "BLOCKCHAIN_CUSTOMER_STARTUP_SNAPSHOT|scheduleBlockchainCustomerStartupLog|console\.table\(rows\)" \
  "$TARGET_ROUTE" 2>/dev/null || true

echo "Update route/function candidate count:"
grep -RIE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "UpdateResident|UpdateCustomer|router\.(put|patch)\(.*customer" \
  "$BACKEND/src" 2>/dev/null \
  | wc -l || true

echo "Delete route/function candidate count:"
grep -RIE \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  --exclude-dir=coverage \
  --exclude-dir=backups \
  --exclude-dir=logs \
  --exclude-dir=.git \
  "DeleteResident|DeleteCustomer|router\.delete\(.*customer|DeleteState|tombstone" \
  "$BACKEND/src" "$PROJECT_ROOT" 2>/dev/null \
  | wc -l || true

section "INSPECTION COMPLETE"
echo "No source files were modified."
echo "No secrets or .env files were printed."
echo "Upload this report for the implementation phase:"
echo "$REPORT"
