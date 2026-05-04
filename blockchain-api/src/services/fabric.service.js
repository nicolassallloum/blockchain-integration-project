"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const grpc = require("@grpc/grpc-js");

const {
  connect,
  hash,
  signers
} = require("@hyperledger/fabric-gateway");

class FabricService {
  constructor() {
    this.connectionProfilePath =
      process.env.FABRIC_CONNECTION_PROFILE ||
      path.resolve(process.cwd(), "config", "connection-org1.json");

    this.walletPath =
      process.env.FABRIC_WALLET_PATH ||
      path.resolve(process.cwd(), "wallet");

    this.identityLabel =
      process.env.FABRIC_IDENTITY_LABEL ||
      "admin";

    this.channelName =
      process.env.FABRIC_CHANNEL_NAME ||
      "kycchannelnix1";

    this.chaincodeName =
      process.env.FABRIC_CHAINCODE_NAME ||
      "kyc-wallet-chaincode-js";

    this.peerName =
      process.env.FABRIC_PEER_NAME ||
      "peer0.org1.blockchain.local";

    this.peerEndpoint =
      process.env.FABRIC_PEER_ENDPOINT ||
      "localhost:7051";

    this.peerTlsHostAlias =
      process.env.FABRIC_PEER_TLS_HOST_ALIAS ||
      "peer0.org1.blockchain.local";

    this.defaultTimeoutMs = Number(
      process.env.FABRIC_DEFAULT_TIMEOUT_MS || 30000
    );
  }

  loadConnectionProfile() {
    if (!fs.existsSync(this.connectionProfilePath)) {
      throw new Error(
        `Fabric connection profile not found: ${this.connectionProfilePath}`
      );
    }

    const rawProfile = fs.readFileSync(this.connectionProfilePath, "utf8");
    return JSON.parse(rawProfile);
  }

  getPeerConfig() {
    const profile = this.loadConnectionProfile();

    if (!profile.peers || !profile.peers[this.peerName]) {
      throw new Error(
        `Peer '${this.peerName}' not found in connection profile.`
      );
    }

    const peer = profile.peers[this.peerName];

    const tlsCertPath =
      peer.tlsCACerts &&
      peer.tlsCACerts.path;

    if (!tlsCertPath) {
      throw new Error(
        `TLS CA certificate path is missing for peer '${this.peerName}'.`
      );
    }

    if (!fs.existsSync(tlsCertPath)) {
      throw new Error(
        `TLS CA certificate file not found: ${tlsCertPath}`
      );
    }

    const grpcOptions = peer.grpcOptions || {};

    return {
      peerName: this.peerName,
      endpoint: this.peerEndpoint,
      tlsCertPath,
      tlsHostAlias:
        grpcOptions["ssl-target-name-override"] ||
        grpcOptions.hostnameOverride ||
        this.peerTlsHostAlias
    };
  }

  loadIdentity() {
    const identityPath = path.join(
      this.walletPath,
      `${this.identityLabel}.id`
    );

    if (!fs.existsSync(identityPath)) {
      throw new Error(
        `Fabric identity '${this.identityLabel}' not found in wallet: ${identityPath}. Run: node scripts/import-admin-identity.js`
      );
    }

    const identity = JSON.parse(fs.readFileSync(identityPath, "utf8"));

    if (!identity.mspId) {
      throw new Error("Wallet identity is missing mspId.");
    }

    if (
      !identity.credentials ||
      !identity.credentials.certificate ||
      !identity.credentials.privateKey
    ) {
      throw new Error(
        "Wallet identity is missing certificate or privateKey."
      );
    }

    return identity;
  }

  createGatewayIdentity(identity) {
    return {
      mspId: identity.mspId,
      credentials: Buffer.from(identity.credentials.certificate)
    };
  }

  createSigner(identity) {
    const privateKey = crypto.createPrivateKey(
      identity.credentials.privateKey
    );

    return signers.newPrivateKeySigner(privateKey);
  }

  createGrpcClient() {
    const peerConfig = this.getPeerConfig();
    const tlsRootCert = fs.readFileSync(peerConfig.tlsCertPath);

    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

    const client = new grpc.Client(
      peerConfig.endpoint,
      tlsCredentials,
      {
        "grpc.ssl_target_name_override": peerConfig.tlsHostAlias,
        "grpc.default_authority": peerConfig.tlsHostAlias
      }
    );

    return client;
  }

