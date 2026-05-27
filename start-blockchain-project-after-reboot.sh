#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/home/nix/u01/blockchain-integration"
FABRIC_NETWORK="${PROJECT_ROOT}/fabric-network"
BLOCKCHAIN_API="${PROJECT_ROOT}/blockchain-api"
ANGULAR_UI="${PROJECT_ROOT}/blockchain-test-ui"

API_PORT="3001"
UI_PORT="4200"

CHANNEL_NAME="kycchannelnix1"
CHAINCODE_NAME="kyc-wallet-chaincode-js"

ORG1_PEER_HOST="peer0.org1.blockchain.local"
ORG2_PEER_HOST="peer0.org2.blockchain.local"
ORDERER_HOST="orderer.blockchain.local"

ORG1_PEER_PORT="7051"
ORG2_PEER_PORT="9051"
ORDERER_PORT="7050"
COUCHDB_PORT="5984"

echo "=================================================="
echo " Blockchain Integration Project - Startup Script"
echo "=================================================="
echo "Project Root: ${PROJECT_ROOT}"
echo "Started At:   $(date)"
echo "=================================================="

echo ""
echo "[1/12] Checking Docker service..."

if ! systemctl is-active --quiet docker; then
  echo "Docker is not running. Starting Docker..."
  sudo systemctl start docker
fi

echo "Docker status: $(systemctl is-active docker)"

echo ""
echo "[2/12] Adding Fabric hostnames to /etc/hosts..."

ensure_host() {
  local host="$1"

  if ! grep -qE "127\.0\.0\.1[[:space:]].*${host}" /etc/hosts; then
    echo "Adding ${host} to /etc/hosts..."
    echo "127.0.0.1 ${host}" | sudo tee -a /etc/hosts >/dev/null
  else
    echo "${host} already exists in /etc/hosts"
  fi
}

ensure_host "${ORG1_PEER_HOST}"
ensure_host "${ORG2_PEER_HOST}"
ensure_host "${ORDERER_HOST}"

echo ""
echo "[3/12] Starting Fabric containers..."

cd "${FABRIC_NETWORK}"

if [ -f "docker-compose-fabric.yaml" ]; then
  docker compose -f docker-compose-fabric.yaml up -d
fi

if [ -f "docker-compose-couchdb.yaml" ]; then
  docker compose -f docker-compose-couchdb.yaml up -d
fi

if [ -f "docker-compose-cli.yaml" ]; then
  docker compose -f docker-compose-cli.yaml up -d
fi

echo ""
echo "[4/12] Starting known containers if they exist..."

docker start orderer.blockchain.local 2>/dev/null || true
docker start peer0.org1.blockchain.local 2>/dev/null || true
docker start peer0.org2.blockchain.local 2>/dev/null || true
docker start couchdb0.org1 2>/dev/null || true
docker start couchdb0.org2 2>/dev/null || true
docker start couchdb0 2>/dev/null || true
docker start couchdb1 2>/dev/null || true
docker start ca.org1.blockchain.local 2>/dev/null || true
docker start ca.org2.blockchain.local 2>/dev/null || true
docker start ca.orderer.blockchain.local 2>/dev/null || true
docker start cli 2>/dev/null || true

echo ""
echo "[5/12] Waiting for ports..."

wait_for_port() {
  local host="$1"
  local port="$2"
  local name="$3"
  local retries=45

  echo "Waiting for ${name} on ${host}:${port}..."

  for i in $(seq 1 "${retries}"); do
    if nc -z "${host}" "${port}" >/dev/null 2>&1; then
      echo "${name} port is open."
      return 0
    fi

    echo "Attempt ${i}/${retries}: ${name} not ready yet..."
    sleep 2
  done

  echo "ERROR: ${name} is not reachable on ${host}:${port}"
  return 1
}

wait_for_port "127.0.0.1" "${ORDERER_PORT}" "Orderer"
wait_for_port "127.0.0.1" "${ORG1_PEER_PORT}" "Org1 Peer"
wait_for_port "127.0.0.1" "${ORG2_PEER_PORT}" "Org2 Peer"
wait_for_port "127.0.0.1" "${COUCHDB_PORT}" "CouchDB"

echo ""
echo "[6/12] Waiting extra time for Fabric TLS/gRPC readiness..."
sleep 20

echo ""
echo "[7/12] Checking containers..."

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "peer|orderer|couch|ca\.|cli" || true

echo ""
echo ""
echo "[7.1/12] Verifying Org1 peer is still running..."

