#!/bin/bash
set -e

PROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"
export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/org1.blockchain.local

CA_HOST=localhost
CA_PORT=7054
CA_NAME=ca-org1
CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org1/tls-cert.pem

ORG_DOMAIN=org1.blockchain.local

echo "=========================================="
echo "Registering and enrolling Org1 identities"
echo "=========================================="

cd "$PROJECT_PATH"

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}

echo "1. Enrolling Org1 CA bootstrap admin..."

fabric-ca-client enroll \
  -u https://ca-org1-admin:ca-org1-adminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  --tls.certfiles ${CA_TLS_CERT}

echo "2. Creating Org1 MSP config.yaml..."

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp

cat > organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml <<EOF
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${CA_HOST}-${CA_PORT}-${CA_NAME}.pem
    OrganizationalUnitIdentifier: orderer
EOF

echo "3. Registering Org1 peer..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name peer0.org1.blockchain.local \
  --id.secret peer0org1pw \
  --id.type peer \
  --tls.certfiles ${CA_TLS_CERT} || true

echo "4. Registering Org1 admin..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name org1admin \
  --id.secret org1adminpw \
  --id.type admin \
  --tls.certfiles ${CA_TLS_CERT} || true

echo "5. Registering Org1 application user..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name appUserOrg1 \
  --id.secret appUserOrg1pw \
  --id.type client \
  --tls.certfiles ${CA_TLS_CERT} || true

echo "6. Registering Org1 Blockchain API service identity..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name blockchain-api-org1-service \
  --id.secret blockchainApiOrg1Pw \
  --id.type client \
  --id.attrs 'role=blockchain-api:ecert,department=integration:ecert' \
  --tls.certfiles ${CA_TLS_CERT} || true

echo "7. Enrolling peer0.org1 MSP..."

fabric-ca-client enroll \
  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp \
  --csr.hosts peer0.org1.blockchain.local \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/config.yaml

echo "8. Enrolling peer0.org1 TLS certificate..."

fabric-ca-client enroll \
  -u https://peer0.org1.blockchain.local:peer0org1pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls \
  --enrollment.profile tls \
  --csr.hosts peer0.org1.blockchain.local \
  --csr.hosts localhost \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/ca.crt

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/signcerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.crt

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/keystore/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/server.key

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts/ca.crt

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/tlsca
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pem

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/ca
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org1.blockchain.local/msp/cacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/ca/ca.${ORG_DOMAIN}-cert.pem

echo "9. Enrolling Org1 admin MSP..."

fabric-ca-client enroll \
  -u https://org1admin:org1adminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp/config.yaml

echo "10. Enrolling Org1 application user MSP..."

fabric-ca-client enroll \
  -u https://appUserOrg1:appUserOrg1pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg1@${ORG_DOMAIN}/msp/config.yaml

echo "11. Enrolling Org1 Blockchain API service identity..."

fabric-ca-client enroll \
  -u https://blockchain-api-org1-service:blockchainApiOrg1Pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org1-service@${ORG_DOMAIN}/msp/config.yaml

echo "=========================================="
echo "Org1 identities registered and enrolled"
echo "=========================================="
