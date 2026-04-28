STEP 8 — Fabric CA / Identity Management Setup
1. Why Fabric CA is needed
Hyperledger Fabric is a permissioned blockchain. Every participant must have a cryptographic identity issued by a trusted Certificate Authority.
Fabric CA provides:
Identity registrationIdentity enrollmentX.509 certificate issuanceTLS certificate issuanceCertificate renewalCertificate revocationMSP generation
Fabric CA supports registration of identities, enrollment certificates, renewal, and revocation. 
In Fabric, the MSP is the mechanism that tells peers/orderers which certificate authorities and identities are trusted. A member must have an identity issued by a CA trusted by the organization MSP. 

2. Target identity architecture
Your network will use this structure:
Blockchain Network│├── Orderer Organization│   ├── ca.orderer.blockchain.local│   ├── ordererAdmin│   └── orderer.blockchain.local│├── Org1│   ├── ca.org1.blockchain.local│   ├── org1admin│   ├── peer0.org1.blockchain.local│   ├── appUserOrg1│   └── blockchain-api-org1-service│└── Org2    ├── ca.org2.blockchain.local    ├── org2admin    ├── peer0.org2.blockchain.local    ├── appUserOrg2    └── blockchain-api-org2-service
Recommended identity types:
IdentityOrganizationTypePurposeorg1adminOrg1adminOrg1 admin operationsorg2adminOrg2adminOrg2 admin operationsordererAdminOrdererMSPadminOrderer admin operationspeer0.org1.blockchain.localOrg1peerOrg1 peer certificatepeer0.org2.blockchain.localOrg2peerOrg2 peer certificateorderer.blockchain.localOrdererMSPordererOrderer certificateblockchain-api-org1-serviceOrg1clientBackend API service identityblockchain-api-org2-serviceOrg2clientBackend API service identityappUserOrg1Org1clientApplication user test identityappUserOrg2Org2clientApplication user test identity

3. Updated project folder structure
Create this structure inside your project:
cd /home/nix/u01/blockchain-integrationmkdir -p fabric-networkmkdir -p fabric-network/organizationsmkdir -p fabric-network/fabric-camkdir -p fabric-network/fabric-ca/org1mkdir -p fabric-network/fabric-ca/org2mkdir -p fabric-network/fabric-ca/ordererOrgmkdir -p fabric-network/scriptsmkdir -p fabric-network/wallet
Expected final structure:
/home/nix/u01/blockchain-integration└── fabric-network    ├── docker-compose.yaml    ├── organizations    │   ├── peerOrganizations    │   │   ├── org1.blockchain.local    │   │   └── org2.blockchain.local    │   └── ordererOrganizations    │       └── blockchain.local    ├── fabric-ca    │   ├── org1    │   ├── org2    │   └── ordererOrg    ├── scripts    │   ├── start-ca.sh    │   ├── register-enroll-org1.sh    │   ├── register-enroll-org2.sh    │   ├── register-enroll-orderer.sh    │   ├── register-app-users.sh    │   └── verify-identities.sh    └── wallet        ├── org1        └── org2

4. Add Fabric CA services to your Docker Compose
Add these volumes to your existing volumes: section:
  ca.org1.blockchain.local:  ca.org2.blockchain.local:  ca.orderer.blockchain.local:
Then add these services under your existing services: section.

4.1 Org1 Fabric CA
  ca.org1.blockchain.local:    container_name: ca.org1.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-org1      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=7054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:17054    ports:      - "7054:7054"      - "17054:17054"    command: sh -c 'fabric-ca-server start -b ca-org1-admin:ca-org1-adminpw -d'    volumes:      - ./fabric-ca/org1:/etc/hyperledger/fabric-ca-server      - ca.org1.blockchain.local:/var/hyperledger/production    networks:      blockchain_net:        aliases:          - ca.org1.blockchain.local

4.2 Org2 Fabric CA
  ca.org2.blockchain.local:    container_name: ca.org2.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-org2      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=8054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:18054    ports:      - "8054:8054"      - "18054:18054"    command: sh -c 'fabric-ca-server start -b ca-org2-admin:ca-org2-adminpw -d'    volumes:      - ./fabric-ca/org2:/etc/hyperledger/fabric-ca-server      - ca.org2.blockchain.local:/var/hyperledger/production    networks:      blockchain_net:        aliases:          - ca.org2.blockchain.local

