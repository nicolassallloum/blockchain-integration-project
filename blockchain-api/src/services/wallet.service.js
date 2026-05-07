'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.APP_JWT_SECRET ||
  'CHANGE_ME_DEV_SECRET';

exports.getNextCustomerId = async () => {
  const result = await db.query(`
    SELECT
      COALESCE(MAX(customer_id::bigint), 0) + 1 AS next_customer_id
    FROM blockchain.wallets
    WHERE customer_id ~ '^[0-9]+$'
  `);

  return {
    customerId: String(result.rows[0]?.next_customer_id || Date.now())
  };
};

async function tableColumnExists(tableName, columnName) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'blockchain'
        AND table_name = $1
        AND column_name = $2
    ) AS exists
    `,
    [tableName, columnName]
  );

  return result.rows[0]?.exists === true;
}

async function getWalletColumns() {
  const result = await db.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'blockchain'
      AND table_name = 'wallets'
    ORDER BY ordinal_position
    `
  );

  return result.rows.map((row) => row.column_name);
}

function normalizeNumber(value, defaultValue = 0) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return defaultValue;
  }

  return numberValue;
}

function mapWalletProfile(profile) {
  if (!profile) {
    return null;
  }

  return {
    walletAddress: profile.walletAddress,
    customerId: profile.customerId,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    walletType: 'CUSTOMER',
    fullName: profile.fullName,
    customerName: profile.fullName,
    customerType: 'CUSTOMER',
    nationality: profile.nationalIdHash,
    countryName: profile.countryName,
    idType: 'wallet',
    idNumber: profile.walletAddress,
    nationalIdHash: profile.nationalIdHash,
    mobileHash: profile.mobileHash,
    emailHash: profile.emailHash,
    currentBalance: profile.currentBalance,
    currencyCode: profile.currencyCode,
    status: profile.status,
    createdAt: profile.createdAt
  };
}

