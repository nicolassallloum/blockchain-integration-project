#!/usr/bin/env bash

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
FABRIC_NETWORK="${PROJECT_ROOT}/fabric-network"

CHANNEL_NAME="kycchannelnix1"
CHAINCODE_NAME="kyc-wallet-chaincode-js"

ORG1_PEER_HOST="peer0.org1.blockchain.local"
ORG1_PEER_PORT="7051"

echo "=================================================="
echo " Blockchain Integration Project - Status Check"
echo "=================================================="

echo ""
echo "[Docker]"
systemctl is-active docker

echo ""
echo "[Fabric Containers]"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "peer|orderer|couch|ca\.|cli" || true

echo ""
echo "[Ports]"
for port in 7050 7051 9051 5984 3001 4200; do
  if nc -z 127.0.0.1 "$port" >/dev/null 2>&1; then
    echo "Port $port: OPEN"
  else
    echo "Port $port: CLOSED"
  fi
done

echo ""
echo "[Hosts]"
getent hosts peer0.org1.blockchain.local || true
getent hosts peer0.org2.blockchain.local || true
getent hosts orderer.blockchain.local || true

echo ""
echo "[API Health]"
curl -s "http://127.0.0.1:3001/api/v1/health" || true
echo ""

echo ""
echo "[Reference Dropdown API]"
curl -s "http://127.0.0.1:3001/api/v1/reference/ministry-dropdowns" | jq '.success, .message' 2>/dev/null || true

echo ""
echo "[CouchDB]"
curl -s "http://admin:adminpw@127.0.0.1:5984/_up" || true
echo ""

echo ""
echo "[Chaincode]"
export PATH="$PATH:${PROJECT_ROOT}/fabric/fabric-samples/bin"
export FABRIC_CFG_PATH="${PROJECT_ROOT}/fabric/fabric-samples/config"
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_ADDRESS="${ORG1_PEER_HOST}:${ORG1_PEER_PORT}"
export CORE_PEER_MSPCONFIGPATH="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp"
export CORE_PEER_TLS_ROOTCERT_FILE="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt"

peer lifecycle chaincode querycommitted \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --peerAddresses "${ORG1_PEER_HOST}:${ORG1_PEER_PORT}" \
  --tlsRootCertFiles "${CORE_PEER_TLS_ROOTCERT_FILE}" 2>/dev/null || true

echo ""
echo "[Runtime Logs]"
echo "API log:"
tail -20 "${PROJECT_ROOT}/blockchain-api-runtime.log" 2>/dev/null || true

echo ""
echo "UI log:"
tail -20 "${PROJECT_ROOT}/blockchain-ui-runtime.log" 2>/dev/null || true

echo ""
echo "=================================================="
echo " Status Check Completed"
echo "=================================================="