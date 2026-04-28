#!/bin/bash
set -e

PROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"
COMPOSE_FILE="${PROJECT_PATH}/docker/docker-compose-fabric.yaml"

echo "=========================================="
echo "Starting Fabric CA services"
echo "Project Path: $PROJECT_PATH"
echo "Compose File: $COMPOSE_FILE"
echo "=========================================="

cd "$PROJECT_PATH"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ERROR: docker-compose-fabric.yaml not found at:"
  echo "$COMPOSE_FILE"
  echo
  echo "Available files:"
  ls -la "$PROJECT_PATH"
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d \
  ca.org1.blockchain.local \
  ca.org2.blockchain.local \
  ca.orderer.blockchain.local

echo
echo "Waiting for Fabric CA containers..."
sleep 8

echo
echo "Running CA containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "ca." || true

echo
echo "Testing CA endpoints..."

curl -k https://localhost:7054/cainfo || true
echo
curl -k https://localhost:8054/cainfo || true
echo
curl -k https://localhost:9054/cainfo || true
echo

echo "=========================================="
echo "Fabric CA services started successfully"
echo "=========================================="