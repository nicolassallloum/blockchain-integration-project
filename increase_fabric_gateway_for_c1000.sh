#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_ROOT="$HOME/u01/blockchain-integration"
NETWORK_DIR="$PROJECT_ROOT/fabric-network"

BASE_COMPOSE="$NETWORK_DIR/docker-compose-fabric.yaml"
OVERRIDE_FILE="$NETWORK_DIR/docker-compose-gateway-c1000.override.yaml"

ORG1_CONTAINER="peer0.org1.blockchain.local"
ORG2_CONTAINER="peer0.org2.blockchain.local"

GATEWAY_LIMIT="1200"

cd "$NETWORK_DIR"

echo "============================================================"
echo "FABRIC GATEWAY CAPACITY INCREASE"
echo "============================================================"
echo "Target benchmark concurrency : 1000"
echo "Configured Gateway capacity  : $GATEWAY_LIMIT"
echo "Base Compose                  : $BASE_COMPOSE"
echo "Override                      : $OVERRIDE_FILE"
echo "============================================================"

if [[ ! -f "$BASE_COMPOSE" ]]; then
  echo "[FAIL] Compose file was not found: $BASE_COMPOSE"
  exit 1
fi

ORG1_SERVICE="$(
  docker inspect "$ORG1_CONTAINER" \
    --format '{{ index .Config.Labels "com.docker.compose.service" }}'
)"

ORG2_SERVICE="$(
  docker inspect "$ORG2_CONTAINER" \
    --format '{{ index .Config.Labels "com.docker.compose.service" }}'
)"

AVAILABLE_SERVICES="$(
  docker compose \
    -f "$BASE_COMPOSE" \
    config --services
)"

if ! grep -Fxq "$ORG1_SERVICE" <<<"$AVAILABLE_SERVICES"; then
  echo "[FAIL] Org1 Compose service was not found: $ORG1_SERVICE"
  echo "$AVAILABLE_SERVICES"
  exit 1
fi

if ! grep -Fxq "$ORG2_SERVICE" <<<"$AVAILABLE_SERVICES"; then
  echo "[FAIL] Org2 Compose service was not found: $ORG2_SERVICE"
  echo "$AVAILABLE_SERVICES"
  exit 1
fi

echo "Org1 service: $ORG1_SERVICE"
echo "Org2 service: $ORG2_SERVICE"

if [[ -f "$OVERRIDE_FILE" ]]; then
  cp "$OVERRIDE_FILE" \
    "${OVERRIDE_FILE}.backup_$(date +%Y%m%d_%H%M%S)"
fi

cat > "$OVERRIDE_FILE" <<YAML
services:
  "$ORG1_SERVICE":
    environment:
      CORE_PEER_LIMITS_CONCURRENCY_GATEWAYSERVICE: "$GATEWAY_LIMIT"

  "$ORG2_SERVICE":
    environment:
      CORE_PEER_LIMITS_CONCURRENCY_GATEWAYSERVICE: "$GATEWAY_LIMIT"
YAML

echo
echo "Validating merged Compose configuration..."

docker compose \
  -f "$BASE_COMPOSE" \
  -f "$OVERRIDE_FILE" \
  config \
  > /tmp/fabric_gateway_c1000_compose_validated.yaml

grep -n \
  "CORE_PEER_LIMITS_CONCURRENCY_GATEWAYSERVICE" \
  /tmp/fabric_gateway_c1000_compose_validated.yaml

echo
echo "Stopping the API during peer recreation..."

sudo systemctl stop blockchain-api.service || true

echo
echo "Recreating only the Fabric peers..."

docker compose \
  -f "$BASE_COMPOSE" \
  -f "$OVERRIDE_FILE" \
  up -d \
  --no-deps \
  --force-recreate \
  "$ORG1_SERVICE" \
  "$ORG2_SERVICE"

echo
echo "Waiting for both peers..."

for ATTEMPT in $(seq 1 60)
do
  ORG1_RUNNING="$(
    docker inspect \
      --format '{{.State.Running}}' \
      "$ORG1_CONTAINER" \
      2>/dev/null || echo false
  )"

  ORG2_RUNNING="$(
    docker inspect \
      --format '{{.State.Running}}' \
      "$ORG2_CONTAINER" \
      2>/dev/null || echo false
  )"

  if [[ "$ORG1_RUNNING" == "true" &&
        "$ORG2_RUNNING" == "true" ]]
  then
    echo "[PASS] Both peers are running."
    break
  fi

  if [[ "$ATTEMPT" -eq 60 ]]; then
    echo "[FAIL] Fabric peers did not start."
    docker ps -a
    exit 1
  fi

  sleep 2
done

echo
echo "Starting Blockchain API..."

sudo systemctl start blockchain-api.service

for ATTEMPT in $(seq 1 60)
do
  if curl \
    --silent \
    --fail \
    http://127.0.0.1:3001/api/v1/health \
    >/dev/null
  then
    echo "[PASS] Blockchain API is ready."
    break
  fi

  if [[ "$ATTEMPT" -eq 60 ]]; then
    echo "[FAIL] Blockchain API did not become ready."
    sudo systemctl status blockchain-api.service \
      --no-pager \
      --full
    exit 1
  fi

  sleep 2
done

echo
echo "Launching/verifying the KYC chaincode..."

curl \
  --silent \
  --show-error \
  --max-time 180 \
  http://127.0.0.1:3001/api/v1/valoores-blockchain/customers/count |
jq .

echo
echo "============================================================"
echo "EFFECTIVE GATEWAY SETTINGS"
echo "============================================================"

for PEER in \
  "$ORG1_CONTAINER" \
  "$ORG2_CONTAINER"
do
  echo
  echo "$PEER"

  docker inspect "$PEER" \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
  grep '^CORE_PEER_LIMITS_CONCURRENCY_GATEWAYSERVICE='
done

echo
echo "[PASS] Gateway capacity is configured for concurrency 1000."
echo "No ledger or CouchDB volume was deleted."
