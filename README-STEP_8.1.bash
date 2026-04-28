STEP 8 — Fabric CA / Identity Management Setup
Project path:
/home/nix/u01/blockchain-integration/fabric-network
Docker Compose file:
docker-compose-fabric.yaml
Your Compose file uses fixed container names like orderer.blockchain.local, peer0.org1.blockchain.local, peer0.org2.blockchain.local, couchdb0.org1, and couchdb0.org2, so every Compose command must use -f docker-compose-fabric.yaml. 
Your previous logs also showed container-name conflicts because old containers were still running outside the current Compose project. 

1. Important rule
Never use:
docker compose downdocker compose up -d
Use this always:
docker compose -f docker-compose-fabric.yaml downdocker compose -f docker-compose-fabric.yaml up -d

2. Required Fabric CA services
Your network should have these CA services:
ca.org1.blockchain.localca.org2.blockchain.localca.orderer.blockchain.local
They are responsible for:
Admin registrationAdmin enrollmentPeer enrollmentOrderer enrollmentApplication user enrollmentService identity enrollmentMSP folder generationTLS certificate generation

3. Recommended execution order
Use this order only:
1. Clean old conflicting containers2. Start Fabric CA containers only3. Register/enroll Org1 identities4. Register/enroll Org2 identities5. Register/enroll Orderer identities6. Verify identities7. Start full Fabric network
Do not start the full Fabric network before MSP and TLS folders exist.

4. Create helper scripts folder
cd /home/nix/u01/blockchain-integration/fabric-networkmkdir -p scriptsmkdir -p organizationsmkdir -p fabric-ca/org1mkdir -p fabric-ca/org2mkdir -p fabric-ca/ordererOrgmkdir -p wallet/org1mkdir -p wallet/org2

5. Fix Docker network configuration
Open your Compose file:
nano docker-compose-fabric.yaml
Find:
networks:  blockchain_net:    name: blockchain_net
Replace it with:
networks:  blockchain_net:    external: true    name: blockchain_net
Then create the network if it does not exist:
docker network inspect blockchain_net >/dev/null 2>&1 || docker network create blockchain_net

6. Fix organization volume paths
Because your Compose file is inside:
/home/nix/u01/blockchain-integration/fabric-network
your volume paths should use:
./organizations/...
not:
../organizations/...
Run:
cd /home/nix/u01/blockchain-integration/fabric-networkcp docker-compose-fabric.yaml docker-compose-fabric.yaml.baksed -i 's#../organizations#./organizations#g' docker-compose-fabric.yaml
Verify:
grep -n "organizations" docker-compose-fabric.yaml

7. Add Fabric CA services to Docker Compose
Make sure your docker-compose-fabric.yaml contains these services under services:.
Org1 CA
  ca.org1.blockchain.local:    container_name: ca.org1.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-org1      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=7054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:17054    ports:      - "7054:7054"      - "17054:17054"    command: sh -c 'fabric-ca-server start -b ca-org1-admin:ca-org1-adminpw -d'    volumes:      - ./fabric-ca/org1:/etc/hyperledger/fabric-ca-server    networks:      blockchain_net:        aliases:          - ca.org1.blockchain.local
Org2 CA
  ca.org2.blockchain.local:    container_name: ca.org2.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-org2      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=8054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:18054    ports:      - "8054:8054"      - "18054:18054"    command: sh -c 'fabric-ca-server start -b ca-org2-admin:ca-org2-adminpw -d'    volumes:      - ./fabric-ca/org2:/etc/hyperledger/fabric-ca-server    networks:      blockchain_net:        aliases:          - ca.org2.blockchain.local
Orderer CA
  ca.orderer.blockchain.local:    container_name: ca.orderer.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-orderer      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=9054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:19054    ports:      - "9054:9054"      - "19054:19054"    command: sh -c 'fabric-ca-server start -b ca-orderer-admin:ca-orderer-adminpw -d'    volumes:      - ./fabric-ca/ordererOrg:/etc/hyperledger/fabric-ca-server    networks:      blockchain_net:        aliases:          - ca.orderer.blockchain.local
Validate Compose:
docker compose -f docker-compose-fabric.yaml config

