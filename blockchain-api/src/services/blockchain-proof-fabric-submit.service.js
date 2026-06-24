const SERVICE_NAME = 'postgres-blockchain-proof-sync-service';

function loadFabricService() {
  const candidates = [
    './fabricGateway.service',
    './fabric.service',
    './blockchain.service'
  ];

  const loaded = [];

  for (const candidate of candidates) {
    try {
      const service = require(candidate);
      loaded.push({
        name: candidate,
        service,
        keys: Object.keys(service || {})
      });
    } catch (error) {
      loaded.push({
        name: candidate,
        error: error.message,
        keys: []
      });
    }
  }

  return loaded;
}

function getFabricServiceDiagnostics() {
  return loadFabricService().map((item) => ({
    service: item.name,
    loaded: Boolean(item.service),
    keys: item.keys,
    error: item.error || null
  }));
}

function extractTransactionId(result) {
  if (!result) {
    return null;
  }

  if (typeof result === 'string') {
    try {
      const parsed = JSON.parse(result);
      return parsed.txId || parsed.transactionId || parsed.transaction_id || null;
    } catch (_) {
      return null;
    }
  }

  if (Buffer.isBuffer(result)) {
    try {
      const parsed = JSON.parse(result.toString());
      return parsed.txId || parsed.transactionId || parsed.transaction_id || null;
    } catch (_) {
      return null;
    }
  }

  if (typeof result === 'object') {
    return result.txId ||
      result.transactionId ||
      result.transaction_id ||
      result.fabricTxId ||
      result.fabricTransactionId ||
      null;
  }

  return null;
}

async function callPossibleMethod(service, methodName, functionName, args) {
  if (!service || typeof service[methodName] !== 'function') {
    return null;
  }

  const attempts = [
    () => service[methodName](functionName, args),
    () => service[methodName](functionName, ...args),
    () => service[methodName]('kycchannelnix1', 'kyc-wallet-chaincode-js', functionName, args),
    () => service[methodName]('kyc-wallet-chaincode-js', functionName, args)
  ];

  let lastError = null;

  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

async function submitTransaction(functionName, args) {
  const loadedServices = loadFabricService();
  const methodNames = [
    'submitTransaction',
    'invokeTransaction',
    'invoke',
    'submit',
    'executeTransaction'
  ];

  const errors = [];

  for (const loaded of loadedServices) {
    if (!loaded.service) {
      errors.push({
        service: loaded.name,
        error: loaded.error
      });
      continue;
    }

    for (const methodName of methodNames) {
      try {
        const result = await callPossibleMethod(
          loaded.service,
          methodName,
          functionName,
          args
        );

        if (result !== null && result !== undefined) {
          return {
            service: loaded.name,
            method: methodName,
            result,
            transactionId: extractTransactionId(result)
          };
        }
      } catch (error) {
        errors.push({
          service: loaded.name,
          method: methodName,
          error: error.message
        });
      }
    }

    if (loaded.service.contract && typeof loaded.service.contract.submitTransaction === 'function') {
      try {
        const result = await loaded.service.contract.submitTransaction(functionName, ...args);

        return {
          service: loaded.name,
          method: 'contract.submitTransaction',
          result,
          transactionId: extractTransactionId(result)
        };
      } catch (error) {
        errors.push({
          service: loaded.name,
          method: 'contract.submitTransaction',
          error: error.message
        });
      }
    }
  }

  throw new Error(
    `No working Fabric submit method found. Diagnostics: ${JSON.stringify({
      availableServices: getFabricServiceDiagnostics(),
      errors
    })}`
  );
}

function buildMetadataJson(metadata = {}) {
  const safeMetadata = {
    proofOnly: true,
    sourceSystem: 'PostgreSQL',
    submittedByService: SERVICE_NAME,
    ...metadata
  };

  const metadataText = JSON.stringify(safeMetadata).toLowerCase();

  const blockedTerms = [
    'password',
    'token',
    'secret',
    'authorization',
    'raw_payload',
    'raw_record',
    'full_data',
    'personal_entity',
    'photo'
  ];

  for (const term of blockedTerms) {
    if (metadataText.includes(term)) {
      throw new Error(`Sensitive metadata blocked before blockchain submission: ${term}`);
    }
  }

  return JSON.stringify(safeMetadata);
}

function buildSaveBlockchainProofArgs(proof) {
  return [
    proof.blockchainKey,
    proof.recordType,
    proof.sourceRecordId,
    proof.stableHash,
    proof.actionType,
    String(proof.postgresHistoryId || ''),
    proof.submittedBy || SERVICE_NAME,
    buildMetadataJson(proof.metadata || {})
  ];
}

async function submitBlockchainProof(proof, options = {}) {
  const dryRun = options.dryRun !== false;

  const args = buildSaveBlockchainProofArgs(proof);

  const payload = {
    functionName: 'SaveBlockchainProof',
    args,
    proofOnly: true,
    dryRun
  };

  if (dryRun) {
    return {
      submitted: false,
      dryRun: true,
      message: 'Dry run only. No blockchain transaction was submitted.',
      payload
    };
  }

  const result = await submitTransaction('SaveBlockchainProof', args);

  return {
    submitted: true,
    dryRun: false,
    message: 'Blockchain proof submitted successfully',
    payload,
    fabric: {
      service: result.service,
      method: result.method,
      transactionId: result.transactionId,
      rawResult: Buffer.isBuffer(result.result)
        ? result.result.toString()
        : result.result
    }
  };
}

module.exports = {
  SERVICE_NAME,
  getFabricServiceDiagnostics,
  buildMetadataJson,
  buildSaveBlockchainProofArgs,
  submitBlockchainProof
};
