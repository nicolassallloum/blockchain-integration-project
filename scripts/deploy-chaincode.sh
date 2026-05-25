#!/usr/bin/env bash
set -euo pipefail
export PATH="$PATH:/home/nix/u01/blockchain-integration/fabric/fabric-samples/bin"
PROJECT_ROOT="/home/nix/u01/blockchain-integration"
FABRIC_NETWORK="${PROJECT_ROOT}/fabric-network"
CC_SRC_PATH="${PROJECT_ROOT}/chaincode/kyc-wallet-chaincode-js"

CHANNEL_NAME="${CHANNEL_NAME:-kycchannelnix1}"
CC_NAME="${CHAINCODE_NAME:-kyc-wallet-chaincode-js}"
CC_VERSION="${CHAINCODE_VERSION:-2.8}"
CC_SEQUENCE="${CHAINCODE_SEQUENCE:-9}"
CC_LANG="${CHAINCODE_LANG:-node}"
CC_LABEL="${CC_NAME}_${CC_VERSION}"
CC_POLICY="${CHAINCODE_POLICY:-OR('Org1MSP.peer','Org2MSP.peer')}"

PACKAGE_FILE="${PROJECT_ROOT}/${CC_LABEL}.tar.gz"

ORDERER_CA="${FABRIC_NETWORK}/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pem"

ORG1_TLS_CA="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt"
ORG1_ADMIN_MSP="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp"

ORG2_TLS_CA="${FABRIC_NETWORK}/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt"
ORG2_ADMIN_MSP="${FABRIC_NETWORK}/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp"

export FABRIC_CFG_PATH="${PROJECT_ROOT}/fabric/fabric-samples/config"
export CORE_PEER_TLS_ENABLED=true

echo "=================================================="
echo "Deploy Chaincode"
echo "Channel:  ${CHANNEL_NAME}"
echo "Name:     ${CC_NAME}"
echo "Version:  ${CC_VERSION}"
echo "Sequence: ${CC_SEQUENCE}"
echo "Source:   ${CC_SRC_PATH}"
echo "=================================================="

echo "[1/10] Validate required files"

for path in \
  "${CC_SRC_PATH}/package.json" \
  "${CC_SRC_PATH}/index.js" \
  "${CC_SRC_PATH}/lib/kycWalletContract.js" \
  "${ORDERER_CA}" \
  "${ORG1_TLS_CA}" \
  "${ORG1_ADMIN_MSP}" \
  "${ORG2_TLS_CA}" \
  "${ORG2_ADMIN_MSP}"
do
  if [ ! -e "$path" ]; then
    echo "Missing required path: $path"
    exit 1
  fi
done

echo "[2/10] Check chaincode syntax"
node -c "${CC_SRC_PATH}/index.js"
node -c "${CC_SRC_PATH}/lib/kycWalletContract.js"

echo "[3/10] Package chaincode"
rm -f "${PACKAGE_FILE}"

peer lifecycle chaincode package "${PACKAGE_FILE}" \
  --path "${CC_SRC_PATH}" \
  --lang "${CC_LANG}" \
  --label "${CC_LABEL}"

echo "[4/10] Install chaincode on Org1"
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS="localhost:7051"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"

peer lifecycle chaincode install "${PACKAGE_FILE}" || true

echo "[5/10] Install chaincode on Org2"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH="${ORG2_ADMIN_MSP}"
export CORE_PEER_ADDRESS="localhost:9051"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_CA}"

peer lifecycle chaincode install "${PACKAGE_FILE}" || true

echo "[6/10] Get package ID from Org1"
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_MSPCONFIGPATH="${ORG1_ADMIN_MSP}"
export CORE_PEER_ADDRESS="localhost:7051"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG1_TLS_CA}"

PACKAGE_ID="$(peer lifecycle chaincode queryinstalled | grep "${CC_LABEL}" | awk -F 'Package ID: ' '{print $2}' | awk -F ',' '{print $1}' | tail -n 1)"

if [ -z "${PACKAGE_ID}" ]; then
  echo "Could not find package ID for ${CC_LABEL}"
  peer lifecycle chaincode queryinstalled
  exit 1
fi

echo "PACKAGE_ID=${PACKAGE_ID}"

echo "[7/10] Approve chaincode for Org1"
peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.blockchain.local \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --package-id "${PACKAGE_ID}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${CC_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}"

echo "[8/10] Approve chaincode for Org2"
export CORE_PEER_LOCALMSPID="Org2MSP"
export CORE_PEER_MSPCONFIGPATH="${ORG2_ADMIN_MSP}"
export CORE_PEER_ADDRESS="localhost:9051"
export CORE_PEER_TLS_ROOTCERT_FILE="${ORG2_TLS_CA}"

peer lifecycle chaincode approveformyorg \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.blockchain.local \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --package-id "${PACKAGE_ID}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${CC_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}"

echo "[9/10] Check commit readiness"
peer lifecycle chaincode checkcommitreadiness \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${CC_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}" \
  --output json

echo "[10/10] Commit chaincode"
peer lifecycle chaincode commit \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.blockchain.local \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --version "${CC_VERSION}" \
  --sequence "${CC_SEQUENCE}" \
  --signature-policy "${CC_POLICY}" \
  --tls \
  --cafile "${ORDERER_CA}" \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${ORG1_TLS_CA}" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${ORG2_TLS_CA}"

echo "=================================================="
echo "Chaincode committed successfully"
echo "=================================================="

peer lifecycle chaincode querycommitted \
  --channelID "${CHANNEL_NAME}" \
  --name "${CC_NAME}" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${ORG2_TLS_CA}"