8. Create cleanup script
nano scripts/clean-fabric-containers.sh
Paste:
#!/bin/bashset -eecho "=========================================="echo "Cleaning old Fabric containers by name"echo "=========================================="docker rm -f \  ca.org1.blockchain.local \  ca.org2.blockchain.local \  ca.orderer.blockchain.local \  peer0.org1.blockchain.local \  peer0.org2.blockchain.local \  orderer.blockchain.local \  couchdb0.org1 \  couchdb0.org2 2>/dev/null || trueecho "Done."
Make executable:
chmod +x scripts/clean-fabric-containers.sh

9. Create start CA script
nano scripts/start-ca.sh
Paste:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"COMPOSE_FILE="${PROJECT_PATH}/docker-compose-fabric.yaml"echo "=========================================="echo "Starting Fabric CA services"echo "Project Path: $PROJECT_PATH"echo "Compose File: $COMPOSE_FILE"echo "=========================================="cd "$PROJECT_PATH"docker network inspect blockchain_net >/dev/null 2>&1 || docker network create blockchain_netif [ ! -f "$COMPOSE_FILE" ]; then  echo "ERROR: docker-compose-fabric.yaml not found."  exit 1fidocker compose -f "$COMPOSE_FILE" up -d \  ca.org1.blockchain.local \  ca.org2.blockchain.local \  ca.orderer.blockchain.localsleep 8echoecho "Running CA containers:"docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "ca." || trueechoecho "Checking generated CA files:"ls -la fabric-ca/org1 || truels -la fabric-ca/org2 || truels -la fabric-ca/ordererOrg || trueechoecho "Testing CA endpoints:"curl -k https://localhost:7054/cainfo || trueechocurl -k https://localhost:8054/cainfo || trueechocurl -k https://localhost:9054/cainfo || trueechoecho "=========================================="echo "Fabric CA services started"echo "=========================================="
Make executable:
chmod +x scripts/start-ca.sh

10. Create Org1 identity script
nano scripts/register-enroll-org1.sh
Paste:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"ORG_DOMAIN="org1.blockchain.local"CA_HOST="localhost"CA_PORT="7054"CA_NAME="ca-org1"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/tls-cert.pemif [ ! -f "$CA_TLS_CERT" ]; then  CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/ca-cert.pemfiif [ ! -f "$CA_TLS_CERT" ]; then  echo "ERROR: Org1 CA certificate not found."  echo "Start CA first:"  echo "./scripts/start-ca.sh"  exit 1fiecho "Using Org1 CA certificate: $CA_TLS_CERT"cd "$PROJECT_PATH"mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}echo "=========================================="echo "Enrolling Org1 CA bootstrap admin"echo "=========================================="fabric-ca-client enroll \  -u https://ca-org1-admin:ca-org1-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/mspcat > organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml <<EOFNodeOUs:  Enable: true  ClientOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: client  PeerOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: peer  AdminOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: admin  OrdererOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: ordererEOFecho "=========================================="echo "Registering Org1 identities"echo "=========================================="fabric-ca-client register \  --caname ${CA_NAME} \  --id.name peer0.org1.blockchain.local \  --id.secret peer0org1pw \  --id.type peer \  --tls.certfiles ${CA_TLS_CERT} || truefabric-ca-client register \  --caname ${CA_NAME} \  --id.name org1admin \  --id.secret org1adminpw \  --id.type admin \  --tls.certfiles ${CA_TLS_CERT} || truefabric-ca-client register \  --caname ${CA_NAME} \  --id.name appUserOrg1 \  --id.secret appUserOrg1pw \  --id.type client \  --tls.certfiles ${CA_TLS_CERT} || truefabric-ca-client register \  --caname ${CA_NAME} \  --id.name blockchain-api-org1-service \  --id.secret blockchainApiOrg1Pw \  --id.type client \  --id.attrs 'role=blockchain-api:ecert,department=integration:ecert' \  --tls.certfiles ${CA_TLS_CERT} || trueecho "=========================================="echo "Enrolling peer0.org1 MSP"echo "=========================================="fabric-ca-client enroll \  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp \  --csr.hosts peer0.org1.blockchain.local \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/config.yamlecho "=========================================="echo "Enrolling peer0.org1 TLS"echo "=========================================="fabric-ca-client enroll \  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls \  --enrollment.profile tls \  --csr.hosts peer0.org1.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/ca.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/signcerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/keystore/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.keymkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacertscp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts/ca.crtmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/tlscacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pemmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/cacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/cacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/ca/ca.${ORG_DOMAIN}-cert.pemecho "=========================================="echo "Enrolling Org1 admin"echo "=========================================="fabric-ca-client enroll \  -u https://org1admin:org1adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp/config.yamlecho "=========================================="echo "Enrolling Org1 app user"echo "=========================================="fabric-ca-client enroll \  -u https://appUserOrg1:appUserOrg1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp/config.yamlecho "=========================================="echo "Enrolling Org1 Blockchain API service identity"echo "=========================================="fabric-ca-client enroll \  -u https://blockchain-api-org1-service:blockchainApiOrg1Pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp/config.yamlecho "=========================================="echo "Org1 identities completed"echo "=========================================="
Make executable:
chmod +x scripts/register-enroll-org1.sh

