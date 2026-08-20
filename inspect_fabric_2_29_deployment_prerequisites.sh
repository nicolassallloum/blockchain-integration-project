#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"
CLI_CONTAINER="${CLI_CONTAINER:-cli}"
ORG1_PEER_CONTAINER="${ORG1_PEER_CONTAINER:-peer0.org1.blockchain.local}"
ORG2_PEER_CONTAINER="${ORG2_PEER_CONTAINER:-peer0.org2.blockchain.local}"
ORDERER_CONTAINER="${ORDERER_CONTAINER:-orderer.blockchain.local}"

CHANNEL_NAME="${CHANNEL_NAME:-kycchannelnix1}"
CHAINCODE_NAME="${CHAINCODE_NAME:-kyc-wallet-chaincode-js}"
NEXT_VERSION="${NEXT_VERSION:-2.29}"
NEXT_SEQUENCE="${NEXT_SEQUENCE:-29}"

CHAINCODE_HOST_PATH="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js"
CHAINCODE_CLI_PATH="/chaincode/kyc-wallet-chaincode-js"
CONTRACT_FILE="$CHAINCODE_HOST_PATH/lib/kycWalletContract.js"

STAMP="$(date +%Y%m%d_%H%M%S)"
REPORT="$PROJECT_ROOT/fabric_2_29_deployment_prerequisites_${STAMP}.txt"

exec > >(tee "$REPORT") 2>&1

section() {
  echo
  echo "======================================================================"
  echo "$1"
  echo "======================================================================"
}

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

container_env() {
  docker inspect "$1" \
    --format '{{range .Config.Env}}{{println .}}{{end}}'
}

discover_admin_msp() {
  local organization_domain="$1"
  local admin_name="$2"

  docker exec "$CLI_CONTAINER" sh -lc "
    set -e

    preferred='/organizations/peerOrganizations/$organization_domain/users/$admin_name/msp'

    if [ -d \"\$preferred\" ]; then
      printf '%s\n' \"\$preferred\"
      exit 0
    fi

    find '/organizations/peerOrganizations/$organization_domain/users' \
      -type d \
      -path '*/msp' \
      2>/dev/null \
      | head -n 1
  "
}

discover_peer_tls_cert() {
  local peer_domain="$1"
  local organization_domain="$2"

  docker exec "$CLI_CONTAINER" sh -lc "
    set -e

    preferred='/organizations/peerOrganizations/$organization_domain/peers/$peer_domain/tls/ca.crt'

    if [ -f \"\$preferred\" ]; then
      printf '%s\n' \"\$preferred\"
      exit 0
    fi

    find '/organizations/peerOrganizations/$organization_domain' \
      -type f \
      \( -path '*/tls/ca.crt' -o -path '*/tlsca/*.pem' \) \
      2>/dev/null \
      | head -n 1
  "
}

section "FABRIC 2.29 DEPLOYMENT PREREQUISITES — READ-ONLY"
echo "Generated At:       $(date -Is)"
echo "Project Root:       $PROJECT_ROOT"
echo "CLI Container:      $CLI_CONTAINER"
echo "Org1 Peer:          $ORG1_PEER_CONTAINER"
echo "Org2 Peer:          $ORG2_PEER_CONTAINER"
echo "Orderer:            $ORDERER_CONTAINER"
echo "Channel:            $CHANNEL_NAME"
echo "Chaincode:          $CHAINCODE_NAME"
echo "Requested Version:  $NEXT_VERSION"
echo "Requested Sequence: $NEXT_SEQUENCE"
echo "Report:             $REPORT"

command -v docker >/dev/null 2>&1 || fail "docker is not available."

for container in \
  "$CLI_CONTAINER" \
  "$ORG1_PEER_CONTAINER" \
  "$ORG2_PEER_CONTAINER" \
  "$ORDERER_CONTAINER"; do
  docker inspect "$container" >/dev/null 2>&1 \
    || fail "Required container was not found: $container"
done

section "1. ACTIVE CHAINCODE SOURCE"

[[ -f "$CONTRACT_FILE" ]] \
  || fail "Contract file not found: $CONTRACT_FILE"

node --check "$CONTRACT_FILE"

UPDATE_COUNT="$(grep -c "async UpdateResident" "$CONTRACT_FILE" || true)"
DELETE_COUNT="$(grep -c "async DeleteResident" "$CONTRACT_FILE" || true)"

echo "UpdateResident count: $UPDATE_COUNT"
echo "DeleteResident count: $DELETE_COUNT"

[[ "$UPDATE_COUNT" -eq 1 ]] \
  || fail "UpdateResident must exist exactly once."

[[ "$DELETE_COUNT" -eq 1 ]] \
  || fail "DeleteResident must exist exactly once."

if [[ -f "$CHAINCODE_HOST_PATH/package.json" ]]; then
  (
    cd "$CHAINCODE_HOST_PATH"
    npm run check:syntax
  )
fi

echo
echo "Host source hashes:"
sha256sum "$CONTRACT_FILE"

if [[ -f "$CHAINCODE_HOST_PATH/package.json" ]]; then
  sha256sum "$CHAINCODE_HOST_PATH/package.json"
fi

section "2. CHAINCODE SOURCE INSIDE CLI"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e

  test -f '$CHAINCODE_CLI_PATH/lib/kycWalletContract.js'
  test -f '$CHAINCODE_CLI_PATH/package.json'

  echo 'PASS: Chaincode source and package metadata are mounted.'
  echo 'UpdateResident count:' \
    \$(grep -c 'async UpdateResident' \
      '$CHAINCODE_CLI_PATH/lib/kycWalletContract.js')
  echo 'DeleteResident count:' \
    \$(grep -c 'async DeleteResident' \
      '$CHAINCODE_CLI_PATH/lib/kycWalletContract.js')
"

section "3. RESOLVE ORG1 CONTEXT"

ORG1_ENV="$(container_env "$ORG1_PEER_CONTAINER")"

ORG1_MSP_ID="$(
  printf '%s\n' "$ORG1_ENV" \
    | sed -n 's/^CORE_PEER_LOCALMSPID=//p' \
    | head -n 1
)"

ORG1_PEER_ADDRESS="$(
  printf '%s\n' "$ORG1_ENV" \
    | sed -n 's/^CORE_PEER_ADDRESS=//p' \
    | head -n 1
)"