4.3 Orderer Fabric CA
  ca.orderer.blockchain.local:    container_name: ca.orderer.blockchain.local    image: hyperledger/fabric-ca:latest    environment:      - FABRIC_CA_HOME=/etc/hyperledger/fabric-ca-server      - FABRIC_CA_SERVER_CA_NAME=ca-orderer      - FABRIC_CA_SERVER_TLS_ENABLED=true      - FABRIC_CA_SERVER_PORT=9054      - FABRIC_CA_SERVER_OPERATIONS_LISTENADDRESS=0.0.0.0:19054    ports:      - "9054:9054"      - "19054:19054"    command: sh -c 'fabric-ca-server start -b ca-orderer-admin:ca-orderer-adminpw -d'    volumes:      - ./fabric-ca/ordererOrg:/etc/hyperledger/fabric-ca-server      - ca.orderer.blockchain.local:/var/hyperledger/production    networks:      blockchain_net:        aliases:          - ca.orderer.blockchain.local

5. Start Fabric CA services
Create this file:
nano /home/nix/u01/blockchain-integration/fabric-network/scripts/start-ca.sh
Add:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"echo "=========================================="echo "Starting Fabric CA services"echo "Project Path: $PROJECT_PATH"echo "=========================================="cd "$PROJECT_PATH"docker compose up -d ca.org1.blockchain.local ca.org2.blockchain.local ca.orderer.blockchain.localechoecho "Waiting for Fabric CA containers..."sleep 5docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "ca."echoecho "Testing CA endpoints..."curl -k https://localhost:7054/cainfo || trueechocurl -k https://localhost:8054/cainfo || trueechocurl -k https://localhost:9054/cainfo || trueechoecho "=========================================="echo "Fabric CA services started successfully"echo "=========================================="
Make it executable:
chmod +x /home/nix/u01/blockchain-integration/fabric-network/scripts/start-ca.sh
Run:
cd /home/nix/u01/blockchain-integration/fabric-network./scripts/start-ca.sh

6. Register and enroll Org1 identities
Create:
nano /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-org1.sh
Add:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/org1.blockchain.localCA_HOST=localhostCA_PORT=7054CA_NAME=ca-org1CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/tls-cert.pemORG_DOMAIN=org1.blockchain.localORG_MSP_ID=Org1MSPecho "=========================================="echo "Registering and enrolling Org1 identities"echo "=========================================="cd "$PROJECT_PATH"mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}echo "1. Enrolling Org1 CA bootstrap admin..."fabric-ca-client enroll \  -u https://ca-org1-admin:ca-org1-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}echo "2. Creating Org1 MSP config.yaml..."mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/mspcat > organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml <<EOFNodeOUs:  Enable: true  ClientOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: client  PeerOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: peer  AdminOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: admin  OrdererOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: ordererEOFecho "3. Registering Org1 peer..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name peer0.org1.blockchain.local \  --id.secret peer0org1pw \  --id.type peer \  --tls.certfiles ${CA_TLS_CERT}echo "4. Registering Org1 admin..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name org1admin \  --id.secret org1adminpw \  --id.type admin \  --tls.certfiles ${CA_TLS_CERT}echo "5. Registering Org1 application user..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name appUserOrg1 \  --id.secret appUserOrg1pw \  --id.type client \  --tls.certfiles ${CA_TLS_CERT}echo "6. Registering Org1 Blockchain API service identity..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name blockchain-api-org1-service \  --id.secret blockchainApiOrg1Pw \  --id.type client \  --id.attrs 'role=blockchain-api:ecert,department=integration:ecert' \  --tls.certfiles ${CA_TLS_CERT}echo "7. Enrolling peer0.org1 MSP..."fabric-ca-client enroll \  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp \  --csr.hosts peer0.org1.blockchain.local \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/config.yamlecho "8. Enrolling peer0.org1 TLS certificate..."fabric-ca-client enroll \  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls \  --enrollment.profile tls \  --csr.hosts peer0.org1.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/ca.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/signcerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/keystore/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.keymkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacertscp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts/ca.crtmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/tlscacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pemmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/cacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/cacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/ca/ca.${ORG_DOMAIN}-cert.pemecho "9. Enrolling Org1 admin MSP..."fabric-ca-client enroll \  -u https://org1admin:org1adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp/config.yamlecho "10. Enrolling Org1 application user MSP..."fabric-ca-client enroll \  -u https://appUserOrg1:appUserOrg1pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp/config.yamlecho "11. Enrolling Org1 Blockchain API service identity..."fabric-ca-client enroll \  -u https://blockchain-api-org1-service:blockchainApiOrg1Pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp/config.yamlecho "=========================================="echo "Org1 identities registered and enrolled"echo "=========================================="
Make executable:
chmod +x /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-org1.sh
Run:
cd /home/nix/u01/blockchain-integration/fabric-network./scripts/register-enroll-org1.sh

