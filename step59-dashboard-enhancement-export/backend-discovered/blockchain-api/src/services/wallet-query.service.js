const fabricService = require("./fabric.service");
const databaseService = require("./database.service");
const logger = require("../utils/logger");

class WalletQueryService {
  safeParseFabricResult(result) {
    if (!result) return null;

    if (Buffer.isBuffer(result)) {
      const text = result.toString("utf8");
      if (!text || text.trim() === "") return null;

      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }

    if (typeof result === "string") {
      if (result.trim() === "") return null;

      try {
        return JSON.parse(result);
      } catch {
        return result;
      }
    }

    return result;
  }

  extractWalletFromFabricResponse(fabricResult) {
    const parsed = this.safeParseFabricResult(fabricResult);

    return (
      parsed?.data?.wallet ||
      parsed?.data?.data?.wallet ||
      parsed?.wallet ||
      parsed ||
      null
    );
  }

  async getWalletByAddress(walletAddress, requestId) {
    const cleanWalletAddress = walletAddress.trim();

    const dbWallet = await this.getWalletByAddressFromDatabase(cleanWalletAddress);

    if (dbWallet?.customer_id) {
      try {
        const fabricResult = await fabricService.evaluateTransaction(
          "GetWalletByCustomerId",
          [dbWallet.customer_id]
        );

        const fabricWallet = this.extractWalletFromFabricResponse(fabricResult);

        if (fabricWallet?.walletAddress) {
          return {
            success: true,
            httpStatus: 200,
            message: "Wallet details retrieved successfully from blockchain using customerId mapping",
            source: "FABRIC",
            data: this.normalizeWallet({
              ...dbWallet,
              ...fabricWallet,
              walletAddress: fabricWallet.walletAddress,
            }),
          };
        }
      } catch (error) {
        logger.warn("Fabric wallet query by customerId failed. Returning PostgreSQL wallet.", {
          requestId,
          walletAddress: cleanWalletAddress,
          error: error.message,
        });
      }
    }

    if (!dbWallet) {
      return {
        success: false,
        httpStatus: 404,
        message: `Wallet not found for walletAddress: ${cleanWalletAddress}`,
        source: "POSTGRESQL",
        data: null,
      };
    }

    return {
      success: true,
      httpStatus: 200,
      message: "Wallet details retrieved successfully from PostgreSQL fallback",
      source: "POSTGRESQL",
      data: this.normalizeWallet(dbWallet),
    };
  }

  async getWalletBalance(walletAddress, requestId) {
    const cleanWalletAddress = walletAddress.trim();

    const dbWallet = await this.getWalletByAddressFromDatabase(cleanWalletAddress);

    if (dbWallet?.customer_id) {
      try {
        const fabricResult = await fabricService.evaluateTransaction(
          "GetWalletByCustomerId",
          [dbWallet.customer_id]
        );

        const fabricWallet = this.extractWalletFromFabricResponse(fabricResult);

        if (fabricWallet?.walletAddress) {
          return {
            success: true,
            httpStatus: 200,
            message: "Wallet balance retrieved successfully from blockchain using customerId mapping",
            source: "FABRIC",
            data: this.normalizeBalance(fabricWallet.walletAddress, fabricWallet),
          };
        }
      } catch (error) {
        logger.warn("Fabric balance query by customerId failed. Returning PostgreSQL balance.", {
          requestId,
          walletAddress: cleanWalletAddress,
          error: error.message,
        });
      }
    }

    const dbBalance = await this.getWalletBalanceFromDatabase(cleanWalletAddress);

    if (!dbBalance) {
      return {
        success: false,
        httpStatus: 404,
        message: `Wallet balance not found for walletAddress: ${cleanWalletAddress}`,
        source: "POSTGRESQL",
        data: null,
      };
    }

    return {
      success: true,
      httpStatus: 200,
      message: "Wallet balance retrieved successfully from PostgreSQL fallback",
      source: "POSTGRESQL",
      data: this.normalizeBalance(cleanWalletAddress, dbBalance),
    };
  }

  async getWalletHistory(walletAddress, options = {}, requestId) {
    const cleanWalletAddress = walletAddress.trim();

    const limit = Number(options.limit || 50);
    const offset = Number(options.offset || 0);

    const dbHistory = await this.getWalletHistoryFromDatabase(
      cleanWalletAddress,
      limit,
      offset
    );

    return {
      success: true,
      httpStatus: 200,
      message: "Wallet transaction history retrieved successfully from PostgreSQL fallback",
      source: "POSTGRESQL",
      data: {
        walletAddress: cleanWalletAddress,
        limit,
        offset,
        total: dbHistory.total,
        transactions: dbHistory.transactions.map((transaction) =>
          this.normalizeTransaction(transaction)
        ),
      },
    };
  }

