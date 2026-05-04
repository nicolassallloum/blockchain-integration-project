const crypto = require("crypto");
const db = require("../config/database");
const fabricService = require("./fabric.service");

class AppError extends Error {
  constructor(message, statusCode = 500, errorCode = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

class TransactionService {
  generateTransactionId() {
    return crypto.randomUUID();
  }

  generateRequestId() {
    return `REQ_${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
  }

  validateTransferPayload(body) {
    const errors = [];

    if (!body.senderWalletAddress) {
      errors.push("senderWalletAddress is required");
    }

    if (!body.receiverWalletAddress) {
      errors.push("receiverWalletAddress is required");
    }

    if (!body.amount) {
      errors.push("amount is required");
    }

    if (body.amount && isNaN(Number(body.amount))) {
      errors.push("amount must be numeric");
    }

    if (Number(body.amount) <= 0) {
      errors.push("amount must be greater than zero");
    }

    if (
      body.senderWalletAddress &&
      body.receiverWalletAddress &&
      body.senderWalletAddress === body.receiverWalletAddress
    ) {
      errors.push("senderWalletAddress and receiverWalletAddress cannot be the same");
    }

    if (!body.currency) {
      errors.push("currency is required");
    }

    if (!body.transactionPurpose) {
      errors.push("transactionPurpose is required");
    }

    if (errors.length > 0) {
      throw new AppError(
        `Validation failed: ${errors.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }
  }

  async getWalletByAddress(client, walletAddress) {
    const query = `
      SELECT
        wallet_id,
        wallet_address,
        customer_id,
        organization_id,
        organization_code,
        current_balance,
        wallet_status,
        is_active,
        created_at,
        updated_at
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1
    `;

    const result = await client.query(query, [walletAddress]);

    return result.rows[0] || null;
  }

  validateSenderWallet(wallet) {
    if (!wallet) {
      throw new AppError(
        "Sender wallet not found",
        404,
        "SENDER_WALLET_NOT_FOUND"
      );
    }

    if (!wallet.is_active) {
      throw new AppError(
        "Sender wallet is inactive",
        400,
        "SENDER_WALLET_INACTIVE"
      );
    }

    if (wallet.wallet_status !== "ACTIVE") {
      throw new AppError(
        `Sender wallet is not active. Current status: ${wallet.wallet_status}`,
        400,
        "SENDER_WALLET_STATUS_INVALID"
      );
    }
  }

  validateReceiverWallet(wallet) {
    if (!wallet) {
      throw new AppError(
        "Receiver wallet not found",
        404,
        "RECEIVER_WALLET_NOT_FOUND"
      );
    }

    if (!wallet.is_active) {
      throw new AppError(
        "Receiver wallet is inactive",
        400,
        "RECEIVER_WALLET_INACTIVE"
      );
    }

    if (wallet.wallet_status !== "ACTIVE") {
      throw new AppError(
        `Receiver wallet is not active. Current status: ${wallet.wallet_status}`,
        400,
        "RECEIVER_WALLET_STATUS_INVALID"
      );
    }
  }

  validateBalance(senderWallet, amount) {
    const senderBalance = Number(senderWallet.current_balance || 0);
    const transferAmount = Number(amount);

    if (senderBalance < transferAmount) {
      throw new AppError(
        "Insufficient sender wallet balance",
        400,
        "INSUFFICIENT_BALANCE"
      );
    }
  }

async insertIntegrationRequest(client, payload) {
  const query = `
    INSERT INTO blockchain.integration_requests (
      request_id,
      request_type,
      operation_name,
      request_source,
      source_system,
      reference_id,
      request_payload,
      request_status,
      created_by,
      created_at
    )
    VALUES (
      $1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, NOW()
    )
    RETURNING *
  `;

  const values = [
    payload.requestId,
    "WALLET_TO_WALLET_TRANSFER",
    "TransferBetweenWallets",
    payload.requestSource || "API",
    payload.sourceSystem || "BLOCKCHAIN_API",
    payload.referenceId,
    JSON.stringify(payload.requestPayload || {}),
    "RECEIVED",
    payload.createdBy || "api_user"
  ];

  const result = await client.query(query, values);
  return result.rows[0];
}

  async updateIntegrationRequest(client, payload) {
    const query = `
      UPDATE blockchain.integration_requests
      SET
        request_status = $2,
        response_payload = $3::jsonb,
        error_code = $4,
        error_message = $5,
        updated_at = NOW()
      WHERE request_id = $1
      RETURNING *
    `;

    const values = [
      payload.requestId,
      payload.status,
      JSON.stringify(payload.responsePayload || {}),
      payload.errorCode || null,
      payload.errorMessage || null
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async insertTransaction(client, payload) {
    const query = `
      INSERT INTO blockchain.transactions (
        transaction_id,
        transaction_type,
        sender_wallet_id,
        sender_wallet_address,
        sender_customer_id,
        receiver_wallet_id,
        receiver_wallet_address,
        receiver_customer_id,
        amount,
        currency,
        transaction_purpose,
        transaction_description,
        transaction_status,
        risk_level,
        fabric_tx_id,
        fabric_status,
        request_id,
        metadata,
        created_by,
        created_at
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18::jsonb, $19, NOW()
      )
      RETURNING *
    `;

    const values = [
      payload.transactionId,
      "TRANSFER",
      payload.senderWallet.wallet_id,
      payload.senderWallet.wallet_address,
      payload.senderWallet.customer_id,
      payload.receiverWallet.wallet_id,
      payload.receiverWallet.wallet_address,
      payload.receiverWallet.customer_id,
      payload.amount,
      payload.currency,
      payload.transactionPurpose,
      payload.transactionDescription || null,
      payload.transactionStatus,
      payload.riskLevel || "LOW",
      payload.fabricTxId || null,
      payload.fabricStatus || "PENDING",
      payload.requestId,
      JSON.stringify(payload.metadata || {}),
      payload.createdBy
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async updateTransactionStatus(client, payload) {
    const query = `
      UPDATE blockchain.transactions
      SET
        transaction_status = $2,
        fabric_tx_id = $3,
        fabric_status = $4,
        error_code = $5,
        error_message = $6,
        updated_at = NOW()
      WHERE transaction_id = $1
      RETURNING *
    `;

    const values = [
      payload.transactionId,
      payload.transactionStatus,
      payload.fabricTxId || null,
      payload.fabricStatus || null,
      payload.errorCode || null,
      payload.errorMessage || null
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async updateWalletBalances(client, payload) {
    const amount = Number(payload.amount);

    const debitQuery = `
      UPDATE blockchain.wallets
      SET
        current_balance = current_balance - $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE wallet_address = $3
      RETURNING wallet_address, current_balance
    `;

    const creditQuery = `
      UPDATE blockchain.wallets
      SET
        current_balance = current_balance + $1,
        updated_at = NOW(),
        updated_by = $2
      WHERE wallet_address = $3
      RETURNING wallet_address, current_balance
    `;

    const debitResult = await client.query(debitQuery, [
      amount,
      payload.createdBy,
      payload.senderWalletAddress
    ]);

    const creditResult = await client.query(creditQuery, [
      amount,
      payload.createdBy,
      payload.receiverWalletAddress
    ]);

    return {
      sender: debitResult.rows[0],
      receiver: creditResult.rows[0]
    };
  }

  async insertAuditLog(client, payload) {
    const query = `
      INSERT INTO blockchain.audit_logs (
        audit_id,
        request_id,
        entity_type,
        entity_id,
        action,
        action_status,
        old_value,
        new_value,
        ip_address,
        user_agent,
        error_code,
        error_message,
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
        $6::jsonb,
        $7::jsonb,
        $8,
        $9,
        $10,
        $11,
        $12,
        NOW()
      )
      RETURNING *
    `;

    const values = [
      payload.requestId,
      payload.entityType,
      payload.entityId,
      payload.action,
      payload.actionStatus,
      JSON.stringify(payload.oldValue || {}),
      JSON.stringify(payload.newValue || {}),
      payload.ipAddress || null,
      payload.userAgent || null,
      payload.errorCode || null,
      payload.errorMessage || null,
      payload.createdBy || "api_user"
    ];

    const result = await client.query(query, values);
    return result.rows[0];
  }

  async submitFabricWalletTransfer(payload) {
    /**
     * Chaincode function expected:
     *
     * TransferBetweenWallets(
     *   transactionId,
     *   senderWalletAddress,
     *   receiverWalletAddress,
     *   amount,
     *   currency,
     *   transactionPurpose
     * )
     */

    const args = [
      payload.transactionId,
      payload.senderWalletAddress,
      payload.receiverWalletAddress,
      String(payload.amount),
      payload.currency,
      payload.transactionPurpose
    ];

    const fabricResult = await fabricService.submitTransaction(
      "TransferBetweenWallets",
      args
    );

    return fabricResult;
  }

  extractFabricTxId(fabricResult) {
    if (!fabricResult) {
      return null;
    }

    if (fabricResult.transactionId) {
      return fabricResult.transactionId;
    }

    if (fabricResult.txId) {
      return fabricResult.txId;
    }

    if (fabricResult.fabricTxId) {
      return fabricResult.fabricTxId;
    }

    if (fabricResult.data && fabricResult.data.transactionId) {
      return fabricResult.data.transactionId;
    }

    return null;
  }

  async walletToWalletTransfer({ requestId, body, ipAddress, userAgent, createdBy }) {
    const client = await db.getClient();

    const transactionId = this.generateTransactionId();

    try {
      this.validateTransferPayload(body);

      const {
        senderWalletAddress,
        receiverWalletAddress,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        requestSource,
        sourceSystem
      } = body;

      await client.query("BEGIN");

      await this.insertIntegrationRequest(client, {
        requestId,
        requestSource,
        sourceSystem,
        referenceId: transactionId,
        requestPayload: body,
        createdBy
      });

      const senderWallet = await this.getWalletByAddress(client, senderWalletAddress);
      const receiverWallet = await this.getWalletByAddress(client, receiverWalletAddress);

      this.validateSenderWallet(senderWallet);
      this.validateReceiverWallet(receiverWallet);
      this.validateBalance(senderWallet, amount);

      const pendingTransaction = await this.insertTransaction(client, {
        transactionId,
        senderWallet,
        receiverWallet,
        amount,
        currency,
        transactionPurpose,
        transactionDescription,
        transactionStatus: "PENDING",
        fabricStatus: "PENDING",
        requestId,
        metadata: {
          requestSource: requestSource || "API",
          sourceSystem: sourceSystem || "BLOCKCHAIN_API",
          senderBalanceBefore: senderWallet.current_balance,
          receiverBalanceBefore: receiverWallet.current_balance
        },
        createdBy
      });

      await this.insertAuditLog(client, {
        requestId,
        entityType: "TRANSACTION",
        entityId: transactionId,
        action: "WALLET_TO_WALLET_TRANSFER_REQUESTED",
        actionStatus: "PENDING",
        oldValue: {},
        newValue: {
          transactionId,
          senderWalletAddress,
          receiverWalletAddress,
          amount,
          currency,
          transactionPurpose
        },
        ipAddress,
        userAgent,
        createdBy
      });

      let fabricResult;
      let fabricTxId;

      try {
        fabricResult = await this.submitFabricWalletTransfer({
          transactionId,
          senderWalletAddress,
          receiverWalletAddress,
          amount,
          currency,
          transactionPurpose
        });

        fabricTxId = this.extractFabricTxId(fabricResult);

        await this.updateWalletBalances(client, {
          amount,
          senderWalletAddress,
          receiverWalletAddress,
          createdBy
        });

        const completedTransaction = await this.updateTransactionStatus(client, {
          transactionId,
          transactionStatus: "COMPLETED",
          fabricTxId,
          fabricStatus: "COMMITTED"
        });

        await this.updateIntegrationRequest(client, {
          requestId,
          status: "COMPLETED",
          responsePayload: {
            transactionId,
            fabricTxId,
            fabricStatus: "COMMITTED"
          }
        });

        await this.insertAuditLog(client, {
          requestId,
          entityType: "TRANSACTION",
          entityId: transactionId,
          action: "WALLET_TO_WALLET_TRANSFER_COMPLETED",
          actionStatus: "COMPLETED",
          oldValue: {
            transactionStatus: pendingTransaction.transaction_status
          },
          newValue: {
            transactionStatus: "COMPLETED",
            fabricTxId,
            fabricResult
          },
          ipAddress,
          userAgent,
          createdBy
        });

        await client.query("COMMIT");

        return {
          transactionId,
          requestId,
          fabricTxId,
          transactionStatus: "COMPLETED",
          fabricStatus: "COMMITTED",
          senderWalletAddress,
          receiverWalletAddress,
          amount,
          currency,
          transactionPurpose,
          transaction: completedTransaction
        };
      } catch (fabricError) {
        await this.updateTransactionStatus(client, {
          transactionId,
          transactionStatus: "FAILED",
          fabricTxId: null,
          fabricStatus: "FAILED",
          errorCode: "FABRIC_SUBMISSION_FAILED",
          errorMessage: fabricError.message
        });

        await this.updateIntegrationRequest(client, {
          requestId,
          status: "FAILED",
          responsePayload: {
            transactionId,
            fabricStatus: "FAILED"
          },
          errorCode: "FABRIC_SUBMISSION_FAILED",
          errorMessage: fabricError.message
        });

        await this.insertAuditLog(client, {
          requestId,
          entityType: "TRANSACTION",
          entityId: transactionId,
          action: "WALLET_TO_WALLET_TRANSFER_FAILED",
          actionStatus: "FAILED",
          oldValue: {
            transactionStatus: "PENDING"
          },
          newValue: {
            transactionStatus: "FAILED",
            errorMessage: fabricError.message
          },
          ipAddress,
          userAgent,
          errorCode: "FABRIC_SUBMISSION_FAILED",
          errorMessage: fabricError.message,
          createdBy
        });

        await client.query("COMMIT");

        throw new AppError(
          `Fabric transaction submission failed: ${fabricError.message}`,
          500,
          "FABRIC_SUBMISSION_FAILED"
        );
      }
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError.message);
      }

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        error.message || "Wallet-to-wallet transfer failed",
        500,
        "WALLET_TRANSFER_FAILED"
      );
    } finally {
      client.release();
    }
  }
}

module.exports = new TransactionService();