7. Register and enroll Org2 identities
Create:
nano /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-org2.sh
Add:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/org2.blockchain.localCA_HOST=localhostCA_PORT=8054CA_NAME=ca-org2CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org2/tls-cert.pemORG_DOMAIN=org2.blockchain.localORG_MSP_ID=Org2MSPecho "=========================================="echo "Registering and enrolling Org2 identities"echo "=========================================="cd "$PROJECT_PATH"mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}echo "1. Enrolling Org2 CA bootstrap admin..."fabric-ca-client enroll \  -u https://ca-org2-admin:ca-org2-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}echo "2. Creating Org2 MSP config.yaml..."mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/mspcat > organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml <<EOFNodeOUs:  Enable: true  ClientOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: client  PeerOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: peer  AdminOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: admin  OrdererOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: ordererEOFecho "3. Registering Org2 peer..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name peer0.org2.blockchain.local \  --id.secret peer0org2pw \  --id.type peer \  --tls.certfiles ${CA_TLS_CERT}echo "4. Registering Org2 admin..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name org2admin \  --id.secret org2adminpw \  --id.type admin \  --tls.certfiles ${CA_TLS_CERT}echo "5. Registering Org2 application user..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name appUserOrg2 \  --id.secret appUserOrg2pw \  --id.type client \  --tls.certfiles ${CA_TLS_CERT}echo "6. Registering Org2 Blockchain API service identity..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name blockchain-api-org2-service \  --id.secret blockchainApiOrg2Pw \  --id.type client \  --id.attrs 'role=blockchain-api:ecert,department=integration:ecert' \  --tls.certfiles ${CA_TLS_CERT}echo "7. Enrolling peer0.org2 MSP..."fabric-ca-client enroll \  -u https://peer0.org2.blockchain.local:peer0org2pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp \  --csr.hosts peer0.org2.blockchain.local \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp/config.yamlecho "8. Enrolling peer0.org2 TLS certificate..."fabric-ca-client enroll \  -u https://peer0.org2.blockchain.local:peer0org2pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls \  --enrollment.profile tls \  --csr.hosts peer0.org2.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/ca.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/signcerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/server.crtcp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/keystore/* \   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/server.keymkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacertscp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts/ca.crtmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/tlscacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pemmkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/cacp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp/cacerts/* \   organizations/peerOrganizations/${ORG_DOMAIN}/ca/ca.${ORG_DOMAIN}-cert.pemecho "9. Enrolling Org2 admin MSP..."fabric-ca-client enroll \  -u https://org2admin:org2adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp/config.yamlecho "10. Enrolling Org2 application user MSP..."fabric-ca-client enroll \  -u https://appUserOrg2:appUserOrg2pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg2@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg2@${ORG_DOMAIN}/msp/config.yamlecho "11. Enrolling Org2 Blockchain API service identity..."fabric-ca-client enroll \  -u https://blockchain-api-org2-service:blockchainApiOrg2Pw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org2-service@${ORG_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \   organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org2-service@${ORG_DOMAIN}/msp/config.yamlecho "=========================================="echo "Org2 identities registered and enrolled"echo "=========================================="
Run:
chmod +x /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-org2.shcd /home/nix/u01/blockchain-integration/fabric-network./scripts/register-enroll-org2.sh

