const crypto = require("crypto");
const db = require("../config/database");
const { compareSecret } = require("../utils/password.util");
const { generateWalletToken } = require("../utils/jwt.util");

const LOGIN_MAX_FAILED_ATTEMPTS = Number(process.env.LOGIN_MAX_FAILED_ATTEMPTS || 5);
const LOGIN_LOCK_MINUTES = Number(process.env.LOGIN_LOCK_MINUTES || 15);

function generateRequestId() {
  return `REQ_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
}

function sanitizeWallet(wallet) {
  return {
    walletId: wallet.wallet_id,
    customerId: wallet.customer_id,
    organizationId: wallet.organization_id,
    organizationCode: wallet.organization_code || null,
    walletAddress: wallet.wallet_address,
    walletStatus: wallet.status || null,
    loginStatus: wallet.login_status,
    lastLoginAt: wallet.last_login_at,
    createdAt: wallet.created_at
  };
}

async function insertAuditLog(client, payload) {
  await client.query(
    `
    INSERT INTO blockchain.audit_logs (
      action,
      event_type,
      event_status,
      entity_type,
      entity_id,
      actor_id,
      source_ip,
      user_agent,
      request_payload,
      response_payload,
      error_message,
      created_at
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
    `,
    [
      payload.action || payload.eventType || "WALLET_LOGIN",
      payload.eventType || "WALLET_LOGIN",
      payload.eventStatus || "UNKNOWN",
      payload.entityType || "WALLET",
      payload.entityId || null,
      payload.actorId || null,
      payload.sourceIp || null,
      payload.userAgent || null,
      payload.requestPayload || {},
      payload.responsePayload || {},
      payload.errorMessage || null
    ]
  );
}

async function findWalletForLogin(client, { walletAddress, customerId }) {
  const params = [];
  const conditions = [];

  if (walletAddress) {
    params.push(walletAddress);
    conditions.push(`wallet_address = $${params.length}`);
  }

  if (customerId) {
    params.push(customerId);
    conditions.push(`customer_id = $${params.length}`);
  }

  const query = `
    SELECT
      wallet_id,
      customer_id,
      organization_id,
      organization_code,
      wallet_address,
      password_hash,
      pin_hash,
      status,
      login_status,
      login_failed_count,
      login_locked_until,
      last_login_at,
      created_at
    FROM blockchain.wallets
    WHERE ${conditions.join(" OR ")}
    LIMIT 1
  `;

  const result = await client.query(query, params);
  return result.rows[0] || null;
}

async function trackFailedLogin(client, wallet, meta, reason) {
  if (!wallet) {
    await insertAuditLog(client, {
      eventType: "WALLET_LOGIN",
      eventStatus: "FAILED",
      entityType: "WALLET",
      entityId: null,
      actorId: null,
      sourceIp: meta.ip,
      userAgent: meta.userAgent,
      requestPayload: {
        walletAddress: meta.walletAddress || null,
        customerId: meta.customerId || null
      },
      responsePayload: { reason },
      errorMessage: reason
    });

    return;
  }

  const nextFailedCount = Number(wallet.login_failed_count || 0) + 1;
  const shouldLock = nextFailedCount >= LOGIN_MAX_FAILED_ATTEMPTS;

  await client.query(
    `
    UPDATE blockchain.wallets
    SET
      login_failed_count = $1,
      last_failed_login_at = NOW(),
      login_locked_until = CASE
        WHEN $2 = TRUE THEN NOW() + ($3 || ' minutes')::INTERVAL
        ELSE login_locked_until
      END,
      login_status = CASE
        WHEN $2 = TRUE THEN 'LOCKED'
        ELSE login_status
      END,
      updated_at = NOW()
    WHERE wallet_id = $4
    `,
    [
      nextFailedCount,
      shouldLock,
      LOGIN_LOCK_MINUTES,
      wallet.wallet_id
    ]
  );

  await insertAuditLog(client, {
    eventType: "WALLET_LOGIN",
    eventStatus: "FAILED",
    entityType: "WALLET",
    entityId: wallet.wallet_address,
    actorId: wallet.customer_id,
    sourceIp: meta.ip,
    userAgent: meta.userAgent,
    requestPayload: {
      walletAddress: meta.walletAddress || null,
      customerId: meta.customerId || null
    },
    responsePayload: {
      failedCount: nextFailedCount,
      locked: shouldLock,
      lockMinutes: shouldLock ? LOGIN_LOCK_MINUTES : null
    },
    errorMessage: reason
  });
}

async function resetSuccessfulLogin(client, wallet, meta) {
  await client.query(
    `
    UPDATE blockchain.wallets
    SET
      login_failed_count = 0,
      login_locked_until = NULL,
      login_status = 'ACTIVE',
      last_login_at = NOW(),
      last_login_ip = $1,
      updated_at = NOW()
    WHERE wallet_id = $2
    `,
    [meta.ip || null, wallet.wallet_id]
  );
}

async function loginWallet(payload, meta = {}) {
  const requestId = generateRequestId();
  const client = await db.pool.connect();

  try {
    await client.query("BEGIN");

    const wallet = await findWalletForLogin(client, {
      walletAddress: payload.walletAddress,
      customerId: payload.customerId
    });

    if (!wallet) {
      await trackFailedLogin(
        client,
        null,
        {
          ...meta,
          walletAddress: payload.walletAddress,
          customerId: payload.customerId
        },
        "Wallet not found"
      );

      await client.query("COMMIT");

      return {
        statusCode: 401,
        body: {
          success: false,
          message: "Invalid login credentials",
          errorCode: "INVALID_CREDENTIALS",
          data: null,
          requestId
        }
      };
    }

    const walletStatus = wallet.status || wallet.wallet_status;

    if (walletStatus && !["ACTIVE", "CREATED"].includes(walletStatus)) {
      await trackFailedLogin(client, wallet, meta, `Wallet status is ${walletStatus}`);

      await client.query("COMMIT");

      return {
        statusCode: 403,
        body: {
          success: false,
          message: "Wallet is not allowed to login",
          errorCode: "WALLET_NOT_ACTIVE",
          data: null,
          requestId
        }
      };
    }

    if (wallet.login_status === "DISABLED" || wallet.login_status === "SUSPENDED") {
      await trackFailedLogin(client, wallet, meta, `Login status is ${wallet.login_status}`);

      await client.query("COMMIT");

      return {
        statusCode: 403,
        body: {
          success: false,
          message: "Wallet login is disabled",
          errorCode: "LOGIN_DISABLED",
          data: null,
          requestId
        }
      };
    }

    if (
      wallet.login_locked_until &&
      new Date(wallet.login_locked_until).getTime() > Date.now()
    ) {
      await insertAuditLog(client, {
        eventType: "WALLET_LOGIN",
        eventStatus: "BLOCKED",
        entityType: "WALLET",
        entityId: wallet.wallet_address,
        actorId: wallet.customer_id,
        sourceIp: meta.ip,
        userAgent: meta.userAgent,
        requestPayload: {
          walletAddress: payload.walletAddress || null,
          customerId: payload.customerId || null
        },
        responsePayload: {
          lockedUntil: wallet.login_locked_until
        },
        errorMessage: "Wallet login is temporarily locked"
      });

      await client.query("COMMIT");

      return {
        statusCode: 423,
        body: {
          success: false,
          message: "Wallet login is temporarily locked. Please try again later.",
          errorCode: "LOGIN_LOCKED",
          data: {
            lockedUntil: wallet.login_locked_until
          },
          requestId
        }
      };
    }

    if (!wallet.password_hash) {
      await trackFailedLogin(client, wallet, meta, "Wallet password hash is missing");

      await client.query("COMMIT");

      return {
        statusCode: 403,
        body: {
          success: false,
          message: "Wallet login is not configured",
          errorCode: "LOGIN_NOT_CONFIGURED",
          data: null,
          requestId
        }
      };
    }

    const passwordValid = await compareSecret(payload.password, wallet.password_hash);

    if (!passwordValid) {
      await trackFailedLogin(client, wallet, meta, "Invalid password");

      await client.query("COMMIT");

      return {
        statusCode: 401,
        body: {
          success: false,
          message: "Invalid login credentials",
          errorCode: "INVALID_CREDENTIALS",
          data: null,
          requestId
        }
      };
    }

    if (wallet.pin_hash) {
      if (!payload.pin) {
        await trackFailedLogin(client, wallet, meta, "PIN is required");

        await client.query("COMMIT");

        return {
          statusCode: 400,
          body: {
            success: false,
            message: "PIN is required for this wallet",
            errorCode: "PIN_REQUIRED",
            data: null,
            requestId
          }
        };
      }

      const pinValid = await compareSecret(payload.pin, wallet.pin_hash);

      if (!pinValid) {
        await trackFailedLogin(client, wallet, meta, "Invalid PIN");

        await client.query("COMMIT");

        return {
          statusCode: 401,
          body: {
            success: false,
            message: "Invalid login credentials",
            errorCode: "INVALID_CREDENTIALS",
            data: null,
            requestId
          }
        };
      }
    }

    await resetSuccessfulLogin(client, wallet, meta);

    const token = generateWalletToken(wallet);

    await insertAuditLog(client, {
      eventType: "WALLET_LOGIN",
      eventStatus: "SUCCESS",
      entityType: "WALLET",
      entityId: wallet.wallet_address,
      actorId: wallet.customer_id,
      sourceIp: meta.ip,
      userAgent: meta.userAgent,
      requestPayload: {
        walletAddress: payload.walletAddress || null,
        customerId: payload.customerId || null
      },
      responsePayload: {
        tokenIssued: true,
        expiresIn: process.env.JWT_EXPIRES_IN || "1h"
      },
      errorMessage: null
    });

    await client.query("COMMIT");

    return {
      statusCode: 200,
      body: {
        success: true,
        message: "Wallet login successful",
        data: {
          token,
          tokenType: "Bearer",
          expiresIn: process.env.JWT_EXPIRES_IN || "1h",
          wallet: sanitizeWallet(wallet)
        },
        requestId
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");

    return {
      statusCode: 500,
      body: {
        success: false,
        message: "Wallet login failed",
        errorCode: "WALLET_LOGIN_ERROR",
        error: process.env.NODE_ENV === "development" ? error.message : undefined,
        data: null,
        requestId
      }
    };
  } finally {
    client.release();
  }
}

module.exports = {
  loginWallet
};
