// src/services/auditProof.service.js
// Submit only audit proof metadata to Fabric.
// Does NOT submit old_data/new_data or sensitive row content.

const crypto = require('crypto');

function tryRequire(path) {
  try {
    return require(path);
  } catch (err) {
    return null;
  }
}

const fabricService =
  tryRequire('./fabric.service') ||
  tryRequire('./fabricGateway.service') ||
  tryRequire('../services/fabric.service') ||
  tryRequire('../services/fabricGateway.service');

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value ?? ''), 'utf8')
    .digest('hex');
}


function safeJsonValue(value) {
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? val.toString() : val
    )
  );
}

function buildChaincodePayload(eventId, proofPayload) {
  const blockchainKey = `AUDIT_EVENT_PROOF_${eventId}`;

  return {
    auditId: eventId,
    auditEventHash: proofPayload.hash_value,
    blockchainKey,

    // Hash-only metadata. No raw sensitive row data is sent to Fabric.
    schemaHash: sha256(proofPayload.source_schema),
    tableHash: sha256(proofPayload.source_table),
    primaryKeyHash: sha256(proofPayload.record_pk),
    changedFieldsHash: sha256(
      JSON.stringify({
        source_object: proofPayload.source_object,
        action_type: proofPayload.action_type,
        changed_at: proofPayload.changed_at,
        approved_at: proofPayload.approved_at,
      })
    ),

    hashAlgorithm: 'SHA-256',
    hashVersion: '1',
  };
}

function getEndorsingOrganizations() {
  const raw =
    process.env.FABRIC_ENDORSING_ORGS ||
    process.env.FABRIC_ENDORSING_ORGANIZATIONS ||
    'Org1MSP,Org2MSP';

  return raw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

async function submitAuditValidationProof(eventId, proofPayload) {
  if (!fabricService) {
    throw new Error(
      'Fabric service not found. Check src/services/fabric.service.js require path.'
    );
  }

  const chaincodePayload = buildChaincodePayload(eventId, proofPayload);
  const payloadJson = JSON.stringify(chaincodePayload);

  if (typeof fabricService.submitTransaction === 'function') {
    const result = await fabricService.submitTransaction(
      'SaveAuditEventProof',
      [payloadJson],
      {
        endorsingOrganizations: getEndorsingOrganizations(),
      }
    );

    return normalizeFabricResult(result, eventId, chaincodePayload.blockchainKey);
  }

  throw new Error(
    'No compatible Fabric submit function found. Expected fabricService.submitTransaction(functionName, args, context).'
  );
}

function normalizeFabricResult(result, eventId, fallbackLedgerKey) {
  if (!result) {
    return {
      blockchain_tx_id: null,
      ledger_key: fallbackLedgerKey || `AUDIT_EVENT_PROOF_${eventId}`,
      couchdb_doc_id: null,
      raw: safeJsonValue(result),
    };
  }

  if (Buffer.isBuffer(result)) {
    const text = result.toString('utf8');
    try {
      result = JSON.parse(text);
    } catch {
      result = { message: text };
    }
  }

  if (typeof result === 'string') {
    try {
      result = JSON.parse(result);
    } catch {
      result = { message: result };
    }
  }

  return {
    blockchain_tx_id:
      result.txId ||
      result.transactionId ||
      result.blockchain_tx_id ||
      result.tx_id ||
      null,

    ledger_key:
      result.blockchainKey ||
      result.blockchain_key ||
      result.ledgerKey ||
      result.ledger_key ||
      result.key ||
      fallbackLedgerKey ||
      `AUDIT_EVENT_PROOF_${eventId}`,

    couchdb_doc_id:
      result.couchdbDocId ||
      result.couchdb_doc_id ||
      result.id ||
      result.blockchainKey ||
      result.blockchain_key ||
      null,

    raw: safeJsonValue(result),
  };
}

module.exports = { submitAuditValidationProof };