8. Register and enroll Orderer identities
Create:
nano /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-orderer.sh
Add:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/ordererOrganizations/blockchain.localCA_HOST=localhostCA_PORT=9054CA_NAME=ca-ordererCA_TLS_CERT=${PROJECT_PATH}/fabric-ca/ordererOrg/tls-cert.pemORDERER_DOMAIN=blockchain.localecho "=========================================="echo "Registering and enrolling Orderer identities"echo "=========================================="cd "$PROJECT_PATH"mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}echo "1. Enrolling Orderer CA bootstrap admin..."fabric-ca-client enroll \  -u https://ca-orderer-admin:ca-orderer-adminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  --tls.certfiles ${CA_TLS_CERT}echo "2. Creating Orderer MSP config.yaml..."mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/mspcat > organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml <<EOFNodeOUs:  Enable: true  ClientOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: client  PeerOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: peer  AdminOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: admin  OrdererOUIdentifier:    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem    OrganizationalUnitIdentifier: ordererEOFecho "3. Registering orderer node..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name orderer.blockchain.local \  --id.secret ordererpw \  --id.type orderer \  --tls.certfiles ${CA_TLS_CERT}echo "4. Registering orderer admin..."fabric-ca-client register \  --caname ${CA_NAME} \  --id.name ordererAdmin \  --id.secret ordererAdminpw \  --id.type admin \  --tls.certfiles ${CA_TLS_CERT}echo "5. Enrolling orderer MSP..."fabric-ca-client enroll \  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp \  --csr.hosts orderer.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/config.yamlecho "6. Enrolling orderer TLS certificate..."fabric-ca-client enroll \  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls \  --enrollment.profile tls \  --csr.hosts orderer.blockchain.local \  --csr.hosts localhost \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/ca.crtcp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/signcerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.crtcp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/keystore/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.keymkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacertscp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pemmkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacertscp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pemecho "7. Enrolling orderer admin MSP..."fabric-ca-client enroll \  -u https://ordererAdmin:ordererAdminpw@${CA_HOST}:${CA_PORT} \  --caname ${CA_NAME} \  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp \  --tls.certfiles ${CA_TLS_CERT}cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \   organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp/config.yamlecho "=========================================="echo "Orderer identities registered and enrolled"echo "=========================================="
Run:
chmod +x /home/nix/u01/blockchain-integration/fabric-network/scripts/register-enroll-orderer.shcd /home/nix/u01/blockchain-integration/fabric-network./scripts/register-enroll-orderer.sh

9. Full execution order
Run in this order:
cd /home/nix/u01/blockchain-integration/fabric-network./scripts/start-ca.sh./scripts/register-enroll-org1.sh./scripts/register-enroll-org2.sh./scripts/register-enroll-orderer.sh
Then restart your network containers so peers/orderer read the newly generated MSP/TLS folders:
docker compose downdocker compose up -d \  orderer.blockchain.local \  couchdb0.org1 \  peer0.org1.blockchain.local \  couchdb0.org2 \  peer0.org2.blockchain.local
Check:
docker ps

10. MSP folder explanation
Each Fabric identity contains an MSP folder.
Typical MSP folder:
msp├── cacerts├── keystore├── signcerts├── tlscacerts└── config.yaml
FolderPurposecacertsCA root certificate used to validate enrollment certificateskeystorePrivate key of the identitysigncertsPublic X.509 certificate of the identitytlscacertsTLS CA certificateconfig.yamlDefines NodeOU roles: admin, peer, client, orderer
The MSP is not a server. It is a folder-based trust configuration used by peers, orderers, admins, and applications to prove identity and authorization. The Fabric documentation describes MSP as the component that defines identity rules and trust. 

11. Wallet identity storage strategy
For your Blockchain Integration Project, use this strategy:
Fabric CA Identity        ↓MSP folder        ↓Application Wallet        ↓Blockchain API / Middleware        ↓Transaction signing
Recommended wallet folders:
/home/nix/u01/blockchain-integration/fabric-network/wallet├── org1│   ├── blockchain-api-org1-service.id│   └── appUserOrg1.id└── org2    ├── blockchain-api-org2-service.id    └── appUserOrg2.id
For production, do not store private keys in a public Git repository.
Use:
Linux filesystem permissionsDocker secretsHashiCorp VaultAWS Secrets ManagerAzure Key VaultHSM-backed key storage
For your current local setup, filesystem wallet is acceptable.
Recommended permissions:
chmod -R 700 /home/nix/u01/blockchain-integration/fabric-network/walletchmod -R 700 /home/nix/u01/blockchain-integration/fabric-network/organizations

12. Service identity setup
Your Spring Boot or Blockchain API should not use the admin identity for normal transactions.
Use this identity instead:
blockchain-api-org1-service
Purpose:
Submit wallet creation transactionsSubmit wallet-to-wallet transactionsQuery balancesQuery transaction historyListen to Fabric eventsSync data to PostgreSQL
Recommended access model:
OperationIdentityRegister usersCA admin onlyEnroll usersCA admin or controlled backend processSubmit transactionsblockchain-api-org1-serviceQuery ledgerblockchain-api-org1-service or user identityChaincode lifecycleOrg adminPeer/orderer operationsPeer/orderer admin