11. Create Org2 identity script
cp scripts/register-enroll-org1.sh scripts/register-enroll-org2.shsed -i 's/org1.blockchain.local/org2.blockchain.local/g' scripts/register-enroll-org2.shsed -i 's/Org1/Org2/g' scripts/register-enroll-org2.shsed -i 's/org1/org2/g' scripts/register-enroll-org2.shsed -i 's/7054/8054/g' scripts/register-enroll-org2.shsed -i 's/ca-org1/ca-org2/g' scripts/register-enroll-org2.shsed -i 's/peer0org1pw/peer0org2pw/g' scripts/register-enroll-org2.shsed -i 's/org1admin/org2admin/g' scripts/register-enroll-org2.shsed -i 's/appUserOrg1/appUserOrg2/g' scripts/register-enroll-org2.shsed -i 's/blockchain-api-org1-service/blockchain-api-org2-service/g' scripts/register-enroll-org2.shsed -i 's/blockchainApiOrg1Pw/blockchainApiOrg2Pw/g' scripts/register-enroll-org2.shchmod +x scripts/register-enroll-org2.sh
Then verify the top lines:
head -40 scripts/register-enroll-org2.sh
Expected values:
ORG_DOMAIN="org2.blockchain.local"CA_PORT="8054"CA_NAME="ca-org2"CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org2/tls-cert.pem

12. Create Orderer identity script
nano scripts/register-enroll-orderer.sh
Paste:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"ORDERER_DOMAIN="blockchain.local"CA_HOST="localhost"CA_PORT="9054"CA_NAME="ca-orderer"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/ordererOrg/tls-cert.pemif [ ! -f "$CA_TLS_CERT" ]; then  CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/ordererOrg/ca-cert.pemfiif [ ! -f "$CA_TLS_CERT" ]; then  echo "ERROR: Orderer CA certificate not found."  echo "Start CA first:"  echo "./scripts/start-ca.sh"  exit 1fiecho "Using Orderer CA certificate: $CA_TLS_CERT"cd "$PROJECT_PATH"mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}echo "=========================================="echo "Enrolling Orderer CA bootstrap admin"echo "=========================================="fabric-ca-client enroll \  -u https://ca-orderer-admin:ca-orderer-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/mspcat > organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml <<EOFNodeOUs:  Enable: true  ClientOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: client  PeerOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: peer  AdminOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: admin  OrdererOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: ordererEOFecho "=========================================="echo "Registering Orderer identities"echo "=========================================="fabric-ca-client register \  --caname ${CA_NAME} \  --id.name orderer.blockchain.local \  --id.secret ordererpw \  --id.type orderer \  --tls.certfiles ${CA_TLS_CERT} || truefabric-ca-client register \  --caname ${CA_NAME} \  --id.name ordererAdmin \  --id.secret ordererAdminpw \  --id.type admin \  --tls.certfiles ${CA_TLS_CERT} || trueecho "=========================================="echo "Enrolling orderer MSP"echo "=========================================="fabric-ca-client enroll \  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp \  --csr.hosts orderer.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/config.yamlecho "=========================================="echo "Enrolling orderer TLS"echo "=========================================="fabric-ca-client enroll \  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls \  --enrollment.profile tls \  --csr.hosts orderer.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/ca.crtcp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/signcerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.crtcp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/keystore/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.keymkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacertscp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pemmkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacertscp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pemecho "=========================================="echo "Enrolling Orderer admin"echo "=========================================="fabric-ca-client enroll \  -u https://ordererAdmin:ordererAdminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp/config.yamlecho "=========================================="echo "Orderer identities completed"echo "=========================================="
Make executable:
chmod +x scripts/register-enroll-orderer.sh

