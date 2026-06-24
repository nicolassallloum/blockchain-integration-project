'use strict';

const path = require('path');

/**
 * Load .env before loading database configuration.
 * Important for PostgreSQL password.
 */
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

/**
 * Blockchain Data Generator

/**
 * Blockchain Data Generator
 *
 * Generates:
 * - Customer wallets
 * - Wallet-to-wallet transactions
 *
 * Run:
 * node src/scripts/generate-wallets-transactions.js --wallets 1000 --transactions 5000
 */

const crypto = require('crypto');
const { performance } = require('perf_hooks');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const enterprisePersistenceRepository = require('../repositories/enterprise-persistence.repository');

const DEFAULT_PASSWORD = process.env.GENERATED_WALLET_PASSWORD || 'Test@12345';
const DEFAULT_CURRENCY = process.env.GENERATED_CURRENCY || 'USD';

function getArg(name, defaultValue) {
  const index = process.argv.indexOf(`--${name}`);

  if (index === -1 || !process.argv[index + 1]) {
    return defaultValue;
  }

  return process.argv[index + 1];
}

const WALLET_COUNT = Number(getArg('wallets', 1000));
const TRANSACTION_COUNT = Number(getArg('transactions', 5000));
const MIN_BALANCE = Number(getArg('minBalance', 100));
const MAX_BALANCE = Number(getArg('maxBalance', 10000));
const MIN_AMOUNT = Number(getArg('minAmount', 1));
const MAX_AMOUNT = Number(getArg('maxAmount', 500));
const FEE_PERCENT = Number(getArg('feePercent', 0.005));

/**
 * Performance logging options.
 *
 * --logEvery 1000
 * --logEach true
 */
const LOG_EVERY = Number(getArg('logEvery', 1000));
const LOG_EACH = String(getArg('logEach', 'false')).toLowerCase() === 'true';

function nowMs() {
  return performance.now();
}

function roundDurationMs(value) {
  return Number(Number(value || 0).toFixed(3));
}

function seconds(valueMs) {
  return Number((Number(valueMs || 0) / 1000).toFixed(3));
}