exports.listWallets = async ({ limit = 13, offset = 0, search = '' }) => {
  const values = [];
  let whereClause = '';

  if (search && search.trim()) {
    values.push(`%${search.trim()}%`);

    whereClause = `
      WHERE
        COALESCE(full_name, '') ILIKE $1
        OR COALESCE(wallet_type, '') ILIKE $1
        OR COALESCE(national_id_hash, '') ILIKE $1
        OR COALESCE(ledger_doc_type, '') ILIKE $1
        OR COALESCE(ledger_key, '') ILIKE $1
        OR COALESCE(customer_id, '') ILIKE $1
        OR COALESCE(wallet_address, '') ILIKE $1
        OR COALESCE(organization_code, '') ILIKE $1
    `;
  }

  const hasCurrentBalance = await tableColumnExists('wallets', 'current_balance');
  const hasCurrencyCode = await tableColumnExists('wallets', 'currency_code');

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM blockchain.wallets
    ${whereClause}
  `;

  const dataSql = `
    SELECT
      wallet_id,
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      wallet_type,
      full_name,
      national_id_hash,
      ledger_doc_type,
      ledger_key,
      mobile_hash,
      email_hash,
      status,
      ${hasCurrentBalance ? 'current_balance' : '0 AS current_balance'},
      ${hasCurrencyCode ? 'currency_code' : `'USD' AS currency_code`},
      created_at,
      updated_at
    FROM blockchain.wallets
    ${whereClause}
    ORDER BY created_at DESC NULLS LAST
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;

  const countResult = await db.query(countSql, values);
  const dataResult = await db.query(dataSql, [...values, limit, offset]);

  return {
    totalRecords: countResult.rows[0]?.total || 0,
    data: dataResult.rows.map((row) => ({
      id: row.wallet_id,
      walletId: row.wallet_id,
      walletAddress: row.wallet_address,
      customerId: row.customer_id,
      organizationId: row.organization_id,
      organizationCode: row.organization_code,
      customerName: row.full_name,
      customerType: row.wallet_type,
      nationality: row.national_id_hash,
      idType: row.ledger_doc_type,
      idNumber: row.ledger_key,
      fullName: row.full_name,
      walletType: row.wallet_type,
      nationalIdHash: row.national_id_hash,
      ledgerDocType: row.ledger_doc_type,
      ledgerKey: row.ledger_key,
      mobileHash: row.mobile_hash,
      emailHash: row.email_hash,
      status: row.status,
      currentBalance: row.current_balance,
      currencyCode: row.currency_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
};

const getProfessionalWalletProfileByCustomerId = async (customerId) => {
  try {
    const result = await db.query(
      `
      SELECT
          w.customer_id                                  AS "customerId",
          w.wallet_address                              AS "walletAddress",
          w.organization_id                             AS "organizationId",
          bo.organization_name                          AS "organizationName",
          w.full_name                                   AS "fullName",
          w.national_id_hash                            AS "nationalIdHash",
          c.cou_name                                    AS "countryName",
          w.email_hash                                  AS "emailHash",
          w.mobile_hash                                 AS "mobileHash",
          COALESCE(w.current_balance, 0)                AS "currentBalance",
          COALESCE(w.currency_code, 'USD')              AS "currencyCode",
          w.created_at                                  AS "createdAt",
          w.status                                      AS "status"
      FROM blockchain.wallets w
      LEFT JOIN blockchain.blockchain_organization bo
          ON bo.organization_id = w.organization_id
      LEFT JOIN blockchain.countries c
          ON c.cou_id::text = w.national_id_hash::text
      WHERE w.customer_id = $1
      LIMIT 1
      `,
      [customerId]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.warn(
      'Professional wallet profile by customer ID full query failed. Falling back to safe query:',
      error.message
    );

    const fallbackResult = await db.query(
      `
      SELECT
          w.customer_id                         AS "customerId",
          w.wallet_address                     AS "walletAddress",
          w.organization_id                    AS "organizationId",
          NULL                                 AS "organizationName",
          w.full_name                          AS "fullName",
          w.national_id_hash                   AS "nationalIdHash",
          NULL                                 AS "countryName",
          w.email_hash                         AS "emailHash",
          w.mobile_hash                        AS "mobileHash",
          COALESCE(w.current_balance, 0)       AS "currentBalance",
          COALESCE(w.currency_code, 'USD')     AS "currencyCode",
          w.created_at                         AS "createdAt",
          w.status                             AS "status"
      FROM blockchain.wallets w
      WHERE w.customer_id = $1
      LIMIT 1
      `,
      [customerId]
    );

    return fallbackResult.rows[0] || null;
  }
};

const getProfessionalWalletProfileByAddress = async (walletAddress) => {
  try {
    const result = await db.query(
      `
      SELECT
          w.customer_id                                  AS "customerId",
          w.wallet_address                              AS "walletAddress",
          w.organization_id                             AS "organizationId",
          bo.organization_name                          AS "organizationName",
          w.full_name                                   AS "fullName",
          w.national_id_hash                            AS "nationalIdHash",
          c.cou_name                                    AS "countryName",
          w.email_hash                                  AS "emailHash",
          w.mobile_hash                                 AS "mobileHash",
          COALESCE(w.current_balance, 0)                AS "currentBalance",
          COALESCE(w.currency_code, 'USD')              AS "currencyCode",
          w.created_at                                  AS "createdAt",
          w.status                                      AS "status"
      FROM blockchain.wallets w
      LEFT JOIN blockchain.blockchain_organization bo
          ON bo.organization_id = w.organization_id
      LEFT JOIN blockchain.countries c
          ON c.cou_id::text = w.national_id_hash::text
      WHERE w.wallet_address = $1
      LIMIT 1
      `,
      [walletAddress]
    );

    return result.rows[0] || null;
  } catch (error) {
    console.warn(
      'Professional wallet profile by address full query failed. Falling back to safe query:',
      error.message
    );

    const fallbackResult = await db.query(
      `
      SELECT
          w.customer_id                         AS "customerId",
          w.wallet_address                     AS "walletAddress",
          w.organization_id                    AS "organizationId",
          NULL                                 AS "organizationName",
          w.full_name                          AS "fullName",
          w.national_id_hash                   AS "nationalIdHash",
          NULL                                 AS "countryName",
          w.email_hash                         AS "emailHash",
          w.mobile_hash                        AS "mobileHash",
          COALESCE(w.current_balance, 0)       AS "currentBalance",
          COALESCE(w.currency_code, 'USD')     AS "currencyCode",
          w.created_at                         AS "createdAt",
          w.status                             AS "status"
      FROM blockchain.wallets w
      WHERE w.wallet_address = $1
      LIMIT 1
      `,
      [walletAddress]
    );

    return fallbackResult.rows[0] || null;
  }
};

exports.getWalletByCustomerId = async (customerId) => {
  const profile = await getProfessionalWalletProfileByCustomerId(customerId);
  return mapWalletProfile(profile);
};

exports.getWalletByAddress = async (walletAddress) => {
  const profile = await getProfessionalWalletProfileByAddress(walletAddress);
  return mapWalletProfile(profile);
};

exports.createWallet = async (payload) => {
  const {
    customerId,
    organizationId,
    organizationCode = null,
    fullName,
    nationalIdHash = null,
    mobileHash = null,
    emailHash = null,
    passwordHash = null,
    ledgerDocType = 'wallet',
    ledgerKey = null,
    requestSource = 'ANGULAR_TEST_UI',
    sourceSystem = 'BLOCKCHAIN_API',
    createdBy = 'angular-test-ui'
  } = payload;

  const initialBalance = normalizeNumber(
    payload.initialBalance ?? payload.currentBalance ?? payload.current_balance,
    0
  );

  const currencyCode =
    payload.currencyCode ||
    payload.currency_code ||
    payload.currency ||
    'USD';

  if (!customerId) {
    throw new Error('customerId is required');
  }

  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  if (!fullName) {
    throw new Error('fullName is required');
  }

  if (initialBalance < 0) {
    throw new Error('initialBalance must be zero or greater');
  }

  const existingWallet = await db.query(
    `
    SELECT customer_id, wallet_address
    FROM blockchain.wallets
    WHERE customer_id = $1
    LIMIT 1
    `,
    [customerId]
  );

  if (existingWallet.rowCount > 0) {
    throw new Error(`Wallet already exists for customerId: ${customerId}`);
  }

  const walletAddress = `WALLET_${Date.now()}_${Math.random()
    .toString(16)
    .slice(2)
    .toUpperCase()}`;

  const normalizedPasswordHash =
    passwordHash && passwordHash.startsWith('$2')
      ? passwordHash
      : passwordHash
        ? await bcrypt.hash(passwordHash, 10)
        : null;

  const columns = await getWalletColumns();

  const valuesByColumn = {
    wallet_address: walletAddress,
    customer_id: customerId,
    organization_id: organizationId,
    organization_code: organizationCode,
    wallet_type: 'CUSTOMER',
    full_name: fullName,
    national_id_hash: nationalIdHash,
    ledger_doc_type: ledgerDocType,
    ledger_key: ledgerKey,
    mobile_hash: mobileHash,
    email_hash: emailHash,
    password_hash: normalizedPasswordHash,
    current_balance: initialBalance,
    currency_code: currencyCode,
    status: 'ACTIVE',
    created_at: new Date(),
    updated_at: new Date()
  };

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];

  Object.entries(valuesByColumn).forEach(([column, value]) => {
    if (columns.includes(column)) {
      insertColumns.push(column);
      insertValues.push(value);
      placeholders.push(`$${insertValues.length}`);
    }
  });

  const sql = `
    INSERT INTO blockchain.wallets (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const result = await db.query(sql, insertValues);
  const row = result.rows[0];

  const profile =
    (await getProfessionalWalletProfileByAddress(row.wallet_address)) ||
    (await getProfessionalWalletProfileByCustomerId(row.customer_id));

  return {
    wallet: profile || {
      walletId: row.wallet_id,
      walletAddress: row.wallet_address,
      customerId: row.customer_id,
      organizationId: row.organization_id,
      organizationCode: row.organization_code,
      walletType: row.wallet_type,
      fullName: row.full_name,
      customerName: row.full_name,
      customerType: row.wallet_type,
      nationality: row.national_id_hash,
      idType: row.ledger_doc_type,
      idNumber: row.ledger_key,
      nationalIdHash: row.national_id_hash,
      ledgerDocType: row.ledger_doc_type,
      ledgerKey: row.ledger_key,
      mobileHash: row.mobile_hash,
      emailHash: row.email_hash,
      currentBalance: row.current_balance ?? initialBalance,
      currencyCode: row.currency_code || currencyCode,
      status: row.status,
      requestSource,
      sourceSystem,
      createdBy,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  };
};

exports.loginWallet = async ({ walletAddress, customerId, password }) => {
  const loginIdentifier = walletAddress || customerId;

  if (!loginIdentifier) {
    throw new Error('walletAddress is required');
  }

  if (!password) {
    throw new Error('password is required');
  }

  const sql = `
    SELECT
      wallet_id,
      wallet_address,
      customer_id,
      organization_id,
      organization_code,
      wallet_type,
      full_name,
      password_hash,
      status
    FROM blockchain.wallets
    WHERE wallet_address = $1
    LIMIT 1
  `;

  const result = await db.query(sql, [loginIdentifier]);

  if (result.rows.length === 0) {
    return null;
  }

  const wallet = result.rows[0];

  if (!wallet.password_hash) {
    throw new Error('Wallet has no password hash configured');
  }

  const isPasswordValid = await bcrypt.compare(password, wallet.password_hash);

  if (!isPasswordValid) {
    return null;
  }

  const profile =
    (await getProfessionalWalletProfileByAddress(wallet.wallet_address)) ||
    (await getProfessionalWalletProfileByCustomerId(wallet.customer_id)) ||
    {};

  const token = jwt.sign(
    {
      walletId: wallet.wallet_id,
      walletAddress: wallet.wallet_address,
      customerId: wallet.customer_id,
      organizationId: wallet.organization_id,
      walletType: wallet.wallet_type
    },
    JWT_SECRET,
    {
      expiresIn: DEFAULT_JWT_EXPIRES_IN
    }
  );

  return {
    token,
    wallet: {
      walletId: wallet.wallet_id,
      walletAddress: profile.walletAddress || wallet.wallet_address,
      customerId: profile.customerId || wallet.customer_id,
      organizationId: profile.organizationId || wallet.organization_id,
      organizationName: profile.organizationName || null,
      organizationCode: wallet.organization_code,
      walletType: wallet.wallet_type,
      fullName: profile.fullName || wallet.full_name,
      customerName: profile.fullName || wallet.full_name,
      nationalIdHash: profile.nationalIdHash || null,
      countryName: profile.countryName || null,
      emailHash: profile.emailHash || null,
      mobileHash: profile.mobileHash || null,
      currentBalance: profile.currentBalance ?? 0,
      currencyCode: profile.currencyCode || 'USD',
      createdAt: profile.createdAt || null,
      status: profile.status || wallet.status
    }
  };
};

exports.login = exports.loginWallet;
exports.getByCustomerId = exports.getWalletByCustomerId;
exports.getByWalletAddress = exports.getWalletByAddress;
exports.getWalletProfileByCustomerId = getProfessionalWalletProfileByCustomerId;
exports.getWalletProfileByAddress = getProfessionalWalletProfileByAddress;
