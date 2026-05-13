'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const db = require('../config/database');
const fabricService = require('./fabric.service');
const enterprisePersistenceRepository = require('../repositories/enterprise-persistence.repository');
const DEFAULT_JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';
const JWT_SECRET =
  process.env.JWT_SECRET ||
  process.env.APP_JWT_SECRET ||
  'CHANGE_ME_DEV_SECRET';

const DEFAULT_CHANNEL_NAME =
  process.env.FABRIC_CHANNEL_NAME ||
  process.env.CHANNEL_NAME ||
  'kycchannelnix1';

const DEFAULT_CHAINCODE_NAME =
  process.env.FABRIC_CHAINCODE_NAME ||
  process.env.CHAINCODE_NAME ||
  'kyc-wallet-chaincode-js';

exports.getNextCustomerId = async () => {
  const client = await db.getClient();

  try {
    const customerId = await enterprisePersistenceRepository.getNextCustomerId(client);

    return {
      customerId: String(customerId),
      customer_id: String(customerId)
    };
  } finally {
    client.release();
  }
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
  return Number.isFinite(numberValue) ? numberValue : defaultValue;
}

function normalizeWalletType(value) {
  const normalized = String(value || 'CUSTOMER').trim().toUpperCase();

  if (normalized === 'ORGANIZATION' || normalized === 'ORG') {
    return 'ORGANIZATION';
  }

  return 'CUSTOMER';
}

function buildOrganizationEmail(organizationName) {
  const slug = String(organizationName || 'organization')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return `${slug || 'organization'}@gmail.com`;
}

function generateOneTimePassword(prefix = 'Wallet') {
  return `${prefix}@${crypto.randomBytes(4).toString('hex')}${Date.now()
    .toString()
    .slice(-4)}`;
}

