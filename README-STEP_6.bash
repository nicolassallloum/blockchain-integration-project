🔹 STEP 6 — Hyperledger Fabric Network Configuration
Professional Prompt

You are a Blockchain Network Architect.

Design and configure the Hyperledger Fabric network for the Blockchain Integration Project.

The network must support this enterprise flow:

Angular → Spring Boot → Blockchain API → Hyperledger Fabric → CouchDB / PostgreSQL

The Angular and Spring Boot applications will be developed by the DEV team.
My responsibility is to provide the Blockchain API, Fabric network, chaincode, ledger, and integration layer.

The Fabric network must include:

Organizations
Peers
Orderer
Channel
MSP structure
Crypto material structure
configtx.yaml configuration
Channel creation flow
Network startup commands
Folder structure
Verification commands
Enterprise-ready naming convention
Troubleshooting commands

Output must be production-style, clear, professional, and ready to continue implementation on Ubuntu.

1. Recommended Fabric Network Design

For this project, use this initial enterprise-ready network:

Network Name: blockchain-integration-network

Organizations:
1. Org1MSP → Blockchain API / KYC / Wallet Services
2. Org2MSP → Bank / Enterprise Partner Services
3. OrdererMSP → Ordering Service

Channel:
kycchannelnix1

Peers:
peer0.org1.blockchain.local
peer0.org2.blockchain.local

Orderer:
orderer.blockchain.local

State Database:
CouchDB for each peer

External Database:
PostgreSQL for API reporting, indexing, and application sync

The official Fabric test network can generate crypto material and create channels for development using cryptogen and network.sh; for production, Fabric CA is preferred for identity lifecycle management.

2. Target Network Architecture
                        +----------------------+
                        |      Angular UI      |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |     Spring Boot      |
                        | Enterprise Backend   |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |   Blockchain API     |
                        | Node.js / Express    |
                        +----------+-----------+
                                   |
                  +----------------+----------------+
                  |                                 |
                  v                                 v
        +-------------------+             +-------------------+
        | peer0.org1        |             | peer0.org2        |
        | Org1MSP           |             | Org2MSP           |
        | CouchDB           |             | CouchDB           |
        +---------+---------+             +---------+---------+
                  \                               /
                   \                             /
                    v                           v
                    +---------------------------+
                    |    kycchannelnix1         |
                    | Hyperledger Fabric Ledger |
                    +-------------+-------------+
                                  |
                                  v
                    +---------------------------+
                    | orderer.blockchain.local  |
                    | OrdererMSP                |
                    +---------------------------+

External Sync:
Fabric Events → Blockchain API Listener → PostgreSQL
3. Organization Design
3.1 Orderer Organization
Organization Name: OrdererOrg
MSP ID: OrdererMSP
Domain: blockchain.local
Node:
  - orderer.blockchain.local

Purpose:

- Orders transactions
- Creates blocks
- Distributes blocks to peers
- Maintains channel ordering service
3.2 Org1 — Blockchain API Organization
Organization Name: Org1
MSP ID: Org1MSP
Domain: org1.blockchain.local
Peer:
  - peer0.org1.blockchain.local
CouchDB:
  - couchdb0.org1.blockchain.local

Purpose:

- Main organization for Blockchain API
- Handles wallet creation
- Handles customer registration
- Handles KYC chaincode invocation
- Handles blockchain transaction submission
3.3 Org2 — Enterprise / Bank Organization
Organization Name: Org2
MSP ID: Org2MSP
Domain: org2.blockchain.local
Peer:
  - peer0.org2.blockchain.local
CouchDB:
  - couchdb0.org2.blockchain.local

Purpose:

- Represents bank / enterprise participant
- Validates transactions
- Stores replicated ledger data
- Participates in endorsement policy
4. Channel Design
Channel Name: kycchannelnix1
Channel Type: Application Channel
Participating Organizations:
  - Org1MSP
  - Org2MSP
Orderer:
  - OrdererMSP

Purpose:

- Private business network between Blockchain API organization and bank/enterprise organization
- Stores KYC records
- Stores wallet transaction records
- Stores audit references
- Supports chaincode execution

Fabric channels provide a private communication layer between selected organizations, and each channel has its own ledger.

5. Recommended Project Folder Structure

Create this structure under your project:

mkdir -p ~/u01/blockchain-integration/fabric-network
cd ~/u01/blockchain-integration/fabric-network

mkdir -p \
  organizations/cryptogen \
  organizations/fabric-ca \
  channel-artifacts \
  system-genesis-block \
  config \
  scripts \
  docker \
  chaincode \
  logs \
  backups

Final structure:

blockchain-integration/
└── fabric-network/
    ├── organizations/
    │   ├── cryptogen/
    │   │   └── crypto-config.yaml
    │   ├── fabric-ca/
    │   └── peerOrganizations/
    │       ├── org1.blockchain.local/
    │       └── org2.blockchain.local/
    ├── channel-artifacts/
    │   ├── kycchannelnix1.block
    │   ├── Org1MSPanchors.tx
    │   └── Org2MSPanchors.tx
    ├── system-genesis-block/
    ├── config/
    │   └── configtx.yaml
    ├── scripts/
    │   ├── network-up.sh
    │   ├── network-down.sh
    │   ├── create-channel.sh
    │   ├── join-channel.sh
    │   └── verify-network.sh
    ├── docker/
    │   └── docker-compose-fabric.yaml
    ├── chaincode/
    ├── logs/
    └── backups/
6. Crypto Material Structure

Expected crypto output:

organizations/
└── peerOrganizations/
    ├── org1.blockchain.local/
    │   ├── ca/
    │   ├── msp/
    │   ├── peers/
    │   │   └── peer0.org1.blockchain.local/
    │   │       ├── msp/
    │   │       └── tls/
    │   ├── users/
    │   │   ├── Admin@org1.blockchain.local/
    │   │   └── User1@org1.blockchain.local/
    │   └── tlsca/
    │
    └── org2.blockchain.local/
        ├── ca/
        ├── msp/
        ├── peers/
        │   └── peer0.org2.blockchain.local/
        │       ├── msp/
        │       └── tls/
        ├── users/
        │   ├── Admin@org2.blockchain.local/
        │   └── User1@org2.blockchain.local/
        └── tlsca/

organizations/
└── ordererOrganizations/
    └── blockchain.local/
        ├── ca/
        ├── msp/
        ├── orderers/
        │   └── orderer.blockchain.local/
        │       ├── msp/
        │       └── tls/
        ├── users/
        │   └── Admin@blockchain.local/
        └── tlsca/
7. crypto-config.yaml

Create the file:

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

Generate crypto material:

cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations

Verify:

tree organizations -L 4
8. configtx.yaml

Create:

nano config/configtx.yaml

Paste this enterprise-ready starter configuration:

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
9. Generate Channel Genesis Block

Set Fabric config path:

export FABRIC_CFG_PATH=$PWD/config

Generate channel block:

configtxgen \
  -profile TwoOrgsApplicationGenesis \
  -outputBlock ./channel-artifacts/kycchannelnix1.block \
  -channelID kycchannelnix1

Verify:

ls -lah channel-artifacts/

Expected:

kycchannelnix1.block

Fabric documentation shows configtxgen as the standard tool used to generate a channel genesis block before creating an application channel.

10. Docker Compose Network Design

Create:

nano docker/docker-compose-fabric.yaml

Core services:

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
    working_dir: /root
    command: orderer
    ports:
      - "7050:7050"
      - "7053:7053"
    volumes:
      - ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp:/var/hyperledger/orderer/msp
      - ../organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls:/var/hyperledger/orderer/tls
      - orderer.blockchain.local:/var/hyperledger/production/orderer
    networks:
      - blockchain_net

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
      - blockchain_net

  peer0.org1.blockchain.local:
    container_name: peer0.org1.blockchain.local
    image: hyperledger/fabric-peer:latest
    environment:
      - FABRIC_CFG_PATH=/etc/hyperledger/peercfg
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org1.blockchain.local
      - CORE_PEER_ADDRESS=peer0.org1.blockchain.local:7051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:7051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org1.blockchain.local:7052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:7052
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
      - blockchain_net

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
      - blockchain_net

  peer0.org2.blockchain.local:
    container_name: peer0.org2.blockchain.local
    image: hyperledger/fabric-peer:latest
    environment:
      - FABRIC_CFG_PATH=/etc/hyperledger/peercfg
      - FABRIC_LOGGING_SPEC=INFO
      - CORE_PEER_ID=peer0.org2.blockchain.local
      - CORE_PEER_ADDRESS=peer0.org2.blockchain.local:9051
      - CORE_PEER_LISTENADDRESS=0.0.0.0:9051
      - CORE_PEER_CHAINCODEADDRESS=peer0.org2.blockchain.local:9052
      - CORE_PEER_CHAINCODELISTENADDRESS=0.0.0.0:9052
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
      - blockchain_net
11. Network Startup Commands

From:

cd ~/u01/blockchain-integration/fabric-network

Start network:

docker compose -f docker/docker-compose-fabric.yaml up -d

Check containers:

docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Expected containers:

orderer.blockchain.local
peer0.org1.blockchain.local
peer0.org2.blockchain.local
couchdb0.org1
couchdb0.org2

Check logs:

docker logs orderer.blockchain.local --tail=50
docker logs peer0.org1.blockchain.local --tail=50
docker logs peer0.org2.blockchain.local --tail=50
12. Channel Creation Flow
12.1 Create Channel on Orderer
osnadmin channel join \
  --channelID kycchannelnix1 \
  --config-block ./channel-artifacts/kycchannelnix1.block \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key

Verify orderer channel list:

osnadmin channel list \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key
12.2 Join Org1 Peer to Channel

Set Org1 environment:

export CORE_PEER_LOCALMSPID=Org1MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=localhost:7051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls/ca.crt