function ratePerSecond(count, durationMs) {
  if (!durationMs || durationMs <= 0) {
    return 0;
  }

  return Number((count / (durationMs / 1000)).toFixed(2));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function formatSeconds(value) {
  return `${Number(value || 0).toFixed(3)} sec`;
}

function progressPercent(done, total) {
  if (!total || total <= 0) {
    return 0;
  }

  return Number(((done / total) * 100).toFixed(2));
}

function estimateRemainingSeconds(done, total, elapsedMs) {
  if (!done || done <= 0 || !total || total <= done) {
    return 0;
  }

  const rate = done / (elapsedMs / 1000);
  const remaining = total - done;

  return Number((remaining / rate).toFixed(3));
}

function logMetric(label, payload) {
  console.log(`[${label}] ${JSON.stringify(payload)}`);
}

function logSection(title) {
  console.log('');
  console.log('======================================================');
  console.log(title);
  console.log('======================================================');
}

function logProfessionalProgress(label, payload) {
  console.log(
    `[${label}] ` +
    `progress=${payload.progressPercent} | ` +
    `created=${payload.created} | ` +
    `skipped=${payload.skipped} | ` +
    `elapsed=${payload.elapsedSeconds} | ` +
    `eta=${payload.etaSeconds} | ` +
    `avg=${payload.averageMsPerRecord} ms/record | ` +
    `throughput=${payload.recordsPerSecond} records/sec`
  );
}

function logProfessionalSummary(title, payload) {
  logSection(title);

  Object.entries(payload).forEach(([key, value]) => {
    console.log(`${key.padEnd(28, ' ')}: ${value}`);
  });
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function randomMoney(min, max) {
  return roundMoney(Math.random() * (max - min) + min);
}

function generateWalletAddress() {
  return crypto.randomBytes(20).toString('hex');
}

function generateRequestId() {
  return `REQ_${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
}

function generateTransactionReference() {
  return `TXN_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function generateCustomerName(customerId) {
  return `Generated Customer ${customerId}`;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const NATIONAL_ID_HASH_LIST = [
  '3474','3484','3464','3502','3505','3520','3533','3531','3543','3537','3542','3552','3564','3563','3551',
  '3559','3565','3480','3546','3555','3545','3568','3577','3573','3572','3575','3586','3593','3584','3582',
  '3585','3596','3598','3528','3536','3613','3618','3602','3604','3612','3611','3609','3603','3475','3538',
  '3616','3621','3450','3620','3627','3622','3583','3495','3558','3569','3468','3560','3557','3514','3417',
  '3571','3640','3610','3588','3599','3548','3479','3624','3504','3421','3420','3428','3445','3503','3513',
  '3512','3519','3574','3581','3669','3485','3641','3435','3463','3592','3600','3411','3415','3456','3458',
  '3453','3413','3469','3408','3418','3414','3424','3431','3426','3443','3440','3437','3442','3438','3436',
  '3429','3432','3525','3459','3448','3455','3447','3457','3451','3462','3466','3629','3470','3619','3496',
  '3471','3476','3477','3482','3493','3487','3490','3497','3494','3501','3507','3644','3508','3517','3509',
  '3515','3522','3521','3523','3526','3529','3524','3535','3540','3539','3647','3591','3645','3670','3637',
  '3630','3643','3671','3589','3623','3550','3594','3607','3491','3446','3412','3488','3419','3578','3648',
  '3554','3489','3441','3628','3651','3461','3566','3518','3439','3597','3511','3625','3632','3634','3631',
  '3633','3635','3639','3638','3409','3642','3650','3646','3649','3666','3492','3500','3510','3561','3444',
  '3422','3430','3465','3478','3499','3516','3530','3544','3553','3562','3547','3567','3576','3570','3580',
  '3587','3601','3652','3614','3615','3605','3606','3636','3556','3449','3460','3590','3608','3532','3579',
  '3626','3541','3467','3486','3410','3416','3427','3433','3425','3454','3527','3452','3506','3472','3498',
  '3656','3481','3667','3434','3663','3549','3617','3423'
];

const REAL_FULL_NAMES = [
  'Nicolas Haddad','Georges Khoury','Charbel Mansour','Elias Saab','Joseph Aoun','Michel Tannous','Fadi Saliba',
  'Tony Nassar','Rami Karam','Marwan Daher','Karim Abou Jaoude','Samir Abi Raad','Walid Chidiac','Nadim Farah',
  'Hadi El Khoury','Jad Mouawad','Paul Zakhia','Roy Matar','Elie Gemayel','Marc Harb','Ziad Rahme','Nabil Sarkis',
  'Tarek Haddad','Omar Khatib','Ahmad Hamdan','Hassan Mansour','Ali Saleh','Mohamad Khalil','Hussein Darwish',
  'Youssef Saad','Bilal Osman','Mahmoud Itani','Khaled Hijazi','Bassel Taha','Fouad Merhi','Adel Abdallah',
  'Sami Daher','Ibrahim Nasser','Nour El Din','Mostafa Zein','Rayan Hallak','Mazen Younes','Samer Barakat',
  'Ghassan Fares','Riad Kassis','Wael Hobeika','Bassem Najjar','Firas Raad','Ralph Bou Daher','Jean Sfeir',
  'Maria Haddad','Nadine Khoury','Maya Mansour','Rita Saab','Christina Aoun','Lara Tannous','Micheline Saliba',
  'Cynthia Nassar','Rana Karam','Dina Daher','Carla Abou Jaoude','Mireille Abi Raad','Hala Chidiac','Sandy Farah',
  'Lea El Khoury','Mia Mouawad','Joelle Zakhia','Tania Matar','Elissa Gemayel','Patricia Harb','Clara Rahme',
  'Rima Sarkis','Mona Haddad','Sara Khatib','Fatima Hamdan','Zeinab Mansour','Nour Saleh','Mariam Khalil',
  'Hiba Darwish','Aya Saad','Lina Osman','Jana Itani','Layal Hijazi','Yara Taha','Dalia Merhi','Reem Abdallah',
  'Samar Daher','Roula Nasser','Farah Zein','Celine Hallak','Mira Younes','Dana Barakat','Nathalie Fares',
  'Racha Kassis','Grace Hobeika','Perla Najjar','Lynn Raad','Joy Bou Daher','Stephanie Sfeir'
];

function getRandomNationalIdHash() {
  return randomItem(NATIONAL_ID_HASH_LIST);
}

function getRealFullName(customerId) {
  const baseName = randomItem(REAL_FULL_NAMES);
  return `${baseName} `;
}

function buildRealEmail(fullName, customerId) {
  const slug = String(fullName || 'customer')
    .toLowerCase()
    .replace(/[0-9]/g, '')
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return `${slug}.${customerId}@gmail.com`;
}


function pickColumn(columns, candidates) {
  return candidates.find((column) => columns.includes(column)) || null;
}

async function getAllowedCheckValues(client, tableName, columnName) {
  const result = await client.query(
    `
    SELECT pg_get_constraintdef(c.oid) AS constraint_def
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'blockchain'
      AND t.relname = $1
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%' || $2 || '%'
    `,
    [tableName, columnName]
  );

  const values = new Set();

  for (const row of result.rows) {
    const constraintDef = String(row.constraint_def || '');
    const matches = constraintDef.match(/'([^']+)'/g) || [];

    for (const match of matches) {
      values.add(match.replace(/'/g, '').toUpperCase());
    }
  }

  return Array.from(values);
}

async function getPreferredAllowedValue(client, tableName, columnName, preferredValues, fallbackValue) {
  const allowedValues = await getAllowedCheckValues(client, tableName, columnName);

  if (allowedValues.length === 0) {
    return fallbackValue;
  }

  for (const preferredValue of preferredValues) {
    if (allowedValues.includes(String(preferredValue).toUpperCase())) {
      return String(preferredValue).toUpperCase();
    }
  }

  return allowedValues[0];
}

async function getClient() {
  if (db.pool && typeof db.pool.connect === 'function') {
    return db.pool.connect();
  }

  if (typeof db.getPool === 'function') {
    return db.getPool().connect();
  }

  if (typeof db.connect === 'function') {
    return db.connect();
  }

  throw new Error('Database client connection method not found in src/config/database.js');
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

async function getColumns(client, tableName) {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'blockchain'
      AND table_name = $1
      AND COALESCE(is_generated, 'NEVER') = 'NEVER'
      AND COALESCE(is_identity, 'NO') = 'NO'
    ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

async function resolveTransactionTable(client) {
  if (await tableExists(client, 'blockchain', 'transactions')) {
    return 'transactions';
  }

  if (await tableExists(client, 'blockchain', 'blockchain_transactions')) {
    return 'blockchain_transactions';
  }

  throw new Error('No transaction table found. Expected blockchain.transactions or blockchain.blockchain_transactions');
}

async function resolveOrganizationTable(client) {
  // Source of truth for organizations in this project is blockchain.blockchain_organization.
  // Use blockchain.organizations only as a fallback for older database deployments.
  if (await tableExists(client, 'blockchain', 'blockchain_organization')) return 'blockchain_organization';
  if (await tableExists(client, 'blockchain', 'organizations')) return 'organizations';
  return null;
}

async function getOrganizations(client) {
  const tableName = await resolveOrganizationTable(client);

  if (!tableName) {
    return [
      {
        organization_id: '1',
        organization_name: 'Generated Organization',
        organization_code: 'GEN_ORG'
      }
    ];
  }

  const columns = await getColumns(client, tableName);

  const idColumn = pickColumn(columns, ['organization_id', 'id']);
  const nameColumn = pickColumn(columns, ['organization_name', 'name']);
  const codeColumn = pickColumn(columns, ['organization_code', 'registration_number', 'code']);
  const statusColumn = pickColumn(columns, ['status']);

  const sql = `
    SELECT
      ${idColumn}::text AS organization_id,
      ${nameColumn ? nameColumn : `'Generated Organization'`} AS organization_name,
      ${codeColumn ? codeColumn : `'GEN_ORG'`} AS organization_code
    FROM blockchain.${tableName}
    ${statusColumn ? `WHERE COALESCE(${statusColumn}, 'ACTIVE') = 'ACTIVE'` : ''}
    ORDER BY ${nameColumn || idColumn} ASC
    LIMIT 100
  `;

  const result = await client.query(sql);

  if (result.rows.length === 0) {
    throw new Error(`No active organizations found in blockchain.${tableName}`);
  }

  return result.rows;
}

async function getNextCustomerId(client) {
  const result = await client.query(
    `
    SELECT COALESCE(MAX(customer_id::bigint), 0) + 1 AS next_customer_id
    FROM blockchain.wallets
    WHERE customer_id ~ '^[0-9]+$'
    `
  );

  return Number(result.rows[0]?.next_customer_id || 1);
}

async function walletAddressExists(client, walletAddress) {
  const result = await client.query(
    `
    SELECT 1
    FROM blockchain.wallets
    WHERE wallet_address = $1
    LIMIT 1
    `,
    [walletAddress]
  );

  return result.rowCount > 0;
}

async function generateUniqueWalletAddress(client) {
  let walletAddress = generateWalletAddress();

  while (await walletAddressExists(client, walletAddress)) {
    walletAddress = generateWalletAddress();
  }

  return walletAddress;
}

async function insertDynamic(client, tableName, valuesByColumn) {
  const columns = await getColumns(client, tableName);

  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];

  Object.entries(valuesByColumn).forEach(([column, value]) => {
    if (columns.includes(column) && value !== undefined) {
      insertColumns.push(column);
      insertValues.push(value);
      placeholders.push(`$${insertValues.length}`);
    }
  });

  if (insertColumns.length === 0) {
    throw new Error(`No matching columns found for blockchain.${tableName}`);
  }

  const sql = `
    INSERT INTO blockchain.${tableName} (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
  `;

  const result = await client.query(sql, insertValues);
  return result.rows[0];
}

async function generateWallets(client, count) {
  const phaseStartedAt = nowMs();

  console.log(`[WALLET_GENERATION_START] count=${count}, enterpriseSync=YES`);

  const organizations = await getOrganizations(client);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const itemStartedAt = nowMs();

    const customerId = String(await enterprisePersistenceRepository.getNextCustomerId(client));
    const realFullName = getRealFullName(customerId);
    const realEmail = buildRealEmail(realFullName, customerId);
    const nationalIdHash = getRandomNationalIdHash();
    const organization = randomItem(organizations);
    const walletAddress = await generateUniqueWalletAddress(client);
    const balance = randomMoney(MIN_BALANCE, MAX_BALANCE);
    const requestId = generateRequestId();
    const fabricTxId = `GENERATED_WALLET_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;

    await enterprisePersistenceRepository.saveWalletEnterprise(client, {
      walletAddress,
      customerId,
      organizationId: organization.organization_id,
      organizationCode: organization.organization_code,
      walletType: 'CUSTOMER',
      fullName: realFullName,
      nationalIdHash,
      mobileHash: `+961${Math.floor(70000000 + Math.random() * 9999999)}`,
      emailHash: realEmail,
      passwordHash,
      ledgerDocType: 'wallet',
      currentBalance: balance,
      currencyCode: DEFAULT_CURRENCY,
      status: 'ACTIVE',
      fabricTxId,
      fabricChannelName: process.env.FABRIC_CHANNEL_NAME || 'kycchannelnix1',
      chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'kyc-wallet-chaincode-js',
      walletMetadata: {
        source: 'DATA_GENERATOR',
        generated: true,
        walletType: 'CUSTOMER',
        organizationId: organization.organization_id,
        organizationCode: organization.organization_code
      },
      kycPayload: {
        fullName: realFullName,
        nationalIdHash,
        emailHash: realEmail,
        organizationId: organization.organization_id,
        organizationCode: organization.organization_code
      },
      blockchainPayload: {
        walletAddress,
        customerId,
        balance,
        status: 'ACTIVE',
        source: 'DATA_GENERATOR'
      },
      fabricResponse: {
        generated: true,
        fabricTxId,
        note: 'Synthetic wallet generated directly in PostgreSQL for testing; no Fabric submit was executed.'
      },
      requestId,
      requestSource: 'DATA_GENERATOR',
      sourceSystem: 'BLOCKCHAIN_API_GENERATOR',
      createdBy: 'nix',
      updatedBy: 'nix',
      originalPayload: {
        generated: true,
        generator: 'generate-wallets-transactions.js'
      }
    });

    created++;

    const itemDurationMs = roundDurationMs(nowMs() - itemStartedAt);

    if (LOG_EACH) {
      logMetric('WALLET_ITEM_TIME', {
        rowNumber: i + 1,
        customerId,
        walletAddress,
        processingMs: itemDurationMs
      });
    }

    if (created % LOG_EVERY === 0 || created + skipped >= count) {
      const elapsedMs = nowMs() - phaseStartedAt;

      logProfessionalProgress('WALLET_PROGRESS', {
        progressPercent: formatPercent(progressPercent(created, count)),
        created: formatNumber(created),
        skipped: formatNumber(skipped),
        enterpriseSync: 'YES',
        elapsedSeconds: formatSeconds(seconds(elapsedMs)),
        etaSeconds: formatSeconds(estimateRemainingSeconds(created, count, elapsedMs)),
        averageMsPerRecord: roundDurationMs(elapsedMs / Math.max(created, 1)),
        recordsPerSecond: ratePerSecond(created, elapsedMs)
      });
    }
  }

  const phaseDurationMs = nowMs() - phaseStartedAt;

  logProfessionalSummary('WALLET GENERATION SUMMARY', {
    'Wallets Created': formatNumber(created),
    'Wallets Skipped': formatNumber(skipped),
    'Enterprise Sync': 'YES - blockchain.wallets + sdedba.ref_customer + sdedba.cfg_customer_def',
    'Processing Time': formatSeconds(seconds(phaseDurationMs)),
    'Processing Time MS': roundDurationMs(phaseDurationMs),
    'Average Per Wallet': `${created > 0 ? roundDurationMs(phaseDurationMs / created) : 0} ms`,
    'Throughput': `${ratePerSecond(created, phaseDurationMs)} wallets/sec`
  });

  return {
    created,
    skipped,
    processingMs: roundDurationMs(phaseDurationMs),
    processingSeconds: seconds(phaseDurationMs),
    averageMsPerWallet: created > 0 ? roundDurationMs(phaseDurationMs / created) : 0,
    walletsPerSecond: ratePerSecond(created, phaseDurationMs)
  };
}

async function getActiveWallets(client) {
  const columns = await getColumns(client, 'wallets');
  const organizationTable = await resolveOrganizationTable(client);
  const hasOrganizationTable = Boolean(organizationTable);

  const balanceColumn = pickColumn(columns, [
    'current_balance',
    'currency_balance',
    'balance'
  ]);

  if (!balanceColumn) {
    throw new Error('No balance column found in blockchain.wallets');
  }

  const result = await client.query(
    `
    SELECT
      wallet_address,
      customer_id,
      CASE
        WHEN ${hasOrganizationTable ? `EXISTS (
          SELECT 1
          FROM blockchain.${organizationTable} bo
          WHERE bo.organization_id::text = wallets.organization_id::text
        )` : 'FALSE'}
        THEN wallets.organization_id
        ELSE NULL
      END AS organization_id,
      wallet_type,
      COALESCE(${balanceColumn}, 0)::numeric AS balance
    FROM blockchain.wallets
    WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'
      AND wallet_address IS NOT NULL
      AND wallet_address <> ''
      AND wallet_address ~ '^[a-f0-9]{40}$'
      AND COALESCE(${balanceColumn}, 0) > 0
    ORDER BY created_at DESC NULLS LAST
    LIMIT 50000
    `
  );

  return {
    balanceColumn,
    wallets: result.rows
  };
}

async function updateWalletBalance(client, balanceColumn, walletAddress, amountDelta) {
  await client.query(
    `
    UPDATE blockchain.wallets
    SET
      ${balanceColumn} = ROUND((COALESCE(${balanceColumn}, 0) + $1)::numeric, 2),
      updated_at = CASE
        WHEN EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'blockchain'
            AND table_name = 'wallets'
            AND column_name = 'updated_at'
        )
        THEN NOW()
        ELSE updated_at
      END
    WHERE wallet_address = $2
    `,
    [amountDelta, walletAddress]
  );
}


function toEnterpriseTransactionData(row) {
  return {
    transactionId: row.transaction_id || row.id,
    businessTransactionId: row.transaction_id || row.id,
    ledgerTransactionId: row.fabric_tx_id || row.fabric_transaction_id,
    fabricTxId: row.fabric_tx_id || row.fabric_transaction_id,
    ledgerKey: row.fabric_tx_id || row.fabric_transaction_id || row.transaction_id,
    transactionType: row.transaction_type || row.type || 'TRANSFER',
    transactionDirection: 'OUTGOING',
    fromWalletAddress: row.from_wallet_address || row.sender_wallet_address,
    toWalletAddress: row.to_wallet_address || row.receiver_wallet_address,
    senderWalletAddress: row.sender_wallet_address || row.from_wallet_address,
    receiverWalletAddress: row.receiver_wallet_address || row.to_wallet_address,
    senderCustomerId: row.sender_customer_id || row.from_customer_id,
    receiverCustomerId: row.receiver_customer_id || row.to_customer_id,
    organizationId: row.sender_organization_id || row.from_organization_id || null,
    organizationCode: row.sender_organization_code || row.from_organization_code || null,
    amount: row.amount,
    currencyCode: row.currency_code || row.currency || DEFAULT_CURRENCY,
    currency: row.currency || row.currency_code || DEFAULT_CURRENCY,
    transactionFee: row.transaction_fee || row.fee_amount || 0,
    status: row.status || 'CONFIRMED',
    transactionStatus: row.transaction_status || row.status || 'CONFIRMED',
    fabricStatus: 'CONFIRMED',
    riskLevel: 'LOW',
    amlStatus: 'NOT_CHECKED',
    requestReference: row.transaction_reference || row.request_id,
    externalReference: row.transaction_reference || null,
    idempotencyKey: row.request_id || row.transaction_id,
    fabricChannelName: process.env.FABRIC_CHANNEL_NAME || 'kycchannelnix1',
    chaincodeName: process.env.FABRIC_CHAINCODE_NAME || 'kyc-wallet-chaincode-js',
    transactionPayload: row,
    blockchainResponse: {
      generated: true,
      transactionReference: row.transaction_reference,
      note: 'Synthetic transaction generated directly in PostgreSQL for testing; no Fabric submit was executed.'
    },
    fabricResponse: {
      generated: true,
      fabricTxId: row.fabric_tx_id || row.fabric_transaction_id
    },
    metadata: {
      source: 'DATA_GENERATOR',
      generated: true
    },
    transactionPurpose: row.transaction_purpose,
    transactionDescription: row.transaction_description || row.description,
    requestId: row.request_id,
    sourceSystem: row.source_system || 'BLOCKCHAIN_API_GENERATOR',
    requestSource: row.request_source || 'DATA_GENERATOR',
    createdBy: row.created_by || 'nix',
    updatedBy: row.created_by || 'nix',
    originalPayload: row
  };
}

async function generateTransactions(client, count) {
  const phaseStartedAt = nowMs();

  console.log(`[TRANSACTION_GENERATION_START] count=${count}`);

  const transactionTable = await resolveTransactionTable(client);
  const transactionColumns = await getColumns(client, transactionTable);

  const statusValue = transactionColumns.includes('status')
    ? await getPreferredAllowedValue(
        client,
        transactionTable,
        'status',
        ['PENDING', 'SUBMITTED', 'CONFIRMED', 'SUCCESS', 'COMPLETED', 'FAILED'],
        'PENDING'
      )
    : null;

  const transactionStatusValue = transactionColumns.includes('transaction_status')
    ? await getPreferredAllowedValue(
        client,
        transactionTable,
        'transaction_status',
        ['PENDING', 'SUBMITTED', 'CONFIRMED', 'SUCCESS', 'COMPLETED', 'FAILED'],
        'PENDING'
      )
    : null;

  const transactionTypeValue = transactionColumns.includes('transaction_type')
    ? await getPreferredAllowedValue(
        client,
        transactionTable,
        'transaction_type',
        [
          'TRANSFER',
          'WALLET_TO_WALLET',
          'CUSTOMER_TO_CUSTOMER',
          'CUSTOMER_TRANSFER',
          'WALLET_TRANSFER',
          'PAYMENT'
        ],
        'TRANSFER'
      )
    : null;

  const typeValue = transactionColumns.includes('type')
    ? await getPreferredAllowedValue(
        client,
        transactionTable,
        'type',
        [
          'TRANSFER',
          'WALLET_TO_WALLET',
          'CUSTOMER_TO_CUSTOMER',
          'CUSTOMER_TRANSFER',
          'WALLET_TRANSFER',
          'PAYMENT'
        ],
        'TRANSFER'
      )
    : null;

  console.log('[TRANSACTION_ALLOWED_VALUES]', {
    statusValue,
    transactionStatusValue,
    transactionTypeValue,
    typeValue
  });

  const { balanceColumn, wallets } = await getActiveWallets(client);

  if (wallets.length < 2) {
    throw new Error('At least 2 active wallets with positive balance are required to generate transactions');
  }

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < count; i++) {
    const itemStartedAt = nowMs();

    let sender = randomItem(wallets);
    let receiver = randomItem(wallets);

    let guard = 0;
    while (
      receiver.wallet_address === sender.wallet_address &&
      guard < 20
    ) {
      receiver = randomItem(wallets);
      guard++;
    }

    if (receiver.wallet_address === sender.wallet_address) {
      skipped++;
      continue;
    }

    const amount = randomMoney(MIN_AMOUNT, MAX_AMOUNT);
    const transactionFee = roundMoney(amount * FEE_PERCENT);
    const totalAmount = roundMoney(amount + transactionFee);

    const senderBalance = Number(sender.balance || 0);

    if (senderBalance < totalAmount) {
      skipped++;
      continue;
    }

    const transactionReference = generateTransactionReference();
    const requestId = generateRequestId();

    const transactionValues = {
      id: crypto.randomUUID(),
      transaction_id: crypto.randomUUID(),
      transaction_reference: transactionReference,
      request_id: requestId,
      fabric_transaction_id: `FABRIC_${crypto.randomBytes(16).toString('hex').toUpperCase()}`,
      fabric_tx_id: `FABRIC_${crypto.randomBytes(16).toString('hex').toUpperCase()}`,

      sender_wallet_address: sender.wallet_address,
      receiver_wallet_address: receiver.wallet_address,
      from_wallet_address: sender.wallet_address,
      to_wallet_address: receiver.wallet_address,

      sender_customer_id: sender.customer_id,
      receiver_customer_id: receiver.customer_id,
      from_customer_id: sender.customer_id,
      to_customer_id: receiver.customer_id,

      sender_organization_id: sender.organization_id,
      receiver_organization_id: receiver.organization_id,
      from_organization_id: sender.organization_id,
      to_organization_id: receiver.organization_id,

      amount,
      transaction_fee: transactionFee,
      fee_amount: transactionFee,
      total_amount: totalAmount,

      currency: DEFAULT_CURRENCY,
      currency_code: DEFAULT_CURRENCY,

      transaction_type: transactionTypeValue,
      type: typeValue,

      transaction_purpose: 'Generated wallet-to-wallet transaction',
      transaction_description: 'Synthetic transaction generated for testing dashboard and history screens',
      description: 'Synthetic transaction generated for testing',

      status: statusValue,
      transaction_status: transactionStatusValue,

      request_source: 'DATA_GENERATOR',
      source_system: 'BLOCKCHAIN_API_GENERATOR',
      created_by: 'nix',

      created_at: new Date(),
      updated_at: new Date(),
      completed_at: new Date()
    };

    await enterprisePersistenceRepository.saveTransactionEnterprise(
      client,
      toEnterpriseTransactionData(transactionValues)
    );

    await updateWalletBalance(client, balanceColumn, sender.wallet_address, -totalAmount);
    await updateWalletBalance(client, balanceColumn, receiver.wallet_address, amount);

    sender.balance = roundMoney(Number(sender.balance || 0) - totalAmount);
    receiver.balance = roundMoney(Number(receiver.balance || 0) + amount);

    created++;

    const itemDurationMs = roundDurationMs(nowMs() - itemStartedAt);

    if (LOG_EACH) {
      logMetric('TRANSACTION_ITEM_TIME', {
        rowNumber: i + 1,
        transactionReference,
        fromWalletAddress: sender.wallet_address,
        toWalletAddress: receiver.wallet_address,
        amount,
        fee: transactionFee,
        processingMs: itemDurationMs
      });
    }

    if (created % LOG_EVERY === 0 || i + 1 === count) {
      const elapsedMs = nowMs() - phaseStartedAt;

      logProfessionalProgress('TRANSACTION_PROGRESS', {
        progressPercent: formatPercent(progressPercent(i + 1, count)),
        created: formatNumber(created),
        skipped: formatNumber(skipped),
        elapsedSeconds: formatSeconds(seconds(elapsedMs)),
        etaSeconds: formatSeconds(estimateRemainingSeconds(i + 1, count, elapsedMs)),
        averageMsPerRecord: roundDurationMs(elapsedMs / Math.max(created, 1)),
        recordsPerSecond: ratePerSecond(created, elapsedMs)
      });
    }
  }

  const phaseDurationMs = nowMs() - phaseStartedAt;

  logProfessionalSummary('TRANSACTION GENERATION SUMMARY', {
    'Transaction Table': `blockchain.${transactionTable}`,
    'Transactions Created': formatNumber(created),
    'Transactions Skipped': formatNumber(skipped),
    'Processing Time': formatSeconds(seconds(phaseDurationMs)),
    'Processing Time MS': roundDurationMs(phaseDurationMs),
    'Average Per Transaction': `${created > 0 ? roundDurationMs(phaseDurationMs / created) : 0} ms`,
    'Throughput': `${ratePerSecond(created, phaseDurationMs)} transactions/sec`
  });

  return {
    transactionTable,
    created,
    skipped,
    processingMs: roundDurationMs(phaseDurationMs),
    processingSeconds: seconds(phaseDurationMs),
    averageMsPerTransaction: created > 0 ? roundDurationMs(phaseDurationMs / created) : 0,
    transactionsPerSecond: ratePerSecond(created, phaseDurationMs)
  };
}

async function validateResults(client) {
  const walletCount = await client.query(
    `
    SELECT COUNT(*)::int AS total_wallets
    FROM blockchain.wallets
    `
  );

  const invalidWallets = await client.query(
    `
    SELECT COUNT(*)::int AS invalid_wallets
    FROM blockchain.wallets
    WHERE wallet_address !~ '^[a-f0-9]{40}$'
    `
  );

  const transactionTable = await resolveTransactionTable(client);

  const transactionCount = await client.query(
    `
    SELECT COUNT(*)::int AS total_transactions
    FROM blockchain.${transactionTable}
    `
  );

  return {
    totalWallets: walletCount.rows[0]?.total_wallets || 0,
    invalidWallets: invalidWallets.rows[0]?.invalid_wallets || 0,
    transactionTable,
    totalTransactions: transactionCount.rows[0]?.total_transactions || 0
  };
}

async function main() {
  const totalStartedAt = nowMs();
  const client = await getClient();

  logSection('BLOCKCHAIN DATA GENERATOR - PERFORMANCE RUN');

  console.log(`Run Started At              : ${new Date().toISOString()}`);
  console.log(`Target Wallets              : ${formatNumber(WALLET_COUNT)}`);
  console.log(`Target Transactions         : ${formatNumber(TRANSACTION_COUNT)}`);
  console.log(`Currency                    : ${DEFAULT_CURRENCY}`);
  console.log(`Default Wallet Password     : ${DEFAULT_PASSWORD}`);
  console.log(`Progress Log Frequency      : Every ${formatNumber(LOG_EVERY)} records`);
  console.log(`Log Each Record             : ${LOG_EACH ? 'YES' : 'NO'}`);

  try {
    await client.query('BEGIN');

    const walletsResult =
      WALLET_COUNT > 0
        ? await generateWallets(client, WALLET_COUNT)
        : { created: 0, skipped: 0 };

    const transactionsResult =
      TRANSACTION_COUNT > 0
        ? await generateTransactions(client, TRANSACTION_COUNT)
        : { created: 0, skipped: 0 };

    const validation = await validateResults(client);

    await client.query('COMMIT');

    const totalDurationMs = nowMs() - totalStartedAt;

    const totalRowsCreated =
      Number(walletsResult.created || 0) + Number(transactionsResult.created || 0);

    logProfessionalSummary('FINAL EXECUTION SUMMARY', {
      'Execution Status': 'SUCCESS',
      'Run Completed At': new Date().toISOString(),
      'Total Processing Time': formatSeconds(seconds(totalDurationMs)),
      'Total Processing Time MS': roundDurationMs(totalDurationMs),
      'Wallets Created': formatNumber(walletsResult.created || 0),
      'Transactions Created': formatNumber(transactionsResult.created || 0),
      'Total Rows Created': formatNumber(totalRowsCreated),
      'Overall Throughput': `${ratePerSecond(totalRowsCreated, totalDurationMs)} rows/sec`,
      'Wallet Throughput': `${walletsResult.walletsPerSecond || 0} wallets/sec`,
      'Transaction Throughput': `${transactionsResult.transactionsPerSecond || 0} transactions/sec`,
      'Total Wallets In DB': formatNumber(validation.totalWallets),
      'Invalid Wallet Addresses': formatNumber(validation.invalidWallets),
      'Total Transactions In DB': formatNumber(validation.totalTransactions)
    });

    console.log('');
    console.log('TUNING NOTES');
    console.log('------------');
    console.log('- For large generation runs, use --logEvery 1000 or --logEvery 5000.');
    console.log('- Avoid --logEach true for performance benchmarking.');
    console.log('- If transaction throughput is low, optimize transaction inserts using batch INSERT.');
    console.log('- If skipped transactions increase, increase initial wallet balances or reduce maxAmount.');
    console.log('- If invalid wallet addresses are greater than 0, clean old WALLET_/ORG_WALLET_ records.');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('======================================================');
    console.error('Blockchain Data Generator Failed');
    console.error(error);
    console.error('======================================================');

    process.exitCode = 1;
  } finally {
    client.release();

    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  }
}

main();