[[ -n "$ORG1_MSP_ID" ]] \
  || fail "Org1 MSP ID was not resolved."

[[ -n "$ORG1_PEER_ADDRESS" ]] \
  || fail "Org1 peer address was not resolved."

ORG1_ADMIN_MSP="$(
  discover_admin_msp \
    "org1.blockchain.local" \
    "Admin@org1.blockchain.local"
)"

ORG1_TLS_CERT="$(
  discover_peer_tls_cert \
    "peer0.org1.blockchain.local" \
    "org1.blockchain.local"
)"

[[ -n "$ORG1_ADMIN_MSP" ]] \
  || fail "Org1 Admin MSP was not found."

[[ -n "$ORG1_TLS_CERT" ]] \
  || fail "Org1 TLS certificate was not found."

echo "Org1 MSP ID:       $ORG1_MSP_ID"
echo "Org1 Peer Address: $ORG1_PEER_ADDRESS"
echo "Org1 Admin MSP:    $ORG1_ADMIN_MSP"
echo "Org1 TLS Cert:     $ORG1_TLS_CERT"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e
  test -d '$ORG1_ADMIN_MSP/signcerts'
  test -d '$ORG1_ADMIN_MSP/keystore'
  test -r '$ORG1_TLS_CERT'
  echo 'PASS: Org1 identity and TLS files are readable.'
"

section "4. RESOLVE ORG2 CONTEXT"

ORG2_ENV="$(container_env "$ORG2_PEER_CONTAINER")"

ORG2_MSP_ID="$(
  printf '%s\n' "$ORG2_ENV" \
    | sed -n 's/^CORE_PEER_LOCALMSPID=//p' \
    | head -n 1
)"

ORG2_PEER_ADDRESS="$(
  printf '%s\n' "$ORG2_ENV" \
    | sed -n 's/^CORE_PEER_ADDRESS=//p' \
    | head -n 1
)"

[[ -n "$ORG2_MSP_ID" ]] \
  || fail "Org2 MSP ID was not resolved."

[[ -n "$ORG2_PEER_ADDRESS" ]] \
  || fail "Org2 peer address was not resolved."

ORG2_ADMIN_MSP="$(
  discover_admin_msp \
    "org2.blockchain.local" \
    "Admin@org2.blockchain.local"
)"

ORG2_TLS_CERT="$(
  discover_peer_tls_cert \
    "peer0.org2.blockchain.local" \
    "org2.blockchain.local"
)"

[[ -n "$ORG2_ADMIN_MSP" ]] \
  || fail "Org2 Admin MSP was not found."

[[ -n "$ORG2_TLS_CERT" ]] \
  || fail "Org2 TLS certificate was not found."

echo "Org2 MSP ID:       $ORG2_MSP_ID"
echo "Org2 Peer Address: $ORG2_PEER_ADDRESS"
echo "Org2 Admin MSP:    $ORG2_ADMIN_MSP"
echo "Org2 TLS Cert:     $ORG2_TLS_CERT"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e
  test -d '$ORG2_ADMIN_MSP/signcerts'
  test -d '$ORG2_ADMIN_MSP/keystore'
  test -r '$ORG2_TLS_CERT'
  echo 'PASS: Org2 identity and TLS files are readable.'
