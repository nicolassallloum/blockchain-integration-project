#!/bin/bash
set -e

PROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"
export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/peerOrganizations/org2.blockchain.local

CA_HOST=localhost
CA_PORT=8054
CA_NAME=ca-org2
CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/org2/tls-cert.pem

ORG_DOMAIN=org2.blockchain.local
ORG_MSP_ID=Org2MSP

echo "=========================================="
echo "Registering and enrolling Org2 identities"
echo "=========================================="

cd "$PROJECT_PATH"

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}

echo "1. Enrolling Org2 CA bootstrap admin..."

fabric-ca-client enroll \
  -u https://ca-org2-admin:ca-org2-adminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  --tls.certfiles ${CA_TLS_CERT}

echo "2. Creating Org2 MSP config.yaml..."

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

echo "3. Registering Org2 peer..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name peer0.org2.blockchain.local \
  --id.secret peer0org2pw \
  --id.type peer \
  --tls.certfiles ${CA_TLS_CERT}

echo "4. Registering Org2 admin..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name org2admin \
  --id.secret org2adminpw \
  --id.type admin \
  --tls.certfiles ${CA_TLS_CERT}

echo "5. Registering Org2 application user..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name appUserOrg2 \
  --id.secret appUserOrg2pw \
  --id.type client \
  --tls.certfiles ${CA_TLS_CERT}

echo "6. Registering Org2 Blockchain API service identity..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name blockchain-api-org2-service \
  --id.secret blockchainApiOrg2Pw \
  --id.type client \
  --id.attrs 'role=blockchain-api:ecert,department=integration:ecert' \
  --tls.certfiles ${CA_TLS_CERT}

echo "7. Enrolling peer0.org2 MSP..."

fabric-ca-client enroll \
  -u https://peer0.org2.blockchain.local:peer0org2pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp \
  --csr.hosts peer0.org2.blockchain.local \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp/config.yaml

echo "8. Enrolling peer0.org2 TLS certificate..."

fabric-ca-client enroll \
  -u https://peer0.org2.blockchain.local:peer0org2pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls \
  --enrollment.profile tls \
  --csr.hosts peer0.org2.blockchain.local \
  --csr.hosts localhost \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/ca.crt

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/signcerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/server.crt

cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/keystore/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/server.key

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/msp/tlscacerts/ca.crt

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/tlsca
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/tls/tlscacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/tlsca/tlsca.${ORG_DOMAIN}-cert.pem

mkdir -p organizations/peerOrganizations/${ORG_DOMAIN}/ca
cp organizations/peerOrganizations/${ORG_DOMAIN}/peers/peer0.org2.blockchain.local/msp/cacerts/* \
   organizations/peerOrganizations/${ORG_DOMAIN}/ca/ca.${ORG_DOMAIN}-cert.pem

echo "9. Enrolling Org2 admin MSP..."

fabric-ca-client enroll \
  -u https://org2admin:org2adminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/Admin@${ORG_DOMAIN}/msp/config.yaml

echo "10. Enrolling Org2 application user MSP..."

fabric-ca-client enroll \
  -u https://appUserOrg2:appUserOrg2pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg2@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/appUserOrg2@${ORG_DOMAIN}/msp/config.yaml

echo "11. Enrolling Org2 Blockchain API service identity..."

fabric-ca-client enroll \
  -u https://blockchain-api-org2-service:blockchainApiOrg2Pw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org2-service@${ORG_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/peerOrganizations/${ORG_DOMAIN}/msp/config.yaml \
   organizations/peerOrganizations/${ORG_DOMAIN}/users/blockchain-api-org2-service@${ORG_DOMAIN}/msp/config.yaml

echo "=========================================="
echo "Org2 identities registered and enrolled"
echo "=========================================="
