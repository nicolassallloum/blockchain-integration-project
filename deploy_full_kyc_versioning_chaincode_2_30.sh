#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT_ROOT="${1:-$HOME/u01/blockchain-integration}"

CLI_CONTAINER="${CLI_CONTAINER:-cli}"
ORG1_PEER_CONTAINER="${ORG1_PEER_CONTAINER:-peer0.org1.blockchain.local}"
ORG2_PEER_CONTAINER="${ORG2_PEER_CONTAINER:-peer0.org2.blockchain.local}"
ORDERER_CONTAINER="${ORDERER_CONTAINER:-orderer.blockchain.local}"

CHANNEL_NAME="${CHANNEL_NAME:-kycchannelnix1}"
CHAINCODE_NAME="${CHAINCODE_NAME:-kyc-wallet-chaincode-js}"
CHAINCODE_VERSION="${CHAINCODE_VERSION:-2.30}"
CHAINCODE_SEQUENCE="${CHAINCODE_SEQUENCE:-30}"
CHAINCODE_LABEL="${CHAINCODE_LABEL:-${CHAINCODE_NAME}_${CHAINCODE_VERSION}}"

CHAINCODE_HOST_PATH="$PROJECT_ROOT/chaincode/kyc-wallet-chaincode-js"
CHAINCODE_CLI_PATH="/chaincode/kyc-wallet-chaincode-js"
CONTRACT_FILE="$CHAINCODE_HOST_PATH/lib/kycWalletContract.js"

# This matches the currently committed validation parameter:
# 1-of Org1MSP.peer and Org2MSP.peer.
SIGNATURE_POLICY="${SIGNATURE_POLICY:-OR('Org1MSP.peer','Org2MSP.peer')}"

STAMP="$(date +%Y%m%d_%H%M%S)"
EVIDENCE_DIR="$PROJECT_ROOT/deployment-evidence/full-kyc-versioning-chaincode-${CHAINCODE_VERSION}-${STAMP}"
PACKAGE_IN_CLI="/var/hyperledger/${CHAINCODE_LABEL}.tar.gz"
PACKAGE_ON_HOST="$EVIDENCE_DIR/${CHAINCODE_LABEL}.tar.gz"
REPORT="$EVIDENCE_DIR/deployment-report.txt"

mkdir -p "$EVIDENCE_DIR"
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

query_committed_org1() {
  local output_file="$1"

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
    " > "$output_file"
}

query_installed() {
  local msp_id="$1"
  local peer_address="$2"
  local tls_cert="$3"
  local admin_msp="$4"
  local output_file="$5"

  docker exec \
    -e CORE_PEER_LOCALMSPID="$msp_id" \
    -e CORE_PEER_ADDRESS="$peer_address" \
    -e CORE_PEER_TLS_ENABLED="true" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$tls_cert" \
    -e CORE_PEER_MSPCONFIGPATH="$admin_msp" \
    -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
    "$CLI_CONTAINER" sh -lc "
      set -e

      peer lifecycle chaincode queryinstalled \
        --peerAddresses '$peer_address' \
        --tlsRootCertFiles '$tls_cert' \
        --output json
    " > "$output_file"
}

install_for_org() {
  local organization_name="$1"
  local msp_id="$2"
  local peer_address="$3"
  local tls_cert="$4"
  local admin_msp="$5"
  local before_file="$6"
  local after_file="$7"

  query_installed \
    "$msp_id" \
    "$peer_address" \
    "$tls_cert" \
    "$admin_msp" \
    "$before_file"

  local already_installed
  already_installed="$(
    jq -r \
      --arg packageId "$PACKAGE_ID" '
        any(
          .installed_chaincodes[]?;
          .package_id == $packageId
        )
      ' \
      "$before_file"
  )"

  if [[ "$already_installed" == "true" ]]; then
    echo "SKIP: $organization_name already has package $PACKAGE_ID"
  else
    echo "Installing package for $organization_name..."

    docker exec \
      -e CORE_PEER_LOCALMSPID="$msp_id" \
      -e CORE_PEER_ADDRESS="$peer_address" \
      -e CORE_PEER_TLS_ENABLED="true" \
      -e CORE_PEER_TLS_ROOTCERT_FILE="$tls_cert" \
      -e CORE_PEER_MSPCONFIGPATH="$admin_msp" \
      -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
      "$CLI_CONTAINER" sh -lc "
        set -e

        peer lifecycle chaincode install \
          '$PACKAGE_IN_CLI' \
          --peerAddresses '$peer_address' \
          --tlsRootCertFiles '$tls_cert'
      "
  fi

  query_installed \
    "$msp_id" \
    "$peer_address" \
    "$tls_cert" \
    "$admin_msp" \
    "$after_file"

  jq -e \
    --arg packageId "$PACKAGE_ID" '
      any(
        .installed_chaincodes[]?;
        .package_id == $packageId
      )
    ' \
    "$after_file" >/dev/null \
    || fail "$organization_name package installation was not confirmed."

  echo "PASS: $organization_name package installation confirmed."
}