"

section "5. RESOLVE ORDERER CONTEXT"

ORDERER_ENV="$(container_env "$ORDERER_CONTAINER")"

ORDERER_PORT="$(
  printf '%s\n' "$ORDERER_ENV" \
    | sed -n 's/^ORDERER_GENERAL_LISTENPORT=//p' \
    | head -n 1
)"

[[ -n "$ORDERER_PORT" ]] || ORDERER_PORT="7050"

ORDERER_ADDRESS="${ORDERER_CONTAINER}:${ORDERER_PORT}"

ORDERER_TLS_CA="$(
  docker exec "$CLI_CONTAINER" sh -lc "
    set -e

    preferred='/organizations/ordererOrganizations/blockchain.local/orderers/$ORDERER_CONTAINER/msp/tlscacerts/tlsca.blockchain.local-cert.pem'

    if [ -f \"\$preferred\" ]; then
      printf '%s\n' \"\$preferred\"
      exit 0
    fi

    preferred_tls='/organizations/ordererOrganizations/blockchain.local/orderers/$ORDERER_CONTAINER/tls/ca.crt'

    if [ -f \"\$preferred_tls\" ]; then
      printf '%s\n' \"\$preferred_tls\"
      exit 0
    fi

    find /organizations/ordererOrganizations \
      -type f \
      \( -path '*/msp/tlscacerts/*.pem' -o -path '*/tls/ca.crt' \) \
      2>/dev/null \
      | head -n 1
  "
)"

[[ -n "$ORDERER_TLS_CA" ]] \
  || fail "Orderer TLS CA was not found."

echo "Orderer Address: $ORDERER_ADDRESS"
echo "Orderer TLS CA:  $ORDERER_TLS_CA"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e
  test -r '$ORDERER_TLS_CA'
  getent hosts '$ORDERER_CONTAINER'
  echo 'PASS: Orderer hostname resolves and TLS CA is readable.'
"

section "6. NETWORK RESOLUTION FROM CLI"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e

  getent hosts '$ORG1_PEER_CONTAINER'
  getent hosts '$ORG2_PEER_CONTAINER'
  getent hosts '$ORDERER_CONTAINER'
"

section "7. QUERY CURRENT DEFINITION FROM ORG1"

ORG1_COMMITTED="/tmp/${CHAINCODE_NAME}_org1_committed_${STAMP}.json"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG1_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG1_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG1_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode querycommitted \
      --channelID '$CHANNEL_NAME' \
      --name '$CHAINCODE_NAME' \
      --peerAddresses '$ORG1_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG1_TLS_CERT' \
      --output json
  " \
  > "$ORG1_COMMITTED"

jq . "$ORG1_COMMITTED"

CURRENT_VERSION="$(
  jq -r '.version // empty' "$ORG1_COMMITTED"
)"

CURRENT_SEQUENCE="$(
  jq -r '.sequence // empty' "$ORG1_COMMITTED"
)"

[[ -n "$CURRENT_VERSION" ]] \
  || fail "Current version was not returned."

[[ -n "$CURRENT_SEQUENCE" ]] \
  || fail "Current sequence was not returned."

[[ "$CURRENT_VERSION" == "2.28" ]] \
  || fail "Expected current version 2.28, found $CURRENT_VERSION."

[[ "$CURRENT_SEQUENCE" == "28" ]] \
  || fail "Expected current sequence 28, found $CURRENT_SEQUENCE."

[[ "$NEXT_SEQUENCE" == "$((CURRENT_SEQUENCE + 1))" ]] \
  || fail "Requested next sequence is not current sequence + 1."

echo
echo "PASS: Current definition is version $CURRENT_VERSION, sequence $CURRENT_SEQUENCE."

section "8. QUERY CURRENT DEFINITION FROM ORG2"

ORG2_COMMITTED="/tmp/${CHAINCODE_NAME}_org2_committed_${STAMP}.json"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG2_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG2_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG2_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG2_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode querycommitted \
      --channelID '$CHANNEL_NAME' \
      --name '$CHAINCODE_NAME' \
      --peerAddresses '$ORG2_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG2_TLS_CERT' \
      --output json
  " \
  > "$ORG2_COMMITTED"

jq . "$ORG2_COMMITTED"

ORG2_VERSION="$(jq -r '.version // empty' "$ORG2_COMMITTED")"
ORG2_SEQUENCE="$(jq -r '.sequence // empty' "$ORG2_COMMITTED")"

[[ "$ORG2_VERSION" == "$CURRENT_VERSION" ]] \
  || fail "Org2 sees a different committed version."

