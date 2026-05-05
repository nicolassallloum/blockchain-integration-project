const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");
const fabricService = require("./fabric.service");
const logger = require("../utils/logger");

/**
 * Build custom application error
 */
function buildError(message, statusCode = 400, errorCode = "VALIDATION_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

/**
 * Validate required string field
 */
function validateRequiredString(value, fieldName, errorCode) {
  if (!value || typeof value !== "string" || value.trim() === "") {
    throw buildError(`${fieldName} is required`, 400, errorCode);
  }

  return value.trim();
}

/**
 * Validate transaction amount
 */
function validateAmount(amount) {
  if (amount === undefined || amount === null || amount === "") {
    throw buildError("Amount is required", 400, "AMOUNT_REQUIRED");
  }

  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    throw buildError("Amount must be numeric", 400, "INVALID_AMOUNT");
  }

  if (numericAmount <= 0) {
    throw buildError(
      "Amount must be greater than zero",
      400,
      "INVALID_AMOUNT"
    );
  }

  if (numericAmount > 100000) {
    throw buildError(
      "Amount exceeds maximum allowed transaction limit",
      400,
      "AMOUNT_LIMIT_EXCEEDED"
    );
  }

  return numericAmount;
}

/**
 * Extract a readable Fabric error message
 */
function extractFabricErrorMessage(fabricResult) {
  return (
    fabricResult?.error?.details?.[0]?.message ||
    fabricResult?.error?.message ||
    fabricResult?.message ||
    "Fabric transaction failed"
  );
}

/**
 * Ensure Fabric transaction was successful
 */
function assertFabricSuccess(fabricResult, errorCode) {
  if (!fabricResult || fabricResult.success === false) {
    throw buildError(
      extractFabricErrorMessage(fabricResult),
      500,
      errorCode
    );
  }
}

/**
 * Safe audit log insert.
 *
 * This function is intentionally defensive because your current audit_logs table
 * may not yet contain all enterprise audit columns.
 */
async function safeAuditLog(client, data) {
  try {
    await client.query(
      `
      INSERT INTO blockchain.audit_logs (
        audit_id,
        request_id,
        event_type,
        event_category,
        entity_type,
        entity_id,
        event_status,
        event_description,
        request_payload,
        response_payload,
        source_system,
        request_source,
        created_by,
        created_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8::jsonb,
        $9::jsonb,
        $10,
        $11,
        $12,
        NOW()
      )
      `,
      [
        data.requestId,
        data.eventType,
        data.eventCategory || "TRANSACTION",
        data.entityType || "TRANSACTION",
        data.entityId,
        data.eventStatus,
        data.eventDescription,
        JSON.stringify(data.requestPayload || {}),
        JSON.stringify(data.responsePayload || {}),
        data.sourceSystem || "BLOCKCHAIN_API",
        data.requestSource || "API",
        data.createdBy || "system",
      ]
    );
  } catch (error) {
    logger.error("Audit insert failed", {
      requestId: data.requestId,
      error: error.message,
      stack: error.stack,
    });
  }
}

/**
 * STEP 23
 * Wallet-to-wallet transfer
 */