approve_for_org() {
  local organization_name="$1"
  local msp_id="$2"
  local peer_address="$3"
  local tls_cert="$4"
  local admin_msp="$5"
  local approval_file="$6"

  echo "Submitting approval for $organization_name..."

  docker exec \
    -e CORE_PEER_LOCALMSPID="$msp_id" \
    -e CORE_PEER_ADDRESS="$peer_address" \
    -e CORE_PEER_TLS_ENABLED="true" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$tls_cert" \
    -e CORE_PEER_MSPCONFIGPATH="$admin_msp" \
    -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
    "$CLI_CONTAINER" sh -lc "
      set -e

      peer lifecycle chaincode approveformyorg \
        --orderer '$ORDERER_ADDRESS' \
        --ordererTLSHostnameOverride '$ORDERER_CONTAINER' \
        --channelID '$CHANNEL_NAME' \
        --name '$CHAINCODE_NAME' \
        --version '$CHAINCODE_VERSION' \
        --package-id '$PACKAGE_ID' \
        --sequence '$CHAINCODE_SEQUENCE' \
        --signature-policy \"$SIGNATURE_POLICY\" \
        --tls \
        --cafile '$ORDERER_TLS_CA'
    "

  docker exec \
    -e CORE_PEER_LOCALMSPID="$msp_id" \
    -e CORE_PEER_ADDRESS="$peer_address" \
    -e CORE_PEER_TLS_ENABLED="true" \
    -e CORE_PEER_TLS_ROOTCERT_FILE="$tls_cert" \
    -e CORE_PEER_MSPCONFIGPATH="$admin_msp" \
    -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
    "$CLI_CONTAINER" sh -lc "
      set -e

      peer lifecycle chaincode queryapproved \
        --channelID '$CHANNEL_NAME' \
        --name '$CHAINCODE_NAME' \
        --sequence '$CHAINCODE_SEQUENCE' \
        --peerAddresses '$peer_address' \
        --tlsRootCertFiles '$tls_cert' \
        --output json
    " > "$approval_file"

  jq . "$approval_file"

  jq -e \
    --arg version "$CHAINCODE_VERSION" \
    --argjson sequence "$CHAINCODE_SEQUENCE" \
    --arg packageId "$PACKAGE_ID" '
      .version == $version
      and
      .sequence == $sequence
      and
      .source.Type.LocalPackage.package_id == $packageId
    ' \
    "$approval_file" >/dev/null \
    || fail "$organization_name approval verification failed."

  echo "PASS: $organization_name approval confirmed."
}

section "CUSTOMER CRUD CHAINCODE CONTROLLED DEPLOYMENT"
echo "Generated At:     $(date -Is)"
echo "Project Root:     $PROJECT_ROOT"
echo "Channel:          $CHANNEL_NAME"
echo "Chaincode:        $CHAINCODE_NAME"
echo "Version:          $CHAINCODE_VERSION"
echo "Sequence:         $CHAINCODE_SEQUENCE"
echo "Label:            $CHAINCODE_LABEL"
echo "Policy:           $SIGNATURE_POLICY"
echo "Evidence Dir:     $EVIDENCE_DIR"
echo "Report:           $REPORT"

command -v docker >/dev/null 2>&1 \
  || fail "docker is not available."

