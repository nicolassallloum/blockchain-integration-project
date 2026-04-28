#!/bin/bash
set -e

PROJECT_PATH="/home/nix/u01/blockchain-integration/fabric-network"
export FABRIC_CA_CLIENT_HOME=${PROJECT_PATH}/organizations/ordererOrganizations/blockchain.local

CA_HOST=localhost
CA_PORT=9054
CA_NAME=ca-orderer
CA_TLS_CERT=${PROJECT_PATH}/fabric-ca/ordererOrg/tls-cert.pem

ORDERER_DOMAIN=blockchain.local

echo "=========================================="
echo "Registering and enrolling Orderer identities"
echo "=========================================="

cd "$PROJECT_PATH"

mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}

echo "1. Enrolling Orderer CA bootstrap admin..."

fabric-ca-client enroll \
  -u https://ca-orderer-admin:ca-orderer-adminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  --tls.certfiles ${CA_TLS_CERT}

echo "2. Creating Orderer MSP config.yaml..."

mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp

cat > organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml <<EOF
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

echo "3. Registering orderer node..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name orderer.blockchain.local \
  --id.secret ordererpw \
  --id.type orderer \
  --tls.certfiles ${CA_TLS_CERT}

echo "4. Registering orderer admin..."

fabric-ca-client register \
  --caname ${CA_NAME} \
  --id.name ordererAdmin \
  --id.secret ordererAdminpw \
  --id.type admin \
  --tls.certfiles ${CA_TLS_CERT}

echo "5. Enrolling orderer MSP..."

fabric-ca-client enroll \
  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp \
  --csr.hosts orderer.blockchain.local \
  --csr.hosts localhost \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/config.yaml

echo "6. Enrolling orderer TLS certificate..."

fabric-ca-client enroll \
  -u https://orderer.blockchain.local:ordererpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls \
  --enrollment.profile tls \
  --csr.hosts orderer.blockchain.local \
  --csr.hosts localhost \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/ca.crt

cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/signcerts/* \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.crt

cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/keystore/* \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/server.key

mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacerts
cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pem

mkdir -p organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacerts
cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/orderers/orderer.blockchain.local/tls/tlscacerts/* \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/tlscacerts/tlsca.${ORDERER_DOMAIN}-cert.pem

echo "7. Enrolling orderer admin MSP..."

fabric-ca-client enroll \
  -u https://ordererAdmin:ordererAdminpw@${CA_HOST}:${CA_PORT} \
  --caname ${CA_NAME} \
  -M ${PROJECT_PATH}/organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp \
  --tls.certfiles ${CA_TLS_CERT}

cp organizations/ordererOrganizations/${ORDERER_DOMAIN}/msp/config.yaml \
   organizations/ordererOrganizations/${ORDERER_DOMAIN}/users/Admin@${ORDERER_DOMAIN}/msp/config.yaml

echo "=========================================="
echo "Orderer identities registered and enrolled"
echo "=========================================="