[[ "$ORG2_SEQUENCE" == "$CURRENT_SEQUENCE" ]] \
  || fail "Org2 sees a different committed sequence."

echo
echo "PASS: Org1 and Org2 see the same committed definition."

section "9. QUERY CURRENT INSTALLED PACKAGES"

ORG1_INSTALLED="/tmp/${CHAINCODE_NAME}_org1_installed_${STAMP}.json"
ORG2_INSTALLED="/tmp/${CHAINCODE_NAME}_org2_installed_${STAMP}.json"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG1_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG1_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG1_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode queryinstalled \
      --peerAddresses '$ORG1_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG1_TLS_CERT' \
      --output json
  " \
  > "$ORG1_INSTALLED"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG2_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG2_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG2_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG2_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode queryinstalled \
      --peerAddresses '$ORG2_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG2_TLS_CERT' \
      --output json
  " \
  > "$ORG2_INSTALLED"

echo "Org1 current package:"
jq \
  --arg label "${CHAINCODE_NAME}_2.28" '
    [
      .installed_chaincodes[]?
      | select(.label == $label)
    ]
  ' \
  "$ORG1_INSTALLED"

echo
echo "Org2 current package:"
jq \
  --arg label "${CHAINCODE_NAME}_2.28" '
    [
      .installed_chaincodes[]?
      | select(.label == $label)
    ]
  ' \
  "$ORG2_INSTALLED"

section "10. CHECK TARGET LABEL IS NOT ALREADY INSTALLED"

ORG1_TARGET_COUNT="$(
  jq \
    --arg label "${CHAINCODE_NAME}_${NEXT_VERSION}" '
      [
        .installed_chaincodes[]?
        | select(.label == $label)
      ]
      | length
    ' \
    "$ORG1_INSTALLED"
)"

ORG2_TARGET_COUNT="$(
  jq \
    --arg label "${CHAINCODE_NAME}_${NEXT_VERSION}" '
      [
        .installed_chaincodes[]?
        | select(.label == $label)
      ]
      | length
    ' \
    "$ORG2_INSTALLED"
)"

echo "Org1 target-label packages: $ORG1_TARGET_COUNT"
echo "Org2 target-label packages: $ORG2_TARGET_COUNT"

if [[ "$ORG1_TARGET_COUNT" -gt 0 || "$ORG2_TARGET_COUNT" -gt 0 ]]; then
  echo "WARNING: The target label already exists on at least one peer."
  echo "A unique deployment label must be selected before packaging."
else
  echo "PASS: Target label ${CHAINCODE_NAME}_${NEXT_VERSION} is unused."
fi

section "11. PACKAGE COMMAND AVAILABILITY"

docker exec "$CLI_CONTAINER" sh -lc '
  set -e

  peer lifecycle chaincode package --help >/dev/null
  peer lifecycle chaincode install --help >/dev/null
  peer lifecycle chaincode approveformyorg --help >/dev/null
  peer lifecycle chaincode checkcommitreadiness --help >/dev/null
  peer lifecycle chaincode commit --help >/dev/null

  echo "PASS: Required Fabric lifecycle commands are available."
'

section "12. FINAL PREREQUISITE SUMMARY"

echo "Current Version:       $CURRENT_VERSION"
echo "Current Sequence:      $CURRENT_SEQUENCE"
echo "Next Version:          $NEXT_VERSION"
echo "Next Sequence:         $NEXT_SEQUENCE"
echo "Target Label:          ${CHAINCODE_NAME}_${NEXT_VERSION}"
echo
echo "Org1 MSP ID:           $ORG1_MSP_ID"
echo "Org1 Peer Address:     $ORG1_PEER_ADDRESS"
echo "Org1 Admin MSP:        $ORG1_ADMIN_MSP"
echo "Org1 TLS Cert:         $ORG1_TLS_CERT"
echo
echo "Org2 MSP ID:           $ORG2_MSP_ID"
echo "Org2 Peer Address:     $ORG2_PEER_ADDRESS"
echo "Org2 Admin MSP:        $ORG2_ADMIN_MSP"
echo "Org2 TLS Cert:         $ORG2_TLS_CERT"
echo
echo "Orderer Address:       $ORDERER_ADDRESS"
echo "Orderer TLS CA:        $ORDERER_TLS_CA"
echo "Chaincode CLI Path:    $CHAINCODE_CLI_PATH"
echo
echo "No chaincode package was created."
echo "No package was installed."
echo "No organization approval was submitted."
echo "No chaincode definition was committed."
echo "No backend or frontend file was modified."

section "PREREQUISITE INSPECTION COMPLETE"
echo "Upload this report for the controlled deployment phase:"
echo "$REPORT"