command -v jq >/dev/null 2>&1 \
  || fail "jq is not available."

for container in \
  "$CLI_CONTAINER" \
  "$ORG1_PEER_CONTAINER" \
  "$ORG2_PEER_CONTAINER" \
  "$ORDERER_CONTAINER"; do
  docker inspect "$container" >/dev/null 2>&1 \
    || fail "Required container was not found: $container"
done

section "1. SOURCE AND VERSION SAFETY CHECKS"

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

(
  cd "$CHAINCODE_HOST_PATH"
  npm run check:syntax
)

sha256sum \
  "$CONTRACT_FILE" \
  "$CHAINCODE_HOST_PATH/package.json" \
  | tee "$EVIDENCE_DIR/source-hashes.txt"

section "2. RESOLVE FABRIC IDENTITIES AND TLS"

ORG1_ENV="$(container_env "$ORG1_PEER_CONTAINER")"
ORG2_ENV="$(container_env "$ORG2_PEER_CONTAINER")"
ORDERER_ENV="$(container_env "$ORDERER_CONTAINER")"

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

ORDERER_PORT="$(
  printf '%s\n' "$ORDERER_ENV" \
    | sed -n 's/^ORDERER_GENERAL_LISTENPORT=//p' \
    | head -n 1
)"

[[ -n "$ORG1_MSP_ID" ]] || fail "Org1 MSP ID was not resolved."
[[ -n "$ORG1_PEER_ADDRESS" ]] || fail "Org1 peer address was not resolved."
[[ -n "$ORG2_MSP_ID" ]] || fail "Org2 MSP ID was not resolved."
[[ -n "$ORG2_PEER_ADDRESS" ]] || fail "Org2 peer address was not resolved."

[[ -n "$ORDERER_PORT" ]] || ORDERER_PORT="7050"
ORDERER_ADDRESS="${ORDERER_CONTAINER}:${ORDERER_PORT}"

ORG1_ADMIN_MSP="$(
  discover_admin_msp \
    "org1.blockchain.local" \
    "Admin@org1.blockchain.local"
)"

ORG2_ADMIN_MSP="$(
  discover_admin_msp \
    "org2.blockchain.local" \
    "Admin@org2.blockchain.local"
)"

ORG1_TLS_CERT="$(
  discover_peer_tls_cert \
    "peer0.org1.blockchain.local" \
    "org1.blockchain.local"
)"

ORG2_TLS_CERT="$(
  discover_peer_tls_cert \
    "peer0.org2.blockchain.local" \
    "org2.blockchain.local"
)"

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

[[ -n "$ORG1_ADMIN_MSP" ]] || fail "Org1 Admin MSP was not found."
[[ -n "$ORG2_ADMIN_MSP" ]] || fail "Org2 Admin MSP was not found."
[[ -n "$ORG1_TLS_CERT" ]] || fail "Org1 TLS certificate was not found."
[[ -n "$ORG2_TLS_CERT" ]] || fail "Org2 TLS certificate was not found."
[[ -n "$ORDERER_TLS_CA" ]] || fail "Orderer TLS CA was not found."

echo "Org1:   $ORG1_MSP_ID | $ORG1_PEER_ADDRESS"
echo "Org2:   $ORG2_MSP_ID | $ORG2_PEER_ADDRESS"
echo "Orderer: $ORDERER_ADDRESS"

section "3. VERIFY CURRENT COMMITTED DEFINITION"

CURRENT_COMMITTED="$EVIDENCE_DIR/committed-before.json"
query_committed_org1 "$CURRENT_COMMITTED"
jq . "$CURRENT_COMMITTED"

CURRENT_VERSION="$(jq -r '.version // empty' "$CURRENT_COMMITTED")"
CURRENT_SEQUENCE="$(jq -r '.sequence // empty' "$CURRENT_COMMITTED")"

