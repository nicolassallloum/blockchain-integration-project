'use strict';

/**
 * STEP 32 — Transaction Service
 * Blockchain Integration Project
 *
 * Supports both table naming styles:
 * - blockchain.wallets
 * - blockchain.blockchain_wallet
 *
 * And transaction table naming styles:
 * - blockchain.transactions
 * - blockchain.blockchain_transaction
 */

const crypto = require('crypto');
const db = require('../config/database');

function getPool() {
  if (db.pool) return db.pool;

  if (typeof db.getPool === 'function') return db.getPool();

  if (typeof db.connect === 'function' && typeof db.query === 'function') return db;

  throw new Error('PostgreSQL pool not found in src/config/database.js');
}

async function tableExists(client, schemaName, tableName) {
  const result = await client.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = $1
        AND table_name = $2
    ) AS exists
    `,
    [schemaName, tableName]
  );

  return result.rows[0]?.exists === true;
}

async function resolveWalletTable(client) {
  if (await tableExists(client, 'blockchain', 'wallets')) {
    return 'wallets';
  }

  if (await tableExists(client, 'blockchain', 'blockchain_wallet')) {
    return 'blockchain_wallet';
  }

  throw new Error('No wallet table found. Expected blockchain.wallets or blockchain.blockchain_wallet');
}

async function resolveTransactionTable(client) {
  if (await tableExists(client, 'blockchain', 'transactions')) {
    return 'transactions';
  }

  if (await tableExists(client, 'blockchain', 'blockchain_transaction')) {
    return 'blockchain_transaction';
  }

  throw new Error('No transaction table found. Expected blockchain.transactions or blockchain.blockchain_transaction');
}

async function getTableColumns(client, schemaName, tableName) {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = $2
    ORDER BY ordinal_position
    `,
    [schemaName, tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

function getAny(obj, keys, defaultValue = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }

  return defaultValue;
}

function normalizeWallet(row) {
  if (!row) return null;

  return {
    walletId: getAny(row, ['wallet_id', 'walletId']),
    walletAddress: getAny(row, ['wallet_address', 'walletAddress']),
    customerId: getAny(row, ['customer_id', 'customerId']),
    organizationId: getAny(row, ['organization_id', 'organizationId']),
    organizationName: getAny(row, ['organization_name', 'organizationName']),
    organizationCode: getAny(row, ['organization_code', 'organizationCode']),
    fullName: getAny(row, ['full_name', 'fullName']),
    currentBalance: getAny(row, ['current_balance', 'currentBalance'], 0),
    currencyCode: getAny(row, ['currency_code', 'currencyCode', 'currency'], 'USD'),
    status: getAny(row, ['status', 'wallet_status', 'walletStatus'], 'ACTIVE'),
    createdAt: getAny(row, ['created_at', 'createdAt']),
    updatedAt: getAny(row, ['updated_at', 'updatedAt'])
  };
}

function normalizeTransaction(row) {
  if (!row) return null;

  return {
    transactionId: getAny(row, ['transaction_id', 'transactionId', 'id']),
    requestId: getAny(row, ['request_id', 'requestId']),
    transactionType: getAny(row, ['transaction_type', 'transactionType', 'type']),
    senderWalletAddress: getAny(row, ['sender_wallet_address', 'senderWalletAddress', 'from_wallet_address']),
    receiverWalletAddress: getAny(row, ['receiver_wallet_address', 'receiverWalletAddress', 'to_wallet_address']),
    organizationId: getAny(row, ['organization_id', 'organizationId']),
    organizationName: getAny(row, ['organization_name', 'organizationName']),
    amount: getAny(row, ['amount', 'transaction_amount', 'transactionAmount'], 0),
    currency: getAny(row, ['currency', 'currency_code', 'currencyCode'], 'USD'),
    status: getAny(row, ['status', 'transaction_status', 'transactionStatus']),
    transactionPurpose: getAny(row, ['transaction_purpose', 'transactionPurpose', 'purpose']),
    transactionDescription: getAny(row, ['transaction_description', 'transactionDescription', 'description']),
    requestSource: getAny(row, ['request_source', 'requestSource', 'source']),
    sourceSystem: getAny(row, ['source_system', 'sourceSystem']),
    createdBy: getAny(row, ['created_by', 'createdBy']),
    createdAt: getAny(row, ['created_at', 'createdAt']),
    updatedAt: getAny(row, ['updated_at', 'updatedAt']),
    raw: row
  };
}

