#!/bin/bash
set -e

FABRIC_DIR="/home/nix/u01/blockchain-integration/fabric-network"

echo "Starting Fabric network..."
cd "$FABRIC_DIR"

docker compose \
  -f docker-compose-couchdb.yaml \
  -f docker-compose-fabric.yaml \
  -f docker-compose-cli.yaml \
  up -d

echo "Waiting for peer0.org1 on port 7051..."

for i in {1..40}; do
  if nc -z 127.0.0.1 7051; then
    echo "peer0.org1 is ready on 7051"
    exit 0
  fi

  echo "Waiting for peer0.org1... attempt $i"
  sleep 3
done

echo "ERROR: peer0.org1 did not become ready on port 7051"
docker ps -a | grep -E "peer0.org1|peer0.org2|orderer|ca.org"
exit 1