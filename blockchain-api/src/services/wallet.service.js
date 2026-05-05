const crypto = require("crypto");
const databaseService = require("./database.service");
const fabricService = require("./fabric.service");
const logger = require("../utils/logger");

const WALLET_SERVICE_VERSION = "AUTOCOMMIT_DUAL_VERIFY_2026_05_05_V2";

function buildError(
  message,
  statusCode = 500,
  errorCode = "WALLET_SERVICE_ERROR"
) {
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

function extractFabricWallet(fabricResult) {
  const wallet =
    fabricResult?.data?.data?.wallet ||
    fabricResult?.data?.wallet ||
    fabricResult?.wallet ||
    null;

  if (!wallet) {
    throw buildError(
      "Fabric CreateWallet succeeded but wallet object was not found in response",
      500,
      "FABRIC_WALLET_RESPONSE_INVALID"
    );
  }

  if (!wallet.walletAddress) {
    throw buildError(
      "Fabric CreateWallet succeeded but walletAddress was not returned",
      500,
      "FABRIC_WALLET_ADDRESS_MISSING"
    );
  }

  return wallet;
}

function extractFabricTransactionId(fabricResult) {
  return (
    fabricResult?.commit?.transactionId ||
    fabricResult?.data?.data?.wallet?.createdTxId ||
    fabricResult?.data?.wallet?.createdTxId ||
    fabricResult?.data?.data?.transaction?.transactionId ||
    fabricResult?.transactionId ||
    fabricResult?.txId ||
    null
  );
}

async function safeAuditLog(pool, payload) {
  try {
    await pool.query(
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

async function safeMirrorToBlockchainWallet(pool, payload) {
  try {
    await pool.query(
      `
      INSERT INTO blockchain.blockchain_wallet (
        wallet_id,
        wallet_address,
        enterprise_customer_id,
        organization_id,
        wallet_type,
        status,
        ledger_tx_id,
        created_at,
        updated_at,
        customer_id
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        'CUSTOMER',
        $5,
        $6,
        NOW(),
        NOW(),
        $3
      )
      ON CONFLICT (wallet_id)
      DO UPDATE SET
        wallet_address = EXCLUDED.wallet_address,
        enterprise_customer_id = EXCLUDED.enterprise_customer_id,
        organization_id = EXCLUDED.organization_id,
        wallet_type = EXCLUDED.wallet_type,
        status = EXCLUDED.status,
        ledger_tx_id = EXCLUDED.ledger_tx_id,
        customer_id = EXCLUDED.customer_id,
        updated_at = NOW()
      `,
      [
        payload.walletId,
        payload.walletAddress,
        payload.customerId,
        payload.organizationId,
        payload.status || "ACTIVE",
        payload.fabricTransactionId,
      ]
    );

    logger.info("Wallet mirrored to blockchain.blockchain_wallet", {
      requestId: payload.requestId,
      customerId: payload.customerId,
      walletAddress: payload.walletAddress,
    });
  } catch (error) {
    logger.warn("Wallet mirror to blockchain.blockchain_wallet skipped", {
      requestId: payload.requestId,
      customerId: payload.customerId,
      walletAddress: payload.walletAddress,
      error: error.message,
    });
  }
}

exports.createWallet = async function createWallet(
  payload = {},
  requestIdFromHeader = null
) {
  const pool = databaseService.getPool();

  const localRequestId =
    requestIdFromHeader || payload.requestId || generateRequestId();

  const customerId = payload.customerId;
  const organizationId = payload.organizationId || payload.organizationCode;
  const organizationCode = payload.organizationCode || payload.organizationId;
  const fullName = payload.fullName;
  const nationalIdHash = payload.nationalIdHash;
  const mobileHash = payload.mobileHash;
  const emailHash = payload.emailHash;
  const passwordHash = payload.passwordHash;
  const initialBalance = Number(payload.initialBalance || 0);
  const requestSource = payload.requestSource || "API";
  const sourceSystem = payload.sourceSystem || "BLOCKCHAIN_API";
  const createdBy = payload.createdBy || "system";

  try {
    logger.info("WALLET_SERVICE_VERSION", {
      version: WALLET_SERVICE_VERSION,
      requestId: localRequestId,
      customerId,
    });

    if (!customerId) {
      throw buildError("customerId is required", 400, "CUSTOMER_ID_REQUIRED");
    }

    if (!organizationId) {
      throw buildError(
        "organizationId is required",
        400,
        "ORGANIZATION_ID_REQUIRED"
      );
    }

    if (!fullName) {
      throw buildError("fullName is required", 400, "FULL_NAME_REQUIRED");
    }

    if (!nationalIdHash) {
      throw buildError(
        "nationalIdHash is required",
        400,
        "NATIONAL_ID_HASH_REQUIRED"
      );
    }

    if (!mobileHash) {
      throw buildError("mobileHash is required", 400, "MOBILE_HASH_REQUIRED");
    }

    if (!emailHash) {
      throw buildError("emailHash is required", 400, "EMAIL_HASH_REQUIRED");
    }

    if (!passwordHash) {
      throw buildError(
        "passwordHash is required",
        400,
        "PASSWORD_HASH_REQUIRED"
      );
    }

    if (Number.isNaN(initialBalance) || initialBalance < 0) {
      throw buildError(
        "initialBalance must be a valid positive number",
        400,
        "INVALID_INITIAL_BALANCE"
      );
    }

    const dbInfo = await pool.query(`
      SELECT
        inet_server_addr() AS server_ip,
        inet_server_port() AS server_port,
        current_database() AS database_name,
        current_schema() AS schema_name;
    `);

    logger.info("Wallet PostgreSQL connection before wallet creation", {
      requestId: localRequestId,
      customerId,
      db: dbInfo.rows[0],
    });

    const existingWalletResult = await pool.query(
      `
      SELECT
        wallet_id,
        wallet_address,
        customer_id,
        wallet_status
      FROM blockchain.wallets
      WHERE customer_id = $1
      LIMIT 1
      `,
      [customerId]
    );

    if (existingWalletResult.rows.length > 0) {
      const existingWallet = existingWalletResult.rows[0];

      if (
        existingWallet.wallet_address &&
        !existingWallet.wallet_address.startsWith("WALLET_PENDING_REQ")
      ) {
        throw buildError(
          `Wallet already exists for customerId: ${customerId}`,
          409,
          "WALLET_ALREADY_EXISTS"
        );
      }
    }

    const fabricResult = await fabricService.submitTransaction("CreateWallet", [
      customerId,
      organizationCode,
      fullName,
      nationalIdHash,
      mobileHash,
      emailHash,
      passwordHash,
      initialBalance.toString(),
    ]);

    assertFabricSuccess(fabricResult, "FABRIC_WALLET_CREATION_FAILED");

    const fabricWallet = extractFabricWallet(fabricResult);
    const finalWalletAddress = fabricWallet.walletAddress;
    const finalCurrency = fabricWallet.currency || payload.currency || "TOKEN";
    const finalBalance =
      fabricWallet.balance !== undefined && fabricWallet.balance !== null
        ? Number(fabricWallet.balance)
        : initialBalance;

    const fabricTransactionId = extractFabricTransactionId(fabricResult);

    const walletResult = await pool.query(
      `
      INSERT INTO blockchain.wallets (
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        organization_code,
        full_name,
        current_balance,
        currency,
        wallet_status,
        fabric_transaction_id,
        fabric_response,
        request_id,
        request_source,
        source_system,
        created_by,
        updated_by,
        created_at,
        updated_at
      )
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::numeric,
        $7,
        $8,
        $9,
        $10::jsonb,
        $11,
        $12,
        $13,
        $14,
        $14,
        NOW(),
        NOW()
      )
      ON CONFLICT (customer_id)
      DO UPDATE SET
        wallet_address = EXCLUDED.wallet_address,
        organization_id = EXCLUDED.organization_id,
        organization_code = EXCLUDED.organization_code,
        full_name = EXCLUDED.full_name,
        current_balance = EXCLUDED.current_balance,
        currency = EXCLUDED.currency,
        wallet_status = EXCLUDED.wallet_status,
        fabric_transaction_id = EXCLUDED.fabric_transaction_id,
        fabric_response = EXCLUDED.fabric_response,
        request_id = EXCLUDED.request_id,
        request_source = EXCLUDED.request_source,
        source_system = EXCLUDED.source_system,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
      `,
      [
        finalWalletAddress,
        customerId,
        organizationId || fabricWallet.organizationId || null,
        organizationCode || fabricWallet.organizationId || null,
        fullName || fabricWallet.fullName || null,
        finalBalance,
        finalCurrency,
        fabricWallet.status || "ACTIVE",
        fabricTransactionId,
        JSON.stringify(fabricResult || {}),
        localRequestId,
        requestSource,
        sourceSystem,
        createdBy,
      ]
    );

    const dbWallet = walletResult.rows[0];

    logger.info("Wallet PostgreSQL autocommit insert returned row", {
      requestId: localRequestId,
      customerId,
      finalWalletAddress,
      rowsInsertedOrUpdated: walletResult.rowCount,
      dbWallet,
    });

    if (!dbWallet) {
      throw buildError(
        "Wallet was created on Fabric but was not saved in PostgreSQL",
        500,
        "POSTGRES_WALLET_SAVE_FAILED"
      );
    }

    if (dbWallet.wallet_address !== finalWalletAddress) {
      throw buildError(
        `Wallet address alignment failed. Fabric=${finalWalletAddress}, PostgreSQL=${dbWallet.wallet_address}`,
        500,
        "WALLET_ADDRESS_ALIGNMENT_FAILED"
      );
    }

    const verifyByCustomerResult = await pool.query(
      `
      SELECT
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        organization_code,
        full_name,
        wallet_status,
        current_balance,
        currency,
        request_id,
        created_at,
        updated_at
      FROM blockchain.wallets
      WHERE customer_id = $1
      LIMIT 1
      `,
      [customerId]
    );

    const verifyByAddressResult = await pool.query(
      `
      SELECT
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        organization_code,
        full_name,
        wallet_status,
        current_balance,
        currency,
        request_id,
        created_at,
        updated_at
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1
      `,
      [finalWalletAddress]
    );

    const verifyByWalletIdResult = await pool.query(
      `
      SELECT
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        organization_code,
        full_name,
        wallet_status,
        current_balance,
        currency,
        request_id,
        created_at,
        updated_at
      FROM blockchain.wallets
      WHERE wallet_id = $1
      LIMIT 1
      `,
      [dbWallet.wallet_id]
    );

    logger.info("Wallet PostgreSQL autocommit verification result", {
      requestId: localRequestId,
      customerId,
      finalWalletAddress,
      dbWalletId: dbWallet.wallet_id,
      rowsFoundByCustomer: verifyByCustomerResult.rows.length,
      rowsFoundByAddress: verifyByAddressResult.rows.length,
      rowsFoundByWalletId: verifyByWalletIdResult.rows.length,
      rowsByCustomer: verifyByCustomerResult.rows,
      rowsByAddress: verifyByAddressResult.rows,
      rowsByWalletId: verifyByWalletIdResult.rows,
    });

    const verifiedWallet =
      verifyByCustomerResult.rows[0] ||
      verifyByAddressResult.rows[0] ||
      verifyByWalletIdResult.rows[0];

    if (!verifiedWallet) {
      throw buildError(
        `Wallet was created on Fabric but is not visible in PostgreSQL after autocommit insert. customerId=${customerId}, walletAddress=${finalWalletAddress}, walletId=${dbWallet.wallet_id}`,
        500,
        "POSTGRES_WALLET_AUTOCOMMIT_VERIFICATION_FAILED"
      );
    }

    await safeMirrorToBlockchainWallet(pool, {
      requestId: localRequestId,
      walletId: verifiedWallet.wallet_id,
      walletAddress: verifiedWallet.wallet_address,
      customerId: verifiedWallet.customer_id,
      organizationId: verifiedWallet.organization_id,
      status: verifiedWallet.wallet_status,
      fabricTransactionId,
    });

    await safeAuditLog(pool, {
      requestId: localRequestId,
      eventType: "WALLET_CREATED",
      eventCategory: "WALLET",
      entityType: "WALLET",
      entityId: finalWalletAddress,
      eventStatus: "SUCCESS",
      eventDescription:
        "Wallet created successfully and aligned with Fabric wallet address",
      requestPayload: {
        customerId,
        organizationId,
        organizationCode,
        fullName,
        initialBalance,
        requestSource,
        sourceSystem,
      },
      responsePayload: {
        walletAddress: finalWalletAddress,
        fabricTransactionId,
        fabricResult,
      },
      sourceSystem,
      requestSource,
      createdBy,
    });

    logger.info("Wallet created and verified in PostgreSQL", {
      requestId: localRequestId,
      customerId,
      walletAddress: finalWalletAddress,
      fabricTransactionId,
      postgresWalletId: verifiedWallet.wallet_id,
      postgresRequestId: verifiedWallet.request_id,
    });

    return {
      requestId: localRequestId,
      wallet: {
        walletId: verifiedWallet.wallet_id,
        customerId: verifiedWallet.customer_id,
        organizationId: verifiedWallet.organization_id,
        organizationCode: verifiedWallet.organization_code,
        walletAddress: verifiedWallet.wallet_address,
        fullName: verifiedWallet.full_name,
        balance: String(verifiedWallet.current_balance),
        currency: verifiedWallet.currency,
        status: verifiedWallet.wallet_status,
        fabricTransactionId,
        createdAt: verifiedWallet.created_at,
        updatedAt: verifiedWallet.updated_at,
      },
      fabricResult,
    };
  } catch (error) {
    logger.error("Wallet creation service failed", {
      requestId: localRequestId,
      customerId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
};

exports.getWalletByCustomerId = async function getWalletByCustomerId(customerId) {
  const pool = databaseService.getPool();

  const result = await pool.query(
    `
    SELECT *
    FROM blockchain.wallets
    WHERE customer_id = $1
    LIMIT 1
    `,
    [customerId]
  );

  return result.rows[0] || null;
};

exports.getWalletByAddress = async function getWalletByAddress(walletAddress) {
  const pool = databaseService.getPool();

  const result = await pool.query(
    `
    SELECT *
    FROM blockchain.wallets
    WHERE wallet_address = $1
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rows[0] || null;
};