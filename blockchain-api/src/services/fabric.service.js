'use strict';

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const grpc = require('@grpc/grpc-js');
const { connect, signers } = require('@hyperledger/fabric-gateway');

const auditService = require('./audit.service');

const {
  AUDIT_EVENT_TYPES,
  AUDIT_EVENT_STATUS,
  AUDIT_EVENT_CATEGORY
} = require('../constants/audit.constants');

class FabricService {
  constructor() {
    this.gateway = null;
    this.client = null;
    this.network = null;
    this.contract = null;
  }

  getConfig() {
    return {
      channelName:
        process.env.FABRIC_CHANNEL_NAME ||
        process.env.CHANNEL_NAME ||
        'kycchannelnix1',

      chaincodeName:
        process.env.FABRIC_CHAINCODE_NAME ||
        process.env.CHAINCODE_NAME ||
        'kyc-wallet-chaincode-js',

      mspId:
        process.env.FABRIC_MSP_ID ||
        process.env.MSP_ID ||
        'Org1MSP',

      peerEndpoint:
        process.env.FABRIC_PEER_ENDPOINT ||
        process.env.PEER_ENDPOINT ||
        process.env.GRPC_PEER_ENDPOINT ||
        'peer0.org1.blockchain.local:7051',

      peerHostAlias:
        process.env.FABRIC_PEER_HOST_ALIAS ||
        process.env.PEER_HOST_ALIAS ||
        process.env.GRPC_PEER_HOST_ALIAS ||
        'peer0.org1.blockchain.local',

      tlsCertPath:
        process.env.FABRIC_TLS_CERT_PATH ||
        process.env.TLS_CERT_PATH ||
        process.env.PEER_TLS_CERT_PATH ||
        process.env.CORE_PEER_TLS_ROOTCERT_FILE ||
        null,

      certPath:
        process.env.FABRIC_CERT_PATH ||
        process.env.CERT_PATH ||
        process.env.IDENTITY_CERT_PATH ||
        null,

      keyDirectoryPath:
        process.env.FABRIC_KEY_DIRECTORY_PATH ||
        process.env.KEY_DIRECTORY_PATH ||
        process.env.PRIVATE_KEY_DIRECTORY_PATH ||
        null,

      evaluateTimeoutMs: Number(
        process.env.FABRIC_EVALUATE_TIMEOUT_MS ||
        process.env.FABRIC_DEFAULT_TIMEOUT_MS ||
        10000
      ),

      endorseTimeoutMs: Number(
        process.env.FABRIC_ENDORSE_TIMEOUT_MS ||
        process.env.FABRIC_DEFAULT_TIMEOUT_MS ||
        30000
      ),

      submitTimeoutMs: Number(
        process.env.FABRIC_SUBMIT_TIMEOUT_MS ||
        process.env.FABRIC_DEFAULT_TIMEOUT_MS ||
        30000
      ),

      commitStatusTimeoutMs: Number(
        process.env.FABRIC_COMMIT_STATUS_TIMEOUT_MS ||
        process.env.FABRIC_DEFAULT_TIMEOUT_MS ||
        60000
      ),
      endorsingOrganizations: String(
        process.env.FABRIC_ENDORSING_ORGS ||
        process.env.FABRIC_ENDORSING_ORGANIZATIONS ||
        process.env.FABRIC_MSP_ID ||
        ''
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
    };
  }

  assertFileExists(filePath, label) {
    if (!filePath) {
      throw new Error(`${label} is not configured`);
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`${label} does not exist: ${filePath}`);
    }
  }

  assertDirectoryExists(directoryPath, label) {
    if (!directoryPath) {
      throw new Error(`${label} is not configured`);
    }

    if (!fs.existsSync(directoryPath)) {
      throw new Error(`${label} does not exist: ${directoryPath}`);
    }

    const stat = fs.statSync(directoryPath);

    if (!stat.isDirectory()) {
      throw new Error(`${label} is not a directory: ${directoryPath}`);
    }
  }

  async newGrpcConnection() {
    const config = this.getConfig();

    this.assertFileExists(config.tlsCertPath, 'FABRIC_TLS_CERT_PATH');

    const tlsRootCert = fs.readFileSync(config.tlsCertPath);
    const tlsCredentials = grpc.credentials.createSsl(tlsRootCert);

    return new grpc.Client(config.peerEndpoint, tlsCredentials, {
      'grpc.ssl_target_name_override': config.peerHostAlias
    });
  }