13. Create application customer registration script
Use this only if you want one Fabric identity per customer.
nano scripts/register-customer-org1.sh
Paste:
#!/bin/bashset -eCUSTOMER_ID="$1"CUSTOMER_SECRET="$2"if [ -z "$CUSTOMER_ID" ] || [ -z "$CUSTOMER_SECRET" ]; then  echo "Usage:"  echo "./scripts/register-customer-org1.sh customer1001 customer1001pw"  exit 1fiPROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"ORG_DOMAIN="org1.blockchain.local"CA_HOST="localhost"CA_PORT="7054"CA_NAME="ca-org1"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/tls-cert.pemif [ ! -f "$CA_TLS_CERT" ]; then  CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/ca-cert.pemfiif [ ! -f "$CA_TLS_CERT" ]; then  echo "ERROR: Org1 CA certificate not found."  exit 1fiecho "Using Org1 CA certificate: $CA_TLS_CERT"cd "$PROJECT_PATH"echo "Ensuring Org1 CA admin is enrolled..."fabric-ca-client enroll \  -u https://ca-org1-admin:ca-org1-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}echo "Registering customer: $CUSTOMER_ID"fabric-ca-client register \  --caname ${CA_NAME} \  --id.name ${CUSTOMER_ID} \  --id.secret ${CUSTOMER_SECRET} \  --id.type client \  --id.attrs 'role=customer:ecert' \  --tls.certfiles ${CA_TLS_CERT} || trueecho "Enrolling customer: $CUSTOMER_ID"fabric-ca-client enroll \  -u https://${CUSTOMER_ID}:${CUSTOMER_SECRET}@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/${CUSTOMER_ID}@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/${CUSTOMER_ID}@${ORG_DOMAIN}/msp/config.yamlecho "Customer identity created:"find organizations/peerOrganizations/${ORG_DOMAIN}/users/${CUSTOMER_ID}@${ORG_DOMAIN}/msp -maxdepth 2 -type f
Make executable:
chmod +x scripts/register-customer-org1.sh
Run example:
./scripts/register-customer-org1.sh customer1001 customer1001pw
Recommended for your project:
Do not create one Fabric identity per normal customer yet.Use blockchain-api-org1-service as the transaction signer.Store customer IDs, wallet addresses, and mappings in PostgreSQL.Write customerId and walletAddress into the ledger as business data.

14. Create verification script
nano scripts/verify-identities.sh
Paste:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"COMPOSE_FILE="${PROJECT_PATH}/docker-compose-fabric.yaml"cd "$PROJECT_PATH"echo "=========================================="echo "Verifying Fabric CA Identity Setup"echo "=========================================="echoecho "1. Compose file:"test -f "$COMPOSE_FILE" && echo "Found: $COMPOSE_FILE"echoecho "2. Docker Compose config:"docker compose -f "$COMPOSE_FILE" config >/tmp/fabric-compose-check.yamlecho "Compose config is valid"echoecho "3. Running containers:"docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"echoecho "4. CA folders:"ls -la fabric-ca/org1 || truels -la fabric-ca/org2 || truels -la fabric-ca/ordererOrg || trueechoecho "5. CA endpoints:"curl -k https://localhost:7054/cainfo || trueechocurl -k https://localhost:8054/cainfo || trueechocurl -k https://localhost:9054/cainfo || trueechoechoecho "6. Org1 identity folders:"test -d organizations/peerOrganizations/org1.blockchain.local/msp && echo "Org1 MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msp && echo "Org1 peer MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls && echo "Org1 peer TLS exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp && echo "Org1 admin exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/appUserOrg1@org1.blockchain.local/msp && echo "Org1 app user exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/blockchain-api-org1-service@org1.blockchain.local/msp && echo "Org1 service identity exists"echoecho "7. Org2 identity folders:"test -d organizations/peerOrganizations/org2.blockchain.local/msp && echo "Org2 MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/msp && echo "Org2 peer MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls && echo "Org2 peer TLS exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp && echo "Org2 admin exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/appUserOrg2@org2.blockchain.local/msp && echo "Org2 app user exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/blockchain-api-org2-service@org2.blockchain.local/msp && echo "Org2 service identity exists"echoecho "8. Orderer identity folders:"test -d organizations/ordererOrganizations/blockchain.local/msp && echo "Orderer org MSP exists"test -d organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msp && echo "Orderer MSP exists"test -d organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls && echo "Orderer TLS exists"test -d organizations/ordererOrganizations/blockchain.local/users/Admin@blockchain.local/msp && echo "Orderer admin exists"echoecho "9. Private keys:"find organizations -path "*keystore*" -type f || trueechoecho "=========================================="echo "Verification completed"echo "=========================================="
Make executable:
chmod +x scripts/verify-identities.sh