  normalizeWallet(wallet) {
    return {
      walletAddress:
        wallet.walletAddress ||
        wallet.wallet_address ||
        wallet.address ||
        null,

      customerId:
        wallet.customerId ||
        wallet.customer_id ||
        null,

      organizationId:
        wallet.organizationId ||
        wallet.organization_id ||
        null,

      organizationCode:
        wallet.organizationCode ||
        wallet.organization_code ||
        wallet.organizationId ||
        null,

      fullName:
        wallet.fullName ||
        wallet.full_name ||
        null,

      status:
        wallet.status ||
        wallet.wallet_status ||
        "UNKNOWN",

      currency:
        wallet.currency ||
        "TOKEN",

      balance:
        wallet.balance !== undefined
          ? String(wallet.balance)
          : wallet.current_balance !== undefined
          ? String(wallet.current_balance)
          : "0",

      createdAt:
        wallet.createdAt ||
        wallet.created_at ||
        null,

      updatedAt:
        wallet.updatedAt ||
        wallet.updated_at ||
        null,
    };
  }

  normalizeBalance(walletAddress, balancePayload) {
    if (
      typeof balancePayload === "string" ||
      typeof balancePayload === "number"
    ) {
      return {
        walletAddress,
        balance: String(balancePayload),
        currency: "TOKEN",
      };
    }

    return {
      walletAddress:
        balancePayload.walletAddress ||
        balancePayload.wallet_address ||
        walletAddress,

      balance:
        balancePayload.balance !== undefined
          ? String(balancePayload.balance)
          : balancePayload.current_balance !== undefined
          ? String(balancePayload.current_balance)
          : "0",

      currency:
        balancePayload.currency ||
        "TOKEN",

      status:
        balancePayload.status ||
        balancePayload.wallet_status ||
        "ACTIVE",

      lastUpdatedAt:
        balancePayload.updatedAt ||
        balancePayload.updated_at ||
        balancePayload.lastUpdatedAt ||
        null,
    };
  }

  normalizeTransaction(transaction) {
    return {
      transactionId:
        transaction.transactionId ||
        transaction.transaction_id ||
        transaction.id ||
        null,

      requestId:
        transaction.requestId ||
        transaction.request_id ||
        null,

      fabricTransactionId:
        transaction.fabricTransactionId ||
        transaction.fabric_transaction_id ||
        null,

      fromWalletAddress:
        transaction.fromWalletAddress ||
        transaction.from_wallet_address ||
        transaction.senderWalletAddress ||
        transaction.sender_wallet_address ||
        null,

      toWalletAddress:
        transaction.toWalletAddress ||
        transaction.to_wallet_address ||
        transaction.receiverWalletAddress ||
        transaction.receiver_wallet_address ||
        null,

      amount:
        transaction.amount !== undefined
          ? String(transaction.amount)
          : "0",

      currency:
        transaction.currency ||
        "TOKEN",

      transactionType:
        transaction.transactionType ||
        transaction.transaction_type ||
        "WALLET_TO_WALLET",

      transactionPurpose:
        transaction.transactionPurpose ||
        transaction.transaction_purpose ||
        null,

      transactionDescription:
        transaction.transactionDescription ||
        transaction.transaction_description ||
        null,

      status:
        transaction.status ||
        transaction.transaction_status ||
        "UNKNOWN",

      riskLevel:
        transaction.riskLevel ||
        transaction.risk_level ||
        "LOW",

      createdAt:
        transaction.createdAt ||
        transaction.created_at ||
        null,
    };
  }

  async getWalletByAddressFromDatabase(walletAddress) {
    const pool = databaseService.getPool();

    const query = `
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
        created_at,
        updated_at
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [walletAddress]);

    return result.rows[0] || null;
  }

  async getWalletBalanceFromDatabase(walletAddress) {
    const pool = databaseService.getPool();

    const query = `
      SELECT
        wallet_address,
        customer_id,
        current_balance,
        currency,
        wallet_status,
        updated_at
      FROM blockchain.wallets
      WHERE wallet_address = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [walletAddress]);

