"use strict";

const db = require("../config/database");
const fabricService = require("./fabric.service");

const SERVICE_NAME = "phase-11-blockchain-api-proof-service";

const ALLOWED_FIELDS = new Set([
  "blockchainKey",
  "moduleName",
  "sourceRecordId",
  "recordHash",
  "hashVersion",
  "actionType",
  "sourceSystem",
  "approvedBy"
]);

const REQUIRED_FIELDS = [
  "blockchainKey",
  "moduleName",
  "sourceRecordId",
  "recordHash",
  "hashVersion",
  "actionType",
  "sourceSystem",
  "approvedBy"
];

const ALLOWED_ACTION_TYPES = new Set([
  "CREATE",
  "UPDATE",
  "DELETE",
  "SUBMIT",
  "APPROVE",
  "REJECT",
  "SYNC",
  "VERIFY"
]);

const BLOCKED_TERMS = [
  "password",
  "token",
  "secret",
  "authorization",
  "bearer",
  "private_key",
  "raw_payload",
  "raw_record",
  "full_data",
  "photo",
  "image",
  "base64",
  "national_id_number",
  "passport_number",
  "mobile_number",
  "email_address"
];

class ApiError extends Error {
  constructor(message, statusCode = 400, code = "PHASE_11_BLOCKCHAIN_API_ERROR") {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeString(value, fieldName, options = {}) {
  const required = options.required !== false;
  const maxLength = options.maxLength || 256;
  const uppercase = options.uppercase === true;

  if (value === undefined || value === null) {
    if (required) {
      throw new ApiError(`${fieldName} is required`, 400, "VALIDATION_ERROR");
    }

    return null;
  }

  const normalized = String(value).trim();

  if (!normalized && required) {
    throw new ApiError(`${fieldName} cannot be empty`, 400, "VALIDATION_ERROR");
  }

  if (normalized.length > maxLength) {
    throw new ApiError(
      `${fieldName} is too long. Maximum length is ${maxLength}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  return uppercase ? normalized.toUpperCase() : normalized;
}

function assertSafeValue(fieldName, value) {
  const text = String(value || "").toLowerCase();

  for (const term of BLOCKED_TERMS) {
    if (text.includes(term)) {
      throw new ApiError(
        `${fieldName} contains blocked sensitive term: ${term}`,
        400,
        "SENSITIVE_VALUE_BLOCKED"
      );
    }
  }
}

function validateNoExtraFields(payload) {
  for (const fieldName of Object.keys(payload || {})) {
    if (!ALLOWED_FIELDS.has(fieldName)) {
      throw new ApiError(
        `Unsupported field for proof submission: ${fieldName}`,
        400,
        "UNSUPPORTED_FIELD"
      );
    }
  }
}

function validateSubmitPayload(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new ApiError("Request body must be a JSON object", 400, "VALIDATION_ERROR");
  }

  validateNoExtraFields(payload);

  for (const fieldName of REQUIRED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(payload, fieldName)) {
      throw new ApiError(`${fieldName} is required`, 400, "VALIDATION_ERROR");
    }
  }

  const proof = {
    blockchainKey: normalizeString(payload.blockchainKey, "blockchainKey", {
      maxLength: 180
    }),
    moduleName: normalizeString(payload.moduleName, "moduleName", {
      maxLength: 80,
      uppercase: true
    }),
    sourceRecordId: normalizeString(payload.sourceRecordId, "sourceRecordId", {
      maxLength: 180
    }),
    recordHash: normalizeString(payload.recordHash, "recordHash", {
      maxLength: 64
    }).toLowerCase(),
    hashVersion: normalizeString(payload.hashVersion, "hashVersion", {
      maxLength: 40
    }),
    actionType: normalizeString(payload.actionType, "actionType", {
      maxLength: 40,
      uppercase: true
    }),
    sourceSystem: normalizeString(payload.sourceSystem, "sourceSystem", {
      maxLength: 80,
      uppercase: true
    }),
    approvedBy: normalizeString(payload.approvedBy, "approvedBy", {
      maxLength: 120
    })
  };

  if (!/^[a-zA-Z0-9_.:-]+$/.test(proof.blockchainKey)) {
    throw new ApiError(
      "blockchainKey may contain only letters, numbers, underscore, dot, colon, or dash",
      400,
      "VALIDATION_ERROR"
    );
  }

  if (!/^[a-f0-9]{64}$/.test(proof.recordHash)) {
    throw new ApiError(
      "recordHash must be a 64-character SHA-256 hex string",
      400,
      "VALIDATION_ERROR"
    );
  }

  if (!ALLOWED_ACTION_TYPES.has(proof.actionType)) {
    throw new ApiError(
      `actionType must be one of: ${Array.from(ALLOWED_ACTION_TYPES).join(", ")}`,
      400,
      "VALIDATION_ERROR"
    );
  }

  for (const [fieldName, value] of Object.entries(proof)) {
    assertSafeValue(fieldName, value);
  }

  return proof;
}

function mapHistoryRow(row) {
  if (!row) {
    return null;
  }

  return {
    blockchainHistoryId: String(row.blockchain_history_id),
    moduleName: row.module_name,
    sourceRecordId: row.source_record_id,
    blockchainKey: row.blockchain_key,
    recordHash: row.record_hash,
    hashVersion: row.hash_version,
    actionType: row.action_type,
    approvalStatus: row.approval_status,
    blockchainStatus: row.blockchain_status,
    blockchainTransactionId: row.blockchain_transaction_id,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    verificationStatus: row.verification_status,
    errorMessage: row.error_message,
    retryCount: Number(row.retry_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function extractTransactionId(fabricResult) {
  if (!fabricResult) {
    return null;
  }

  return (
    fabricResult.transactionId ||
    fabricResult.txId ||
    fabricResult.data?.transactionId ||
    fabricResult.data?.txId ||
    fabricResult.data?.transaction_id ||
    null
  );
}

async function insertPendingHistory(proof) {
  const client = await db.getClient();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `
      SELECT *
      FROM blockchain.blockchain_history
      WHERE blockchain_key = $1
      LIMIT 1
      `,
      [proof.blockchainKey]
    );

    if (existing.rows.length > 0) {
      throw new ApiError(
        `blockchainKey already exists in PostgreSQL history: ${proof.blockchainKey}`,
        409,
        "DUPLICATE_BLOCKCHAIN_KEY"
      );
    }

    const result = await client.query(
      `
      INSERT INTO blockchain.blockchain_history (
        module_name,
        source_record_id,
        blockchain_key,
        record_hash,
        hash_version,
        action_type,
        approval_status,
        blockchain_status,
        submitted_by,
        submitted_at
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        'APPROVED',
        'PENDING',
        $7,
        NOW()
      )
      RETURNING *
      `,
      [
        proof.moduleName,
        proof.sourceRecordId,
        proof.blockchainKey,
        proof.recordHash,
        proof.hashVersion,
        proof.actionType,
        proof.approvedBy
      ]
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function markHistorySubmitted(blockchainHistoryId, transactionId) {
  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      blockchain_status = 'SUBMITTED',
      blockchain_transaction_id = $2,
      error_message = NULL,
      updated_at = NOW()
    WHERE blockchain_history_id = $1
    RETURNING *
    `,
    [blockchainHistoryId, transactionId]
  );

  return result.rows[0];
}

async function markHistoryFailed(blockchainHistoryId, error) {
  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      blockchain_status = 'FAILED',
      error_message = $2,
      retry_count = COALESCE(retry_count, 0),
      updated_at = NOW()
    WHERE blockchain_history_id = $1
    RETURNING *
    `,
    [blockchainHistoryId, String(error.message || error)]
  );

  return result.rows[0];
}

function buildRequestContext(options = {}) {
  return {
    requestId: options.requestId || null,
    correlationId: options.correlationId || options.requestId || null,
    sourceSystem: "BLOCKCHAIN_API",
    requestSource: "POST /api/v1/blockchain/proof/submit",
    createdBy: options.createdBy || SERVICE_NAME
  };
}

async function submitProof(payload, options = {}) {
  const proof = validateSubmitPayload(payload);
  const historyRow = await insertPendingHistory(proof);

  try {
    const fabricResult = await fabricService.submitTransaction(
      "SubmitProof",
      [JSON.stringify(proof)],
      buildRequestContext({
        requestId: options.requestId,
        correlationId: options.correlationId,
        createdBy: proof.approvedBy
      })
    );

    const transactionId = extractTransactionId(fabricResult);

    if (!transactionId) {
      throw new ApiError(
        "Fabric submit succeeded but transactionId was not returned",
        502,
        "FABRIC_TRANSACTION_ID_MISSING"
      );
    }

    const updatedHistory = await markHistorySubmitted(
      historyRow.blockchain_history_id,
      transactionId
    );

    return {
      submitted: true,
      dryRun: false,
      chaincodeFunction: "SubmitProof",
      proof,
      postgres: {
        history: mapHistoryRow(updatedHistory)
      },
      fabric: {
        transactionId,
        channelName: fabricResult.channelName,
        chaincodeName: fabricResult.chaincodeName,
        functionName: fabricResult.functionName,
        durationMs: fabricResult.durationMs,
        data: fabricResult.data
      }
    };
  } catch (error) {
    const failedHistory = await markHistoryFailed(
      historyRow.blockchain_history_id,
      error
    );

    const wrapped = error instanceof ApiError
      ? error
      : new ApiError(
          `Fabric proof submission failed: ${error.message}`,
          502,
          "FABRIC_SUBMIT_FAILED"
        );

    wrapped.details = {
      postgres: {
        history: mapHistoryRow(failedHistory)
      }
    };

    throw wrapped;
  }
}


function validateBlockchainKey(blockchainKey) {
  const value = normalizeString(blockchainKey, "blockchainKey", {
    maxLength: 180
  });

  if (!/^[a-zA-Z0-9_.:-]+$/.test(value)) {
    throw new ApiError(
      "blockchainKey may contain only letters, numbers, underscore, dot, colon, or dash",
      400,
      "VALIDATION_ERROR"
    );
  }

  return value;
}

async function getPostgresHistoryByKey(blockchainKey) {
  const result = await db.query(
    `
    SELECT
      blockchain_history_id,
      module_name,
      source_record_id,
      blockchain_key,
      record_hash,
      hash_version,
      action_type,
      approval_status,
      blockchain_status,
      blockchain_transaction_id,
      submitted_by,
      submitted_at,
      verified_at,
      verification_status,
      error_message,
      retry_count,
      created_at,
      updated_at
    FROM blockchain.blockchain_history
    WHERE blockchain_key = $1
    ORDER BY blockchain_history_id DESC
    LIMIT 1
    `,
    [blockchainKey]
  );

  return result.rows[0] || null;
}

function isFabricNotFoundError(error) {
  const message = String(error && error.message ? error.message : error || "").toLowerCase();

  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("no proof") ||
    message.includes("proof not found")
  );
}

async function getProof(blockchainKey, options = {}) {
  const normalizedKey = validateBlockchainKey(blockchainKey);
  const postgresHistory = await getPostgresHistoryByKey(normalizedKey);

  try {
    const fabricResult = await fabricService.evaluateTransaction(
      "GetProof",
      [normalizedKey],
      buildRequestContext({
        requestId: options.requestId,
        correlationId: options.correlationId,
        createdBy: options.requestedBy || SERVICE_NAME
      })
    );

    return {
      found: true,
      blockchainKey: normalizedKey,
      postgres: {
        history: mapHistoryRow(postgresHistory)
      },
      fabric: {
        channelName: fabricResult.channelName,
        chaincodeName: fabricResult.chaincodeName,
        functionName: fabricResult.functionName,
        durationMs: fabricResult.durationMs,
        proof: fabricResult.data
      }
    };
  } catch (error) {
    if (isFabricNotFoundError(error)) {
      const notFound = new ApiError(
        `Blockchain proof not found for key: ${normalizedKey}`,
        404,
        "PROOF_NOT_FOUND"
      );

      notFound.details = {
        postgres: {
          history: mapHistoryRow(postgresHistory)
        }
      };

      throw notFound;
    }

    const wrapped = new ApiError(
      `Fabric proof lookup failed: ${error.message}`,
      502,
      "FABRIC_GET_PROOF_FAILED"
    );

    wrapped.details = {
      postgres: {
        history: mapHistoryRow(postgresHistory)
      }
    };

    throw wrapped;
  }
}



function validateVerifyPayload(payload) {
  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    throw new ApiError("Request body must be a JSON object", 400, "VALIDATION_ERROR");
  }

  const allowedFields = new Set(["blockchainKey", "recordHash"]);

  for (const fieldName of Object.keys(payload)) {
    if (!allowedFields.has(fieldName)) {
      throw new ApiError(
        `Unsupported field for proof verification: ${fieldName}`,
        400,
        "UNSUPPORTED_FIELD"
      );
    }
  }

  const blockchainKey = validateBlockchainKey(payload.blockchainKey);

  const recordHash = normalizeString(payload.recordHash, "recordHash", {
    maxLength: 64
  }).toLowerCase();

  if (!/^[a-f0-9]{64}$/.test(recordHash)) {
    throw new ApiError(
      "recordHash must be a 64-character SHA-256 hex string",
      400,
      "VALIDATION_ERROR"
    );
  }

  assertSafeValue("blockchainKey", blockchainKey);
  assertSafeValue("recordHash", recordHash);

  return {
    blockchainKey,
    recordHash
  };
}

async function updatePostgresVerification(blockchainKey, verificationResult) {
  const verificationStatus = verificationResult && verificationResult.status
    ? String(verificationResult.status).toUpperCase()
    : "NOT_VERIFIED";

  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      verification_status = $2,
      verified_at = NOW(),
      error_message = NULL,
      updated_at = NOW()
    WHERE blockchain_key = $1
    RETURNING
      blockchain_history_id,
      module_name,
      source_record_id,
      blockchain_key,
      record_hash,
      hash_version,
      action_type,
      approval_status,
      blockchain_status,
      blockchain_transaction_id,
      submitted_by,
      submitted_at,
      verified_at,
      verification_status,
      error_message,
      retry_count,
      created_at,
      updated_at
    `,
    [blockchainKey, verificationStatus]
  );

  return result.rows[0] || null;
}

async function verifyProof(payload, options = {}) {
  const verificationInput = validateVerifyPayload(payload);
  const postgresHistoryBefore = await getPostgresHistoryByKey(
    verificationInput.blockchainKey
  );

  try {
    const fabricResult = await fabricService.evaluateTransaction(
      "VerifyProof",
      [
        verificationInput.blockchainKey,
        verificationInput.recordHash
      ],
      buildRequestContext({
        requestId: options.requestId,
        correlationId: options.correlationId,
        createdBy: options.requestedBy || SERVICE_NAME
      })
    );

    const verification = fabricResult.data || null;

    if (!verification || typeof verification !== "object") {
      throw new ApiError(
        "Fabric VerifyProof returned an invalid response",
        502,
        "FABRIC_VERIFY_INVALID_RESPONSE"
      );
    }

    const updatedHistory = await updatePostgresVerification(
      verificationInput.blockchainKey,
      verification
    );

    return {
      verified: Boolean(verification.verified),
      status: verification.status || "UNKNOWN",
      blockchainKey: verificationInput.blockchainKey,
      submittedHash: verification.submittedHash || verificationInput.recordHash,
      storedHash: verification.storedHash || null,
      postgres: {
        historyBefore: mapHistoryRow(postgresHistoryBefore),
        history: mapHistoryRow(updatedHistory)
      },
      fabric: {
        channelName: fabricResult.channelName,
        chaincodeName: fabricResult.chaincodeName,
        functionName: fabricResult.functionName,
        durationMs: fabricResult.durationMs,
        verification
      }
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const wrapped = new ApiError(
      `Fabric proof verification failed: ${error.message}`,
      502,
      "FABRIC_VERIFY_PROOF_FAILED"
    );

    wrapped.details = {
      postgres: {
        history: mapHistoryRow(postgresHistoryBefore)
      }
    };

    throw wrapped;
  }
}


module.exports = {
  SERVICE_NAME,
  ApiError,
  validateSubmitPayload,
  submitProof,
  validateBlockchainKey,
  getPostgresHistoryByKey,
  getProof,
  validateVerifyPayload,
  verifyProof
};