Join channel:

peer channel join -b ./channel-artifacts/kycchannelnix1.block

Verify:

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1
12.3 Join Org2 Peer to Channel

Set Org2 environment:

export CORE_PEER_LOCALMSPID=Org2MSP
export CORE_PEER_TLS_ENABLED=true
export CORE_PEER_ADDRESS=localhost:9051
export CORE_PEER_MSPCONFIGPATH=$PWD/organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp
export CORE_PEER_TLS_ROOTCERT_FILE=$PWD/organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls/ca.crt

Join channel:

peer channel join -b ./channel-artifacts/kycchannelnix1.block

Verify:

peer channel list

Expected:

Channels peers has joined:
kycchannelnix1
13. Verification Commands
Check Docker Network
docker network ls
docker network inspect blockchain_net
Check Containers
docker ps -a
Check Peer Logs
docker logs peer0.org1.blockchain.local --tail=100
docker logs peer0.org2.blockchain.local --tail=100
Check Orderer Logs
docker logs orderer.blockchain.local --tail=100
Check CouchDB
curl http://admin:adminpw@localhost:5984/_all_dbs
curl http://admin:adminpw@localhost:7984/_all_dbs
Check Channel
peer channel list
Fetch Channel Block
peer channel fetch 0 ./channel-artifacts/kycchannelnix1_fetched.block \
  -o localhost:7050 \
  -c kycchannelnix1 \
  --tls \
  --cafile ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt
14. Useful Helper Scripts
scripts/network-up.sh
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Starting Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml up -d

echo "Fabric containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "Network started successfully."

Make executable:

chmod +x scripts/network-up.sh

Run:

./scripts/network-up.sh
scripts/network-down.sh
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Stopping Fabric network..."

docker compose -f docker/docker-compose-fabric.yaml down

echo "Network stopped."

Make executable:

chmod +x scripts/network-down.sh

Run:

./scripts/network-down.sh
scripts/verify-network.sh
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

Make executable:

chmod +x scripts/verify-network.sh

Run:

./scripts/verify-network.sh
15. Enterprise Naming Standards

Use these names consistently:

Network: blockchain-integration-network
Docker Network: blockchain_net
Channel: kycchannelnix1
Orderer MSP: OrdererMSP
Org1 MSP: Org1MSP
Org2 MSP: Org2MSP
Org1 Peer: peer0.org1.blockchain.local
Org2 Peer: peer0.org2.blockchain.local
Orderer: orderer.blockchain.local
Chaincode Name: kyc_cc
State Database: CouchDB
Integration Database: PostgreSQL
16. Troubleshooting
Problem: Channel already exists
Error: channel already exists

Fix:

osnadmin channel list \
  -o localhost:7053 \
  --ca-file ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/ca.crt \
  --client-cert ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.crt \
  --client-key ./organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/server.key

If needed, restart from clean state:

docker compose -f docker/docker-compose-fabric.yaml down -v
Problem: MSP path not found
Error: MSP folder does not exist

Fix:

ls organizations/peerOrganizations/org1.blockchain.local/users/
ls organizations/peerOrganizations/org2.blockchain.local/users/

Regenerate crypto:

rm -rf organizations/peerOrganizations organizations/ordererOrganizations

cryptogen generate \
  --config=./organizations/cryptogen/crypto-config.yaml \
  --output=./organizations
Problem: Peer cannot connect to orderer

Check orderer:

docker ps | grep orderer
docker logs orderer.blockchain.local --tail=100

Check TLS cert:

ls organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls/
Problem: CouchDB not connected

Check CouchDB:

curl http://admin:adminpw@localhost:5984/_up
curl http://admin:adminpw@localhost:7984/_up

Check peer environment:

docker inspect peer0.org1.blockchain.local | grep COUCHDB
docker inspect peer0.org2.blockchain.local | grep COUCHDB
17. Step 6 Completion Checklist

Your Step 6 is complete when:

[ ] Fabric folder structure created
[ ] crypto-config.yaml created
[ ] crypto material generated
[ ] configtx.yaml created
[ ] kycchannelnix1.block generated
[ ] Docker Compose Fabric services created
[ ] Orderer container running
[ ] Org1 peer running
[ ] Org2 peer running
[ ] Org1 CouchDB running
[ ] Org2 CouchDB running
[ ] Channel created on orderer
[ ] Org1 joined kycchannelnix1
[ ] Org2 joined kycchannelnix1
[ ] peer channel list shows kycchannelnix1
[ ] CouchDB endpoints reachable
[ ] verification script created
18. Recommended Next Step

After Step 6, continue with:

🔹 STEP 7 — Chaincode Design & Deployment

Design and deploy the KYC / Wallet / Transaction smart contract.

Include:
- Chaincode folder structure
- Go or JavaScript chaincode
- Asset model
- Customer model
- Wallet model
- Transaction model
- Chaincode package
- Install
- Approve
- Commit
- Invoke
- Query
- Troubleshooting