13. Application user registration and enrollment
For normal users, you have two options.
Option A — One Fabric service identity for all app users
Recommended for your current architecture:
Angular user logs in        ↓Spring Boot validates user        ↓Blockchain API signs Fabric transaction using service identity        ↓Ledger stores business user ID, wallet address, and transaction ID
Best for:
Enterprise systemsSpring Boot controlled accessPostgreSQL user managementJWT authenticationAudit trailCentralized security
Option B — One Fabric identity per application user
Use only if every customer must sign blockchain transactions directly.
Example:
fabric-ca-client register \  --caname ca-org1 \  --id.name customer1001 \  --id.secret customer1001pw \  --id.type client \  --id.attrs 'role=customer:ecert' \  --tls.certfiles /home/nix/u01/blockchain-integration/fabric-network/fabric-ca/org1/tls-cert.pem
Enroll:
fabric-ca-client enroll \  -u https://customer1001:customer1001pw@localhost:7054 \  --caname ca-org1 \  -M /home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/customer1001@org1.blockchain.local/msp \  --tls.certfiles /home/nix/u01/blockchain-integration/fabric-network/fabric-ca/org1/tls-cert.pem
For your project, I recommend Option A for now:
Application users stay in PostgreSQL / Spring BootFabric uses service identitiesBusiness user IDs are written to ledger as transaction data

14. Identity lifecycle
Production lifecycle:
1. Register identity2. Enroll identity3. Store MSP / wallet securely4. Use identity to sign transactions5. Rotate certificates before expiration6. Revoke identity if compromised7. Update CRL if needed8. Audit all identity usage
Fabric CA supports registration, enrollment, renewal, and revocation. 
Recommended lifecycle table:
StageActionOwnerRegistrationCreate identity in CACA adminEnrollmentGenerate cert/private keyAdmin or identity ownerStorageStore MSP/wallet securelyDevOps/securityUsageSign Fabric transactionsBlockchain APIRenewalRenew before expiryDevOps/securityRevocationDisable compromised identityCA adminAuditTrack use of identitySecurity/admin

15. Verification script
Create:
nano /home/nix/u01/blockchain-integration/fabric-network/scripts/verify-identities.sh
Add:
#!/bin/bashset -ePROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"echo "=========================================="echo "Verifying Fabric CA Identity Setup"echo "=========================================="cd "$PROJECT_PATH"echoecho "1. Checking CA containers..."docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "ca." || trueechoecho "2. Checking CA endpoints..."curl -k https://localhost:7054/cainfo || trueechocurl -k https://localhost:8054/cainfo || trueechocurl -k https://localhost:9054/cainfo || trueechoechoecho "3. Checking Org1 MSP..."test -d organizations/peerOrganizations/org1.blockchain.local/msp && echo "Org1 MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp && echo "Org1 Admin MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/appUserOrg1@org1.blockchain.local/msp && echo "Org1 App User MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/users/blockchain-api-org1-service@org1.blockchain.local/msp && echo "Org1 Service MSP exists"test -d organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls && echo "Org1 Peer TLS exists"echoecho "4. Checking Org2 MSP..."test -d organizations/peerOrganizations/org2.blockchain.local/msp && echo "Org2 MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/Admin@org2.blockchain.local/msp && echo "Org2 Admin MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/appUserOrg2@org2.blockchain.local/msp && echo "Org2 App User MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/users/blockchain-api-org2-service@org2.blockchain.local/msp && echo "Org2 Service MSP exists"test -d organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/tls && echo "Org2 Peer TLS exists"echoecho "5. Checking Orderer MSP..."test -d organizations/ordererOrganizations/blockchain.local/msp && echo "Orderer Org MSP exists"test -d organizations/ordererOrganizations/blockchain.local/users/Admin@blockchain.local/msp && echo "Orderer Admin MSP exists"test -d organizations/ordererOrganizations/blockchain.local/orderers/orderer.blockchain.local/tls && echo "Orderer TLS exists"echoecho "6. Checking private keys..."find organizations -path "*keystore*" -type fechoecho "=========================================="echo "Identity verification completed"echo "=========================================="
Run:
chmod +x /home/nix/u01/blockchain-integration/fabric-network/scripts/verify-identities.shcd /home/nix/u01/blockchain-integration/fabric-network./scripts/verify-identities.sh

16. Important production security best practices
Do not use weak secrets in production
Current examples:
org1adminpworg2adminpwadminpw
For production, replace with strong secrets:
Minimum 20 charactersUppercaseLowercaseNumbersSymbolsStored in secret managerNever committed to Git

