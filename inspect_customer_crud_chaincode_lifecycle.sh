#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
CHANNEL_NAME="${CHANNEL_NAME:-kycchannelnix1}"
CHAINCODE_NAME="${CHAINCODE_NAME:-kyc-wallet-chaincode-js}"
CHAINCODE_PATH="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js"
CONTRACT_FILE="$CHAINCODE_PATH/lib/kycWalletContract.js"

STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="$PROJECT_ROOT/customer_crud_chaincode_lifecycle_${STAMP}.txt"

if [[ -f "$HOME/blockchain-audit-env.sh" ]]; then
  # shellcheck disable=SC1090
  source "$HOME/blockchain-audit-env.sh"
fi

exec > >(tee "$REPORT") 2>&1

section() {
  echo
  echo "======================================================================"
  echo "$1"
  echo "======================================================================"
}

section "CUSTOMER CRUD CHAINCODE LIFECYCLE — READ-ONLY INSPECTION"
echo "Generated At:   $(date -Is)"
echo "Project Root:   $PROJECT_ROOT"
echo "Channel:        $CHANNEL_NAME"
echo "Chaincode:      $CHAINCODE_NAME"
echo "Chaincode Path: $CHAINCODE_PATH"
echo "Report:         $REPORT"

section "1. ACTIVE SOURCE STATE"

if [[ ! -f "$CONTRACT_FILE" ]]; then
  echo "ERROR: Contract file not found: $CONTRACT_FILE" >&2
  exit 1
fi

node --check "$CONTRACT_FILE"

grep -nE \
  "VALOORES_CUSTOMER_CRUD_CHAINCODE_V1|async (CreateResident|GetResident|UpdateResident|DeleteResident|CreateResidentWallet)" \
  "$CONTRACT_FILE" || true

UPDATE_COUNT="$(
  grep -c "async UpdateResident" "$CONTRACT_FILE" || true
)"

DELETE_COUNT="$(
  grep -c "async DeleteResident" "$CONTRACT_FILE" || true
)"

echo
echo "UpdateResident count: $UPDATE_COUNT"
echo "DeleteResident count: $DELETE_COUNT"

if [[ "$UPDATE_COUNT" -ne 1 || "$DELETE_COUNT" -ne 1 ]]; then
  echo
  echo "BLOCKED: UpdateResident and DeleteResident must each exist exactly once."
  echo "Reapply the source patch before lifecycle packaging."
  exit 2
fi

section "2. CHAINCODE PACKAGE METADATA"

if [[ -f "$CHAINCODE_PATH/package.json" ]]; then
  node - "$CHAINCODE_PATH/package.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));

console.log(JSON.stringify({
  name: pkg.name || null,
  version: pkg.version || null,
  main: pkg.main || null,
  scripts: pkg.scripts || {}
}, null, 2));
NODE
else
  echo "package.json not found."
fi

section "3. FABRIC CLI AVAILABILITY"

if ! command -v peer >/dev/null 2>&1; then
  echo "ERROR: peer CLI is not available in PATH." >&2
  exit 3
fi

echo "Peer CLI: $(command -v peer)"
peer version

section "4. ACTIVE PEER CONTEXT"

for variable in \
  CORE_PEER_LOCALMSPID \
  CORE_PEER_ADDRESS \
  CORE_PEER_TLS_ENABLED \
  CORE_PEER_TLS_ROOTCERT_FILE \
  CORE_PEER_MSPCONFIGPATH \
  FABRIC_CFG_PATH; do
  value="${!variable:-}"

  if [[ -n "$value" ]]; then
    echo "$variable=$value"
  else
    echo "$variable=<not set>"
  fi
done

section "5. CURRENT COMMITTED DEFINITION — JSON"

COMMITTED_JSON="/tmp/${CHAINCODE_NAME}_committed_${STAMP}.json"

peer lifecycle chaincode querycommitted \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME" \
  --output json \
  > "$COMMITTED_JSON"

jq . "$COMMITTED_JSON"

CURRENT_SEQUENCE="$(
  jq -r '.sequence // empty' "$COMMITTED_JSON"
)"

CURRENT_VERSION="$(
  jq -r '.version // empty' "$COMMITTED_JSON"
)"

if [[ -z "$CURRENT_SEQUENCE" || -z "$CURRENT_VERSION" ]]; then
  echo "ERROR: Could not resolve the committed version or sequence." >&2
  exit 4
fi

NEXT_SEQUENCE="$((CURRENT_SEQUENCE + 1))"

echo
echo "Current Version:  $CURRENT_VERSION"
echo "Current Sequence: $CURRENT_SEQUENCE"
echo "Next Sequence:    $NEXT_SEQUENCE"

section "6. INSTALLED CHAINCODE PACKAGES"

INSTALLED_JSON="/tmp/${CHAINCODE_NAME}_installed_${STAMP}.json"

peer lifecycle chaincode queryinstalled \
  --output json \
  > "$INSTALLED_JSON"

jq . "$INSTALLED_JSON"

echo
echo "Packages matching chaincode label/name:"
jq \
  --arg chaincodeName "$CHAINCODE_NAME" '
    [
      .installed_chaincodes[]?
      | select(
          (.label // "") | contains($chaincodeName)
        )
    ]
  ' \
  "$INSTALLED_JSON"

section "7. CURRENT APPROVALS"

peer lifecycle chaincode querycommitted \
  --channelID "$CHANNEL_NAME" \
  --name "$CHAINCODE_NAME"

section "8. RECOMMENDED NEXT VERSION"

python3 - "$CURRENT_VERSION" <<'PY'
import re
import sys

current = sys.argv[1].strip()
match = re.fullmatch(r"(\d+)\.(\d+)", current)

if not match:
    print(
        "Current version is not in major.minor format. "
        "Choose the next project-approved version manually."
    )
    raise SystemExit(0)

major = int(match.group(1))
minor = int(match.group(2))

print(f"Recommended next version: {major}.{minor + 1}")
PY

section "9. SOURCE HASH"

sha256sum "$CONTRACT_FILE"

if [[ -f "$CHAINCODE_PATH/package.json" ]]; then
  sha256sum "$CHAINCODE_PATH/package.json"
fi

section "10. SUMMARY"

echo "Source has UpdateResident: YES"
echo "Source has DeleteResident: YES"
echo "Current committed version: $CURRENT_VERSION"
echo "Current committed sequence: $CURRENT_SEQUENCE"
echo "Required next sequence: $NEXT_SEQUENCE"
echo "No package was created."
echo "No package was installed."
echo "No approval was submitted."
echo "No chaincode definition was committed."
echo "No backend or frontend file was changed."

section "INSPECTION COMPLETE"
echo "Upload this report for the deployment phase:"
echo "$REPORT"