15. Create .gitignore
If your Git repo is here:
/home/nix/u01/blockchain-integration
create:
cd /home/nix/u01/blockchain-integrationnano .gitignore
Add:
# Fabric generated crypto materialfabric-network/organizations/fabric-network/fabric-ca/fabric-network/wallet/# Certificates and private keys*.pem*.key*_sk# Docker / local files.env*.log
If your Git repo is inside fabric-network, create:
cd /home/nix/u01/blockchain-integration/fabric-networknano .gitignore
Add:
organizations/fabric-ca/wallet/*.pem*.key*_sk.env*.log

16. Full execution commands
Run this complete sequence:
cd /home/nix/u01/blockchain-integration/fabric-networkchmod +x scripts/*.shdocker network inspect blockchain_net >/dev/null 2>&1 || docker network create blockchain_net./scripts/clean-fabric-containers.shdocker compose -f docker-compose-fabric.yaml config./scripts/start-ca.sh./scripts/register-enroll-org1.sh./scripts/register-enroll-org2.sh./scripts/register-enroll-orderer.sh./scripts/verify-identities.shdocker compose -f docker-compose-fabric.yaml up -ddocker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

17. If you want a clean development reset
Use this only if you want to delete generated certificates and start Step 8 again.
cd /home/nix/u01/blockchain-integration/fabric-network./scripts/clean-fabric-containers.shrm -rf organizationsrm -rf fabric-ca/org1rm -rf fabric-ca/org2rm -rf fabric-ca/ordererOrgrm -rf walletmkdir -p organizationsmkdir -p fabric-ca/org1mkdir -p fabric-ca/org2mkdir -p fabric-ca/ordererOrgmkdir -p wallet/org1mkdir -p wallet/org2./scripts/start-ca.sh./scripts/register-enroll-org1.sh./scripts/register-enroll-org2.sh./scripts/register-enroll-orderer.sh./scripts/verify-identities.shdocker compose -f docker-compose-fabric.yaml up -d

18. Final checklist
Step 8 is complete when these exist:
organizations/peerOrganizations/org1.blockchain.local/msporganizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msporganizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tlsorganizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msporganizations/peerOrganizations/org1.blockchain.local/users/blockchain-api-org1-service@org1.blockchain.local/msporganizations/peerOrganizations/org2.blockchain.local/msporganizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/msporganizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tlsorganizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msporganizations/peerOrganizations/org2.blockchain.local/users/blockchain-api-org2-service@org2.blockchain.local/msporganizations/ordererOrganizations/blockchain.local/msporganizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/msporganizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tlsorganizations/ordererOrganizations/blockchain.local/users/Admin@blockchain.local/msp
Final verification:
./scripts/verify-identities.shdocker compose -f docker-compose-fabric.yaml psdocker ps

19. Production security notes
For development, these passwords are acceptable:
ca-org1-adminpwca-org2-adminpwca-orderer-adminpworg1adminpworg2adminpwordererAdminpw
For production, replace all with strong secrets.
Do not commit:
organizations/fabric-ca/wallet/*.pem*.key*_sk
Recommended production storage:
AWS Secrets ManagerHashiCorp VaultDocker SecretsKubernetes SecretsHSM-backed private key storage
For your architecture, recommended identity model:
Angular user → Spring Boot user/JWT → Blockchain API service identity → Hyperledger Fabric
Use this Fabric identity for backend transactions:
blockchain-api-org1-service
Do not use admin identities for normal application transactions.