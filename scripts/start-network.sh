#!/bin/bash
set -e

source /home/nix/u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Starting Hyperledger Fabric network..."
./network.sh up createChannel -ca -c $CHANNEL_NAME -s couchdb

echo "Network started successfully."
docker ps