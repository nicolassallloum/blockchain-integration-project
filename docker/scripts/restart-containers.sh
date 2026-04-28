#!/bin/bash

set -e

echo "Restarting Blockchain Integration Docker containers..."

cd ~/u01/blockchain-integration

echo "Starting Docker service..."
sudo systemctl start docker

echo "Starting Hyperledger Fabric test network if available..."

if [ -d "$HOME/u01/blockchain-integration/fabric/fabric-samples/test-network" ]; then
  cd "$HOME/u01/blockchain-integration/fabric/fabric-samples/test-network"
  docker ps
else
  echo "Fabric test-network folder not found."
fi

echo "Restart completed."