Do not expose CA ports publicly
Current local ports:
705480549054
In production:
Restrict with firewallExpose only to admin subnetUse TLS onlyDisable public internet accessMonitor CA logs

Separate CA and TLS CA in production
For local development, one CA can issue both enrollment and TLS certificates.
For production, better architecture:
ca.org1.blockchain.local       → enrollment certificatestlsca.org1.blockchain.local    → TLS certificatesca.org2.blockchain.local       → enrollment certificatestlsca.org2.blockchain.local    → TLS certificatesca.orderer.blockchain.local    → enrollment certificatestlsca.orderer.blockchain.local → TLS certificates

Do not use latest image tag in production
Your current Compose uses latest for Fabric images. For production, pin versions:
image: hyperledger/fabric-ca:1.5image: hyperledger/fabric-peer:2.5image: hyperledger/fabric-orderer:2.5
Using fixed versions prevents unexpected changes after Docker pulls.

Protect private keys
Private keys are stored under:
organizations/**/msp/keystore
Secure them:
chmod -R 700 organizationschown -R nix:nix organizations
Never run:
git add organizationsgit add fabric-cagit add wallet
Add to .gitignore:
fabric-network/organizations/fabric-network/fabric-ca/fabric-network/wallet/*.pem*.key*_sk

17. Common errors and fixes
Error: fabric-ca-client: command not found
Fix:
export PATH=$PATH:/home/nix/u01/blockchain-integration/fabric/bin
Verify:
which fabric-ca-clientfabric-ca-client version

Error: tls-cert.pem no such file
Cause: CA container did not start or volume path is wrong.
Fix:
cd /home/nix/u01/blockchain-integration/fabric-networkdocker compose logs ca.org1.blockchain.localls -l fabric-ca/org1
Restart CA:
docker compose up -d ca.org1.blockchain.local

Error: Authentication failure
Cause: wrong bootstrap admin password.
Fix:
docker compose down -vrm -rf fabric-ca/org1 fabric-ca/org2 fabric-ca/ordererOrg
Then start CA again:
./scripts/start-ca.sh

Error: identity already registered
This means the CA database already contains the identity.
You can continue with enrollment, or reset CA data for development:
docker compose down -vrm -rf fabric-ca/org1 fabric-ca/org2 fabric-ca/ordererOrg organizations
Then rerun:
./scripts/start-ca.sh./scripts/register-enroll-org1.sh./scripts/register-enroll-org2.sh./scripts/register-enroll-orderer.sh

Error: peer cannot find MSP
Check your Compose mount paths. Your current peer services mount MSP folders from:
../organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msp../organizations/peerOrganizations/org2.blockchain.local/peers/peer0.org2.blockchain.local/msp
But the scripts above create:
/home/nix/u01/blockchain-integration/fabric-network/organizations/...
So if your docker-compose.yaml is inside:
/home/nix/u01/blockchain-integration/fabric-network
then update your peer/orderer volume paths from:
../organizations/...
to:
./organizations/...
Example:
volumes:  - ./organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/msp:/etc/hyperledger/fabric/msp  - ./organizations/peerOrganizations/org1.blockchain.local/peers/peer0.org1.blockchain.local/tls:/etc/hyperledger/fabric/tls
This is important because your attached Compose currently uses ../organizations/..., which means it expects organizations to exist one level above the Compose file. 

18. Final Step 8 checklist
After finishing Step 8, this must be true:
[ ] Fabric CA Org1 is running[ ] Fabric CA Org2 is running[ ] Fabric CA Orderer is running[ ] Org1 admin registered and enrolled[ ] Org2 admin registered and enrolled[ ] Orderer admin registered and enrolled[ ] Org1 peer registered and enrolled[ ] Org2 peer registered and enrolled[ ] Orderer registered and enrolled[ ] Org1 application user enrolled[ ] Org2 application user enrolled[ ] Org1 Blockchain API service identity enrolled[ ] Org2 Blockchain API service identity enrolled[ ] MSP folders generated[ ] TLS folders generated[ ] config.yaml NodeOUs created[ ] Private keys protected[ ] Compose volume paths aligned with generated organizations folder
Run this final verification:
cd /home/nix/u01/blockchain-integration/fabric-network./scripts/verify-identities.shdocker compose up -ddocker ps
Step 8 is complete when all CA services are healthy and the following folders exist:
organizations/peerOrganizations/org1.blockchain.localorganizations/peerOrganizations/org2.blockchain.localorganizations/ordererOrganizations/blockchain.local