if ! docker ps --format "{{.Names}}" | grep -q "^peer0.org1.blockchain.local$"; then
  echo "ERROR: peer0.org1.blockchain.local is not running."
  echo "Last peer logs:"
  docker logs peer0.org1.blockchain.local --tail 120 || true
  exit 1
fi

if ! nc -z 127.0.0.1 7051 >/dev/null 2>&1; then
  echo "ERROR: Org1 peer port 7051 is not open."
  echo "Last peer logs:"
  docker logs peer0.org1.blockchain.local --tail 120 || true
  exit 1
fi

echo "Org1 peer is running and port 7051 is open."
echo "[8/12] Setting Fabric CLI environment..."

export PATH="$PATH:${PROJECT_ROOT}/fabric/fabric-samples/bin"
export FABRIC_CFG_PATH="${PROJECT_ROOT}/fabric/fabric-samples/config"

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_ADDRESS="${ORG1_PEER_HOST}:${ORG1_PEER_PORT}"
export CORE_PEER_MSPCONFIGPATH="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp"
export CORE_PEER_TLS_ROOTCERT_FILE="${FABRIC_NETWORK}/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt"

ORDERER_CA="${FABRIC_NETWORK}/organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.blockchain.local-cert.pem"

echo ""
echo "[9/12] Checking committed chaincode using Fabric hostname..."

peer lifecycle chaincode querycommitted \
  --channelID "${CHANNEL_NAME}" \
  --name "${CHAINCODE_NAME}" \
  --peerAddresses "localhost:${ORG1_PEER_PORT}" \
  --tlsRootCertFiles "${CORE_PEER_TLS_ROOTCERT_FILE}" || true

echo ""
echo "[10/12] Testing CouchDB..."

curl -s "http://admin:adminpw@127.0.0.1:${COUCHDB_PORT}/_up" || true
echo ""

echo ""
echo ""
echo "[FIX] Ensuring CouchDB containers have correct Docker network aliases..."

FABRIC_DOCKER_NETWORK="blockchain_net"

docker network inspect "${FABRIC_DOCKER_NETWORK}" >/dev/null 2>&1 || {
  echo "ERROR: Docker network ${FABRIC_DOCKER_NETWORK} does not exist."
  docker network ls
  exit 1
}

docker start couchdb0.org1 2>/dev/null || true
docker start couchdb0.org2 2>/dev/null || true

docker network disconnect "${FABRIC_DOCKER_NETWORK}" couchdb0.org1 2>/dev/null || true
docker network disconnect "${FABRIC_DOCKER_NETWORK}" couchdb0.org2 2>/dev/null || true

docker network connect --alias couchdb0.org1 "${FABRIC_DOCKER_NETWORK}" couchdb0.org1
docker network connect --alias couchdb0.org2 "${FABRIC_DOCKER_NETWORK}" couchdb0.org2

echo "CouchDB Docker aliases fixed:"
docker inspect couchdb0.org1 --format '{{json .NetworkSettings.Networks}}'
docker inspect couchdb0.org2 --format '{{json .NetworkSettings.Networks}}'
echo "[11/12] Restarting backend API and Angular UI..."

echo "Stopping old backend/UI processes..."
pkill -f "nodemon src/server.js" 2>/dev/null || true
pkill -f "node src/server.js" 2>/dev/null || true
pkill -f "ng serve" 2>/dev/null || true

sleep 3

echo "Starting Blockchain API..."
cd "${BLOCKCHAIN_API}"
nohup npm run dev > "${PROJECT_ROOT}/blockchain-api-runtime.log" 2>&1 &

sleep 8

echo "Testing API health..."
curl -s "http://127.0.0.1:${API_PORT}/api/v1/health" || true
echo ""

echo ""
echo "Starting Angular UI..."
cd "${ANGULAR_UI}"
nohup ng serve --host 0.0.0.0 --port "${UI_PORT}" > "${PROJECT_ROOT}/blockchain-ui-runtime.log" 2>&1 &

echo ""
echo "[12/12] Waiting for Angular UI port..."
wait_for_port "127.0.0.1" "${UI_PORT}" "Angular UI" || true

echo ""
echo "=================================================="
echo " Startup Completed"
echo "=================================================="
echo "Backend API: http://127.0.0.1:${API_PORT}/api/v1/health"
echo "Angular UI:  http://172.31.13.90:${UI_PORT}"
echo "API Log:     ${PROJECT_ROOT}/blockchain-api-runtime.log"
echo "UI Log:      ${PROJECT_ROOT}/blockchain-ui-runtime.log"
echo "=================================================="
