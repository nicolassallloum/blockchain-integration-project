const transactionService = require("../services/transaction.service");

function buildRequestId(req) {
  return (
    req.headers["x-request-id"] ||
    `REQ_${Date.now()}_${Math.random().toString(16).slice(2).toUpperCase()}`
  );
}

function parsePositiveInteger(value, defaultValue, maxValue = 100) {
  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.min(parsed, maxValue);
}

function parseDecimal(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeSortBy(sortBy) {
  const allowedSortColumns = [
    "createdAt",
    "updatedAt",
    "amount",
    "transactionType",
    "status",
    "transactionId",
  ];

  if (!allowedSortColumns.includes(sortBy)) {
    return "createdAt";
  }

  return sortBy;
}

function normalizeSortOrder(sortOrder) {
  const value = String(sortOrder || "desc").toLowerCase();

  return value === "asc" ? "asc" : "desc";
}

function normalizeSource(source) {
  const value = String(source || "postgres").toLowerCase();

  if (value === "fabric" || value === "couchdb") {
    return "fabric";
  }

  return "postgres";
}

class TransactionController {
  async searchTransactions(req, res) {
    const requestId = buildRequestId(req);

    try {
      const filters = {
        walletAddress: req.query.walletAddress || null,
        customerId: req.query.customerId || null,
        organizationId: req.query.organizationId || null,
        transactionType: req.query.transactionType || null,
        status: req.query.status || null,
        dateFrom: req.query.dateFrom || null,
        dateTo: req.query.dateTo || null,
        amountMin: parseDecimal(req.query.amountMin),
        amountMax: parseDecimal(req.query.amountMax),
      };

      const pagination = {
        page: parsePositiveInteger(req.query.page, 1, 100000),
        limit: parsePositiveInteger(req.query.limit, 20, 100),
      };

      const sorting = {
        sortBy: normalizeSortBy(req.query.sortBy),
        sortOrder: normalizeSortOrder(req.query.sortOrder),
      };

      const source = normalizeSource(req.query.source);

      const result = await transactionService.searchTransactions({
        filters,
        pagination,
        sorting,
        source,
        requestId,
      });

      return res.status(200).json({
        success: true,
        message: "Transaction history retrieved successfully",
        data: result.data,
        pagination: result.pagination,
        filters: result.filters,
        sorting: result.sorting,
        source: result.source,
        requestId,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve transaction history",
        errorCode: "TRANSACTION_SEARCH_FAILED",
        error: {
          message: error.message,
        },
        data: null,
        requestId,
      });
    }
  }

  async getTransactionById(req, res) {
    const requestId = buildRequestId(req);

    try {
      const { transactionId } = req.params;
      const source = normalizeSource(req.query.source);

      if (!transactionId) {
        return res.status(400).json({
          success: false,
          message: "transactionId is required",
          errorCode: "TRANSACTION_ID_REQUIRED",
          data: null,
          requestId,
        });
      }

      const transaction = await transactionService.getTransactionById({
        transactionId,
        source,
        requestId,
      });

      if (!transaction) {
        return res.status(404).json({
          success: false,
          message: `Transaction not found for transactionId=${transactionId}`,
          errorCode: "TRANSACTION_NOT_FOUND",
          data: null,
          requestId,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Transaction retrieved successfully",
        data: transaction,
        source,
        requestId,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve transaction",
        errorCode: "TRANSACTION_GET_FAILED",
        error: {
          message: error.message,
        },
        data: null,
        requestId,
      });
    }
  }
}

module.exports = new TransactionController();