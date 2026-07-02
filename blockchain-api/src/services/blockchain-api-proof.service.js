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


async function markHistorySubmitting(blockchainHistoryId) {
  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      blockchain_status = 'SUBMITTING',
      error_message = NULL,
      updated_at = NOW()
    WHERE blockchain_history_id = $1
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
    [blockchainHistoryId]
  );

  return result.rows[0] || null;
}

async function insertSubmitAttemptStarted(historyRow, options = {}) {
  const result = await db.query(
    `
    INSERT INTO blockchain.blockchain_history_attempts (
      blockchain_history_id,
      module_name,
      source_record_id,
      blockchain_key,
      attempt_no,
      attempt_type,
      blockchain_status,
      verification_status,
      request_id,
      worker_name,
      started_at,
      created_by
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      (
        SELECT COALESCE(MAX(attempt_no), 0) + 1
        FROM blockchain.blockchain_history_attempts
        WHERE blockchain_history_id = $1
      ),
      'SUBMIT',
      'SUBMITTING',
      $5,
      $6,
      'phase12-api-submit',
      NOW(),
      $7
    )
    RETURNING *
    `,
    [
      historyRow.blockchain_history_id,
      historyRow.module_name,
      historyRow.source_record_id,
      historyRow.blockchain_key,
      historyRow.verification_status || "NOT_VERIFIED",
      options.requestId || null,
      options.requestedBy || SERVICE_NAME
    ]
  );

  return result.rows[0] || null;
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
  const pendingHistory = await insertPendingHistory(proof);

  let submittingHistory = pendingHistory;
  let submitAttempt = null;
  let attemptLogWarning = null;

  try {
    submittingHistory = await markHistorySubmitting(
      pendingHistory.blockchain_history_id
    );

    submitAttempt = await insertSubmitAttemptStarted(submittingHistory, {
      requestId: options.requestId,
      requestedBy: proof.approvedBy || SERVICE_NAME
    });
  } catch (error) {
    attemptLogWarning = error.message;
  }

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
      pendingHistory.blockchain_history_id,
      transactionId
    );

    let finishedAttempt = submitAttempt;

    try {
      finishedAttempt = await finishRetryAttempt(
        submitAttempt && submitAttempt.blockchain_history_attempt_id,
        {
          blockchainStatus: "SUBMITTED",
          verificationStatus: updatedHistory.verification_status || "NOT_VERIFIED",
          blockchainTransactionId: transactionId,
          requestId: options.requestId || null
        }
      );
    } catch (error) {
      attemptLogWarning = attemptLogWarning || error.message;
    }

    return {
      submitted: true,
      dryRun: false,
      chaincodeFunction: "SubmitProof",
      blockchainKey: proof.blockchainKey,
      blockchainHistoryId: String(updatedHistory.blockchain_history_id),
      blockchainTransactionId: transactionId,
      proof,
      postgres: {
        historyBefore: mapHistoryRow(pendingHistory),
        submittingHistory: mapHistoryRow(submittingHistory),
        history: mapHistoryRow(updatedHistory),
        attempt: finishedAttempt,
        attemptLogWarning
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
      pendingHistory.blockchain_history_id,
      error
    );

    try {
      await finishRetryAttempt(
        submitAttempt && submitAttempt.blockchain_history_attempt_id,
        {
          blockchainStatus: "FAILED",
          verificationStatus: failedHistory.verification_status || "NOT_VERIFIED",
          errorCode: error.code || "FABRIC_SUBMIT_FAILED",
          errorMessage: String(error.message || error).slice(0, 2000),
          requestId: options.requestId || null
        }
      );
    } catch (_) {}

    const wrapped = error instanceof ApiError
      ? error
      : new ApiError(
          `Fabric proof submission failed: ${error.message}`,
          502,
          "FABRIC_SUBMIT_FAILED"
        );

    wrapped.details = {
      postgres: {
        historyBefore: mapHistoryRow(pendingHistory),
        submittingHistory: mapHistoryRow(submittingHistory),
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



function validateHistoryRecordId(recordId) {
  const value = normalizeString(recordId, "recordId", {
    maxLength: 180
  });

  if (!/^[a-zA-Z0-9_.:-]+$/.test(value)) {
    throw new ApiError(
      "recordId may contain only letters, numbers, underscore, dot, colon, or dash",
      400,
      "VALIDATION_ERROR"
    );
  }

  assertSafeValue("recordId", value);

  return value;
}

async function getPostgresHistoriesByRecordId(recordId) {
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
    WHERE source_record_id = $1
       OR blockchain_key = $1
    ORDER BY blockchain_history_id DESC
    `,
    [recordId]
  );

  return result.rows;
}

async function queryFabricProofsByRecordId(recordId, options = {}) {
  const result = await fabricService.evaluateTransaction(
    "QueryProofsByRecordId",
    [recordId],
    buildRequestContext({
      requestId: options.requestId,
      correlationId: options.correlationId,
      createdBy: options.requestedBy || SERVICE_NAME
    })
  );

  if (Array.isArray(result.data)) {
    return {
      channelName: result.channelName,
      chaincodeName: result.chaincodeName,
      functionName: result.functionName,
      durationMs: result.durationMs,
      proofs: result.data
    };
  }

  return {
    channelName: result.channelName,
    chaincodeName: result.chaincodeName,
    functionName: result.functionName,
    durationMs: result.durationMs,
    proofs: []
  };
}

async function getFabricHistoryForBlockchainKey(blockchainKey, options = {}) {
  const result = await fabricService.evaluateTransaction(
    "GetHistoryForKey",
    [blockchainKey],
    buildRequestContext({
      requestId: options.requestId,
      correlationId: options.correlationId,
      createdBy: options.requestedBy || SERVICE_NAME
    })
  );

  return {
    blockchainKey,
    channelName: result.channelName,
    chaincodeName: result.chaincodeName,
    functionName: result.functionName,
    durationMs: result.durationMs,
    count: Array.isArray(result.data) ? result.data.length : 0,
    items: Array.isArray(result.data) ? result.data : []
  };
}

async function getHistoryByRecordId(recordId, options = {}) {
  const normalizedRecordId = validateHistoryRecordId(recordId);

  const postgresRows = await getPostgresHistoriesByRecordId(normalizedRecordId);
  const postgresHistories = postgresRows.map(mapHistoryRow);

  const blockchainKeys = new Set();

  for (const row of postgresRows) {
    if (row.blockchain_key) {
      blockchainKeys.add(row.blockchain_key);
    }
  }

  let recordProofQuery = {
    attempted: true,
    success: false,
    proofs: [],
    errorMessage: null
  };

  try {
    const fabricProofs = await queryFabricProofsByRecordId(normalizedRecordId, options);

    recordProofQuery = {
      attempted: true,
      success: true,
      channelName: fabricProofs.channelName,
      chaincodeName: fabricProofs.chaincodeName,
      functionName: fabricProofs.functionName,
      durationMs: fabricProofs.durationMs,
      count: fabricProofs.proofs.length,
      proofs: fabricProofs.proofs,
      errorMessage: null
    };

    for (const proof of fabricProofs.proofs) {
      if (proof && proof.blockchainKey) {
        blockchainKeys.add(proof.blockchainKey);
      }
    }
  } catch (error) {
    recordProofQuery = {
      attempted: true,
      success: false,
      proofs: [],
      errorMessage: error.message
    };
  }

  if (blockchainKeys.size === 0 && /^[a-zA-Z0-9_.:-]+$/.test(normalizedRecordId)) {
    blockchainKeys.add(normalizedRecordId);
  }

  const fabricHistories = [];
  const fabricHistoryErrors = [];

  for (const blockchainKey of blockchainKeys) {
    try {
      const history = await getFabricHistoryForBlockchainKey(blockchainKey, options);
      fabricHistories.push(history);
    } catch (error) {
      fabricHistoryErrors.push({
        blockchainKey,
        errorMessage: error.message
      });
    }
  }

  const fabricHistoryItemCount = fabricHistories.reduce(
    (total, history) => total + Number(history.count || 0),
    0
  );

  const found =
    postgresHistories.length > 0 ||
    recordProofQuery.proofs.length > 0 ||
    fabricHistoryItemCount > 0;

  if (!found) {
    const notFound = new ApiError(
      `Blockchain history not found for recordId: ${normalizedRecordId}`,
      404,
      "BLOCKCHAIN_HISTORY_NOT_FOUND"
    );

    notFound.details = {
      recordId: normalizedRecordId,
      postgresCount: 0,
      fabricRecordProofCount: 0,
      fabricHistoryItemCount: 0,
      fabricHistoryErrors
    };

    throw notFound;
  }

  return {
    found: true,
    recordId: normalizedRecordId,
    postgres: {
      count: postgresHistories.length,
      histories: postgresHistories
    },
    fabric: {
      recordProofQuery,
      historyKeyCount: blockchainKeys.size,
      historyItemCount: fabricHistoryItemCount,
      histories: fabricHistories,
      errors: fabricHistoryErrors
    }
  };
}



function normalizeDashboardLimit(value, defaultValue = 10, maxValue = 50) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function mapDashboardModuleSummary(row) {
  return {
    moduleName: row.module_name,
    totalHistoryRecords: toNumber(row.total_history_records),
    approvalPendingCount: toNumber(row.approval_pending_count),
    approvalApprovedCount: toNumber(row.approval_approved_count),
    approvalRejectedCount: toNumber(row.approval_rejected_count),
    blockchainPendingCount: toNumber(row.blockchain_pending_count),
    blockchainSubmittedCount: toNumber(row.blockchain_submitted_count),
    blockchainConfirmedCount: toNumber(row.blockchain_confirmed_count),
    blockchainFailedCount: toNumber(row.blockchain_failed_count),
    notVerifiedCount: toNumber(row.not_verified_count),
    verifiedCount: toNumber(row.verified_count),
    verificationFailedCount: toNumber(row.verification_failed_count),
    verificationMismatchCount: toNumber(row.verification_mismatch_count),
    totalRetryCount: toNumber(row.total_retry_count),
    firstHistoryCreatedAt: row.first_history_created_at,
    latestHistoryUpdatedAt: row.latest_history_updated_at
  };
}

function mapDashboardLatestRow(row) {
  return {
    blockchainHistoryId: row.blockchain_history_id ? String(row.blockchain_history_id) : null,
    moduleName: row.module_name,
    sourceRecordId: row.source_record_id,
    blockchainKey: row.blockchain_key,
    hashVersion: row.hash_version,
    actionType: row.action_type,
    approvalStatus: row.approval_status,
    blockchainStatus: row.blockchain_status,
    blockchainTransactionId: row.blockchain_transaction_id || null,
    hasRecordHash: Boolean(row.record_hash),
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    verificationStatus: row.verification_status,
    errorMessage: row.error_message,
    retryCount: toNumber(row.retry_count),
    attemptCount: toNumber(row.attempt_count),
    latestAttemptNo: row.latest_attempt_no,
    latestAttemptStartedAt: row.latest_attempt_started_at,
    latestAttemptFinishedAt: row.latest_attempt_finished_at,
    latestAttemptType: row.latest_attempt_type,
    latestAttemptBlockchainStatus: row.latest_attempt_blockchain_status,
    latestAttemptVerificationStatus: row.latest_attempt_verification_status,
    latestAttemptErrorCode: row.latest_attempt_error_code,
    latestAttemptRequestId: row.latest_attempt_request_id,
    latestAttemptWorkerName: row.latest_attempt_worker_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapDashboardRetryRow(row) {
  return {
    blockchainHistoryId: row.blockchain_history_id ? String(row.blockchain_history_id) : null,
    moduleName: row.module_name,
    sourceRecordId: row.source_record_id,
    blockchainKey: row.blockchain_key,
    actionType: row.action_type,
    approvalStatus: row.approval_status,
    blockchainStatus: row.blockchain_status,
    verificationStatus: row.verification_status,
    retryCount: toNumber(row.retry_count),
    errorMessage: row.error_message,
    blockchainTransactionId: row.blockchain_transaction_id || null,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getDashboard(options = {}) {
  const limit = normalizeDashboardLimit(options.limit);

  const [
    totalsResult,
    blockchainStatusResult,
    verificationStatusResult,
    actionTypeResult,
    moduleSummaryResult,
    latestResult,
    retryQueueResult
  ] = await Promise.all([
    db.query(
      `
      SELECT
        COUNT(*)::int AS total_records,
        COUNT(*) FILTER (WHERE blockchain_status = 'PENDING')::int AS pending_count,
        COUNT(*) FILTER (WHERE blockchain_status = 'SUBMITTED')::int AS submitted_count,
        COUNT(*) FILTER (WHERE blockchain_status = 'CONFIRMED')::int AS confirmed_count,
        COUNT(*) FILTER (WHERE blockchain_status = 'FAILED')::int AS failed_count,
        COUNT(*) FILTER (WHERE verification_status = 'NOT_VERIFIED')::int AS not_verified_count,
        COUNT(*) FILTER (WHERE verification_status = 'VERIFIED')::int AS verified_count,
        COUNT(*) FILTER (WHERE verification_status = 'FAILED')::int AS verification_failed_count,
        COUNT(*) FILTER (WHERE verification_status = 'MISMATCHED')::int AS mismatched_count,
        COUNT(*) FILTER (WHERE blockchain_transaction_id IS NOT NULL)::int AS records_with_transaction_count,
        COUNT(*) FILTER (WHERE blockchain_transaction_id IS NULL)::int AS records_without_transaction_count,
        COALESCE(SUM(COALESCE(retry_count, 0)), 0)::int AS total_retry_count,
        MIN(created_at) AS first_created_at,
        MAX(updated_at) AS latest_updated_at
      FROM blockchain.blockchain_history
      `
    ),
    db.query(
      `
      SELECT
        COALESCE(blockchain_status, 'NULL') AS status,
        COUNT(*)::int AS count
      FROM blockchain.blockchain_history
      GROUP BY blockchain_status
      ORDER BY COUNT(*) DESC, status ASC
      `
    ),
    db.query(
      `
      SELECT
        COALESCE(verification_status, 'NULL') AS status,
        COUNT(*)::int AS count
      FROM blockchain.blockchain_history
      GROUP BY verification_status
      ORDER BY COUNT(*) DESC, status ASC
      `
    ),
    db.query(
      `
      SELECT
        COALESCE(action_type, 'NULL') AS actionType,
        COUNT(*)::int AS count
      FROM blockchain.blockchain_history
      GROUP BY action_type
      ORDER BY COUNT(*) DESC, actionType ASC
      `
    ),
    db.query(
      `
      SELECT *
      FROM blockchain.vw_blockchain_history_summary
      ORDER BY total_history_records DESC, module_name ASC
      `
    ),
    db.query(
      `
      SELECT *
      FROM blockchain.vw_blockchain_history_latest
      ORDER BY blockchain_history_id DESC
      LIMIT $1
      `,
      [limit]
    ),
    db.query(
      `
      SELECT *
      FROM blockchain.vw_blockchain_history_retry_queue
      ORDER BY retry_count DESC, updated_at ASC
      LIMIT $1
      `,
      [limit]
    )
  ]);

  const totals = totalsResult.rows[0] || {};

  return {
    asOf: new Date().toISOString(),
    summary: {
      totalRecords: toNumber(totals.total_records),
      pendingCount: toNumber(totals.pending_count),
      submittedCount: toNumber(totals.submitted_count),
      confirmedCount: toNumber(totals.confirmed_count),
      failedCount: toNumber(totals.failed_count),
      notVerifiedCount: toNumber(totals.not_verified_count),
      verifiedCount: toNumber(totals.verified_count),
      verificationFailedCount: toNumber(totals.verification_failed_count),
      mismatchedCount: toNumber(totals.mismatched_count),
      recordsWithTransactionCount: toNumber(totals.records_with_transaction_count),
      recordsWithoutTransactionCount: toNumber(totals.records_without_transaction_count),
      totalRetryCount: toNumber(totals.total_retry_count),
      firstCreatedAt: totals.first_created_at || null,
      latestUpdatedAt: totals.latest_updated_at || null
    },
    breakdowns: {
      blockchainStatus: blockchainStatusResult.rows.map((row) => ({
        status: row.status,
        count: toNumber(row.count)
      })),
      verificationStatus: verificationStatusResult.rows.map((row) => ({
        status: row.status,
        count: toNumber(row.count)
      })),
      actionType: actionTypeResult.rows.map((row) => ({
        actionType: row.actiontype,
        count: toNumber(row.count)
      })),
      modules: moduleSummaryResult.rows.map(mapDashboardModuleSummary)
    },
    recent: {
      limit,
      count: latestResult.rows.length,
      records: latestResult.rows.map(mapDashboardLatestRow)
    },
    retryQueue: {
      limit,
      count: retryQueueResult.rows.length,
      records: retryQueueResult.rows.map(mapDashboardRetryRow)
    },
    securityPolicy: {
      rawSourceRowsReturned: false,
      sensitiveFieldsReturned: false,
      hashesExposedInRecentList: false,
      proofOnlyMetrics: true
    }
  };
}



function normalizeFailedLimit(value, defaultValue = 25, maxValue = 100) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function mapFailedRecord(row) {
  return {
    blockchainHistoryId: row.blockchain_history_id ? String(row.blockchain_history_id) : null,
    moduleName: row.module_name,
    sourceRecordId: row.source_record_id,
    blockchainKey: row.blockchain_key,
    hashVersion: row.hash_version,
    actionType: row.action_type,
    approvalStatus: row.approval_status,
    blockchainStatus: row.blockchain_status,
    verificationStatus: row.verification_status,
    blockchainTransactionId: row.blockchain_transaction_id || null,
    hasRecordHash: Boolean(row.has_record_hash),
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at,
    verifiedAt: row.verified_at,
    retryCount: toNumber(row.retry_count),
    retryEligible: Boolean(row.retry_eligible),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function getFailedRecords(options = {}) {
  const limit = normalizeFailedLimit(options.limit);

  const failedWhereClause = `
    blockchain_status IN ('FAILED', 'ERROR')
    OR verification_status IN ('FAILED', 'MISMATCHED')
    OR error_message IS NOT NULL
  `;

  const [summaryResult, recordsResult] = await Promise.all([
    db.query(
      `
      SELECT
        COUNT(*)::int AS total_failed_records,
        COUNT(*) FILTER (WHERE blockchain_status IN ('FAILED', 'ERROR'))::int AS blockchain_failed_count,
        COUNT(*) FILTER (WHERE verification_status = 'FAILED')::int AS verification_failed_count,
        COUNT(*) FILTER (WHERE verification_status = 'MISMATCHED')::int AS mismatched_count,
        COUNT(*) FILTER (WHERE error_message IS NOT NULL)::int AS records_with_error_message_count,
        COUNT(*) FILTER (
          WHERE blockchain_status IN ('FAILED', 'ERROR')
            AND COALESCE(retry_count, 0) < 3
        )::int AS retry_eligible_count,
        COALESCE(SUM(COALESCE(retry_count, 0)), 0)::int AS total_retry_count,
        MAX(updated_at) AS latest_failed_updated_at
      FROM blockchain.blockchain_history
      WHERE ${failedWhereClause}
      `
    ),
    db.query(
      `
      SELECT
        blockchain_history_id,
        module_name,
        source_record_id,
        blockchain_key,
        record_hash IS NOT NULL AS has_record_hash,
        hash_version,
        action_type,
        approval_status,
        blockchain_status,
        verification_status,
        blockchain_transaction_id,
        submitted_by,
        submitted_at,
        verified_at,
        retry_count,
        (
          blockchain_status IN ('FAILED', 'ERROR')
          AND COALESCE(retry_count, 0) < 3
        ) AS retry_eligible,
        error_message,
        created_at,
        updated_at
      FROM blockchain.blockchain_history
      WHERE ${failedWhereClause}
      ORDER BY updated_at DESC NULLS LAST, blockchain_history_id DESC
      LIMIT $1
      `,
      [limit]
    )
  ]);

  const summary = summaryResult.rows[0] || {};

  return {
    asOf: new Date().toISOString(),
    limit,
    count: recordsResult.rows.length,
    summary: {
      totalFailedRecords: toNumber(summary.total_failed_records),
      blockchainFailedCount: toNumber(summary.blockchain_failed_count),
      verificationFailedCount: toNumber(summary.verification_failed_count),
      mismatchedCount: toNumber(summary.mismatched_count),
      recordsWithErrorMessageCount: toNumber(summary.records_with_error_message_count),
      retryEligibleCount: toNumber(summary.retry_eligible_count),
      totalRetryCount: toNumber(summary.total_retry_count),
      latestFailedUpdatedAt: summary.latest_failed_updated_at || null
    },
    records: recordsResult.rows.map(mapFailedRecord),
    securityPolicy: {
      rawSourceRowsReturned: false,
      sensitiveFieldsReturned: false,
      recordHashReturned: false,
      proofOnlyMetadataReturned: true
    }
  };
}



function validateRetryId(value) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== String(value).trim()) {
    throw new ApiError(
      "Retry id must be a positive integer blockchain_history_id",
      400,
      "VALIDATION_ERROR"
    );
  }

  return parsed;
}

function buildRetryProofPayload(historyRow, options = {}) {
  return {
    blockchainKey: historyRow.blockchain_key,
    moduleName: historyRow.module_name,
    sourceRecordId: historyRow.source_record_id,
    recordHash: historyRow.record_hash,
    hashVersion: historyRow.hash_version || "v1",
    actionType: historyRow.action_type || "SUBMIT",
    sourceSystem: "VALOORES",
    approvedBy: options.requestedBy || historyRow.submitted_by || SERVICE_NAME
  };
}

function isRetryableHistoryRow(historyRow, maxRetries = 3) {
  if (!historyRow) {
    return false;
  }

  const blockchainStatus = String(historyRow.blockchain_status || "").toUpperCase();
  const retryCount = Number(historyRow.retry_count || 0);

  if (retryCount >= maxRetries) {
    return false;
  }

  return (
    blockchainStatus === "FAILED" ||
    blockchainStatus === "ERROR" ||
    Boolean(historyRow.error_message)
  );
}

async function getHistoryById(blockchainHistoryId) {
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
    WHERE blockchain_history_id = $1
    `,
    [blockchainHistoryId]
  );

  return result.rows[0] || null;
}

async function insertRetryAttemptStarted(historyRow, attemptNo, options = {}) {
  const result = await db.query(
    `
    INSERT INTO blockchain.blockchain_history_attempts (
      blockchain_history_id,
      module_name,
      source_record_id,
      blockchain_key,
      attempt_no,
      attempt_type,
      blockchain_status,
      verification_status,
      request_id,
      worker_name,
      started_at,
      created_by
    )
    VALUES (
      $1, $2, $3, $4, $5, 'RETRY', 'PENDING', $6, $7, $8, NOW(), $9
    )
    RETURNING *
    `,
    [
      historyRow.blockchain_history_id,
      historyRow.module_name,
      historyRow.source_record_id,
      historyRow.blockchain_key,
      attemptNo,
      historyRow.verification_status || "NOT_VERIFIED",
      options.requestId || null,
      "phase11-api-retry",
      options.requestedBy || SERVICE_NAME
    ]
  );

  return result.rows[0] || null;
}

async function finishRetryAttempt(attemptId, patch = {}) {
  if (!attemptId) {
    return null;
  }

  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history_attempts
    SET
      blockchain_status = $2,
      verification_status = $3,
      blockchain_transaction_id = $4,
      error_code = $5,
      error_message = $6,
      request_id = COALESCE($7, request_id),
      finished_at = NOW(),
      duration_ms = GREATEST(
        0,
        FLOOR(EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000)::int
      )
    WHERE blockchain_history_attempt_id = $1
    RETURNING *
    `,
    [
      attemptId,
      patch.blockchainStatus || null,
      patch.verificationStatus || null,
      patch.blockchainTransactionId || null,
      patch.errorCode || null,
      patch.errorMessage || null,
      patch.requestId || null
    ]
  );

  return result.rows[0] || null;
}

async function markRetrySubmitted(blockchainHistoryId, attemptNo, transactionId, requestedBy) {
  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      blockchain_status = 'SUBMITTED',
      blockchain_transaction_id = $2,
      submitted_by = COALESCE($3, submitted_by),
      submitted_at = NOW(),
      verification_status = 'NOT_VERIFIED',
      verified_at = NULL,
      error_message = NULL,
      retry_count = $4,
      updated_at = NOW()
    WHERE blockchain_history_id = $1
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
    [blockchainHistoryId, transactionId || null, requestedBy || SERVICE_NAME, attemptNo]
  );

  return result.rows[0] || null;
}

async function markRetryFailed(blockchainHistoryId, attemptNo, error) {
  const result = await db.query(
    `
    UPDATE blockchain.blockchain_history
    SET
      blockchain_status = 'FAILED',
      error_message = $2,
      retry_count = $3,
      updated_at = NOW()
    WHERE blockchain_history_id = $1
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
    [blockchainHistoryId, String(error.message || error).slice(0, 2000), attemptNo]
  );

  return result.rows[0] || null;
}

function extractFabricTransactionId(fabricResult) {
  if (!fabricResult || typeof fabricResult !== "object") {
    return null;
  }

  return (
    fabricResult.transactionId ||
    fabricResult.txId ||
    fabricResult.transactionID ||
    fabricResult.fabricTransactionId ||
    (fabricResult.data && (
      fabricResult.data.transactionId ||
      fabricResult.data.txId ||
      fabricResult.data.transactionID ||
      fabricResult.data.fabricTransactionId
    )) ||
    null
  );
}

async function retryProofSubmission(id, options = {}) {
  const blockchainHistoryId = validateRetryId(id);
  const maxRetries = 3;

  const historyRow = await getHistoryById(blockchainHistoryId);

  if (!historyRow) {
    throw new ApiError(
      `Blockchain history row not found for id: ${blockchainHistoryId}`,
      404,
      "BLOCKCHAIN_HISTORY_NOT_FOUND"
    );
  }

  if (!isRetryableHistoryRow(historyRow, maxRetries)) {
    const error = new ApiError(
      `Blockchain history row ${blockchainHistoryId} is not retryable`,
      409,
      "BLOCKCHAIN_HISTORY_NOT_RETRYABLE"
    );

    error.details = {
      blockchainHistoryId: String(historyRow.blockchain_history_id),
      blockchainStatus: historyRow.blockchain_status,
      verificationStatus: historyRow.verification_status,
      retryCount: Number(historyRow.retry_count || 0),
      maxRetries,
      retryableStatuses: ["FAILED", "ERROR"],
      hasErrorMessage: Boolean(historyRow.error_message)
    };

    throw error;
  }

  const attemptNo = Number(historyRow.retry_count || 0) + 1;
  const proofPayload = buildRetryProofPayload(historyRow, options);

  validateSubmitPayload(proofPayload);

  let attemptRow = null;
  let attemptLogWarning = null;

  try {
    attemptRow = await insertRetryAttemptStarted(historyRow, attemptNo, options);
  } catch (error) {
    attemptLogWarning = error.message;
  }

  try {
    const fabricResult = await fabricService.submitTransaction(
      "SubmitProof",
      [JSON.stringify(proofPayload)],
      buildRequestContext({
        requestId: options.requestId,
        correlationId: options.correlationId,
        createdBy: options.requestedBy || SERVICE_NAME
      })
    );

    const transactionId = extractFabricTransactionId(fabricResult);

    const updatedHistory = await markRetrySubmitted(
      blockchainHistoryId,
      attemptNo,
      transactionId,
      options.requestedBy || SERVICE_NAME
    );

    let finishedAttempt = null;

    try {
      finishedAttempt = await finishRetryAttempt(
        attemptRow && attemptRow.blockchain_history_attempt_id,
        {
          blockchainStatus: "SUBMITTED",
          verificationStatus: "NOT_VERIFIED",
          blockchainTransactionId: transactionId,
          requestId: options.requestId || null
        }
      );
    } catch (error) {
      attemptLogWarning = attemptLogWarning || error.message;
    }

    return {
      retried: true,
      status: "SUBMITTED",
      blockchainHistoryId: String(blockchainHistoryId),
      attemptNo,
      blockchainKey: updatedHistory.blockchain_key,
      blockchainTransactionId: transactionId,
      postgres: {
        historyBefore: mapHistoryRow(historyRow),
        history: mapHistoryRow(updatedHistory),
        attempt: finishedAttempt || attemptRow,
        attemptLogWarning
      },
      fabric: {
        channelName: fabricResult.channelName,
        chaincodeName: fabricResult.chaincodeName,
        functionName: fabricResult.functionName,
        durationMs: fabricResult.durationMs,
        transactionId,
        result: fabricResult.data || null
      }
    };
  } catch (error) {
    const failedHistory = await markRetryFailed(blockchainHistoryId, attemptNo, error);

    try {
      await finishRetryAttempt(
        attemptRow && attemptRow.blockchain_history_attempt_id,
        {
          blockchainStatus: "FAILED",
          verificationStatus: historyRow.verification_status || "NOT_VERIFIED",
          errorCode: error.code || "FABRIC_RETRY_FAILED",
          errorMessage: String(error.message || error).slice(0, 2000),
          requestId: options.requestId || null
        }
      );
    } catch (_) {}

    const wrapped = new ApiError(
      `Blockchain retry failed: ${error.message}`,
      502,
      "BLOCKCHAIN_RETRY_FAILED"
    );

    wrapped.details = {
      blockchainHistoryId: String(blockchainHistoryId),
      attemptNo,
      postgres: {
        historyBefore: mapHistoryRow(historyRow),
        history: mapHistoryRow(failedHistory)
      }
    };

    throw wrapped;
  }
}


module.exports = {
  SERVICE_NAME,
  ApiError,
  validateSubmitPayload,
  markHistorySubmitting,
  insertSubmitAttemptStarted,
  submitProof,
  validateBlockchainKey,
  getPostgresHistoryByKey,
  getProof,
  validateVerifyPayload,
  verifyProof,
  validateHistoryRecordId,
  getPostgresHistoriesByRecordId,
  getHistoryByRecordId,
  normalizeDashboardLimit,
  getDashboard,
  normalizeFailedLimit,
  getFailedRecords,
  validateRetryId,
  retryProofSubmission
};