if [[ "$CURRENT_VERSION" == "$CHAINCODE_VERSION" \
   && "$CURRENT_SEQUENCE" == "$CHAINCODE_SEQUENCE" ]]; then
  echo "Chaincode version $CHAINCODE_VERSION sequence $CHAINCODE_SEQUENCE is already committed."
  echo "Running final verification only."

  FINAL_COMMITTED="$EVIDENCE_DIR/committed-final.json"
  cp "$CURRENT_COMMITTED" "$FINAL_COMMITTED"

  jq -e \
    --arg version "$CHAINCODE_VERSION" \
    --argjson sequence "$CHAINCODE_SEQUENCE" '
      .version == $version
      and
      .sequence == $sequence
      and
      .approvals.Org1MSP == true
      and
      .approvals.Org2MSP == true
    ' \
    "$FINAL_COMMITTED" >/dev/null \
    || fail "Existing committed definition is not fully approved."

  section "DEPLOYMENT ALREADY COMPLETE"
  echo "Evidence directory: $EVIDENCE_DIR"
  exit 0
fi

[[ "$CURRENT_VERSION" == "2.29" ]] \
  || fail "Expected current version 2.29, found $CURRENT_VERSION."

[[ "$CURRENT_SEQUENCE" == "29" ]] \
  || fail "Expected current sequence 29, found $CURRENT_SEQUENCE."

[[ "$CHAINCODE_VERSION" == "2.30" ]] \
  || fail "This controlled deployment requires version 2.30."

[[ "$CHAINCODE_SEQUENCE" == "30" ]] \
  || fail "This controlled deployment requires sequence 30."

section "4. PACKAGE CHAINCODE"

docker exec "$CLI_CONTAINER" sh -lc "
  set -e

  rm -f '$PACKAGE_IN_CLI'

  peer lifecycle chaincode package \
    '$PACKAGE_IN_CLI' \
    --path '$CHAINCODE_CLI_PATH' \
    --lang node \
    --label '$CHAINCODE_LABEL'

  test -s '$PACKAGE_IN_CLI'

  peer lifecycle chaincode calculatepackageid \
    '$PACKAGE_IN_CLI'
" \
| tee "$EVIDENCE_DIR/package-command-output.txt"

PACKAGE_ID="$(
  tail -n 1 "$EVIDENCE_DIR/package-command-output.txt" \
    | tr -d '\r\n'
)"

[[ "$PACKAGE_ID" == "${CHAINCODE_LABEL}:"* ]] \
  || fail "Unexpected package ID: $PACKAGE_ID"

printf '%s\n' "$PACKAGE_ID" \
  | tee "$EVIDENCE_DIR/package-id.txt"

docker cp \
  "$CLI_CONTAINER:$PACKAGE_IN_CLI" \
  "$PACKAGE_ON_HOST"

chmod 600 "$PACKAGE_ON_HOST"

ls -lh "$PACKAGE_ON_HOST"
sha256sum "$PACKAGE_ON_HOST" \
  | tee "$EVIDENCE_DIR/package-sha256.txt"

section "5. INSTALL PACKAGE ON ORG1 AND ORG2"

install_for_org \
  "Org1" \
  "$ORG1_MSP_ID" \
  "$ORG1_PEER_ADDRESS" \
  "$ORG1_TLS_CERT" \
  "$ORG1_ADMIN_MSP" \
  "$EVIDENCE_DIR/org1-installed-before.json" \
  "$EVIDENCE_DIR/org1-installed-after.json"

install_for_org \
  "Org2" \
  "$ORG2_MSP_ID" \
  "$ORG2_PEER_ADDRESS" \
  "$ORG2_TLS_CERT" \
  "$ORG2_ADMIN_MSP" \
  "$EVIDENCE_DIR/org2-installed-before.json" \
  "$EVIDENCE_DIR/org2-installed-after.json"

section "6. APPROVE DEFINITION FOR BOTH ORGANIZATIONS"

approve_for_org \
  "Org1" \
  "$ORG1_MSP_ID" \
  "$ORG1_PEER_ADDRESS" \
  "$ORG1_TLS_CERT" \
  "$ORG1_ADMIN_MSP" \
  "$EVIDENCE_DIR/org1-approved.json"

approve_for_org \
  "Org2" \
  "$ORG2_MSP_ID" \
  "$ORG2_PEER_ADDRESS" \
  "$ORG2_TLS_CERT" \
  "$ORG2_ADMIN_MSP" \
  "$EVIDENCE_DIR/org2-approved.json"

