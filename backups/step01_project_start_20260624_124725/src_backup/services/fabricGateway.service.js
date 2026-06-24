"use strict";

const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");
const { Gateway, Wallets } = require("fabric-network");
const config = require("../../config/config");

async function loadConnectionProfile() {
  const profilePath = config.fabric.connectionProfile;

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Fabric connection profile not found: ${profilePath}`);
  }

  const fileContent = fs.readFileSync(profilePath, "utf8");

  if (profilePath.endsWith(".yaml") || profilePath.endsWith(".yml")) {
    return yaml.load(fileContent);
  }

  return JSON.parse(fileContent);
}

async function getFabricContract() {
  const connectionProfile = await loadConnectionProfile();

  const wallet = await Wallets.newFileSystemWallet(config.fabric.walletPath);

  const identity = await wallet.get(config.fabric.identity);

  if (!identity) {
    throw new Error(
      `Fabric identity '${config.fabric.identity}' not found in wallet path: ${config.fabric.walletPath}`
    );
  }

  const gateway = new Gateway();

  await gateway.connect(connectionProfile, {
    wallet,
    identity: config.fabric.identity,
    discovery: {
      enabled: config.fabric.discovery.enabled,
      asLocalhost: config.fabric.discovery.asLocalhost,
    },
  });

  const network = await gateway.getNetwork(config.fabric.channelName);
  const contract = network.getContract(config.fabric.chaincodeName);

  return {
    gateway,
    network,
    contract,
  };
}

module.exports = {
  getFabricContract,
};