  async newIdentity() {
    const config = this.getConfig();

    this.assertFileExists(config.certPath, 'FABRIC_CERT_PATH');

    const credentials = fs.readFileSync(config.certPath);

    return {
      mspId: config.mspId,
      credentials
    };
  }

  async newSigner() {
    const config = this.getConfig();

    this.assertDirectoryExists(
      config.keyDirectoryPath,
      'FABRIC_KEY_DIRECTORY_PATH'
    );

    const files = fs
      .readdirSync(config.keyDirectoryPath)
      .filter((file) => !file.startsWith('.'));

    if (!files || files.length === 0) {
      throw new Error(
        `No private key found inside FABRIC_KEY_DIRECTORY_PATH: ${config.keyDirectoryPath}`
      );
    }

    const keyPath = path.join(config.keyDirectoryPath, files[0]);
    const privateKeyPem = fs.readFileSync(keyPath);
    const privateKey = crypto.createPrivateKey(privateKeyPem);

    return signers.newPrivateKeySigner(privateKey);
  }

  async connect() {
    if (this.gateway && this.contract) {
      return {
        gateway: this.gateway,
        client: this.client,
        network: this.network,
        contract: this.contract
      };
    }

    const config = this.getConfig();

    this.client = await this.newGrpcConnection();

    this.gateway = connect({
      client: this.client,
      identity: await this.newIdentity(),
      signer: await this.newSigner(),
      evaluateOptions: () => {
        return { deadline: Date.now() + config.evaluateTimeoutMs };
      },
      endorseOptions: () => {
        return { deadline: Date.now() + config.endorseTimeoutMs };
      },
      submitOptions: () => {
        return { deadline: Date.now() + config.submitTimeoutMs };
      },
      commitStatusOptions: () => {
        return { deadline: Date.now() + config.commitStatusTimeoutMs };
      }
    });

    this.network = this.gateway.getNetwork(config.channelName);
    this.contract = this.network.getContract(config.chaincodeName);

    return {
      gateway: this.gateway,
      client: this.client,
      network: this.network,
      contract: this.contract
    };
  }

  parseBufferResult(buffer) {
    if (!buffer) return null;

    const text = Buffer.from(buffer).toString('utf8');

    if (!text) return null;

    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  normalizeContext(context = {}) {
    return {
      requestId: context.requestId || context.request_id || null,
      correlationId: context.correlationId || context.correlation_id || null,
      sourceSystem:
        context.sourceSystem ||
        context.source_system ||
        'BLOCKCHAIN_API',
      requestSource:
        context.requestSource ||
        context.request_source ||
        'API',
      createdBy:
        context.createdBy ||
        context.created_by ||
        'system'
    };
  }
  normalizeArgs(args = []) {
    if (args === undefined || args === null) {
      return [];
    }

    if (Array.isArray(args)) {
      return args.map((arg) => String(arg));
    }

    return [String(args)];
  }
  async submitTransaction(functionName, args = [], context = {}) {
      const startedAt = Date.now();
      const config = this.getConfig();
      const auditContext = this.normalizeContext(context);

      try {
        await auditService.log({
          ...auditContext,
          eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_REQUEST,
          eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
          eventStatus: AUDIT_EVENT_STATUS.PENDING,
          blockchainFunction: functionName,
          chaincodeName: config.chaincodeName,
          channelName: config.channelName,
          requestPayload: {
            functionName,
            args
          },
          serviceName: 'fabric.service'
        });

        const connection = await this.connect();

        let resultBuffer;
  let transactionId = null;
  let commitStatus = null;

  if (
    connection.contract &&
    typeof connection.contract.newProposal === 'function' &&
    config.endorsingOrganizations &&
    config.endorsingOrganizations.length > 0
  ) {
    const proposal = connection.contract.newProposal(functionName, {
      arguments: this.normalizeArgs(args),
      endorsingOrganizations: config.endorsingOrganizations
    });

    const endorsedProposal = await proposal.endorse();
    const submittedTransaction = await endorsedProposal.submit();

    resultBuffer = endorsedProposal.getResult();

    commitStatus = await submittedTransaction.getStatus();
    transactionId = commitStatus.transactionId || null;

    if (!commitStatus.successful) {
      throw new Error(
        `Transaction commit failed with code ${commitStatus.code} for transaction ${commitStatus.transactionId}`
      );
    }
  } else {
    resultBuffer = await connection.contract.submitTransaction(
      functionName,
      ...this.normalizeArgs(args)
    );
  }

      const parsedResult = this.parseBufferResult(resultBuffer);

      const result = {
        success: true,
        type: 'submit',
        channelName: config.channelName,
        chaincodeName: config.chaincodeName,
        functionName,
        args,
        transactionId,
        txId: transactionId,
        commitStatus,
        data: parsedResult,
        durationMs: Date.now() - startedAt
      };

      await auditService.log({
        ...auditContext,
        eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        blockchainFunction: functionName,
        chaincodeName: config.chaincodeName,
        channelName: config.channelName,
        responsePayload: result,
        durationMs: Date.now() - startedAt,
        serviceName: 'fabric.service'
      });

      return result;
    } catch (error) {
      await auditService.log({
        ...auditContext,
        eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_SUBMIT_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        blockchainFunction: functionName,
        chaincodeName: config.chaincodeName,
        channelName: config.channelName,
        errorCode: error.code || 'FABRIC_SUBMIT_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: {
          functionName,
          args
        },
        durationMs: Date.now() - startedAt,
        serviceName: 'fabric.service'
      });

      throw error;
    }
  }

