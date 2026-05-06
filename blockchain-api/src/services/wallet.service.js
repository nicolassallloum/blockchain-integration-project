'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.APP_JWT_SECRET ||
  'CHANGE_ME_DEV_SECRET';

/**
 * STEP 30 — Dashboard Wallet List
 *
 * Source table:
 *   blockchain.wallets
 *
 * Dashboard column mapping:
 *   full_name        -> Customer Name
 *   wallet_type      -> Customer Type
 *   national_id_hash -> Nationality
 *   ledger_doc_type  -> ID Type
 *   ledger_key       -> ID Number
 */
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
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }))
  };
};

/**
 * Professional Wallet Profile for Login / Query screens.
 *
 * First tries your requested full query.
 * If some optional columns do not exist, it falls back to a safe profile query.
 */
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
          COALESCE(w.current_balance, w.current_Balance, 0) AS "currentBalance",
          COALESCE(w.currency_code, w.currency, 'USD')  AS "currencyCode",
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
      'Professional wallet profile full query failed. Falling back to safe query:',
      error.message
    );

    const fallbackResult = await db.query(
      `
      SELECT
          w.customer_id                         AS "customerId",
          w.wallet_address                     AS "walletAddress",
          w.organization_id                    AS "organizationId",
          bo.organization_name                 AS "organizationName",
          w.full_name                          AS "fullName",
          w.national_id_hash                   AS "nationalIdHash",
          c.cou_name                           AS "countryName",
          w.email_hash                         AS "emailHash",
          w.mobile_hash                        AS "mobileHash",
          0                                    AS "currentBalance",
          'USD'                                AS "currencyCode",
          w.created_at                         AS "createdAt",
          w.status                             AS "status"
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

    return fallbackResult.rows[0] || null;
  }
};

/**
 * Professional Wallet Profile by wallet address.
 */
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
          COALESCE(w.current_balance, w.current_Balance, 0) AS "currentBalance",
          COALESCE(w.currency_code, w.currency, 'USD')  AS "currencyCode",
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
          bo.organization_name                 AS "organizationName",
          w.full_name                          AS "fullName",
          w.national_id_hash                   AS "nationalIdHash",
          c.cou_name                           AS "countryName",
          w.email_hash                         AS "emailHash",
          w.mobile_hash                        AS "mobileHash",
          0                                    AS "currentBalance",
          'USD'                                AS "currencyCode",
          w.created_at                         AS "createdAt",
          w.status                             AS "status"
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

    return fallbackResult.rows[0] || null;
  }
};

/**
 * Get wallet by customer ID
 */
exports.getWalletByCustomerId = async (customerId) => {
  const profile = await getProfessionalWalletProfileByCustomerId(customerId);

  if (!profile) {
    return null;
  }

  return {
    id: profile.walletId || null,
    walletId: profile.walletId || null,
    walletAddress: profile.walletAddress,
    customerId: profile.customerId,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    walletType: profile.walletType || 'CUSTOMER',
    fullName: profile.fullName,
    customerName: profile.fullName,
    customerType: profile.walletType || 'CUSTOMER',
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
};

/**
 * Get wallet by wallet address
 */
exports.getWalletByAddress = async (walletAddress) => {
  const profile = await getProfessionalWalletProfileByAddress(walletAddress);

  if (!profile) {
    return null;
  }

  return {
    id: profile.walletId || null,
    walletId: profile.walletId || null,
    walletAddress: profile.walletAddress,
    customerId: profile.customerId,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    walletType: profile.walletType || 'CUSTOMER',
    fullName: profile.fullName,
    customerName: profile.fullName,
    customerType: profile.walletType || 'CUSTOMER',
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
};

/**
 * Create wallet directly in PostgreSQL.
 *
 * Kept from your working version.
 */
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

  if (!customerId) {
    throw new Error('customerId is required');
  }

  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  if (!fullName) {
    throw new Error('fullName is required');
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

  const sql = `
    INSERT INTO blockchain.wallets (
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
      password_hash,
      status,
      created_at,
      updated_at
    )
    VALUES (
      $1, $2, $3, $4, 'CUSTOMER', $5, $6, $7, $8, $9, $10, $11, 'ACTIVE', NOW(), NOW()
    )
    RETURNING
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
      created_at,
      updated_at
  `;

  const values = [
    walletAddress,
    customerId,
    organizationId,
    organizationCode,
    fullName,
    nationalIdHash,
    ledgerDocType,
    ledgerKey,
    mobileHash,
    emailHash,
    normalizedPasswordHash
  ];

  const result = await db.query(sql, values);
  const row = result.rows[0];

  const profile = await getProfessionalWalletProfileByCustomerId(row.customer_id);

  return {
    wallet: profile || {
      id: row.wallet_id,
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
      status: row.status,
      requestSource,
      sourceSystem,
      createdBy,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  };
};

/**
 * Wallet login by customer ID
 *
 * Kept bcrypt validation from your working version,
 * but now returns a professional enriched wallet profile.
 */
exports.loginWallet = async ({ customerId, password }) => {
  if (!customerId) {
    throw new Error('customerId is required');
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
    WHERE customer_id = $1
    LIMIT 1
  `;

  const result = await db.query(sql, [customerId]);

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
    (await getProfessionalWalletProfileByCustomerId(customerId)) || {};

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

/**
 * Compatibility exports for controllers that may call these names.
 */
exports.login = exports.loginWallet;
exports.getByCustomerId = exports.getWalletByCustomerId;
exports.getByWalletAddress = exports.getWalletByAddress;
exports.getWalletProfileByCustomerId = getProfessionalWalletProfileByCustomerId;
exports.getWalletProfileByAddress = getProfessionalWalletProfileByAddress;