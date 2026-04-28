#!/bin/bash

echo "Checking Docker containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Checking Docker network..."
docker network ls | grep blockchain_net || echo "blockchain_net not found"

echo ""
echo "Checking CouchDB Org1..."
curl -s http://admin:adminpw@localhost:5984/_all_dbs || true

echo ""
echo "Checking CouchDB Org2..."
curl -s http://admin:adminpw@localhost:7984/_all_dbs || true

echo ""
echo "Checking orderer logs..."
docker logs orderer.blockchain.local --tail=20

echo ""
echo "Checking Org1 peer logs..."
docker logs peer0.org1.blockchain.local --tail=20

echo ""
echo "Checking Org2 peer logs..."
docker logs peer0.org2.blockchain.local --tail=20