exports.walletToWalletTransfer = async (payload) => {
  const client = await db.getClient();

  const localRequestId = payload.requestId || `REQ_${Date.now()}`;
  const localTransactionId = uuidv4();

  const sourceSystem = payload.sourceSystem || "BLOCKCHAIN_API";
  const requestSource = payload.requestSource || "API";
  const createdBy = payload.createdBy || "system";

  try {
    await client.query("BEGIN");

    const senderWalletAddress = validateRequiredString(
      payload.senderWalletAddress,
      "Sender wallet address",
      "SENDER_WALLET_REQUIRED"
    );

    const receiverWalletAddress = validateRequiredString(
      payload.receiverWalletAddress,
      "Receiver wallet address",
      "RECEIVER_WALLET_REQUIRED"
    );

    const amount = validateAmount(payload.amount);
    const currency = payload.currency || "USD";

    const transactionPurpose =
      payload.transactionPurpose || "Wallet-to-wallet transfer";

    const transactionDescription =
      payload.transactionDescription || "Wallet-to-wallet transaction";

    if (senderWalletAddress === receiverWalletAddress) {
      throw buildError(
        "Sender and receiver wallet cannot be the same",
        400,
        "SAME_WALLET_TRANSFER_NOT_ALLOWED"
      );
    }

    const senderWalletResult = await client.query(
      `
      SELECT 
        wallet_id,
        wallet_address,
        customer_id,
        wallet_status,
        current_balance
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1
      `,
      [senderWalletAddress]
    );

    if (senderWalletResult.rowCount === 0) {
      throw buildError(
        "Sender wallet not found",
        404,
        "SENDER_WALLET_NOT_FOUND"
      );
    }

    const receiverWalletResult = await client.query(
      `
      SELECT 
        wallet_id,
        wallet_address,
        customer_id,
        wallet_status,
        current_balance
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1
      `,
      [receiverWalletAddress]
    );

    if (receiverWalletResult.rowCount === 0) {
      throw buildError(
        "Receiver wallet not found",
        404,
        "RECEIVER_WALLET_NOT_FOUND"
      );
    }

    const senderWallet = senderWalletResult.rows[0];
    const receiverWallet = receiverWalletResult.rows[0];

    if (senderWallet.wallet_status !== "ACTIVE") {
      throw buildError(
        "Sender wallet is not active",
        400,
        "SENDER_WALLET_NOT_ACTIVE"
      );
    }

    if (receiverWallet.wallet_status !== "ACTIVE") {
      throw buildError(
        "Receiver wallet is not active",
        400,
        "RECEIVER_WALLET_NOT_ACTIVE"
      );
    }

    if (Number(senderWallet.current_balance) < amount) {
      throw buildError(
        "Insufficient sender wallet balance",
        400,
        "INSUFFICIENT_BALANCE"
      );
    }

    const fabricResult = await fabricService.submitTransaction(
      "TransferBetweenWallets",
      [
        senderWalletAddress,
        receiverWalletAddress,
        amount.toString(),
        localRequestId,
      ]
    );

    assertFabricSuccess(fabricResult, "FABRIC_WALLET_TRANSFER_FAILED");

    const insertTransactionResult = await client.query(
      `
      INSERT INTO blockchain.transactions (
        transaction_id,
        request_id,
        transaction_type,
        transaction_status,
        sender_wallet_address,
        receiver_wallet_address,
        from_wallet_address,
        to_wallet_address,
        amount,
        currency,
        transaction_purpose,
        transaction_description,
        fabric_transaction_id,
        fabric_response,
        source_system,
        request_source,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'WALLET_TO_WALLET',
        'COMPLETED',
        $3,
        $4,
        $3,
        $4,
        $5::numeric,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11,
        $12,
        $13,
        NOW(),
        NOW()
      )
      RETURNING transaction_id, request_id;
      `,
      [
        localTransactionId,
        localRequestId,
        senderWalletAddress,
        receiverWalletAddress,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        fabricResult.commit?.transactionId ||
          fabricResult.data?.data?.transaction?.transactionId ||
          fabricResult.transactionId ||
          fabricResult.txId ||
          null,
        JSON.stringify(fabricResult || {}),
        sourceSystem,
        requestSource,
        createdBy,
      ]
    );

    logger.info("Wallet transfer saved to PostgreSQL", {
      requestId: localRequestId,
      transactionId: localTransactionId,
      rowsInserted: insertTransactionResult.rowCount,
    });
    await client.query(
      `
      UPDATE blockchain.wallets
      SET 
        current_balance = current_balance - $1::numeric,
        updated_by = $2,
        updated_at = NOW()
      WHERE wallet_address = $3
      `,
      [amount, createdBy, senderWalletAddress]
    );

    await client.query(
      `
      UPDATE blockchain.wallets
      SET 
        current_balance = current_balance + $1::numeric,
        updated_by = $2,
        updated_at = NOW()
      WHERE wallet_address = $3
      `,
      [amount, createdBy, receiverWalletAddress]
    );

    await safeAuditLog(client, {
      requestId: localRequestId,
      eventType: "WALLET_TO_WALLET_TRANSFER",
      eventCategory: "TRANSACTION",
      entityType: "TRANSACTION",
      entityId: localTransactionId,
      eventStatus: "SUCCESS",
      eventDescription: "Wallet-to-wallet transfer completed successfully",
      requestPayload: {
        senderWalletAddress,
        receiverWalletAddress,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        sourceSystem,
        requestSource,
        createdBy,
      },
      responsePayload: fabricResult,
      sourceSystem,
      requestSource,
      createdBy,
    });

    await client.query("COMMIT");

    return {
      transactionId: localTransactionId,
      requestId: localRequestId,
      senderWalletAddress,
      receiverWalletAddress,
      amount: amount.toString(),
      currency,
      fabricResult,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    logger.error("Wallet-to-wallet transfer service failed", {
      requestId: localRequestId,
      transactionId: localTransactionId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  } finally {
    client.release();
  }
};

/**
 * STEP 24
 * Wallet-to-organization transfer
 *
 * Compatibility mode:
 * Current deployed chaincode expects 4 parameters:
 * 1. senderWalletAddress
 * 2. organizationCode
 * 3. amount
 * 4. requestId
 */
exports.walletToOrganizationTransfer = async (payload) => {
  const client = await db.getClient();

  const localRequestId = payload.requestId || `REQ_${Date.now()}`;
  const localTransactionId = uuidv4();

  const sourceSystem = payload.sourceSystem || "BLOCKCHAIN_API";
  const requestSource = payload.requestSource || "API";
  const createdBy = payload.createdBy || "system";

  try {
    await client.query("BEGIN");

    const senderWalletAddress = validateRequiredString(
      payload.senderWalletAddress,
      "Sender wallet address",
      "SENDER_WALLET_REQUIRED"
    );

    const organizationCode = validateRequiredString(
      payload.organizationCode,
      "Organization code",
      "ORGANIZATION_CODE_REQUIRED"
    );

    const amount = validateAmount(payload.amount);
    const currency = payload.currency || "USD";

    const transactionPurpose =
      payload.transactionPurpose || "Wallet-to-organization transfer";

    const transactionDescription =
      payload.transactionDescription || "Wallet-to-organization transaction";

    const allowedCurrencies = ["USD", "LBP", "EUR"];

    if (!allowedCurrencies.includes(currency)) {
      throw buildError(
        "Currency is not supported for organization transfers",
        400,
        "UNSUPPORTED_CURRENCY"
      );
    }

    const senderWalletResult = await client.query(
      `
      SELECT 
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        wallet_status,
        current_balance
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1
      `,
      [senderWalletAddress]
    );

    if (senderWalletResult.rowCount === 0) {
      throw buildError(
        "Sender wallet not found",
        404,
        "SENDER_WALLET_NOT_FOUND"
      );
    }

    const senderWallet = senderWalletResult.rows[0];

    if (senderWallet.wallet_status !== "ACTIVE") {
      throw buildError(
        "Sender wallet is not active",
        400,
        "SENDER_WALLET_NOT_ACTIVE"
      );
    }

    if (Number(senderWallet.current_balance) < amount) {
      throw buildError(
        "Insufficient wallet balance",
        400,
        "INSUFFICIENT_BALANCE"
      );
    }

    /**
     * Organization validation.
     * Your current table appears to use status, not organization_status.
     */
    const organizationResult = await client.query(
      `
      SELECT 
        organization_id,
        organization_code,
        organization_name,
        organization_type,
        status
      FROM blockchain.organizations
      WHERE organization_code = $1
      LIMIT 1
      `,
      [organizationCode]
    );

    if (organizationResult.rowCount === 0) {
      throw buildError(
        "Organization not found",
        404,
        "ORGANIZATION_NOT_FOUND"
      );
    }

    const organization = organizationResult.rows[0];

    if (organization.status !== "ACTIVE") {
      throw buildError(
        "Organization is not active",
        400,
        "ORGANIZATION_NOT_ACTIVE"
      );
    }

    if (amount < 1) {
      throw buildError(
        "Minimum organization transfer amount is 1",
        400,
        "MIN_AMOUNT_NOT_ALLOWED"
      );
    }

    if (amount > 50000) {
      throw buildError(
        "Organization transfer amount exceeds business limit",
        400,
        "ORGANIZATION_TRANSFER_LIMIT_EXCEEDED"
      );
    }

    /**
     * Insert integration request as PROCESSING.
     */
    await client.query(
      `
      INSERT INTO blockchain.integration_requests (
        request_id,
        request_type,
        request_status,
        source_system,
        request_source,
        request_payload,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        'ORGANIZATION_TRANSFER',
        'PROCESSING',
        $2,
        $3,
        $4::jsonb,
        $5,
        NOW(),
        NOW()
      )
      ON CONFLICT (request_id)
      DO UPDATE SET
        request_status = 'PROCESSING',
        source_system = EXCLUDED.source_system,
        request_source = EXCLUDED.request_source,
        request_payload = EXCLUDED.request_payload,
        updated_at = NOW()
      `,
      [
        localRequestId,
        sourceSystem,
        requestSource,
        JSON.stringify({
          senderWalletAddress,
          organizationCode,
          amount,
          currency,
          transactionPurpose,
          transactionDescription,
          sourceSystem,
          requestSource,
          createdBy,
        }),
        createdBy,
      ]
    );

    /**
     * Submit to Fabric.
     *
     * Current chaincode expects 4 args only.
     */
    const fabricResult = await fabricService.submitTransaction(
      "TransferToOrganization",
      [
        senderWalletAddress,
        organizationCode,
        amount.toString(),
        localRequestId,
      ]
    );

    /**
     * Stop immediately if Fabric failed.
     * This prevents API success=true with fabricResult.success=false.
     */
    assertFabricSuccess(
      fabricResult,
      "FABRIC_ORGANIZATION_TRANSFER_FAILED"
    );

    /**
     * Insert transaction only after Fabric success.
     */
        await client.query(
      `
      INSERT INTO blockchain.transactions (
        transaction_id,
        request_id,
        transaction_type,
        transaction_status,
        sender_wallet_address,
        receiver_wallet_address,
        from_wallet_address,
        to_wallet_address,
        organization_id,
        organization_code,
        amount,
        currency,
        transaction_purpose,
        transaction_description,
        fabric_transaction_id,
        fabric_response,
        source_system,
        request_source,
        created_by,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'WALLET_TO_ORGANIZATION',
        'COMPLETED',
        $3,
        NULL,
        $3,
        NULL,
        $4,
        $5,
        $6::numeric,
        $7,
        $8,
        $9,
        $10,
        $11::jsonb,
        $12,
        $13,
        $14,
        NOW(),
        NOW()
      )
      `,
      [
        localTransactionId,
        localRequestId,
        senderWalletAddress,
        organization.organization_id || organization.id,
        organizationCode,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        fabricResult.transactionId || fabricResult.txId || null,
        JSON.stringify(fabricResult || {}),
        sourceSystem,
        requestSource,
        createdBy,
      ]
    );

    /**
     * Deduct balance only after Fabric success.
     */
    await client.query(
      `
      UPDATE blockchain.wallets
      SET 
        current_balance = current_balance - $1::numeric,
        updated_by = $2,
        updated_at = NOW()
      WHERE wallet_address = $3
      `,
      [amount, createdBy, senderWalletAddress]
    );

    await client.query(
      `
      UPDATE blockchain.integration_requests
      SET 
        request_status = 'COMPLETED',
        response_payload = $1::jsonb,
        updated_by = $2,
        updated_at = NOW()
      WHERE request_id = $3
      `,
      [
        JSON.stringify({
          transactionId: localTransactionId,
          fabricResult,
        }),
        createdBy,
        localRequestId,
      ]
    );

    await safeAuditLog(client, {
      requestId: localRequestId,
      eventType: "WALLET_TO_ORGANIZATION_TRANSFER",
      eventCategory: "TRANSACTION",
      entityType: "TRANSACTION",
      entityId: localTransactionId,
      eventStatus: "SUCCESS",
      eventDescription:
        "Wallet-to-organization transfer completed successfully",
      requestPayload: {
        senderWalletAddress,
        organizationCode,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        sourceSystem,
        requestSource,
        createdBy,
      },
      responsePayload: {
        transactionId: localTransactionId,
        organizationCode: organization.organization_code,
        amount,
        currency,
        fabricResult,
      },
      sourceSystem,
      requestSource,
      createdBy,
    });

    await client.query("COMMIT");

    return {
      transactionId: localTransactionId,
      requestId: localRequestId,
      senderWalletAddress,
      organizationId: organization.organization_id,
      organizationCode: organization.organization_code,
      organizationName: organization.organization_name,
      amount: amount.toString(),
      currency,
      transactionPurpose,
      fabricResult,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    logger.error("Wallet-to-organization transfer service failed", {
      requestId: localRequestId,
      transactionId: localTransactionId,
      error: error.message,
      stack: error.stack,
    });

    let failureClient;

    try {
      failureClient = await db.getClient();
      await failureClient.query("BEGIN");

      await failureClient.query(
        `
        INSERT INTO blockchain.integration_requests (
          request_id,
          request_type,
          request_status,
          source_system,
          request_source,
          request_payload,
          response_payload,
          created_by,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          'ORGANIZATION_TRANSFER',
          'FAILED',
          $2,
          $3,
          $4::jsonb,
          $5::jsonb,
          $6,
          NOW(),
          NOW()
        )
        ON CONFLICT (request_id)
        DO UPDATE SET
          request_status = 'FAILED',
          source_system = EXCLUDED.source_system,
          request_source = EXCLUDED.request_source,
          request_payload = EXCLUDED.request_payload,
          response_payload = EXCLUDED.response_payload,
          updated_at = NOW()
        `,
        [
          localRequestId,
          sourceSystem,
          requestSource,
          JSON.stringify({
            ...payload,
            sourceSystem,
            requestSource,
            createdBy,
          }),
          JSON.stringify({
            error: error.message,
            errorCode:
              error.errorCode || "ORGANIZATION_TRANSFER_FAILED",
          }),
          createdBy,
        ]
      );

      await safeAuditLog(failureClient, {
        requestId: localRequestId,
        eventType: "WALLET_TO_ORGANIZATION_TRANSFER",
        eventCategory: "TRANSACTION",
        entityType: "TRANSACTION",
        entityId: localTransactionId,
        eventStatus: "FAILED",
        eventDescription: error.message,
        requestPayload: {
          ...payload,
          sourceSystem,
          requestSource,
          createdBy,
        },
        responsePayload: {
          error: error.message,
          errorCode:
            error.errorCode || "ORGANIZATION_TRANSFER_FAILED",
        },
        sourceSystem,
        requestSource,
        createdBy,
      });

      await failureClient.query("COMMIT");
    } catch (auditError) {
      if (failureClient) {
        await failureClient.query("ROLLBACK");
      }

      logger.error("Failed to write organization transfer failure audit", {
        requestId: localRequestId,
        transactionId: localTransactionId,
        error: auditError.message,
        stack: auditError.stack,
      });
    } finally {
      if (failureClient) {
        failureClient.release();
      }
    }

    throw error;
  } finally {
    client.release();
  }
};