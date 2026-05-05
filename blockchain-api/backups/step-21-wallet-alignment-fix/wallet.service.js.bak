const crypto = require("crypto");
const { Pool } = require("pg");
const fabricService = require("./fabric.service");

/**
 * PostgreSQL connection pool
 */
const pool = new Pool({
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || "172.31.13.133",
  port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5444),
  database: process.env.POSTGRES_DATABASE || process.env.DB_NAME || "vfds_dev",
  user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

/**
 * Generate internal request id for API/database audit tracking.
 */
function generateRequestId() {
  return `REQ_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

/**
 * Safe JSON parser.
 */
function safeJsonParse(value) {
  try {
    if (!value) return null;
    if (typeof value === "object") return value;
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Normalize Fabric SDK result.
 */
function normalizeFabricResponse(result) {
  if (!result) return null;

  if (Buffer.isBuffer(result)) {
    const text = result.toString("utf8");
    return safeJsonParse(text) || text;
  }

  if (typeof result === "string") {
    return safeJsonParse(result) || result;
  }

  return result;
}

/**
 * Extract wallet object from chaincode response.
 */
function extractWalletData(fabricResponse) {
  if (!fabricResponse) return {};

  /**
   * Fabric submit endpoint wrapper response:
   * fabricResponse.data.data.wallet
   */
  if (
    fabricResponse.data &&
    fabricResponse.data.data &&
    fabricResponse.data.data.wallet
  ) {
    return fabricResponse.data.data.wallet;
  }

  /**
   * Direct chaincode response:
   * fabricResponse.data.wallet
   */
  if (fabricResponse.data && fabricResponse.data.wallet) {
    return fabricResponse.data.wallet;
  }

  /**
   * Direct wallet object:
   * fabricResponse.wallet
   */
  if (fabricResponse.wallet) {
    return fabricResponse.wallet;
  }

  return fabricResponse;
}

/**
 * Get table columns from PostgreSQL.
 */
async function getTableColumns(client, schemaName, tableName) {
  const result = await client.query(
    `
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position;
    `,
    [schemaName, tableName]
  );

  return result.rows;
}

/**
 * Convert column rows to simple column-name list.
 */
function columnNames(columnRows) {
  return columnRows.map((row) => row.column_name);
}

/**
 * Get column data type.
 */
function getColumnType(columnRows, columnName) {
  const column = columnRows.find((row) => row.column_name === columnName);
  return column ? column.data_type : null;
}

/**
 * Find the first existing column from a candidate list.
 */
function firstExistingColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column));
}

/**
 * Add insert column/value only if column exists.
 */
function addColumnValue(columns, insertColumns, values, columnName, value) {
  if (columnName && columns.includes(columnName)) {
    insertColumns.push(columnName);
    values.push(value);
  }
}

/**
 * Build dynamic insert statement.
 */
function buildDynamicInsert(schemaName, tableName, insertColumns, values) {
  if (!insertColumns.length) {
    const error = new Error(`No insertable columns found for ${schemaName}.${tableName}`);
    error.statusCode = 500;
    error.code = "NO_INSERTABLE_COLUMNS";
    throw error;
  }

  const placeholders = values.map((_, index) => `$${index + 1}`);

  return {
    sql: `
      INSERT INTO ${schemaName}.${tableName} (
        ${insertColumns.join(", ")}
      )
      VALUES (
        ${placeholders.join(", ")}
      )
      RETURNING *;
    `,
    values
  };
}

/**
 * UUID validator.
 */
function isUuid(value) {
  if (!value || typeof value !== "string") return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/**
 * Resolve organization input.
 *
 * API receives:
 *   BANK001
 *
 * Database wallet table may require:
 *   organization_id UUID
 *
 * This function maps BANK001 to the real organization UUID if needed.
 */
async function resolveOrganizationId(client, organizationInput) {
  if (!organizationInput) {
    return null;
  }

  const organizationColumnRows = await getTableColumns(
    client,
    "blockchain",
    "organizations"
  );

  const orgColumns = columnNames(organizationColumnRows);

  const idColumn = firstExistingColumn(orgColumns, [
    "organization_id",
    "id",
    "org_id"
  ]);

  const codeColumn = firstExistingColumn(orgColumns, [
    "organization_code",
    "org_code",
    "code",
    "bank_code",
    "external_org_id"
  ]);

  const nameColumn = firstExistingColumn(orgColumns, [
    "organization_name",
    "org_name",
    "name",
    "bank_name"
  ]);

  /**
   * If organization table is not available or does not have id column,
   * return original value. Insert will fail only if wallet column requires UUID.
   */
  if (!idColumn) {
    return organizationInput;
  }

  /**
   * Already UUID.
   */
  if (isUuid(organizationInput)) {
    return organizationInput;
  }

  const searchConditions = [];
  const values = [];

  if (codeColumn) {
    values.push(organizationInput);
    searchConditions.push(`${codeColumn} = $${values.length}`);
  }

  if (nameColumn) {
    values.push(organizationInput);
    searchConditions.push(`${nameColumn} = $${values.length}`);
  }

  if (!searchConditions.length) {
    return organizationInput;
  }

  const sql = `
    SELECT ${idColumn} AS resolved_organization_id
    FROM blockchain.organizations
    WHERE ${searchConditions.join(" OR ")}
    LIMIT 1;
  `;

  const result = await client.query(sql, values);

  if (!result.rows.length) {
    const error = new Error(`Organization not found for value: ${organizationInput}`);
    error.statusCode = 404;
    error.code = "ORGANIZATION_NOT_FOUND";
    error.details = {
      organizationInput,
      expectedColumns: {
        idColumn,
        codeColumn,
        nameColumn
      }
    };
    throw error;
  }

  return result.rows[0].resolved_organization_id;
}

/**
 * Insert wallet into blockchain.wallets using dynamic schema-safe mapping.
 */
async function insertWallet(client, payload, fabricResponse, walletData, requestId) {
  const walletColumnRows = await getTableColumns(client, "blockchain", "wallets");
  const columns = columnNames(walletColumnRows);

  const insertColumns = [];
  const values = [];

  const walletAddress =
    walletData.walletAddress ||
    walletData.wallet_address ||
    walletData.address ||
    `WALLET_PENDING_${requestId}`;
  const fabricTransactionId =
    walletData.createdTxId ||
    walletData.updatedTxId ||
    fabricResponse?.commit?.transactionId ||
    fabricResponse?.data?.data?.transaction?.transactionId ||
    null;
  const balance =
    walletData.balance ||
    walletData.initialBalance ||
    walletData.initial_balance ||
    payload.initialBalance ||
    "0";

  const nameColumn = firstExistingColumn(columns, [
    "owner_name",
    "full_name",
    "customer_name",
    "wallet_holder_name",
    "holder_name",
    "name"
  ]);

  const balanceColumn = firstExistingColumn(columns, [
    "balance",
    "current_balance",
    "available_balance",
    "wallet_balance"
  ]);

  const fabricResponseColumn = firstExistingColumn(columns, [
    "fabric_response",
    "ledger_payload",
    "blockchain_payload",
    "chaincode_response"
  ]);

  const metadataColumn = firstExistingColumn(columns, [
    "metadata",
    "additional_data",
    "extra_data"
  ]);

  const statusColumn = firstExistingColumn(columns, [
    "status",
    "wallet_status",
    "state"
  ]);

  /**
   * Required wallet columns.
   */
  if (!columns.includes("customer_id")) {
    const error = new Error("Column customer_id does not exist in blockchain.wallets");
    error.statusCode = 500;
    error.code = "SCHEMA_MISMATCH";
    throw error;
  }

  if (!columns.includes("wallet_address")) {
    const error = new Error("Column wallet_address does not exist in blockchain.wallets");
    error.statusCode = 500;
    error.code = "SCHEMA_MISMATCH";
    throw error;
  }

  /**
   * Organization handling:
   * If organization_id column is UUID, resolve BANK001 to real UUID.
   * If it is varchar/text, keep BANK001.
   */
  let organizationValue = payload.organizationId;

  if (columns.includes("organization_id")) {
    const organizationColumnType = getColumnType(walletColumnRows, "organization_id");

    if (organizationColumnType === "uuid" && !isUuid(payload.organizationId)) {
      organizationValue = await resolveOrganizationId(client, payload.organizationId);
    }
  }

  addColumnValue(columns, insertColumns, values, "customer_id", payload.customerId);
  addColumnValue(columns, insertColumns, values, "organization_id", organizationValue);
  addColumnValue(columns, insertColumns, values, "wallet_address", walletAddress);
  addColumnValue(columns, insertColumns, values, nameColumn, payload.fullName);
  addColumnValue(columns, insertColumns, values, "national_id_hash", payload.nationalIdHash);
  addColumnValue(columns, insertColumns, values, "mobile_hash", payload.mobileHash);
  addColumnValue(columns, insertColumns, values, "email_hash", payload.emailHash);
  addColumnValue(columns, insertColumns, values, statusColumn, "ACTIVE");
  addColumnValue(columns, insertColumns, values, balanceColumn, balance);

  if (fabricResponseColumn) {
    addColumnValue(
      columns,
      insertColumns,
      values,
      fabricResponseColumn,
      JSON.stringify(fabricResponse || {})
    );
  }

  if (metadataColumn) {
    addColumnValue(
      columns,
      insertColumns,
      values,
      metadataColumn,
      JSON.stringify({
        ...payload.metadata,
        requestId,
        requestSource: payload.requestSource,
        fullName: payload.fullName,
        organizationCode: payload.organizationId,
        resolvedOrganizationId: organizationValue,
        fabricTransactionId
      })
    );
  }

  addColumnValue(columns, insertColumns, values, "created_by", payload.createdBy);
  addColumnValue(columns, insertColumns, values, "updated_by", payload.createdBy);
  addColumnValue(columns, insertColumns, values, "created_at", new Date());
  addColumnValue(columns, insertColumns, values, "updated_at", new Date());

  const insert = buildDynamicInsert(
    "blockchain",
    "wallets",
    insertColumns,
    values
  );

  const result = await client.query(insert.sql, insert.values);
  return result.rows[0];
}

/**
 * Insert audit log into blockchain.audit_logs using dynamic schema-safe mapping.
 */
async function insertAuditLog(
  client,
  payload,
  fabricResponse,
  walletRecord,
  requestId,
  status,
  errorMessage = null
) {
  const auditColumnRows = await getTableColumns(client, "blockchain", "audit_logs");
  const columns = columnNames(auditColumnRows);

  const insertColumns = [];
  const values = [];

  const entityId =
    walletRecord?.wallet_id ||
    walletRecord?.id ||
    walletRecord?.wallet_address ||
    payload.customerId;

  const entityTypeColumn = firstExistingColumn(columns, [
    "entity_type",
    "object_type",
    "resource_type"
  ]);

  const entityIdColumn = firstExistingColumn(columns, [
    "entity_id",
    "object_id",
    "resource_id",
    "wallet_id"
  ]);

  const actionColumn = firstExistingColumn(columns, [
    "action",
    "event_action",
    "operation"
  ]);

  const statusColumn = firstExistingColumn(columns, [
    "status",
    "event_status",
    "result_status"
  ]);

  const requestIdColumn = firstExistingColumn(columns, [
    "request_id",
    "correlation_id",
    "trace_id"
  ]);

  const requestPayloadColumn = firstExistingColumn(columns, [
    "request_payload",
    "request_body",
    "payload",
    "old_data"
  ]);

  const responsePayloadColumn = firstExistingColumn(columns, [
    "response_payload",
    "response_body",
    "new_data",
    "result_payload"
  ]);

  const errorMessageColumn = firstExistingColumn(columns, [
    "error_message",
    "error",
    "failure_reason"
  ]);

  const performedByColumn = firstExistingColumn(columns, [
    "performed_by",
    "created_by",
    "user_id",
    "actor"
  ]);

  const sourceSystemColumn = firstExistingColumn(columns, [
    "source_system",
    "request_source",
    "source"
  ]);

  const ipAddressColumn = firstExistingColumn(columns, [
    "ip_address",
    "client_ip"
  ]);

  const userAgentColumn = firstExistingColumn(columns, [
    "user_agent",
    "client_user_agent"
  ]);

  const createdAtColumn = firstExistingColumn(columns, [
    "created_at",
    "event_time",
    "audit_time"
  ]);

  addColumnValue(columns, insertColumns, values, entityTypeColumn, "WALLET");
  addColumnValue(columns, insertColumns, values, entityIdColumn, String(entityId));
  addColumnValue(columns, insertColumns, values, actionColumn, "CREATE_WALLET");
  addColumnValue(columns, insertColumns, values, statusColumn, status);
  addColumnValue(columns, insertColumns, values, requestIdColumn, requestId);

  if (requestPayloadColumn) {
    addColumnValue(
      columns,
      insertColumns,
      values,
      requestPayloadColumn,
      JSON.stringify({
        customerId: payload.customerId,
        organizationId: payload.organizationId,
        fullName: payload.fullName,
        nationalIdHash: payload.nationalIdHash,
        mobileHash: payload.mobileHash,
        emailHash: payload.emailHash,
        initialBalance: payload.initialBalance
      })
    );
  }

  if (responsePayloadColumn) {
    addColumnValue(
      columns,
      insertColumns,
      values,
      responsePayloadColumn,
      JSON.stringify(fabricResponse || {})
    );
  }

  addColumnValue(columns, insertColumns, values, errorMessageColumn, errorMessage);
  addColumnValue(columns, insertColumns, values, performedByColumn, payload.createdBy);
  addColumnValue(columns, insertColumns, values, sourceSystemColumn, payload.requestSource);
  addColumnValue(columns, insertColumns, values, ipAddressColumn, payload.ipAddress);
  addColumnValue(columns, insertColumns, values, userAgentColumn, payload.userAgent);
  addColumnValue(columns, insertColumns, values, createdAtColumn, new Date());

  /**
   * If audit_logs table exists but no supported columns match,
   * skip instead of breaking the main wallet creation flow.
   */
  if (!insertColumns.length) {
    console.warn("[STEP 21] Audit log skipped: no compatible audit columns found");
    return;
  }

  const insert = buildDynamicInsert(
    "blockchain",
    "audit_logs",
    insertColumns,
    values
  );

  await client.query(insert.sql, insert.values);
}

/**
 * Main Wallet Creation Service
 */
exports.createWallet = async (payload) => {
  const requestId = generateRequestId();

  console.log("[STEP 21] Create wallet started:", {
    requestId,
    customerId: payload.customerId,
    organizationId: payload.organizationId
  });

  console.log("[STEP 21] Connecting to PostgreSQL...");

  const client = await pool.connect();

  console.log("[STEP 21] PostgreSQL connected successfully");

  let fabricResponse = null;
  let walletRecord = null;

  try {
    await client.query("BEGIN");

    console.log("[STEP 21] PostgreSQL transaction started");

    /**
     * Fabric chaincode call.
     *
     * Chaincode method:
     * CreateWallet(
     *   customerId,
     *   organizationId,
     *   fullName,
     *   nationalIdHash,
     *   mobileHash,
     *   emailHash,
     *   passwordHash,
     *   initialBalance
     * )
     */
    console.log("[STEP 21] Submitting Fabric transaction CreateWallet...");

    const fabricResult = await fabricService.submitTransaction("CreateWallet", [
      payload.customerId,
      payload.organizationId,
      payload.fullName,
      payload.nationalIdHash,
      payload.mobileHash,
      payload.emailHash,
      payload.passwordHash,
      String(payload.initialBalance || "0")
    ]);

    console.log("[STEP 21] Fabric transaction completed");

    fabricResponse = normalizeFabricResponse(fabricResult);

    console.log(
      "[STEP 21] Fabric response:",
      JSON.stringify(fabricResponse, null, 2)
    );

    if (fabricResponse && fabricResponse.success === false) {
      const error = new Error(
        fabricResponse.message || "Fabric wallet creation failed"
      );
      error.statusCode = 409;
      error.code = "FABRIC_TRANSACTION_FAILED";
      error.details = fabricResponse;
      throw error;
    }

    const walletData = extractWalletData(fabricResponse);

    console.log(
      "[STEP 21] Extracted wallet data:",
      JSON.stringify(walletData, null, 2)
    );

    console.log("[STEP 21] Inserting wallet into PostgreSQL...");

    walletRecord = await insertWallet(
      client,
      payload,
      fabricResponse,
      walletData,
      requestId
    );

    console.log("[STEP 21] Wallet inserted into PostgreSQL:", {
      customerId: walletRecord.customer_id,
      organizationId: walletRecord.organization_id,
      walletAddress: walletRecord.wallet_address
    });

    console.log("[STEP 21] Inserting audit log...");

    await insertAuditLog(
      client,
      payload,
      fabricResponse,
      walletRecord,
      requestId,
      "SUCCESS",
      null
    );

    console.log("[STEP 21] Audit log inserted");

    console.log("[STEP 21] Committing PostgreSQL transaction...");

    await client.query("COMMIT");

    console.log("[STEP 21] Wallet creation completed successfully");

    return {
      requestId,
      wallet: {
        customerId: walletRecord.customer_id,
        organizationId: walletRecord.organization_id,
        organizationCode: payload.organizationId,
        walletAddress: walletRecord.wallet_address,
        ownerName:
          walletRecord.owner_name ||
          walletRecord.full_name ||
          walletRecord.customer_name ||
          walletRecord.wallet_holder_name ||
          walletRecord.holder_name ||
          payload.fullName,
        status:
          walletRecord.status ||
          walletRecord.wallet_status ||
          walletRecord.state ||
          "ACTIVE",
        balance:
          walletRecord.balance ||
          walletRecord.current_balance ||
          walletRecord.available_balance ||
          walletRecord.wallet_balance ||
          payload.initialBalance,
        createdAt: walletRecord.created_at || null
      },
      blockchain: {
        chaincodeFunction: "CreateWallet",
        fabricResponse
      }
    };
  } catch (error) {
    console.error("[STEP 21] Wallet creation failed:", {
      message: error.message,
      code: error.code,
      details: error.details || null,
      stack: error.stack
    });

    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[STEP 21] PostgreSQL rollback failed:", rollbackError);
    }

    /**
     * Insert failed audit log outside the rolled back transaction.
     */
    try {
      console.log("[STEP 21] Inserting failed audit log...");

      await client.query("BEGIN");

      await insertAuditLog(
        client,
        payload,
        fabricResponse,
        walletRecord,
        requestId,
        "FAILED",
        error.message
      );

      await client.query("COMMIT");

      console.log("[STEP 21] Failed audit log inserted");
    } catch (auditError) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ignore rollback error
      }

      console.error("[STEP 21] Failed audit log insert failed:", auditError);
    }

    if (!error.statusCode) {
      error.statusCode = 500;
    }

    if (!error.code) {
      error.code = "WALLET_CREATION_FAILED";
    }

    throw error;
  } finally {
    client.release();
    console.log("[STEP 21] PostgreSQL connection released");
  }
};