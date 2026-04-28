#!/bin/bash

source /home/nix/u01/blockchain-integration/config/fabric-env.sh

echo "Checking Docker..."
docker --version
docker compose version

echo ""
echo "Checking Fabric binaries..."
peer version
orderer version
configtxgen --version
cryptogen version
fabric-ca-client version

echo ""
echo "Checking Fabric containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Checking Hyperledger images..."
docker images | grep hyperledger || true

echo ""
echo "Fabric verification completed."