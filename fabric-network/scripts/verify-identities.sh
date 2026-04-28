#!/bin/bash
set -e

PROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"

echo "=========================================="
echo "Verifying Fabric CA Identity Setup"
echo "=========================================="

cd "$PROJECT_PATH"

echo
echo "1. Checking CA containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "ca." || true

echo
echo "2. Checking CA endpoints..."
curl -k https://localhost:7054/cainfo || true
echo
curl -k https://localhost:8054/cainfo || true
echo
curl -k https://localhost:9054/cainfo || true
echo

echo
echo "3. Checking Org1 MSP..."
test -d organizations/peerOrganizations/org1.blockchain.local/msp && echo "Org1 MSP exists"
test -d organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp && echo "Org1 Admin MSP exists"
test -d organizations/peerOrganizations/org1.blockchain.local/users/appUserOrg1@org1.blockchain.local/msp && echo "Org1 App User MSP exists"
test -d organizations/peerOrganizations/org1.blockchain.local/users/blockchain-api-org1-service@org1.blockchain.local/msp && echo "Org1 Service MSP exists"
test -d organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls && echo "Org1 Peer TLS exists"

echo
echo "4. Checking Org2 MSP..."
test -d organizations/peerOrganizations/org2.blockchain.local/msp && echo "Org2 MSP exists"
test -d organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp && echo "Org2 Admin MSP exists"
test -d organizations/peerOrganizations/org2.blockchain.local/users/appUserOrg2@org2.blockchain.local/msp && echo "Org2 App User MSP exists"
test -d organizations/peerOrganizations/org2.blockchain.local/users/blockchain-api-org2-service@org2.blockchain.local/msp && echo "Org2 Service MSP exists"
test -d organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls && echo "Org2 Peer TLS exists"

echo
echo "5. Checking Orderer MSP..."
test -d organizations/ordererOrganizations/blockchain.local/msp && echo "Orderer Org MSP exists"
test -d organizations/ordererOrganizations/blockchain.local/users/Admin@blockchain.local/msp && echo "Orderer Admin MSP exists"
test -d organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls && echo "Orderer TLS exists"

echo
echo "6. Checking private keys..."
find organizations -path "*keystore*" -type f

echo
echo "=========================================="
echo "Identity verification completed"
echo "=========================================="
