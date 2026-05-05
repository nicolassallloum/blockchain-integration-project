const crypto = require("crypto");
const databaseService = require("./database.service");
const fabricService = require("./fabric.service");
const logger = require("../utils/logger");

function buildError(message, statusCode = 500, errorCode = "TRANSACTION_SERVICE_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function generateRequestId() {
  return `REQ_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

function assertFabricSuccess(fabricResult, errorCode) {
  if (!fabricResult || fabricResult.success === false) {
    const message =
      fabricResult?.error?.details?.[0]?.message ||
      fabricResult?.error?.message ||
      fabricResult?.message ||
      "Fabric transaction failed";

    throw buildError(message, 500, errorCode);
  }

  const innerSuccess =
    fabricResult?.data?.success ??
    fabricResult?.data?.data?.success ??
    true;

  if (innerSuccess === false) {
    const message =
      fabricResult?.data?.message ||
      fabricResult?.data?.data?.message ||
      "Fabric transaction failed";

    throw buildError(message, 500, errorCode);
  }
}

function extractFabricTransactionId(fabricResult) {
  return (
    fabricResult?.commit?.transactionId ||
    fabricResult?.data?.data?.transaction?.transactionId ||
    fabricResult?.data?.transaction?.transactionId ||
    fabricResult?.transactionId ||
    fabricResult?.txId ||
    null
  );
}

async function safeAuditLog(client, payload) {
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
        payload.requestId || null,
        payload.eventType || null,
        payload.eventCategory || null,
        payload.entityType || null,
        payload.entityId || null,
        payload.eventStatus || null,
        payload.eventDescription || null,
        JSON.stringify(payload.requestPayload || {}),
        JSON.stringify(payload.responsePayload || {}),
        payload.sourceSystem || "BLOCKCHAIN_API",
        payload.requestSource || "API",
        payload.createdBy || "system",
      ]
    );
  } catch (error) {
    logger.warn("Audit log insert skipped", {
      error: error.message,
      requestId: payload.requestId,
    });
  }
}

async function getWalletByAddress(client, walletAddress) {
  const result = await client.query(
    `
    SELECT
      wallet_id,
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      full_name,
      current_balance,
      currency,
      wallet_status
    FROM blockchain.wallets
    WHERE wallet_address = $1
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
}

