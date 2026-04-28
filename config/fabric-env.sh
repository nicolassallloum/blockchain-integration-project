#!/bin/bash

export PROJECT_HOME=/home/nix/u01/blockchain-integration
export FABRIC_HOME=$PROJECT_HOME/fabric/fabric-samples
export TEST_NETWORK_HOME=$FABRIC_HOME/test-network
export FABRIC_CFG_PATH=$FABRIC_HOME/config
export PATH=$PATH:$FABRIC_HOME/bin

#--Change this on every Run to avoid conflicts with existing channels
export CHANNEL_NAME=kycchannelnix 
export CHAINCODE_NAME=kyc
export CHAINCODE_LANG=go
export CHAINCODE_VERSION=1.0

echo "Fabric environment loaded."
echo "PROJECT_HOME=$PROJECT_HOME"
echo "FABRIC_HOME=$FABRIC_HOME"
echo "TEST_NETWORK_HOME=$TEST_NETWORK_HOME"
echo "CHANNEL_NAME=$CHANNEL_NAME"
