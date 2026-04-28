🔹 STEP 6 — Fabric Network Configuration
Enterprise Setup with Custom Docker Names

Project path:

~/u01/blockchain-integration/fabric-network

Target container names:

orderer.blockchain.local
peer0.org1.blockchain.local
peer0.org2.blockchain.local
couchdb0.org1
couchdb0.org2

Channel:

kycchannelnix1

Organizations:

OrdererMSP
Org1MSP
Org2MSP
1. Current Problem Summary

During setup, these issues appeared:

1. Peer TLS handshake failed
2. CouchDB hostname was not resolved
3. CouchDB username/password mismatch caused peer crash
4. Peer could not connect to orderer because of TLS certificate mismatch

The important errors were:

lookup couchdb0.org1 on 127.0.0.11:53: no such host

Then later:

Status Code:401, Reason:Name or password is incorrect

Then later:

tls: failed to verify certificate: x509: certificate signed by unknown authority

These confirm that the final correct solution is:

1. Use custom Docker Compose names
2. Add Docker network aliases
3. Clean old Docker volumes
4. Regenerate crypto material
5. Regenerate channel block
6. Restart the network cleanly
7. Join orderer and peers again

Your latest verification showed that all custom containers were running and CouchDB databases existed, but the peers still had TLS trust errors with the orderer.

2. Stop Old Fabric Test Network

Go to the old Fabric test-network folder:

cd ~/u01/blockchain-integration/fabric/fabric-samples/test-network

Stop it:

./network.sh down

Remove old containers manually if they still exist:

docker rm -f orderer.example.com peer0.org1.example.com peer0.org2.example.com couchdb0 couchdb1 ca_org1 ca_org2 ca_orderer 2>/dev/null || true
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

Verify:

docker ps -a

You should not see:

orderer.example.com
peer0.org1.example.com
peer0.org2.example.com
couchdb0
couchdb1
3. Prepare Custom Fabric Network Folder
cd ~/u01/blockchain-integration
mkdir -p fabric-network
cd fabric-network

Create folders:

mkdir -p \
  organizations/cryptogen \
  channel-artifacts \
  config \
  docker \
  scripts \
  logs \
  backups

Expected structure:

fabric-network/
├── organizations/
│   └── cryptogen/
├── channel-artifacts/
├── config/
├── docker/
├── scripts/
├── logs/
└── backups/
4. Create crypto-config.yaml

Create file:

nano organizations/cryptogen/crypto-config.yaml

Paste:

OrdererOrgs:
  - Name: Orderer
    Domain: blockchain.local
    EnableNodeOUs: true
    Specs:
      - Hostname: orderer
        SANS:
          - localhost
          - orderer.blockchain.local

PeerOrgs:
  - Name: Org1
    Domain: org1.blockchain.local
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - peer0.org1.blockchain.local
    Users:
      Count: 1

  - Name: Org2
    Domain: org2.blockchain.local
    EnableNodeOUs: true
    Template:
      Count: 1
      SANS:
        - localhost
        - peer0.org2.blockchain.local
    Users:
      Count: 1
5. Generate Crypto Material

Set Fabric binaries path:

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin

Remove old crypto:

rm -rf organizations/peerOrganizations organizations/ordererOrganizations

Generate crypto:

cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations

Verify:

tree organizations -L 4

Expected:

organizations/
├── ordererOrganizations/
│   └── blockchain.local/
└── peerOrganizations/
    ├── org1.blockchain.local/
    └── org2.blockchain.local/
6. Create configtx.yaml

Create file:

nano config/configtx.yaml

Paste:

Organizations:

  - &OrdererOrg
    Name: OrdererOrg
    ID: OrdererMSP
    MSPDir: ../organizations/ordererOrganizations/blockchain.local/msp

    Policies:
      Readers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Writers:
        Type: Signature
        Rule: "OR('OrdererMSP.member')"
      Admins:
        Type: Signature
        Rule: "OR('OrdererMSP.admin')"

    OrdererEndpoints:
      - orderer.blockchain.local:7050

  - &Org1
    Name: Org1MSP
    ID: Org1MSP
    MSPDir: ../organizations/peerOrganizations/org1.blockchain.local/msp

    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.peer', 'Org1MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org1MSP.admin', 'Org1MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org1MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org1MSP.peer')"

    AnchorPeers:
      - Host: peer0.org1.blockchain.local
        Port: 7051

  - &Org2
    Name: Org2MSP
    ID: Org2MSP
    MSPDir: ../organizations/peerOrganizations/org2.blockchain.local/msp

    Policies:
      Readers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.peer', 'Org2MSP.client')"
      Writers:
        Type: Signature
        Rule: "OR('Org2MSP.admin', 'Org2MSP.client')"
      Admins:
        Type: Signature
        Rule: "OR('Org2MSP.admin')"
      Endorsement:
        Type: Signature
        Rule: "OR('Org2MSP.peer')"

    AnchorPeers:
      - Host: peer0.org2.blockchain.local
        Port: 9051

Capabilities:

  Channel: &ChannelCapabilities
    V2_0: true

  Orderer: &OrdererCapabilities
    V2_0: true

  Application: &ApplicationCapabilities
    V2_0: true

Application: &ApplicationDefaults

  Organizations:

  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    LifecycleEndorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"
    Endorsement:
      Type: ImplicitMeta
      Rule: "MAJORITY Endorsement"

  Capabilities:
    <<: *ApplicationCapabilities

Orderer: &OrdererDefaults

  OrdererType: etcdraft

  Addresses:
    - orderer.blockchain.local:7050

  EtcdRaft:
    Consenters:
      - Host: orderer.blockchain.local
        Port: 7050
        ClientTLSCert: ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt
        ServerTLSCert: ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt

  BatchTimeout: 2s

  BatchSize:
    MaxMessageCount: 10
    AbsoluteMaxBytes: 99 MB
    PreferredMaxBytes: 512 KB

  Organizations:

  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"
    BlockValidation:
      Type: ImplicitMeta
      Rule: "ANY Writers"

  Capabilities:
    <<: *OrdererCapabilities

Channel: &ChannelDefaults

  Policies:
    Readers:
      Type: ImplicitMeta
      Rule: "ANY Readers"
    Writers:
      Type: ImplicitMeta
      Rule: "ANY Writers"
    Admins:
      Type: ImplicitMeta
      Rule: "MAJORITY Admins"

  Capabilities:
    <<: *ChannelCapabilities

Profiles:

  TwoOrgsApplicationGenesis:
    <<: *ChannelDefaults

    Orderer:
      <<: *OrdererDefaults
      Organizations:
        - *OrdererOrg

    Application:
      <<: *ApplicationDefaults
      Organizations:
        - *Org1
        - *Org2
      Capabilities:
        <<: *ApplicationCapabilities
7. Generate Channel Block

Remove old channel artifacts:

rm -rf channel-artifacts/*
mkdir -p channel-artifacts

Set config path:

export FABRIC_CFG_PATH=$PWD/config
export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin

Generate channel block:

configtxgen \
  -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/kycchannelnix1.block \
  -channelID kycchannelnix1

Verify:

ls -lah channel-artifacts/

Expected:

kycchannelnix1.block
8. Create Updated Docker Compose File

Create file:

nano docker/docker-compose-fabric.yaml

Paste:

version: "3.8"

networks:
  blockchain_net:
    name: blockchain_net

volumes:
  orderer.blockchain.local:
  peer0.org1.blockchain.local:
  peer0.org2.blockchain.local:
  couchdb0.org1:
  couchdb0.org2:

services:

  orderer.blockchain.local:
    container_name: orderer.blockchain.local
    image: hyperledger/fabric-orderer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - ORDERER_GENERAL_LISTENADDRESS=0.0.0.0
      - ORDERER_GENERAL_LISTENPORT=7050
      - ORDERER_GENERAL_LOCALMSPID=OrdererMSP
      - ORDERER_GENERAL_LOCALMSPDIR=/var/hyperledger/orderer/msp
      - ORDERER_GENERAL_BOOTSTRAPMETHOD=none
      - ORDERER_CHANNELPARTICIPATION_ENABLED=true
      - ORDERER_ADMIN_TLS_ENABLED=true
      - ORDERER_ADMIN_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_ADMIN_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_ADMIN_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_TLS_CLIENTROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
      - ORDERER_ADMIN_LISTENADDRESS=0.0.0.0:7053
      - ORDERER_GENERAL_TLS_ENABLED=true
      - ORDERER_GENERAL_TLS_PRIVATEKEY=/var/hyperledger/orderer/tls/server.key
      - ORDERER_GENERAL_TLS_CERTIFICATE=/var/hyperledger/orderer/tls/server.crt
      - ORDERER_GENERAL_TLS_ROOTCAS=[/var/hyperledger/orderer/tls/ca.crt]
    command: orderer
    ports:
      - "7050:7050"
      - "7053:7053"
    volumes:
      - ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp:/var/hyperledger/orderer/msp
      - ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls:/var/hyperledger/orderer/tls
      - orderer.blockchain.local:/var/hyperledger/production/orderer
    networks:
      blockchain_net:
        aliases:
          - orderer.blockchain.local

  couchdb0.org1:
    container_name: couchdb0.org1
    image: couchdb:3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "5984:5984"
    volumes:
      - couchdb0.org1:/opt/couchdb/data
    networks:
      blockchain_net:
        aliases:
          - couchdb0.org1

  peer0.org1.blockchain.local:
    container_name: peer0.org1.blockchain.local
    image: hyperledger/fabric-peer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org1.blockchain.local
      - CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org1.blockchain.local:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org1.blockchain.local:7051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org1.blockchain.local:7051
      - CORE_PEER_LOCALMSPID=Org1MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org1:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
    command: peer node start
    ports:
      - "7051:7051"
    depends_on:
      - couchdb0.org1
    volumes:
      - ../organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls:/etc/hyperledger/fabric/tls
      - peer0.org1.blockchain.local:/var/hyperledger/production
    networks:
      blockchain_net:
        aliases:
          - peer0.org1.blockchain.local

  couchdb0.org2:
    container_name: couchdb0.org2
    image: couchdb:3
    environment:
      - COUCHDB_USER=admin
      - COUCHDB_PASSWORD=adminpw
    ports:
      - "7984:5984"
    volumes:
      - couchdb0.org2:/opt/couchdb/data
    networks:
      blockchain_net:
        aliases:
          - couchdb0.org2

  peer0.org2.blockchain.local:
    container_name: peer0.org2.blockchain.local
    image: hyperledger/fabric-peer:latest
    environment:
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org2.blockchain.local
      - CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org2.blockchain.local:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
      - CORE_PEER_GOSSIP_BOOTSTRAP=peer0.org2.blockchain.local:9051
      - CORE_PEER_GOSSIP_EXTERNALENDPOINT=peer0.org2.blockchain.local:9051
      - CORE_PEER_LOCALMSPID=Org2MSP
      - CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/fabric/msp
      - CORE_PEER_TLS_ENABLED=true
      - CORE_PEER_TLS_CERT_FILE=/etc/hyperledger/fabric/tls/server.crt
      - CORE_PEER_TLS_KEY_FILE=/etc/hyperledger/fabric/tls/server.key
      - CORE_PEER_TLS_ROOTCERT_FILE=/etc/hyperledger/fabric/tls/ca.crt
      - CORE_LEDGER_STATE_STATEDATABASE=CouchDB
      - CORE_LEDGER_STATE_COUCHDBCONFIG_COUCHDBADDRESS=couchdb0.org2:5984
      - CORE_LEDGER_STATE_COUCHDBCONFIG_USERNAME=admin
      - CORE_LEDGER_STATE_COUCHDBCONFIG_PASSWORD=adminpw
    command: peer node start
    ports:
      - "9051:9051"
    depends_on:
      - couchdb0.org2
    volumes:
      - ../organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/msp:/etc/hyperledger/fabric/msp
      - ../organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls:/etc/hyperledger/fabric/tls
      - peer0.org2.blockchain.local:/var/hyperledger/production
    networks:
      blockchain_net:
        aliases:
          - peer0.org2.blockchain.local
9. Add Hostname Mapping on Ubuntu Server

Edit hosts file:

sudo nano /etc/hosts

Add:

127.0.0.1 orderer.blockchain.local
127.0.0.1 peer0.org1.blockchain.local
127.0.0.1 peer0.org2.blockchain.local

Verify:

getent hosts orderer.blockchain.local
getent hosts peer0.org1.blockchain.local
getent hosts peer0.org2.blockchain.local

Expected:

127.0.0.1 orderer.blockchain.local
127.0.0.1 peer0.org1.blockchain.local
127.0.0.1 peer0.org2.blockchain.local
10. Clean Start Network

Important: use down -v to remove old CouchDB passwords and old ledger data.

cd ~/u01/blockchain-integration/fabric-network

docker compose -f docker/docker-compose-fabric.yaml down -v
docker compose -f docker/docker-compose-fabric.yaml up -d

Wait:

sleep 15

Check:

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Expected:

orderer.blockchain.local        Up
peer0.org1.blockchain.local     Up
peer0.org2.blockchain.local     Up
couchdb0.org1                   Up
couchdb0.org2                   Up
11. Verify CouchDB

Org1:

curl http://admin:adminpw@localhost:5984/_up
curl http://admin:adminpw@localhost:5984/_all_dbs

Org2:

curl http://admin:adminpw@localhost:7984/_up
curl http://admin:adminpw@localhost:7984/_all_dbs

Expected:

{"status":"ok"}
12. Join Orderer to Channel

Run:

cd ~/u01/blockchain-integration/fabric-network

Join orderer:

osnadmin channel join \
  --channelID kycchannelnix1 \
  --config-block ./channel-artifacts/kycchannelnix1.block \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key

Verify:

osnadmin channel list \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key

Expected:

kycchannelnix1
13. Join Org1 Peer to Channel

Set Org1 environment:

cd ~/u01/blockchain-integration/fabric-network

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin
export FABRIC_CFG_PATH=~/u01/blockchain-integration/fabric/fabric-samples/config

export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt

Join channel:

peer channel join -b ./channel-artifacts/kycchannelnix1.block

Verify:

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1
14. Join Org2 Peer to Channel

Set Org2 environment:

cd ~/u01/blockchain-integration/fabric-network

export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt

Join channel:

peer channel join -b ./channel-artifacts/kycchannelnix1.block

Verify:

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1
15. Create Helper Scripts
15.1 scripts/clean-network.sh
nano scripts/clean-network.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Stopping and cleaning Fabric custom network..."

docker compose -f docker/docker-compose-fabric.yaml down -v || true

echo "Removing old dev-peer containers..."
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

echo "Removing old example.com containers..."
docker rm -f orderer.example.com peer0.org1.example.com peer0.org2.example.com couchdb0 couchdb1 ca_org1 ca_org2 ca_orderer 2>/dev/null || true

echo "Network cleaned."

Make executable:

chmod +x scripts/clean-network.sh
15.2 scripts/generate-crypto.sh
nano scripts/generate-crypto.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin

echo "Removing old crypto material..."
rm -rf organizations/peerOrganizations organizations/ordererOrganizations

echo "Generating new crypto material..."
cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations

echo "Crypto material generated."
tree organizations -L 3 || true

Make executable:

chmod +x scripts/generate-crypto.sh
15.3 scripts/generate-channel.sh
nano scripts/generate-channel.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin
export FABRIC_CFG_PATH=$PWD/config

echo "Cleaning old channel artifacts..."
rm -rf channel-artifacts/*
mkdir -p channel-artifacts

echo "Generating channel block for kycchannelnix1..."
configtxgen \
  -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/kycchannelnix1.block \
  -channelID kycchannelnix1

echo "Channel block generated:"
ls -lah channel-artifacts/

Make executable:

chmod +x scripts/generate-channel.sh
15.4 scripts/network-up.sh
nano scripts/network-up.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Starting custom Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml up -d

echo "Waiting for services..."
sleep 15

echo "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Network started."

Make executable:

chmod +x scripts/network-up.sh
15.5 scripts/network-down.sh
nano scripts/network-down.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Stopping custom Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml down

echo "Network stopped."

Make executable:

chmod +x scripts/network-down.sh
15.6 scripts/join-orderer.sh
nano scripts/join-orderer.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Joining orderer to kycchannelnix1..."

osnadmin channel join \
  --channelID kycchannelnix1 \
  --config-block ./channel-artifacts/kycchannelnix1.block \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key || true

echo "Orderer channel list:"
osnadmin channel list \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key

Make executable:

chmod +x scripts/join-orderer.sh
15.7 scripts/join-org1.sh
nano scripts/join-org1.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin
export FABRIC_CFG_PATH=~/u01/blockchain-integration/fabric/fabric-samples/config

export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt

echo "Joining Org1 peer to kycchannelnix1..."
peer channel join -b ./channel-artifacts/kycchannelnix1.block || true

echo "Org1 peer channel list:"
peer channel list

Make executable:

chmod +x scripts/join-org1.sh
15.8 scripts/join-org2.sh
nano scripts/join-org2.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin
export FABRIC_CFG_PATH=~/u01/blockchain-integration/fabric/fabric-samples/config

export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt

echo "Joining Org2 peer to kycchannelnix1..."
peer channel join -b ./channel-artifacts/kycchannelnix1.block || true

echo "Org2 peer channel list:"
peer channel list

Make executable:

chmod +x scripts/join-org2.sh
15.9 scripts/verify-network.sh
nano scripts/verify-network.sh

Paste:

#!/bin/bash

cd "$(dirname "$0")/.."

echo "Checking Docker containers..."
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "Checking Docker network..."
docker network ls | grep blockchain_net || echo "blockchain_net not found"

echo ""
echo "Checking hostnames..."
getent hosts orderer.blockchain.local || true
getent hosts peer0.org1.blockchain.local || true
getent hosts peer0.org2.blockchain.local || true

echo ""
echo "Checking CouchDB Org1..."
curl -s http://admin:adminpw@localhost:5984/_all_dbs || true

echo ""
echo ""
echo "Checking CouchDB Org2..."
curl -s http://admin:adminpw@localhost:7984/_all_dbs || true

echo ""
echo ""
echo "Checking orderer logs..."
docker logs orderer.blockchain.local --tail=20 || true

echo ""
echo "Checking Org1 peer logs..."
docker logs peer0.org1.blockchain.local --tail=20 || true

echo ""
echo "Checking Org2 peer logs..."
docker logs peer0.org2.blockchain.local --tail=20 || true

Make executable:

chmod +x scripts/verify-network.sh
15.10 scripts/full-reset-and-start.sh
nano scripts/full-reset-and-start.sh

Paste:

#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "======================================"
echo "FULL RESET AND START FABRIC NETWORK"
echo "======================================"

export PATH=$PATH:~/u01/blockchain-integration/fabric/fabric-samples/bin
export FABRIC_CFG_PATH=$PWD/config

echo "1. Stopping network and removing volumes..."
docker compose -f docker/docker-compose-fabric.yaml down -v || true

echo "2. Removing old dev-peer containers..."
docker rm -f $(docker ps -aq --filter "name=dev-peer") 2>/dev/null || true

echo "3. Removing old example.com containers..."
docker rm -f orderer.example.com peer0.org1.example.com peer0.org2.example.com couchdb0 couchdb1 ca_org1 ca_org2 ca_orderer 2>/dev/null || true

echo "4. Regenerating crypto material..."
rm -rf organizations/peerOrganizations organizations/ordererOrganizations

cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations

echo "5. Regenerating channel block..."
rm -rf channel-artifacts/*
mkdir -p channel-artifacts

configtxgen \
  -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/kycchannelnix1.block \
  -channelID kycchannelnix1

echo "6. Starting network..."
docker compose -f docker/docker-compose-fabric.yaml up -d

echo "7. Waiting for containers..."
sleep 15

echo "8. Joining orderer to channel..."
osnadmin channel join \
  --channelID kycchannelnix1 \
  --config-block ./channel-artifacts/kycchannelnix1.block \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key || true

echo "9. Joining Org1 peer..."
export FABRIC_CFG_PATH=~/u01/blockchain-integration/fabric/fabric-samples/config
export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt

peer channel join -b ./channel-artifacts/kycchannelnix1.block || true

echo "10. Joining Org2 peer..."
export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt

peer channel join -b ./channel-artifacts/kycchannelnix1.block || true

echo "11. Final containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "12. CouchDB Org1 databases:"
curl -s http://admin:adminpw@localhost:5984/_all_dbs || true

echo ""
echo "13. CouchDB Org2 databases:"
curl -s http://admin:adminpw@localhost:7984/_all_dbs || true

echo ""
echo "Fabric network reset and start completed."

Make executable:

chmod +x scripts/full-reset-and-start.sh
16. Recommended Execution Order

After saving all files, run:

cd ~/u01/blockchain-integration/fabric-network

Then:

./scripts/full-reset-and-start.sh

After it finishes, verify:

./scripts/verify-network.sh
17. Manual Verification Commands

Check containers:

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Expected:

orderer.blockchain.local
peer0.org1.blockchain.local
peer0.org2.blockchain.local
couchdb0.org1
couchdb0.org2

Check Org1 channel:

export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1

Check Org2 channel:

export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1
18. Troubleshooting Reference
Problem 1: CouchDB hostname not found

Error:

lookup couchdb0.org1 on 127.0.0.11:53: no such host

Fix:

Add Docker network aliases for couchdb0.org1 and couchdb0.org2.

Compose example:

networks:
  blockchain_net:
    aliases:
      - couchdb0.org1
Problem 2: CouchDB unauthorized

Error:

Status Code:401, Reason:Name or password is incorrect

Fix:

docker compose -f docker/docker-compose-fabric.yaml down -v
docker compose -f docker/docker-compose-fabric.yaml up -d

Reason:

CouchDB stored old password in Docker volume.
Problem 3: Peer port refused

Error:

dial tcp 127.0.0.1:7051: connect: connection refused

Fix:

docker ps -a | grep peer0.org1
docker logs peer0.org1.blockchain.local --tail=100

Most likely the peer crashed because CouchDB was not reachable.

Problem 4: TLS unknown authority

Error:

tls: failed to verify certificate: x509: certificate signed by unknown authority

Fix:

Regenerate crypto material and regenerate channel block using the same current certificates.

Commands:

rm -rf organizations/peerOrganizations organizations/ordererOrganizations
cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations

rm -rf channel-artifacts/*
export FABRIC_CFG_PATH=$PWD/config
configtxgen \
  -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/kycchannelnix1.block \
  -channelID kycchannelnix1
19. Step 6 Completion Checklist

Step 6 is complete when:

[ ] Old example.com network stopped
[ ] Custom crypto material generated
[ ] configtx.yaml created
[ ] kycchannelnix1.block generated
[ ] Docker Compose file uses custom names
[ ] Docker network aliases added
[ ] /etc/hosts includes custom hostnames
[ ] orderer.blockchain.local is running
[ ] peer0.org1.blockchain.local is running
[ ] peer0.org2.blockchain.local is running
[ ] couchdb0.org1 is running
[ ] couchdb0.org2 is running
[ ] CouchDB login works with admin/adminpw
[ ] Orderer joined kycchannelnix1
[ ] Org1 peer joined kycchannelnix1
[ ] Org2 peer joined kycchannelnix1
[ ] peer channel list shows kycchannelnix1
[ ] verify-network.sh shows no CouchDB panic
[ ] verify-network.sh shows no TLS unknown authority error