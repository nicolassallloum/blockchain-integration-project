#!/bin/bash

set -e

PROJECT_DIR="/home/nix/u01/blockchain-integration/fabric-network"

cd "$PROJECT_DIR"

echo "=========================================="
echo "Verifying CouchDB Setup for Fabric"
echo "Project Path: $PROJECT_DIR"
echo "=========================================="

echo ""
echo "1. Checking running containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "2. Testing Org1 CouchDB on localhost:5984..."
curl -s -u admin:adminpw http://localhost:5984 | jq .

echo ""
echo "3. Testing Org2 CouchDB on localhost:7984..."
curl -s -u admin:adminpw http://localhost:7984 | jq .

echo ""
echo "4. Listing Org1 CouchDB databases..."
curl -s -u admin:adminpw http://localhost:5984/_all_dbs | jq .

echo ""
echo "5. Listing Org2 CouchDB databases..."
curl -s -u admin:adminpw http://localhost:7984/_all_dbs | jq .

echo ""
echo "6. Checking Org1 peer CouchDB environment..."
docker exec peer0.org1.blockchain.local printenv | grep COUCHDB

echo ""
echo "7. Checking Org2 peer CouchDB environment..."
docker exec peer0.org2.blockchain.local printenv | grep COUCHDB

echo ""
echo "8. Testing peer0.org1 can resolve couchdb0.org1..."
docker exec peer0.org1.blockchain.local sh -c 'getent hosts couchdb0.org1'

echo ""
echo "9. Testing peer0.org2 can resolve couchdb0.org2..."
docker exec peer0.org2.blockchain.local sh -c 'getent hosts couchdb0.org2'

echo ""
echo "=========================================="
echo "CouchDB verification completed successfully."
echo "=========================================="