section "7. CHECK COMMIT READINESS"

READINESS_FILE="$EVIDENCE_DIR/check-commit-readiness.json"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG1_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG1_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG1_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode checkcommitreadiness \
      --channelID '$CHANNEL_NAME' \
      --name '$CHAINCODE_NAME' \
      --version '$CHAINCODE_VERSION' \
      --sequence '$CHAINCODE_SEQUENCE' \
      --signature-policy \"$SIGNATURE_POLICY\" \
      --peerAddresses '$ORG1_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG1_TLS_CERT' \
      --output json
  " > "$READINESS_FILE"

jq . "$READINESS_FILE"

jq -e '
  .approvals.Org1MSP == true
  and
  .approvals.Org2MSP == true
' "$READINESS_FILE" >/dev/null \
  || fail "Both organization approvals are not ready."

echo "PASS: Both organizations are ready to commit."

section "8. COMMIT VERSION 2.30 SEQUENCE 30"

docker exec \
  -e CORE_PEER_LOCALMSPID="$ORG1_MSP_ID" \
  -e CORE_PEER_ADDRESS="$ORG1_PEER_ADDRESS" \
  -e CORE_PEER_TLS_ENABLED="true" \
  -e CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS_CERT" \
  -e CORE_PEER_MSPCONFIGPATH="$ORG1_ADMIN_MSP" \
  -e FABRIC_CFG_PATH="/etc/hyperledger/fabric" \
  "$CLI_CONTAINER" sh -lc "
    set -e

    peer lifecycle chaincode commit \
      --orderer '$ORDERER_ADDRESS' \
      --ordererTLSHostnameOverride '$ORDERER_CONTAINER' \
      --channelID '$CHANNEL_NAME' \
      --name '$CHAINCODE_NAME' \
      --version '$CHAINCODE_VERSION' \
      --sequence '$CHAINCODE_SEQUENCE' \
      --signature-policy \"$SIGNATURE_POLICY\" \
      --peerAddresses '$ORG1_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG1_TLS_CERT' \
      --peerAddresses '$ORG2_PEER_ADDRESS' \
      --tlsRootCertFiles '$ORG2_TLS_CERT' \
      --tls \
      --cafile '$ORDERER_TLS_CA'
  " \
  | tee "$EVIDENCE_DIR/commit-command-output.txt"

section "9. VERIFY FINAL COMMITTED DEFINITION"

sleep 5

FINAL_COMMITTED="$EVIDENCE_DIR/committed-final.json"
query_committed_org1 "$FINAL_COMMITTED"
jq . "$FINAL_COMMITTED"

jq -e \
  --arg version "$CHAINCODE_VERSION" \
  --argjson sequence "$CHAINCODE_SEQUENCE" '
    .version == $version
    and
    .sequence == $sequence
    and
    .approvals.Org1MSP == true
    and
    .approvals.Org2MSP == true
  ' \
  "$FINAL_COMMITTED" >/dev/null \
  || fail "Final committed-definition verification failed."

section "10. VERIFY NEW CHAINCODE CONTAINERS"

sleep 10

docker ps \
  --format 'table {{.Names}}\t{{.Status}}' \
  | grep -E \
    "${CHAINCODE_NAME}_${CHAINCODE_VERSION}|NAMES" \
  | tee "$EVIDENCE_DIR/chaincode-containers.txt" \
  || true

section "DEPLOYMENT COMPLETED SUCCESSFULLY"

echo "Channel:             $CHANNEL_NAME"
echo "Chaincode:           $CHAINCODE_NAME"
echo "Committed Version:   $CHAINCODE_VERSION"
echo "Committed Sequence:  $CHAINCODE_SEQUENCE"
echo "Package Label:       $CHAINCODE_LABEL"
echo "Package ID:          $PACKAGE_ID"
echo "Endorsement Policy:  $SIGNATURE_POLICY"
echo "Evidence Directory:  $EVIDENCE_DIR"
echo
echo "Full KYC immutable versioning is now part of the committed chaincode definition."
echo "No backend or frontend source file was modified by this deployment script."
