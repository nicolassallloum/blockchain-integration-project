🔹 STEP 4 — Hyperledger Fabric Environment Setup

Role: Hyperledger Fabric Engineer
Target OS: Ubuntu 22.04 / Ubuntu 24.04
Recommended Fabric Version: Fabric 2.5 LTS for stable enterprise setup. The official Fabric install script can clone fabric-samples, download Fabric binaries/config files into bin and config, and pull Fabric Docker images.

1. Update Ubuntu Server
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git unzip jq tree ca-certificates gnupg lsb-release software-properties-common

Verify:

lsb_release -a
git --version
curl --version
jq --version
2. Install Required OS Packages
sudo apt install -y \
  build-essential \
  make \
  gcc \
  g++ \
  python3 \
  python3-pip \
  python3-venv \
  net-tools \
  iputils-ping \
  openssl \
  pkg-config

Verify:

python3 --version
gcc --version
make --version
openssl version
3. Install Docker Engine

Hyperledger Fabric test networks are Docker-based, so Docker is required. Official Fabric docs list Docker as a prerequisite for running the local Fabric test network.

sudo apt remove -y docker docker-engine docker.io containerd runc || true
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
"deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu \
$(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

Start Docker:

sudo systemctl enable docker
sudo systemctl start docker

Allow your user to run Docker without sudo:

sudo usermod -aG docker $USER
newgrp docker

Verify:

docker --version
docker compose version
docker run hello-world
4. Install Go

Go is required for Fabric chaincode development, especially if you will write chaincode in Go.

cd /tmp
wget https://go.dev/dl/go1.22.12.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.12.linux-amd64.tar.gz

Add Go environment variables:

cat <<'EOF' >> ~/.bashrc

# Go Environment
export GOROOT=/usr/local/go
export GOPATH=$HOME/go
export PATH=$PATH:$GOROOT/bin:$GOPATH/bin
EOF

Reload:

source ~/.bashrc

Verify:

go version
echo $GOROOT
echo $GOPATH
5. Install Node.js and NPM

Node.js is needed if you will use Fabric SDKs or write chaincode in JavaScript/TypeScript. Fabric supports smart contracts/chaincode in Go, Java, and Node.js.

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

Verify:

node -v
npm -v

Optional useful packages:

sudo npm install -g yarn
yarn -v
6. Create Working Directory Structure

Use a clean enterprise project location:

sudo mkdir -p /u01/blockchain-integration
sudo chown -R $USER:$USER /u01/blockchain-integration
cd /u01/blockchain-integration

Create folders:

mkdir -p \
  fabric \
  chaincode \
  api \
  scripts \
  logs \
  config \
  docs

Expected structure:

tree -L 2 /u01/blockchain-integration

Expected result:

/u01/blockchain-integration
├── api
├── chaincode
├── config
├── docs
├── fabric
├── logs
└── scripts
7. Download Fabric Samples, Binaries, and Docker Images

The official Fabric installation flow uses install-fabric.sh, which automates cloning fabric-samples, downloading Fabric binaries, and pulling Docker images.

cd /u01/blockchain-integration/fabric

Download Fabric samples, binaries, and Docker images:

curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh

Install Fabric:

./install-fabric.sh docker samples binary

After this, you should have:

ls -la
ls -la fabric-samples
ls -la fabric-samples/bin
ls -la fabric-samples/config
8. Add Fabric Binaries to PATH
cat <<'EOF' >> ~/.bashrc

# Hyperledger Fabric Environment
export FABRIC_HOME=/u01/blockchain-integration/fabric/fabric-samples
export FABRIC_CFG_PATH=$FABRIC_HOME/config
export PATH=$PATH:$FABRIC_HOME/bin
EOF

Reload:

source ~/.bashrc

Verify:

echo $FABRIC_HOME
echo $FABRIC_CFG_PATH
which peer
which orderer
which configtxgen
which cryptogen
which fabric-ca-client

Check versions:

peer version
orderer version
configtxgen --version
cryptogen version
fabric-ca-client version
9. Verify Fabric Docker Images
docker images | grep hyperledger

You should see images similar to:

hyperledger/fabric-peer
hyperledger/fabric-orderer
hyperledger/fabric-ccenv
hyperledger/fabric-tools
hyperledger/fabric-ca
hyperledger/fabric-baseos

If you want to pull specific images manually:

docker pull hyperledger/fabric-peer:2.5
docker pull hyperledger/fabric-orderer:2.5
docker pull hyperledger/fabric-tools:2.5
docker pull hyperledger/fabric-ccenv:2.5
docker pull hyperledger/fabric-baseos:2.5
docker pull hyperledger/fabric-ca:1.5

Verify again:

docker images | grep hyperledger
10. Run Fabric Test Network

Go to the test network:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network

Clean any old network:

./network.sh down

Start the test network:

./network.sh up

Create a channel:

./network.sh createChannel -c kycchannel

Or start network and create channel in one command:

./network.sh up createChannel -c kycchannel

For CouchDB state database:

./network.sh down
./network.sh up createChannel -c kycchannel -s couchdb

For Certificate Authorities:

./network.sh down
./network.sh up createChannel -ca -c kycchannel -s couchdb

Verify containers:

docker ps

Expected containers include:

peer0.org1.example.com
peer0.org2.example.com
orderer.example.com
ca_org1
ca_org2
ca_orderer
couchdb0
couchdb1
11. Test Chaincode Deployment

Use Fabric sample asset-transfer chaincode:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network

Deploy Go chaincode:

./network.sh deployCC \
  -ccn basic \
  -ccp ../asset-transfer-basic/chaincode-go \
  -ccl go \
  -c kycchannel

Verify:

docker ps

Query chaincode:

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=$PWD/../config/

Set Org1 environment:

export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_LOCALMSPID="Org1MSP"
export CORE_PEER_TLS_ROOTCERT_FILE=${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=${PWD}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp
export CORE_PEER_ADDRESS=localhost:7051

Query ledger:

peer chaincode query \
  -C kycchannel \
  -n basic \
  -c '{"Args":["GetAllAssets"]}'

Invoke transaction:

peer chaincode invoke \
  -o localhost:7050 \
  --ordererTLSHostnameOverride orderer.example.com \
  --tls \
  --cafile "${PWD}/organizations/ordererOrganizations/example.com/orderers/orderer.example.com/msp/tlscacerts/tlsca.example.com-cert.pem" \
  -C kycchannel \
  -n basic \
  --peerAddresses localhost:7051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt" \
  --peerAddresses localhost:9051 \
  --tlsRootCertFiles "${PWD}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt" \
  -c '{"function":"CreateAsset","Args":["asset100","blue","10","Nix","500"]}'

Query again:

peer chaincode query \
  -C kycchannel \
  -n basic \
  -c '{"Args":["ReadAsset","asset100"]}'
12. Recommended Project Directory After Setup

Final recommended structure:

/u01/blockchain-integration
├── api
│   └── blockchain-api
├── chaincode
│   └── kyc-chaincode
├── config
│   ├── connection-org1.json
│   ├── connection-org2.json
│   └── fabric-env.sh
├── docs
│   ├── api-contract.md
│   ├── architecture.md
│   └── setup-guide.md
├── fabric
│   ├── fabric-samples
│   └── install-fabric.sh
├── logs
└── scripts
    ├── start-network.sh
    ├── stop-network.sh
    ├── restart-network.sh
    ├── deploy-chaincode.sh
    └── verify-network.sh

Create script files:

cd /u01/blockchain-integration/scripts
touch start-network.sh stop-network.sh restart-network.sh deploy-chaincode.sh verify-network.sh
chmod +x *.sh
13. Create Reusable Environment File
cat > /u01/blockchain-integration/config/fabric-env.sh <<'EOF'
#!/bin/bash

export PROJECT_HOME=/u01/blockchain-integration
export FABRIC_HOME=$PROJECT_HOME/fabric/fabric-samples
export TEST_NETWORK_HOME=$FABRIC_HOME/test-network
export FABRIC_CFG_PATH=$FABRIC_HOME/config
export PATH=$PATH:$FABRIC_HOME/bin

export CHANNEL_NAME=kycchannel
export CHAINCODE_NAME=kyc
export CHAINCODE_LANG=go
export CHAINCODE_VERSION=1.0

echo "Fabric environment loaded."
echo "PROJECT_HOME=$PROJECT_HOME"
echo "FABRIC_HOME=$FABRIC_HOME"
echo "TEST_NETWORK_HOME=$TEST_NETWORK_HOME"
echo "CHANNEL_NAME=$CHANNEL_NAME"
EOF

Load it:

source /u01/blockchain-integration/config/fabric-env.sh
14. Create Start Network Script
cat > /u01/blockchain-integration/scripts/start-network.sh <<'EOF'
#!/bin/bash
set -e

source /u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Starting Hyperledger Fabric network..."
./network.sh up createChannel -ca -c $CHANNEL_NAME -s couchdb

echo "Network started successfully."
docker ps
EOF

Run:

chmod +x /u01/blockchain-integration/scripts/start-network.sh
/u01/blockchain-integration/scripts/start-network.sh
15. Create Stop Network Script
cat > /u01/blockchain-integration/scripts/stop-network.sh <<'EOF'
#!/bin/bash
set -e

source /u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Stopping Hyperledger Fabric network..."
./network.sh down

echo "Network stopped."
EOF

Run:

chmod +x /u01/blockchain-integration/scripts/stop-network.sh
/u01/blockchain-integration/scripts/stop-network.sh
16. Create Restart Network Script
cat > /u01/blockchain-integration/scripts/restart-network.sh <<'EOF'
#!/bin/bash
set -e

source /u01/blockchain-integration/config/fabric-env.sh

cd $TEST_NETWORK_HOME

echo "Restarting Hyperledger Fabric network..."
./network.sh down
./network.sh up createChannel -ca -c $CHANNEL_NAME -s couchdb

echo "Network restarted successfully."
docker ps
EOF

Run:

chmod +x /u01/blockchain-integration/scripts/restart-network.sh
/u01/blockchain-integration/scripts/restart-network.sh
17. Create Verification Script
cat > /u01/blockchain-integration/scripts/verify-network.sh <<'EOF'
#!/bin/bash

source /u01/blockchain-integration/config/fabric-env.sh

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
EOF

Run:

chmod +x /u01/blockchain-integration/scripts/verify-network.sh
/u01/blockchain-integration/scripts/verify-network.sh
18. Common Troubleshooting Errors
Error 1: Docker permission denied

Error:

permission denied while trying to connect to the Docker daemon socket

Fix:

sudo usermod -aG docker $USER
newgrp docker

Then test:

docker ps
Error 2: Docker service not running

Error:

Cannot connect to the Docker daemon

Fix:

sudo systemctl start docker
sudo systemctl enable docker
sudo systemctl status docker
Error 3: peer: command not found

Fix:

source ~/.bashrc
echo $PATH
ls /u01/blockchain-integration/fabric/fabric-samples/bin

Temporary fix:

export PATH=$PATH:/u01/blockchain-integration/fabric/fabric-samples/bin

Permanent fix:

echo 'export PATH=$PATH:/u01/blockchain-integration/fabric/fabric-samples/bin' >> ~/.bashrc
source ~/.bashrc
Error 4: FABRIC_CFG_PATH not set

Fix:

export FABRIC_CFG_PATH=/u01/blockchain-integration/fabric/fabric-samples/config

Permanent:

echo 'export FABRIC_CFG_PATH=/u01/blockchain-integration/fabric/fabric-samples/config' >> ~/.bashrc
source ~/.bashrc

Verify:

echo $FABRIC_CFG_PATH
ls $FABRIC_CFG_PATH
Error 5: Network already running / duplicate containers

Fix:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network
./network.sh down
docker ps -a

Optional cleanup:

docker rm -f $(docker ps -aq) 2>/dev/null || true
docker network prune -f
docker volume prune -f

Then restart:

./network.sh up createChannel -ca -c kycchannel -s couchdb
Error 6: Channel creation failed

Clean and recreate:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network
./network.sh down
./network.sh up createChannel -ca -c kycchannel -s couchdb

Check logs:

docker logs orderer.example.com
docker logs peer0.org1.example.com
docker logs peer0.org2.example.com
Error 7: CouchDB container not starting

Check CouchDB containers:

docker ps -a | grep couch

Check logs:

docker logs couchdb0
docker logs couchdb1

Restart clean:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network
./network.sh down
docker volume prune -f
./network.sh up createChannel -ca -c kycchannel -s couchdb
Error 8: Chaincode deploy fails because Go modules are missing

Go to your chaincode folder:

cd /u01/blockchain-integration/chaincode/kyc-chaincode

Initialize Go module:

go mod init kyc-chaincode
go mod tidy

Then redeploy chaincode.

Error 9: Port already in use

Check used ports:

sudo netstat -tulpn | grep LISTEN

Common Fabric ports:

7050  orderer
7051  peer0.org1
9051  peer0.org2
7054  ca_org1
8054  ca_org2
9054  ca_orderer
5984  couchdb0
7984  couchdb1

Stop old containers:

docker ps
docker stop <container_name>

Or clean test network:

cd /u01/blockchain-integration/fabric/fabric-samples/test-network
./network.sh down
19. Final Full Setup Verification Checklist

Run:

docker --version
docker compose version
go version
node -v
npm -v
peer version
orderer version
configtxgen --version
cryptogen version
fabric-ca-client version
docker images | grep hyperledger
docker ps

Expected result:

Docker installed
Docker Compose installed
Go installed
Node.js installed
Fabric binaries installed
Fabric Docker images available
Test network running
Channel kycchannel created
CouchDB running
CA containers running
Peer and orderer containers running
20. Final Developer Handoff Notes

For your Blockchain Integration Project, this setup prepares the local Fabric layer for:

Angular → Spring Boot → Blockchain API → Hyperledger Fabric → CouchDB / PostgreSQL

At the end of Step 4, the environment must have:

1. Ubuntu packages installed
2. Docker and Docker Compose working
3. Go installed
4. Node.js installed
5. Fabric samples downloaded
6. Fabric binaries installed
7. Fabric Docker images pulled
8. Fabric test network running
9. Channel created: kycchannel
10. CouchDB enabled
11. CA enabled
12. Chaincode deployment tested
13. Reusable scripts created
14. Environment variables configured