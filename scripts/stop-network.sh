#!/bin/bash
set -e

source /home/nix/u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Stopping Hyperledger Fabric network..."
./network.sh down

echo "Network stopped."