exports.walletToWalletTransfer = async function walletToWalletTransfer(payload = {}, requestIdFromHeader = null) {
  const pool = databaseService.getPool();
  const client = await pool.connect();

  const localTransactionId = crypto.randomUUID();
  const localRequestId =
    requestIdFromHeader ||
    payload.requestId ||
    generateRequestId();

  const senderWalletAddress =
    payload.senderWalletAddress ||
    payload.fromWalletAddress ||
    payload.from_wallet_address;

  const receiverWalletAddress =
    payload.receiverWalletAddress ||
    payload.toWalletAddress ||
    payload.to_wallet_address;

  const amount = Number(payload.amount);
  const currency = payload.currency || "TOKEN";
  const transactionPurpose = payload.transactionPurpose || null;
  const transactionDescription = payload.transactionDescription || null;
  const requestSource = payload.requestSource || "API";
  const sourceSystem = payload.sourceSystem || "BLOCKCHAIN_API";
  const createdBy = payload.createdBy || "system";

  try {
    if (!senderWalletAddress) {
      throw buildError("senderWalletAddress is required", 400, "SENDER_WALLET_REQUIRED");
    }

    if (!receiverWalletAddress) {
      throw buildError("receiverWalletAddress is required", 400, "RECEIVER_WALLET_REQUIRED");
    }

    if (senderWalletAddress === receiverWalletAddress) {
      throw buildError("Sender and receiver wallets cannot be the same", 400, "SAME_WALLET_TRANSFER_NOT_ALLOWED");
    }

    if (Number.isNaN(amount) || amount <= 0) {
      throw buildError("amount must be greater than zero", 400, "INVALID_AMOUNT");
    }

    await client.query("BEGIN");

    const senderWallet = await getWalletByAddress(client, senderWalletAddress);
    const receiverWallet = await getWalletByAddress(client, receiverWalletAddress);

    if (!senderWallet) {
      throw buildError("Sender wallet not found", 404, "SENDER_WALLET_NOT_FOUND");
    }

    if (!receiverWallet) {
      throw buildError("Receiver wallet not found", 404, "RECEIVER_WALLET_NOT_FOUND");
    }

    if (senderWallet.wallet_status !== "ACTIVE") {
      throw buildError("Sender wallet is not active", 400, "SENDER_WALLET_NOT_ACTIVE");
    }

    if (receiverWallet.wallet_status !== "ACTIVE") {
      throw buildError("Receiver wallet is not active", 400, "RECEIVER_WALLET_NOT_ACTIVE");
    }

    if (Number(senderWallet.current_balance) < amount) {
      throw buildError("Insufficient sender wallet balance", 400, "INSUFFICIENT_BALANCE");
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

    const fabricTransactionId = extractFabricTransactionId(fabricResult);

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
      RETURNING *
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
        fabricTransactionId,
        JSON.stringify(fabricResult || {}),
        sourceSystem,
        requestSource,
        createdBy,
      ]
    );

    await client.query(
      `
      UPDATE blockchain.wallets
      SET
        current_balance = current_balance - $1::numeric,
        currency = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE wallet_address = $4
      `,
      [amount, currency, createdBy, senderWalletAddress]
    );

    await client.query(
      `
      UPDATE blockchain.wallets
      SET
        current_balance = current_balance + $1::numeric,
        currency = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE wallet_address = $4
      `,
      [amount, currency, createdBy, receiverWalletAddress]
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

    logger.info("Wallet-to-wallet transfer completed successfully", {
      requestId: localRequestId,
      transactionId: localTransactionId,
      fabricTransactionId,
      rowsInserted: insertTransactionResult.rowCount,
    });

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

exports.walletToOrganizationTransfer = async function walletToOrganizationTransfer(payload = {}, requestIdFromHeader = null) {
  const pool = databaseService.getPool();
  const client = await pool.connect();

  const localTransactionId = crypto.randomUUID();
  const localRequestId =
    requestIdFromHeader ||
    payload.requestId ||
    generateRequestId();

  const senderWalletAddress =
    payload.senderWalletAddress ||
    payload.fromWalletAddress ||
    payload.from_wallet_address;

  const organizationCode = payload.organizationCode || payload.organizationId;
  const amount = Number(payload.amount);
  const currency = payload.currency || "TOKEN";
  const transactionPurpose = payload.transactionPurpose || null;
  const transactionDescription = payload.transactionDescription || null;
  const requestSource = payload.requestSource || "API";
  const sourceSystem = payload.sourceSystem || "BLOCKCHAIN_API";
  const createdBy = payload.createdBy || "system";

  try {
    if (!senderWalletAddress) {
      throw buildError("senderWalletAddress is required", 400, "SENDER_WALLET_REQUIRED");
    }

    if (!organizationCode) {
      throw buildError("organizationCode is required", 400, "ORGANIZATION_CODE_REQUIRED");
    }

    if (Number.isNaN(amount) || amount <= 0) {
      throw buildError("amount must be greater than zero", 400, "INVALID_AMOUNT");
    }

    await client.query("BEGIN");

    const senderWallet = await getWalletByAddress(client, senderWalletAddress);

    if (!senderWallet) {
      throw buildError("Sender wallet not found", 404, "SENDER_WALLET_NOT_FOUND");
    }

    if (senderWallet.wallet_status !== "ACTIVE") {
      throw buildError("Sender wallet is not active", 400, "SENDER_WALLET_NOT_ACTIVE");
    }

    if (Number(senderWallet.current_balance) < amount) {
      throw buildError("Insufficient sender wallet balance", 400, "INSUFFICIENT_BALANCE");
    }

    const organizationResult = await client.query(
      `
      SELECT
        organization_id,
        organization_code,
        organization_name,
        organization_status
      FROM blockchain.organizations
      WHERE organization_code = $1
         OR organization_id::text = $1
      LIMIT 1
      `,
      [organizationCode]
    );

    const organization = organizationResult.rows[0] || {
      organization_id: null,
      organization_code: organizationCode,
      organization_name: organizationCode,
      organization_status: "ACTIVE",
    };

    if (organization.organization_status && organization.organization_status !== "ACTIVE") {
      throw buildError("Organization is not active", 400, "ORGANIZATION_NOT_ACTIVE");
    }

    const fabricResult = await fabricService.submitTransaction(
      "TransferToOrganization",
      [
        senderWalletAddress,
        organizationCode,
        amount.toString(),
        localRequestId,
      ]
    );

    assertFabricSuccess(fabricResult, "FABRIC_ORGANIZATION_TRANSFER_FAILED");

    const fabricTransactionId = extractFabricTransactionId(fabricResult);

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
      RETURNING *
      `,
      [
        localTransactionId,
        localRequestId,
        senderWalletAddress,
        organization.organization_id,
        organization.organization_code || organizationCode,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        fabricTransactionId,
        JSON.stringify(fabricResult || {}),
        sourceSystem,
        requestSource,
        createdBy,
      ]
    );

    await client.query(
      `
      UPDATE blockchain.wallets
      SET
        current_balance = current_balance - $1::numeric,
        currency = $2,
        updated_by = $3,
        updated_at = NOW()
      WHERE wallet_address = $4
      `,
      [amount, currency, createdBy, senderWalletAddress]
    );

    await safeAuditLog(client, {
      requestId: localRequestId,
      eventType: "WALLET_TO_ORGANIZATION_TRANSFER",
      eventCategory: "TRANSACTION",
      entityType: "TRANSACTION",
      entityId: localTransactionId,
      eventStatus: "SUCCESS",
      eventDescription: "Wallet-to-organization transfer completed successfully",
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
      responsePayload: fabricResult,
      sourceSystem,
      requestSource,
      createdBy,
    });

    await client.query("COMMIT");

    logger.info("Wallet-to-organization transfer completed successfully", {
      requestId: localRequestId,
      transactionId: localTransactionId,
      fabricTransactionId,
      rowsInserted: insertTransactionResult.rowCount,
    });

    return {
      transactionId: localTransactionId,
      requestId: localRequestId,
      senderWalletAddress,
      organizationCode,
      amount: amount.toString(),
      currency,
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

    throw error;
  } finally {
    client.release();
  }
};