    return result.rows[0] || null;
  }

  async getWalletHistoryFromDatabase(walletAddress, limit, offset) {
    const pool = databaseService.getPool();

    const tableCheckQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'blockchain'
        AND table_name IN (
          'transactions',
          'blockchain_transaction',
          'fabric_transactions'
        )
      ORDER BY
        CASE table_name
          WHEN 'transactions' THEN 1
          WHEN 'blockchain_transaction' THEN 2
          WHEN 'fabric_transactions' THEN 3
          ELSE 99
        END
      LIMIT 1;
    `;

    const tableCheckResult = await pool.query(tableCheckQuery);

    if (!tableCheckResult.rows.length) {
      logger.warn("No transaction table found in schema blockchain", {
        walletAddress,
      });

      return {
        total: 0,
        transactions: [],
      };
    }

    const tableName = tableCheckResult.rows[0].table_name;
    const fullTableName = `blockchain.${tableName}`;

    const columnsResult = await pool.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'blockchain'
        AND table_name = $1;
      `,
      [tableName]
    );

    const columns = columnsResult.rows.map((row) => row.column_name);

    const hasFromWalletAddress = columns.includes("from_wallet_address");
    const hasToWalletAddress = columns.includes("to_wallet_address");
    const hasSenderWalletAddress = columns.includes("sender_wallet_address");
    const hasReceiverWalletAddress = columns.includes("receiver_wallet_address");

    let whereClause = null;

    if (hasFromWalletAddress && hasToWalletAddress) {
      whereClause = `
        WHERE from_wallet_address = $1
           OR to_wallet_address = $1
      `;
    } else if (hasSenderWalletAddress && hasReceiverWalletAddress) {
      whereClause = `
        WHERE sender_wallet_address = $1
           OR receiver_wallet_address = $1
      `;
    } else {
      logger.warn("Transaction table does not have wallet address columns", {
        fullTableName,
        walletAddress,
      });

      return {
        total: 0,
        transactions: [],
      };
    }

    const selectTransactionId = columns.includes("transaction_id")
      ? "transaction_id"
      : columns.includes("id")
      ? "id AS transaction_id"
      : "NULL AS transaction_id";

    const selectRequestId = columns.includes("request_id")
      ? "request_id"
      : "NULL AS request_id";

    const selectFabricTransactionId = columns.includes("fabric_transaction_id")
      ? "fabric_transaction_id"
      : columns.includes("fabric_tx_id")
      ? "fabric_tx_id AS fabric_transaction_id"
      : "NULL AS fabric_transaction_id";

    const selectFromWalletAddress = hasFromWalletAddress
      ? "from_wallet_address"
      : hasSenderWalletAddress
      ? "sender_wallet_address AS from_wallet_address"
      : "NULL AS from_wallet_address";

    const selectToWalletAddress = hasToWalletAddress
      ? "to_wallet_address"
      : hasReceiverWalletAddress
      ? "receiver_wallet_address AS to_wallet_address"
      : "NULL AS to_wallet_address";

    const selectAmount = columns.includes("amount")
      ? "amount"
      : "0 AS amount";

    const selectCurrency = columns.includes("currency")
      ? "currency"
      : "'TOKEN' AS currency";

    const selectTransactionType = columns.includes("transaction_type")
      ? "transaction_type"
      : "'WALLET_TO_WALLET' AS transaction_type";

    const selectTransactionPurpose = columns.includes("transaction_purpose")
      ? "transaction_purpose"
      : "NULL AS transaction_purpose";

    const selectTransactionDescription = columns.includes("transaction_description")
      ? "transaction_description"
      : "NULL AS transaction_description";

    const selectTransactionStatus = columns.includes("transaction_status")
      ? "transaction_status"
      : columns.includes("status")
      ? "status AS transaction_status"
      : "'UNKNOWN' AS transaction_status";

    const selectRiskLevel = columns.includes("risk_level")
      ? "risk_level"
      : "'LOW' AS risk_level";

    const selectCreatedAt = columns.includes("created_at")
      ? "created_at"
      : "NULL AS created_at";

    const orderBy = columns.includes("created_at")
      ? "ORDER BY created_at DESC"
      : "ORDER BY transaction_id DESC";

    const countQuery = `
      SELECT COUNT(*)::INT AS total
      FROM ${fullTableName}
      ${whereClause};
    `;

    const dataQuery = `
      SELECT
        ${selectTransactionId},
        ${selectRequestId},
        ${selectFabricTransactionId},
        ${selectFromWalletAddress},
        ${selectToWalletAddress},
        ${selectAmount},
        ${selectCurrency},
        ${selectTransactionType},
        ${selectTransactionPurpose},
        ${selectTransactionDescription},
        ${selectTransactionStatus},
        ${selectRiskLevel},
        ${selectCreatedAt}
      FROM ${fullTableName}
      ${whereClause}
      ${orderBy}
      LIMIT $2 OFFSET $3;
    `;

    const countResult = await pool.query(countQuery, [walletAddress]);
    const dataResult = await pool.query(dataQuery, [
      walletAddress,
      limit,
      offset,
    ]);

    return {
      total: countResult.rows[0]?.total || 0,
      transactions: dataResult.rows,
    };
  }
}

module.exports = new WalletQueryService();