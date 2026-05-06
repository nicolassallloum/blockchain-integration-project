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

      /**
       * Angular dashboard fields
       */
      customerName: row.full_name,
      customerType: row.wallet_type,
      nationality: row.national_id_hash,
      idType: row.ledger_doc_type,
      idNumber: row.ledger_key,

      /**
       * Raw wallet fields
       */
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
 * Get wallet by customer ID
 */
exports.getWalletByCustomerId = async (customerId) => {
  const sql = `
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
    WHERE customer_id = $1
    LIMIT 1
  `;

  const result = await db.query(sql, [customerId]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Get wallet by wallet address
 */
exports.getWalletByAddress = async (walletAddress) => {
  const sql = `
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
    WHERE wallet_address = $1
    LIMIT 1
  `;

  const result = await db.query(sql, [walletAddress]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];

  return {
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
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

/**
 * Create wallet directly in PostgreSQL.
 *
 * IMPORTANT:
 * If you already have Fabric wallet creation logic in another service,
 * keep that Fabric logic and only use listWallets for the dashboard.
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

  return {
    wallet: {
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
      walletAddress: wallet.wallet_address,
      customerId: wallet.customer_id,
      organizationId: wallet.organization_id,
      organizationCode: wallet.organization_code,
      walletType: wallet.wallet_type,
      fullName: wallet.full_name,
      status: wallet.status
    }
  };
};
