"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");

const walletPath =
  process.env.FABRIC_WALLET_PATH ||
  path.join(PROJECT_ROOT, "wallet");

const identityLabel =
  process.env.FABRIC_IDENTITY_LABEL ||
  "admin";

const mspId =
  process.env.FABRIC_ORG_MSP_ID ||
  "Org1MSP";

const adminMspPath =
  process.env.FABRIC_ADMIN_MSP_PATH ||
  "/home/nix/u01/blockchain-integration/fabric-network/organizations/peerOrganizations/org1.blockchain.local/users/Admin@org1.blockchain.local/msp";

const certDir = path.join(adminMspPath, "signcerts");
const keyDir = path.join(adminMspPath, "keystore");

function getFirstFile(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`Directory not found: ${directoryPath}`);
  }

  const files = fs.readdirSync(directoryPath).filter((file) => {
    return !file.startsWith(".");
  });

  if (!files.length) {
    throw new Error(`No files found inside: ${directoryPath}`);
  }

  return path.join(directoryPath, files[0]);
}

function main() {
  console.log("==================================================");
  console.log("Importing Fabric Admin Identity");
  console.log("==================================================");

  const certPath = getFirstFile(certDir);
  const keyPath = getFirstFile(keyDir);

  const certificate = fs.readFileSync(certPath, "utf8");
  const privateKey = fs.readFileSync(keyPath, "utf8");

  const identity = {
    label: identityLabel,
    mspId,
    credentials: {
      certificate,
      privateKey
    },
    type: "X.509"
  };

  if (!fs.existsSync(walletPath)) {
    fs.mkdirSync(walletPath, { recursive: true });
  }

  const identityFilePath = path.join(walletPath, `${identityLabel}.id`);
  fs.writeFileSync(identityFilePath, JSON.stringify(identity, null, 2));

  console.log(`Identity label  : ${identityLabel}`);
  console.log(`MSP ID          : ${mspId}`);
  console.log(`Wallet path     : ${walletPath}`);
  console.log(`Identity file   : ${identityFilePath}`);
  console.log("Admin identity imported successfully.");
}

try {
  main();
} catch (error) {
  console.error("Failed to import Fabric identity.");
  console.error(error.message);
  process.exit(1);
}
