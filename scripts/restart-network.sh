#!/bin/bash
set -e

source /home/nix/u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Restarting Hyperledger Fabric network..."
./network.sh down
./network.sh up createChannel -ca -c $CHANNEL_NAME -s couchdb

echo "Network restarted successfully."
docker ps