  async evaluateTransaction(functionName, args = [], context = {}) {
    const startedAt = Date.now();
    const config = this.getConfig();
    const auditContext = this.normalizeContext(context);

    try {
      await auditService.log({
        ...auditContext,
        eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_EVALUATE_REQUEST,
        eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
        eventStatus: AUDIT_EVENT_STATUS.PENDING,
        blockchainFunction: functionName,
        chaincodeName: config.chaincodeName,
        channelName: config.channelName,
        requestPayload: {
          functionName,
          args
        },
        serviceName: 'fabric.service'
      });

      const connection = await this.connect();

      const resultBuffer = await connection.contract.evaluateTransaction(
        functionName,
        ...this.normalizeArgs(args)
      );

      const parsedResult = this.parseBufferResult(resultBuffer);

      const result = {
        success: true,
        type: 'evaluate',
        channelName: config.channelName,
        chaincodeName: config.chaincodeName,
        functionName,
        args,
        data: parsedResult,
        durationMs: Date.now() - startedAt
      };

      await auditService.log({
        ...auditContext,
        eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_EVALUATE_SUCCESS,
        eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
        eventStatus: AUDIT_EVENT_STATUS.SUCCESS,
        blockchainFunction: functionName,
        chaincodeName: config.chaincodeName,
        channelName: config.channelName,
        responsePayload: result,
        durationMs: Date.now() - startedAt,
        serviceName: 'fabric.service'
      });

      return result;
    } catch (error) {
      await auditService.log({
        ...auditContext,
        eventType: AUDIT_EVENT_TYPES.BLOCKCHAIN_EVALUATE_FAILED,
        eventCategory: AUDIT_EVENT_CATEGORY.BLOCKCHAIN,
        eventStatus: AUDIT_EVENT_STATUS.FAILED,
        blockchainFunction: functionName,
        chaincodeName: config.chaincodeName,
        channelName: config.channelName,
        errorCode: error.code || 'FABRIC_EVALUATE_ERROR',
        errorMessage: error.message,
        errorStack: error.stack,
        requestPayload: {
          functionName,
          args
        },
        durationMs: Date.now() - startedAt,
        serviceName: 'fabric.service'
      });

      throw error;
    }
  }
async createPublicAdministration(payload, context = {}) {
    return this.submitTransaction(
      'CreatePublicAdministration',
      [JSON.stringify(payload)],
      context
    );
  }

  async getPublicAdministration(administrationId, context = {}) {
    return this.evaluateTransaction(
      'GetPublicAdministration',
      [administrationId],
      context
    );
  }

  async publicAdministrationExists(administrationId, context = {}) {
    return this.evaluateTransaction(
      'PublicAdministrationExists',
      [administrationId],
      context
    );
  }
  async disconnect() {
    try {
      if (this.gateway) {
        this.gateway.close();
      }

      if (this.client) {
        this.client.close();
      }

      this.gateway = null;
      this.client = null;
      this.network = null;
      this.contract = null;

      return {
        success: true,
        message: 'Fabric gateway disconnected successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

module.exports = new FabricService();