  async connectGateway() {
    const client = this.createGrpcClient();
    const walletIdentity = this.loadIdentity();

    const gateway = connect({
      client,
      identity: this.createGatewayIdentity(walletIdentity),
      signer: this.createSigner(walletIdentity),
      hash: hash.sha256,

      evaluateOptions: () => {
        return {
          deadline: Date.now() + this.defaultTimeoutMs
        };
      },

      endorseOptions: () => {
        return {
          deadline: Date.now() + this.defaultTimeoutMs
        };
      },

      submitOptions: () => {
        return {
          deadline: Date.now() + this.defaultTimeoutMs
        };
      },

      commitStatusOptions: () => {
        return {
          deadline: Date.now() + this.defaultTimeoutMs
        };
      }
    });

    return {
      gateway,
      client
    };
  }

  async getContract() {
    const { gateway, client } = await this.connectGateway();

    const network = gateway.getNetwork(this.channelName);
    const contract = network.getContract(this.chaincodeName);

    return {
      gateway,
      client,
      network,
      contract
    };
  }

  normalizeArgs(args) {
    if (!Array.isArray(args)) {
      return [];
    }

    return args.map((arg) => {
      if (arg === null || arg === undefined) {
        return "";
      }

      if (typeof arg === "object") {
        return JSON.stringify(arg);
      }

      return String(arg);
    });
  }

  parseFabricResponse(buffer) {
    if (!buffer) {
      return null;
    }

    const text = Buffer.from(buffer).toString("utf8");

    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  formatFabricError(error) {
    return {
      message: error.message,
      name: error.name,
      code: error.code,
      details: error.details,
      stack:
        process.env.NODE_ENV === "development"
          ? error.stack
          : undefined
    };
  }

  async evaluateTransaction(functionName, args = []) {
    let gateway;
    let client;

    try {
      if (!functionName) {
        throw new Error("functionName is required.");
      }

      const connection = await this.getContract();

      gateway = connection.gateway;
      client = connection.client;

      const normalizedArgs = this.normalizeArgs(args);

      const proposal = connection.contract.newProposal(functionName, {
        arguments: normalizedArgs,
        endorsingOrganizations: ["Org1MSP"]
      });

      const endorsedTransaction = await proposal.endorse();

      const result = endorsedTransaction.getResult();

      const submittedTransaction = await endorsedTransaction.submit();

      const commitStatus = await submittedTransaction.getStatus();

      if (!commitStatus.successful) {
        throw new Error(
          `Transaction ${commitStatus.transactionId} failed to commit with status code ${commitStatus.code}`
        );
      }

      return {
        success: true,
        type: "evaluate",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args: normalizedArgs,
        data: this.parseFabricResponse(result),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        type: "evaluate",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args,
        error: this.formatFabricError(error),
        timestamp: new Date().toISOString()
      };
    } finally {
      if (gateway) {
        gateway.close();
      }

      if (client) {
        client.close();
      }
    }
  }

  async submitTransaction(functionName, args = []) {
    let gateway;
    let client;

    try {
      if (!functionName) {
        throw new Error("functionName is required.");
      }

      const connection = await this.getContract();

      gateway = connection.gateway;
      client = connection.client;

      const normalizedArgs = this.normalizeArgs(args);

      const proposal = connection.contract.newProposal(functionName, {
        arguments: normalizedArgs,
        endorsingOrganizations: ["Org1MSP"]
      });

      const endorsedTransaction = await proposal.endorse();

      const resultBuffer = endorsedTransaction.getResult();

      const submittedTransaction = await endorsedTransaction.submit();

      const commitStatus = await submittedTransaction.getStatus();

      if (!commitStatus.successful) {
        throw new Error(
          `Transaction ${commitStatus.transactionId} failed to commit with status code ${commitStatus.code}`
        );
      }

      return {
        success: true,
        type: "submit",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args: normalizedArgs,
        data: this.parseFabricResponse(resultBuffer),
        commit: {
          transactionId: commitStatus.transactionId,
          successful: commitStatus.successful,
          code: commitStatus.code
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        type: "submit",
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        functionName,
        args,
        error: this.formatFabricError(error),
        timestamp: new Date().toISOString()
      };
    } finally {
      if (gateway) {
        gateway.close();
      }

      if (client) {
        client.close();
      }
    }
  }


  getConnectionInfo() {
    const peerConfig = this.getPeerConfig();
    const identity = this.loadIdentity();

    return {
      success: true,
      fabric: {
        connectionProfilePath: this.connectionProfilePath,
        walletPath: this.walletPath,
        identityLabel: this.identityLabel,
        identityMspId: identity.mspId,
        channelName: this.channelName,
        chaincodeName: this.chaincodeName,
        peerName: peerConfig.peerName,
        peerEndpoint: peerConfig.endpoint,
        peerTlsHostAlias: peerConfig.tlsHostAlias,
        tlsCertPath: peerConfig.tlsCertPath
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new FabricService();