function mapWalletProfile(profile) {
  if (!profile) {
    return null;
  }

  const walletType = normalizeWalletType(profile.walletType);

  return {
    walletAddress: profile.walletAddress,
    customerId: profile.customerId,
    organizationId: profile.organizationId,
    organizationName: profile.organizationName,
    organizationCode: profile.organizationCode || null,
    walletType,
    fullName: profile.fullName,
    customerName: profile.fullName,
    customerType: walletType,
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

async function getOrganizationById(organizationId) {
  const result = await db.query(
    `
    SELECT
      organization_id::text AS organization_id,
      organization_name,
      organization_type,
      registration_number,
      country_code,
      status
    FROM blockchain.blockchain_organization
    WHERE organization_id::text = $1
    LIMIT 1
    `,
    [String(organizationId)]
  );

  return result.rows[0] || null;
}

function extractBlockchainWallet(fabricResult) {
  const fabricData = fabricResult?.data || fabricResult || {};
  const nestedData = fabricData?.data || {};

  const wallet =
    fabricData.wallet ||
    nestedData.wallet ||
    null;

  const transaction =
    fabricData.transaction ||
    nestedData.transaction ||
    null;

  if (!wallet || !wallet.walletAddress) {
    throw new Error('Blockchain CreateWallet did not return wallet.walletAddress');
  }

  return {
    wallet,
    transaction,
    fabricData
  };
}

function getFabricTransactionId(blockchainWallet, blockchainTransaction) {
  return (
    blockchainTransaction?.transactionId ||
    blockchainTransaction?.createdTxId ||
    blockchainWallet?.createdTxId ||
    blockchainWallet?.updatedTxId ||
    null
  );
}

async function assertCustomerDoesNotExistInPostgres(customerId) {
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
      customerType: normalizeWalletType(row.wallet_type),
      nationality: row.national_id_hash,
      idType: row.ledger_doc_type,
      idNumber: row.ledger_key,
      fullName: row.full_name,
      walletType: normalizeWalletType(row.wallet_type),
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
  const result = await db.query(
    `
    SELECT
        w.customer_id                                  AS "customerId",
        w.wallet_address                              AS "walletAddress",
        w.organization_id                             AS "organizationId",
        w.organization_code                           AS "organizationCode",
        bo.organization_name                          AS "organizationName",
        w.wallet_type                                 AS "walletType",
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
};

const getProfessionalWalletProfileByAddress = async (walletAddress) => {
  const result = await db.query(
    `
    SELECT
        w.customer_id                                  AS "customerId",
        w.wallet_address                              AS "walletAddress",
        w.organization_id                             AS "organizationId",
        w.organization_code                           AS "organizationCode",
        bo.organization_name                          AS "organizationName",
        w.wallet_type                                 AS "walletType",
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
};

exports.getWalletByCustomerId = async (customerId) => {
  const profile = await getProfessionalWalletProfileByCustomerId(customerId);
  return mapWalletProfile(profile);
};

exports.getWalletByAddress = async (walletAddress) => {
  const profile = await getProfessionalWalletProfileByAddress(walletAddress);
  return mapWalletProfile(profile);
};

async function insertWallet(valuesByColumn) {
  const columns = await getWalletColumns();

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
  return result.rows[0];
}

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
    requestSource = 'ANGULAR_TEST_UI',
    sourceSystem = 'BLOCKCHAIN_API',
    createdBy = 'angular-test-ui'
  } = payload;

  const initialBalance = normalizeNumber(
    payload.initialBalance ?? payload.currentBalance ?? payload.current_balance,
    0
  );

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

  await assertCustomerDoesNotExistInPostgres(customerId);

  const plainPassword =
    payload.password ||
    payload.oneTimePassword ||
    payload.plainPassword ||
    null;

  const generatedPassword =
    !passwordHash && !plainPassword ? generateOneTimePassword('Wallet') : null;

  const passwordForHash = passwordHash || plainPassword || generatedPassword;

  const normalizedPasswordHash =
    passwordForHash && String(passwordForHash).startsWith('$2')
      ? String(passwordForHash)
      : await bcrypt.hash(String(passwordForHash), 10);

  let fabricResult;
  let blockchainWallet;
  let blockchainTransaction;

  try {
    fabricResult = await fabricService.submitTransaction(
      'CreateWallet',
      [
        customerId,
        organizationId,
        fullName,
        nationalIdHash || '',
        mobileHash || '',
        emailHash || '',
        normalizedPasswordHash,
        String(initialBalance)
      ],
      {
        requestId: payload.requestId || payload.request_id || null,
        correlationId: payload.correlationId || payload.correlation_id || null,
        sourceSystem,
        requestSource,
        createdBy
      }
    );

    const extracted = extractBlockchainWallet(fabricResult);
    blockchainWallet = extracted.wallet;
    blockchainTransaction = extracted.transaction;
  } catch (error) {
    throw new Error(`Blockchain wallet creation failed: ${error.message}`);
  }

  const walletAddress = blockchainWallet.walletAddress;
  const fabricTransactionId = getFabricTransactionId(
    blockchainWallet,
    blockchainTransaction
  );

  const client = await db.getClient();

    let enterpriseSaveResult;

    try {
      await client.query('BEGIN');

      enterpriseSaveResult = await enterprisePersistenceRepository.saveWalletEnterprise(
        client,
        {
          walletAddress,
          customerId,
          organizationId,
          organizationCode,
          walletType: 'CUSTOMER',
          fullName,
          nationalIdHash,
          mobileHash,
          emailHash,
          passwordHash: normalizedPasswordHash,
          ledgerDocType,
          currentBalance: blockchainWallet.balance ?? initialBalance,
          currencyCode: payload.currencyCode || payload.currency || 'USD',          status: blockchainWallet.status || 'ACTIVE',
          fabricTxId: fabricTransactionId,
          fabricChannelName: fabricResult.channelName || DEFAULT_CHANNEL_NAME,
          chaincodeName: fabricResult.chaincodeName || DEFAULT_CHAINCODE_NAME,
          walletMetadata: {
            source: 'BLOCKCHAIN_API',
            walletType: 'CUSTOMER',
            fabricTxId: fabricTransactionId,
            createdFrom: requestSource
          },
          kycPayload: {
            fullName,
            nationalIdHash,
            mobileHash,
            emailHash
          },
          blockchainPayload: blockchainWallet,
          fabricResponse: fabricResult,
          requestId: payload.requestId || payload.request_id || null,
          requestSource,
          sourceSystem,
          createdBy,
          updatedBy: createdBy,
          originalPayload: payload
        }
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      throw new Error(
        `Wallet created on Fabric but enterprise PostgreSQL save failed. Manual reconciliation required. FabricTxId=${fabricTransactionId || 'N/A'} WalletAddress=${walletAddress}. Error: ${error.message}`
      );
    } finally {
      client.release();
    }

    const row = enterpriseSaveResult.wallet;

  const profile =
    (await getProfessionalWalletProfileByAddress(row.wallet_address)) ||
    (await getProfessionalWalletProfileByCustomerId(row.customer_id));

  return {
    wallet: profile || row,
    blockchain: {
      saved: true,
      walletAddress,
      fabricTransactionId,
      channelName: fabricResult.channelName || DEFAULT_CHANNEL_NAME,
      chaincodeName: fabricResult.chaincodeName || DEFAULT_CHAINCODE_NAME,
      transaction: blockchainTransaction || null
    },
    postgres: {
      saved: true,
      walletId: row.wallet_id || null
    },
    oneTimePassword:
      generatedPassword ||
      (!String(passwordForHash).startsWith('$2') ? passwordForHash : null)
  };
};

exports.createOrganizationWallet = async (payload) => {
  const organizationId = payload.organizationId || payload.organization_id;

  if (!organizationId) {
    throw new Error('organizationId is required');
  }

  const organization = await getOrganizationById(organizationId);

  if (!organization) {
    throw new Error(`Organization not found: ${organizationId}`);
  }

  const existingOrgWallet = await db.query(
    `
    SELECT wallet_address
    FROM blockchain.wallets
    WHERE organization_id::text = $1
      AND UPPER(wallet_type) = 'ORGANIZATION'
    LIMIT 1
    `,
    [String(organizationId)]
  );

  if (existingOrgWallet.rowCount > 0) {
    throw new Error(
      `Organization wallet already exists for organizationId: ${organizationId}`
    );
  }

  const initialBalance = normalizeNumber(
    payload.initialBalance ?? payload.currentBalance ?? payload.current_balance,
    0
  );

  if (initialBalance < 0) {
    throw new Error('initialBalance must be zero or greater');
  }

  const plainPassword =
    payload.passwordHash ||
    payload.password ||
    generateOneTimePassword('Org');

  const normalizedPasswordHash = String(plainPassword).startsWith('$2')
    ? String(plainPassword)
    : await bcrypt.hash(String(plainPassword), 10);

  const customerId = `ORG_${String(organization.organization_id)
    .replace(/-/g, '')
    .slice(0, 24)}`;

  const organizationName = organization.organization_name;
  const organizationCode =
    organization.registration_number ||
    organization.organization_code ||
    String(organization.organization_id);

  const emailHash = buildOrganizationEmail(organizationName);

  let fabricResult;
  let blockchainWallet;
  let blockchainTransaction;

  try {
    fabricResult = await fabricService.submitTransaction(
      'CreateWallet',
      [
        customerId,
        String(organization.organization_id),
        organizationName,
        String(organization.organization_id),
        '',
        emailHash,
        normalizedPasswordHash,
        String(initialBalance)
      ],
      {
        requestId: payload.requestId || payload.request_id || null,
        correlationId: payload.correlationId || payload.correlation_id || null,
        sourceSystem: payload.sourceSystem || payload.source_system || 'BLOCKCHAIN_API',
        requestSource: payload.requestSource || payload.request_source || 'ANGULAR_TEST_UI',
        createdBy: payload.createdBy || payload.created_by || 'angular-test-ui'
      }
    );

    const extracted = extractBlockchainWallet(fabricResult);
    blockchainWallet = extracted.wallet;
    blockchainTransaction = extracted.transaction;
  } catch (error) {
    throw new Error(`Blockchain organization wallet creation failed: ${error.message}`);
  }

  const walletAddress = blockchainWallet.walletAddress;
  const fabricTransactionId = getFabricTransactionId(
    blockchainWallet,
    blockchainTransaction
  );

  const client = await db.getClient();

    let enterpriseSaveResult;

    try {
      await client.query('BEGIN');

      enterpriseSaveResult = await enterprisePersistenceRepository.saveWalletEnterprise(
        client,
        {
          walletAddress,
          customerId,
          organizationId: organization.organization_id,
          organizationCode,
          walletType: 'ORGANIZATION',
          fullName: organizationName,
          nationalIdHash: String(organization.organization_id),
          mobileHash: null,
          emailHash,
          passwordHash: normalizedPasswordHash,
          ledgerDocType: 'organization_wallet',
          currentBalance: blockchainWallet.balance ?? initialBalance,
          currencyCode: payload.currencyCode || payload.currency || 'USD',          status: blockchainWallet.status || 'ACTIVE',
          fabricTxId: fabricTransactionId,
          fabricChannelName: fabricResult.channelName || DEFAULT_CHANNEL_NAME,
          chaincodeName: fabricResult.chaincodeName || DEFAULT_CHAINCODE_NAME,
          walletMetadata: {
            source: 'BLOCKCHAIN_API',
            walletType: 'ORGANIZATION',
            fabricTxId: fabricTransactionId,
            organizationId: organization.organization_id,
            organizationCode
          },
          kycPayload: {
            organizationId: organization.organization_id,
            organizationName,
            organizationCode
          },
          blockchainPayload: blockchainWallet,
          fabricResponse: fabricResult,
          requestId: payload.requestId || payload.request_id || null,
          requestSource: payload.requestSource || payload.request_source || 'ANGULAR_TEST_UI',
          sourceSystem: payload.sourceSystem || payload.source_system || 'BLOCKCHAIN_API',
          createdBy: payload.createdBy || payload.created_by || 'angular-test-ui',
          updatedBy: payload.createdBy || payload.created_by || 'angular-test-ui',
          originalPayload: payload
        }
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');

      throw new Error(
        `Organization wallet created on Fabric but enterprise PostgreSQL save failed. Manual reconciliation required. FabricTxId=${fabricTransactionId || 'N/A'} WalletAddress=${walletAddress}. Error: ${error.message}`
      );
    } finally {
      client.release();
    }

    const row = enterpriseSaveResult.wallet;

  const profile = await getProfessionalWalletProfileByAddress(row.wallet_address);

  return {
    wallet: profile || row,
    blockchain: {
      saved: true,
      walletAddress,
      fabricTransactionId,
      channelName: fabricResult.channelName || DEFAULT_CHANNEL_NAME,
      chaincodeName: fabricResult.chaincodeName || DEFAULT_CHAINCODE_NAME,
      transaction: blockchainTransaction || null
    },
    postgres: {
      saved: true,
      walletId: row.wallet_id || null
    },
    oneTimePassword: String(plainPassword).startsWith('$2') ? null : plainPassword
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

  const result = await db.query(
    `
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
    `,
    [loginIdentifier]
  );

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

  const walletType = normalizeWalletType(profile.walletType || wallet.wallet_type);

  const token = jwt.sign(
    {
      walletId: wallet.wallet_id,
      walletAddress: wallet.wallet_address,
      customerId: wallet.customer_id,
      organizationId: wallet.organization_id,
      walletType
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
      organizationCode: profile.organizationCode || wallet.organization_code,
      walletType,
      fullName: profile.fullName || wallet.full_name,
      customerName: profile.fullName || wallet.full_name,
      nationalIdHash: profile.nationalIdHash || null,
      countryName: profile.countryName || null,
      emailHash: profile.emailHash || null,
      mobileHash: profile.mobileHash || null,
      currentBalance: profile.currentBalance ?? 0,
      currencyCode: profile.currencyCode || 'TOKEN',
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