function buildInsertQuery(schemaName, tableName, valuesByColumn, existingColumns) {
  const columns = [];
  const values = [];
  const placeholders = [];

  Object.entries(valuesByColumn).forEach(([column, value]) => {
    if (existingColumns.includes(column)) {
      columns.push(column);
      values.push(value);
      placeholders.push(`$${values.length}`);
    }
  });

  if (columns.length === 0) {
    throw new Error(`No matching columns found for insert into ${schemaName}.${tableName}`);
  }

  return {
    query: `
      INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING *
    `,
    values
  };
}

async function getWalletByAddressInternal(client, walletAddress) {
  const walletTable = await resolveWalletTable(client);

  const result = await client.query(
    `
    SELECT *
    FROM blockchain.${walletTable}
    WHERE wallet_address = $1
    LIMIT 1
    `,
    [walletAddress]
  );

  return normalizeWallet(result.rows[0]);
}

async function getOrganizationByIdInternal(client, organizationId) {
  const possibleTables = [
    'organizations',
    'blockchain_organization'
  ];

  for (const tableName of possibleTables) {
    const exists = await tableExists(client, 'blockchain', tableName);

    if (!exists) continue;

    try {
      const result = await client.query(
        `
        SELECT *
        FROM blockchain.${tableName}
        WHERE organization_id::text = $1
        LIMIT 1
        `,
        [String(organizationId)]
      );

      if (result.rowCount > 0) {
        return result.rows[0];
      }
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function updateWalletBalance(client, walletAddress, amountDelta) {
  const walletTable = await resolveWalletTable(client);
  const walletColumns = await getTableColumns(client, 'blockchain', walletTable);

  const balanceColumn = pickColumn(walletColumns, ['current_balance', 'current_Balance']);
  const updatedAtColumn = pickColumn(walletColumns, ['updated_at', 'updatedAt']);

  if (!balanceColumn) {
    throw new Error(`Wallet balance column not found in blockchain.${walletTable}`);
  }

  const setClauses = [
    `${balanceColumn} = COALESCE(${balanceColumn}, 0) + $1`
  ];

  if (updatedAtColumn) {
    setClauses.push(`${updatedAtColumn} = NOW()`);
  }

  await client.query(
    `
    UPDATE blockchain.${walletTable}
    SET ${setClauses.join(', ')}
    WHERE wallet_address = $2
    `,
    [amountDelta, walletAddress]
  );
}

async function insertTransaction(client, transactionData) {
  const transactionTable = await resolveTransactionTable(client);
  const transactionColumns = await getTableColumns(client, 'blockchain', transactionTable);

  const transactionId = transactionData.transactionId || crypto.randomUUID();

  const valuesByColumn = {
    transaction_id: transactionId,
    id: transactionId,

    request_id: transactionData.requestId,

    transaction_type: transactionData.transactionType,
    type: transactionData.transactionType,

    sender_wallet_address: transactionData.senderWalletAddress,
    from_wallet_address: transactionData.senderWalletAddress,

    receiver_wallet_address: transactionData.receiverWalletAddress,
    to_wallet_address: transactionData.receiverWalletAddress,

    organization_id: transactionData.organizationId,
    organization_name: transactionData.organizationName,

    amount: transactionData.amount,
    transaction_amount: transactionData.amount,

    currency: transactionData.currency,
    currency_code: transactionData.currency,

    transaction_purpose: transactionData.transactionPurpose,
    purpose: transactionData.transactionPurpose,

    transaction_description: transactionData.transactionDescription,
    description: transactionData.transactionDescription,

    status: transactionData.status,
    transaction_status: transactionData.status,

    request_source: transactionData.requestSource,
    source: transactionData.requestSource,

    source_system: transactionData.sourceSystem,

    created_by: transactionData.createdBy,
    created_at: new Date(),
    updated_at: new Date()
  };

  const insert = buildInsertQuery(
    'blockchain',
    transactionTable,
    valuesByColumn,
    transactionColumns
  );

  const result = await client.query(insert.query, insert.values);

  return normalizeTransaction(result.rows[0]);
}

async function walletTransfer(payload, context = {}) {
  const senderWalletAddress = payload.senderWalletAddress;
  const receiverWalletAddress = payload.receiverWalletAddress;
  const amount = payload.amount;
  const currency = payload.currency || 'USD';

  if (!senderWalletAddress) {
    return {
      success: false,
      message: 'Sender wallet address is required',
      errorCode: 'SENDER_WALLET_REQUIRED',
      data: null
    };
  }

  if (!receiverWalletAddress) {
    return {
      success: false,
      message: 'Receiver wallet address is required',
      errorCode: 'RECEIVER_WALLET_REQUIRED',
      data: null
    };
  }

  if (senderWalletAddress === receiverWalletAddress) {
    return {
      success: false,
      message: 'Sender wallet address and receiver wallet address cannot be the same',
      errorCode: 'SAME_WALLET_TRANSFER_NOT_ALLOWED',
      data: null
    };
  }

  const transferAmount = Number(amount);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return {
      success: false,
      message: 'Transfer amount must be greater than zero',
      errorCode: 'INVALID_AMOUNT',
      data: null
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const senderWallet = await getWalletByAddressInternal(client, senderWalletAddress);

    if (!senderWallet) {
      await client.query('ROLLBACK');

      return {
        success: false,
        message: 'Sender wallet not found',
        errorCode: 'SENDER_WALLET_NOT_FOUND',
        data: null
      };
    }

    const receiverWallet = await getWalletByAddressInternal(client, receiverWalletAddress);

    if (!receiverWallet) {
      await client.query('ROLLBACK');

      return {
        success: false,
        message: 'Receiver wallet not found',
        errorCode: 'RECEIVER_WALLET_NOT_FOUND',
        data: null
      };
    }

    const senderBalance = Number(senderWallet.currentBalance || 0);

    if (senderBalance < transferAmount) {
      await client.query('ROLLBACK');

      return {
        success: false,
        message: `Insufficient wallet balance. Current balance is ${senderBalance}.`,
        errorCode: 'INSUFFICIENT_BALANCE',
        data: {
          senderWalletAddress,
          currentBalance: senderBalance,
          requestedAmount: transferAmount,
          currency: senderWallet.currencyCode || currency
        }
      };
    }

    const requestId =
      context.requestId ||
      payload.requestId ||
      `REQ_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const transactionId = crypto.randomUUID();

    const normalizedCurrency =
      currency ||
      senderWallet.currencyCode ||
      receiverWallet.currencyCode ||
      'USD';

    await updateWalletBalance(client, senderWalletAddress, -transferAmount);
    await updateWalletBalance(client, receiverWalletAddress, transferAmount);

    const transaction = await insertTransaction(client, {
      transactionId,
      requestId,
      transactionType: 'TRANSFER',
      senderWalletAddress,
      receiverWalletAddress,
      organizationId: null,
      organizationName: null,
      amount: transferAmount,
      currency: normalizedCurrency,
      transactionPurpose: payload.transactionPurpose || 'Wallet transfer test',
      transactionDescription:
        payload.transactionDescription || 'Wallet-to-wallet transfer from Blockchain API',
      status: 'SUCCESS',
      requestSource: payload.requestSource || 'BLOCKCHAIN_API',
      sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_API',
      createdBy: payload.createdBy || 'system'
    });

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Wallet-to-wallet transfer completed successfully',
      data: {
        transactionId,
        requestId,
        transactionType: 'TRANSFER',
        senderWalletAddress,
        receiverWalletAddress,
        amount: String(transferAmount),
        currency: normalizedCurrency,
        status: 'SUCCESS',
        transaction
      }
    };
} catch (error) {
    await client.query('ROLLBACK');

    console.error('[STEP32_WALLET_TRANSFER_DB_ERROR]', {
      code: error.code,
      message: error.message,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      schema: error.schema
    });

    error.message = `Wallet transfer failed: ${error.message}`;
    error.debug = {
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column,
      schema: error.schema
    };

    throw error;
  } finally {
    client.release();
  }
}

async function organizationTransfer(payload, context = {}) {
  const senderWalletAddress = payload.senderWalletAddress;
  const organizationId = payload.organizationId;
  const amount = payload.amount;
  const currency = payload.currency || 'USD';

  if (!senderWalletAddress) {
    return {
      success: false,
      message: 'Sender wallet address is required',
      errorCode: 'SENDER_WALLET_REQUIRED',
      data: null
    };
  }

  if (!organizationId) {
    return {
      success: false,
      message: 'Organization ID is required',
      errorCode: 'ORGANIZATION_ID_REQUIRED',
      data: null
    };
  }

  const transferAmount = Number(amount);

  if (!Number.isFinite(transferAmount) || transferAmount <= 0) {
    return {
      success: false,
      message: 'Transfer amount must be greater than zero',
      errorCode: 'INVALID_AMOUNT',
      data: null
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const senderWallet = await getWalletByAddressInternal(client, senderWalletAddress);

    if (!senderWallet) {
      await client.query('ROLLBACK');

      return {
        success: false,
        message: 'Sender wallet not found',
        errorCode: 'SENDER_WALLET_NOT_FOUND',
        data: null
      };
    }

    const senderBalance = Number(senderWallet.currentBalance || 0);

    if (senderBalance < transferAmount) {
      await client.query('ROLLBACK');

      return {
        success: false,
        message: `Insufficient wallet balance. Current balance is ${senderBalance}.`,
        errorCode: 'INSUFFICIENT_BALANCE',
        data: {
          senderWalletAddress,
          currentBalance: senderBalance,
          requestedAmount: transferAmount,
          currency: senderWallet.currencyCode || currency
        }
      };
    }

    const organization = await getOrganizationByIdInternal(client, organizationId);

    const requestId =
      context.requestId ||
      payload.requestId ||
      `REQ_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

    const transactionId = crypto.randomUUID();

    const normalizedCurrency =
      currency ||
      senderWallet.currencyCode ||
      'USD';

    await updateWalletBalance(client, senderWalletAddress, -transferAmount);

    const transaction = await insertTransaction(client, {
      transactionId,
      requestId,
      transactionType: 'ORGANIZATION_TRANSFER',
      senderWalletAddress,
      receiverWalletAddress: null,
      organizationId,
      organizationName:
        organization?.organization_name ||
        organization?.organizationName ||
        null,
      amount: transferAmount,
      currency: normalizedCurrency,
      transactionPurpose: payload.transactionPurpose || 'Organization payment test',
      transactionDescription:
        payload.transactionDescription || 'Wallet-to-organization transfer from Blockchain API',
      status: 'SUCCESS',
      requestSource: payload.requestSource || 'BLOCKCHAIN_API',
      sourceSystem: payload.sourceSystem || 'BLOCKCHAIN_API',
      createdBy: payload.createdBy || 'system'
    });

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Wallet-to-organization transfer completed successfully',
      data: {
        transactionId,
        requestId,
        transactionType: 'ORGANIZATION_TRANSFER',
        senderWalletAddress,
        organizationId,
        organizationName:
          organization?.organization_name ||
          organization?.organizationName ||
          null,
        amount: String(transferAmount),
        currency: normalizedCurrency,
        status: 'SUCCESS',
        transaction
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    error.message = `Organization transfer failed: ${error.message}`;
    throw error;
  } finally {
    client.release();
  }
}

async function getTransactions(filters = {}) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    const transactionTable = await resolveTransactionTable(client);
    const transactionColumns = await getTableColumns(client, 'blockchain', transactionTable);

    const page = Number(filters.page || 1);
    const limit = Number(filters.limit || 10);
    const safePage = Number.isFinite(page) && page > 0 ? page : 1;
    const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 10;
    const offset = (safePage - 1) * safeLimit;

    const where = [];
    const values = [];

    const createdAtColumn = pickColumn(transactionColumns, ['created_at', 'createdAt']);
    const amountColumn = pickColumn(transactionColumns, ['amount', 'transaction_amount']);

    if (filters.walletAddress) {
      const senderColumn = pickColumn(transactionColumns, ['sender_wallet_address', 'from_wallet_address']);
      const receiverColumn = pickColumn(transactionColumns, ['receiver_wallet_address', 'to_wallet_address']);

      if (senderColumn && receiverColumn) {
        values.push(filters.walletAddress);
        where.push(`(${senderColumn} = $${values.length} OR ${receiverColumn} = $${values.length})`);
      } else if (senderColumn) {
        values.push(filters.walletAddress);
        where.push(`${senderColumn} = $${values.length}`);
      } else if (receiverColumn) {
        values.push(filters.walletAddress);
        where.push(`${receiverColumn} = $${values.length}`);
      }
    }

    function addFilter(columnCandidates, value, operator = '=') {
      if (value === undefined || value === null || value === '') return;

      const column = pickColumn(transactionColumns, columnCandidates);

      if (!column) return;

      values.push(value);
      where.push(`${column} ${operator} $${values.length}`);
    }

    addFilter(['customer_id'], filters.customerId);
    addFilter(['organization_id'], filters.organizationId);
    addFilter(['transaction_type', 'type'], filters.transactionType);
    addFilter(['status', 'transaction_status'], filters.status);

    if (createdAtColumn && filters.dateFrom) {
      values.push(filters.dateFrom);
      where.push(`${createdAtColumn} >= $${values.length}`);
    }

    if (createdAtColumn && filters.dateTo) {
      values.push(filters.dateTo);
      where.push(`${createdAtColumn} <= $${values.length}`);
    }

    if (amountColumn && filters.amountMin) {
      values.push(Number(filters.amountMin));
      where.push(`${amountColumn} >= $${values.length}`);
    }

    if (amountColumn && filters.amountMax) {
      values.push(Number(filters.amountMax));
      where.push(`${amountColumn} <= $${values.length}`);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const orderColumn =
      pickColumn(transactionColumns, ['created_at', 'createdAt']) ||
      pickColumn(transactionColumns, ['transaction_id', 'id']) ||
      transactionColumns[0];

    const countResult = await client.query(
      `
      SELECT COUNT(*)::int AS total
      FROM blockchain.${transactionTable}
      ${whereClause}
      `,
      values
    );

    const totalRecords = countResult.rows[0]?.total || 0;
    const totalPages = Math.ceil(totalRecords / safeLimit);

    values.push(safeLimit);
    const limitParam = values.length;

    values.push(offset);
    const offsetParam = values.length;

    const result = await client.query(
      `
      SELECT *
      FROM blockchain.${transactionTable}
      ${whereClause}
      ORDER BY ${orderColumn} DESC
      LIMIT $${limitParam}
      OFFSET $${offsetParam}
      `,
      values
    );

    return {
      success: true,
      message: 'Transaction history retrieved successfully',
      data: result.rows.map(normalizeTransaction),
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalRecords,
        totalPages,
        hasNextPage: safePage < totalPages,
        hasPreviousPage: safePage > 1
      },
      filters: {
        walletAddress: filters.walletAddress || null,
        customerId: filters.customerId || null,
        organizationId: filters.organizationId || null,
        transactionType: filters.transactionType || null,
        status: filters.status || null,
        dateFrom: filters.dateFrom || null,
        dateTo: filters.dateTo || null,
        amountMin: filters.amountMin || null,
        amountMax: filters.amountMax || null
      },
      sorting: {
        sortBy: orderColumn,
        sortOrder: 'desc'
      },
      source: 'postgres',
      table: `blockchain.${transactionTable}`
    };
  } finally {
    client.release();
  }
}

async function getTransactionById(transactionId) {
  if (!transactionId) {
    return {
      success: false,
      message: 'Transaction ID is required',
      errorCode: 'TRANSACTION_ID_REQUIRED',
      data: null
    };
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    const transactionTable = await resolveTransactionTable(client);
    const transactionColumns = await getTableColumns(client, 'blockchain', transactionTable);

    const transactionIdColumn = pickColumn(transactionColumns, ['transaction_id', 'id']);

    if (!transactionIdColumn) {
      return {
        success: false,
        message: 'Transaction ID column not found',
        errorCode: 'TRANSACTION_ID_COLUMN_NOT_FOUND',
        data: null
      };
    }

    const result = await client.query(
      `
      SELECT *
      FROM blockchain.${transactionTable}
      WHERE ${transactionIdColumn}::text = $1
      LIMIT 1
      `,
      [String(transactionId)]
    );

    if (result.rowCount === 0) {
      return {
        success: false,
        message: 'Transaction not found',
        errorCode: 'TRANSACTION_NOT_FOUND',
        data: null
      };
    }

    return {
      success: true,
      message: 'Transaction retrieved successfully',
      data: normalizeTransaction(result.rows[0]),
      source: 'postgres',
      table: `blockchain.${transactionTable}`
    };
  } finally {
    client.release();
  }
}

const createWalletTransfer = walletTransfer;
const walletToWalletTransfer = walletTransfer;
const transferBetweenWallets = walletTransfer;
const executeWalletTransfer = walletTransfer;
const processWalletTransfer = walletTransfer;

const createOrganizationTransfer = organizationTransfer;
const walletToOrganizationTransfer = organizationTransfer;
const transferToOrganization = organizationTransfer;
const executeOrganizationTransfer = organizationTransfer;
const processOrganizationTransfer = organizationTransfer;

module.exports = {
  walletTransfer,
  createWalletTransfer,
  walletToWalletTransfer,
  transferBetweenWallets,
  executeWalletTransfer,
  processWalletTransfer,

  organizationTransfer,
  createOrganizationTransfer,
  walletToOrganizationTransfer,
  transferToOrganization,
  executeOrganizationTransfer,
  processOrganizationTransfer,

  getTransactions,
  getTransactionById
};