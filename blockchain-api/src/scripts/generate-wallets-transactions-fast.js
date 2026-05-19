'use strict';

const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const crypto = require('crypto');
const { performance } = require('perf_hooks');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const enterprisePersistenceRepository = require('../repositories/enterprise-persistence.repository');

const DEFAULT_PASSWORD = process.env.GENERATED_WALLET_PASSWORD || 'Test@12345';
const DEFAULT_CURRENCY = process.env.GENERATED_CURRENCY || 'USD';

function getArg(name, defaultValue) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 || !process.argv[index + 1] ? defaultValue : process.argv[index + 1];
}

const WALLET_COUNT = Number(getArg('wallets', 1000));
const TRANSACTION_COUNT = Number(getArg('transactions', 5000));
const BATCH_SIZE = Number(getArg('batchSize', 1000));
const LOG_EVERY = Number(getArg('logEvery', 5000));

/**
 * PostgreSQL extended query protocol supports a limited number of bind parameters.
 * Keep this below 65,535 for safety.
 */
const MAX_PG_PARAMS = Number(getArg('maxPgParams', 50000));

const MIN_BALANCE = Number(getArg('minBalance', 1000));
const MAX_BALANCE = Number(getArg('maxBalance', 10000));
const MIN_AMOUNT = Number(getArg('minAmount', 1));
const MAX_AMOUNT = Number(getArg('maxAmount', 250));
const FEE_PERCENT = Number(getArg('feePercent', 0.005));

const columnCache = new Map();

function nowMs() {
  return performance.now();
}

function roundMs(value) {
  return Number(Number(value || 0).toFixed(3));
}

function seconds(ms) {
  return Number((Number(ms || 0) / 1000).toFixed(3));
}

function ratePerSecond(count, durationMs) {
  if (!durationMs || durationMs <= 0) return 0;
  return Number((count / (durationMs / 1000)).toFixed(2));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('en-US');
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

function logSection(title) {
  console.log('');
  console.log('======================================================');
  console.log(title);
  console.log('======================================================');
}

function logSummary(title, payload) {
  logSection(title);
  Object.entries(payload).forEach(([key, value]) => {
    console.log(`${key.padEnd(30, ' ')}: ${value}`);
  });
}

function logProgress(label, created, target, skipped, startedAt) {
  const elapsedMs = nowMs() - startedAt;
  const progress = target > 0 ? ((created / target) * 100).toFixed(2) : '0.00';

  console.log(
    `[${label}] progress=${progress}% | created=${formatNumber(created)} | skipped=${formatNumber(skipped)} | ` +
    `elapsed=${seconds(elapsedMs)} sec | avg=${roundMs(elapsedMs / Math.max(created, 1))} ms/row | ` +
    `throughput=${ratePerSecond(created, elapsedMs)} rows/sec`
  );
}

async function getClient() {
  if (db.pool && typeof db.pool.connect === 'function') return db.pool.connect();
  if (typeof db.getPool === 'function') return db.getPool().connect();
  if (typeof db.connect === 'function') return db.connect();

  throw new Error('Database client connection method not found');
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
  if (columnCache.has(tableName)) {
    return columnCache.get(tableName);
  }

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

  const columns = result.rows.map((row) => row.column_name);
  columnCache.set(tableName, columns);

  return columns;
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
    const matches = String(row.constraint_def || '').match(/'([^']+)'/g) || [];
    for (const match of matches) {
      values.add(match.replace(/'/g, '').toUpperCase());
    }
  }

  return Array.from(values);
}

async function getPreferredAllowedValue(client, tableName, columnName, preferredValues, fallbackValue) {
  const allowedValues = await getAllowedCheckValues(client, tableName, columnName);

  if (allowedValues.length === 0) return fallbackValue;

  for (const preferred of preferredValues) {
    if (allowedValues.includes(String(preferred).toUpperCase())) {
      return String(preferred).toUpperCase();
    }
  }

  return allowedValues[0];
}

async function resolveTransactionTable(client) {
  if (await tableExists(client, 'blockchain', 'transactions')) return 'transactions';
  if (await tableExists(client, 'blockchain', 'blockchain_transactions')) return 'blockchain_transactions';

  throw new Error('No transaction table found');
}

async function resolveOrganizationTable(client) {
  // Source of truth for organizations in this project is blockchain.blockchain_organization.
  // Use blockchain.organizations only as a fallback for older database deployments.
  if (await tableExists(client, 'blockchain', 'blockchain_organization')) return 'blockchain_organization';
  // if (await tableExists(client, 'blockchain', 'organizations')) return 'organizations';
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

  const result = await client.query(
    `
    SELECT
      ${idColumn}::text AS organization_id,
      ${nameColumn ? nameColumn : `'Generated Organization'`} AS organization_name,
      ${codeColumn ? codeColumn : `'GEN_ORG'`} AS organization_code
    FROM blockchain.${tableName}
    ${statusColumn ? `WHERE COALESCE(${statusColumn}, 'ACTIVE') = 'ACTIVE'` : ''}
    ORDER BY ${nameColumn || idColumn} ASC
    LIMIT 100
    `
  );

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

async function batchInsertDynamic(client, tableName, rows, options = {}) {
  if (!rows.length) return [];

  const tableColumns = await getColumns(client, tableName);
  const insertColumns = Object.keys(rows[0]).filter((column) => tableColumns.includes(column));

  if (!insertColumns.length) {
    throw new Error(`No matching insert columns for blockchain.${tableName}`);
  }

  /**
   * Auto-split batch to avoid PostgreSQL bind parameter limit.
   */
  const maxRowsPerInsert = Math.max(
    1,
    Math.floor(MAX_PG_PARAMS / insertColumns.length)
  );

  const insertedRows = [];
  const onConflictSql = options.onConflictDoNothing ? 'ON CONFLICT DO NOTHING' : '';

  for (let offset = 0; offset < rows.length; offset += maxRowsPerInsert) {
    const chunk = rows.slice(offset, offset + maxRowsPerInsert);

    const values = [];
    const rowPlaceholders = [];

    chunk.forEach((row) => {
      const placeholders = [];

      insertColumns.forEach((column) => {
        values.push(row[column]);
        placeholders.push(`$${values.length}`);
      });

      rowPlaceholders.push(`(${placeholders.join(', ')})`);
    });

    const sql = `
      INSERT INTO blockchain.${tableName} (${insertColumns.join(', ')})
      VALUES ${rowPlaceholders.join(', ')}
      ${onConflictSql}
      RETURNING *
    `;

    const result = await client.query(sql, values);
    insertedRows.push(...result.rows);
  }

  return insertedRows;
}

async function generateWalletsFast(client, count) {
  const startedAt = nowMs();

  console.log(`[WALLET_FAST_START] target=${formatNumber(count)}, enterpriseSync=YES`);

  if (count <= 0) {
    return {
      created: 0,
      skipped: 0,
      processingMs: 0,
      processingSeconds: 0,
      walletsPerSecond: 0
    };
  }

  const organizations = await getOrganizations(client);
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  let created = 0;
  let skipped = 0;
  const generatedAddresses = new Set();

  while (created + skipped < count) {
    const customerId = String(await enterprisePersistenceRepository.getNextCustomerId(client));
    const realFullName = getRealFullName(customerId);
    const realEmail = buildRealEmail(realFullName, customerId);
    const nationalIdHash = getRandomNationalIdHash();
    const organization = randomItem(organizations);

    let walletAddress = generateWalletAddress();

    while (generatedAddresses.has(walletAddress)) {
      walletAddress = generateWalletAddress();
    }

    generatedAddresses.add(walletAddress);

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
        source: 'DATA_GENERATOR_FAST',
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
        source: 'DATA_GENERATOR_FAST'
      },
      fabricResponse: {
        generated: true,
        fabricTxId,
        note: 'Synthetic wallet generated directly in PostgreSQL for testing; no Fabric submit was executed.'
      },
      requestId,
      requestSource: 'DATA_GENERATOR_FAST',
      sourceSystem: 'BLOCKCHAIN_API_FAST_GENERATOR',
      createdBy: 'nix',
      updatedBy: 'nix',
      originalPayload: {
        generated: true,
        generator: 'generate-wallets-transactions-fast.js'
      }
    });

    created++;

    if (created % LOG_EVERY === 0 || created + skipped >= count) {
      logProgress('WALLET_FAST_PROGRESS', created, count, skipped, startedAt);
    }
  }

  const durationMs = nowMs() - startedAt;

  logSummary('WALLET FAST GENERATION SUMMARY', {
    'Wallets Created': formatNumber(created),
    'Wallets Skipped': formatNumber(skipped),
    'Enterprise Sync': 'YES - blockchain.wallets + sdedba.ref_customer + sdedba.cfg_customer_def',
    'Processing Time': `${seconds(durationMs)} sec`,
    'Average Per Wallet': `${roundMs(durationMs / Math.max(created, 1))} ms`,
    'Throughput': `${ratePerSecond(created, durationMs)} wallets/sec`
  });

  return {
    created,
    skipped,
    processingMs: roundMs(durationMs),
    processingSeconds: seconds(durationMs),
    averageMsPerWallet: roundMs(durationMs / Math.max(created, 1)),
    walletsPerSecond: ratePerSecond(created, durationMs)
  };
}

async function getActiveWallets(client) {
  const columns = await getColumns(client, 'wallets');
  const organizationTable = await resolveOrganizationTable(client);
  const hasOrganizationTable = Boolean(organizationTable);

  const customerIdColumn = pickColumn(columns, ['customer_id']);
  const organizationIdColumn = pickColumn(columns, ['organization_id']);
  const walletTypeColumn = pickColumn(columns, ['wallet_type', 'type']);

  if (!customerIdColumn) {
    throw new Error('No customer_id column found in blockchain.wallets');
  }

  const balanceColumn = pickColumn(columns, [
    'current_balance',
    'currency_balance',
    'balance'
  ]);

  if (!balanceColumn) {
    throw new Error('No balance column found in blockchain.wallets');
  }

  const updatedAtColumn = pickColumn(columns, ['updated_at']);

  /**
   * IMPORTANT:
   * findba.fin_transaction has FK constraints to sdedba.ref_customer.
   * Therefore transaction generation must only use wallets whose customer_id
   * already exists in sdedba.ref_customer.
   *
   * Also, organization_id must be validated against blockchain.blockchain_organization
   * because this project uses blockchain.blockchain_organization as the organization
   * source of truth, not blockchain.organizations.
   */
  const organizationJoinSql = hasOrganizationTable && organizationIdColumn
    ? `
    INNER JOIN blockchain.${organizationTable} bo
      ON bo.organization_id::text = w.${organizationIdColumn}::text
    `
    : '';

  const organizationSelectSql = hasOrganizationTable && organizationIdColumn
    ? `w.${organizationIdColumn}::text AS organization_id`
    : `NULL::text AS organization_id`;

  const walletTypeSelectSql = walletTypeColumn
    ? `w.${walletTypeColumn} AS wallet_type`
    : `'CUSTOMER' AS wallet_type`;

  const result = await client.query(
    `
    SELECT
      w.wallet_address,
      c.customer_id::text AS customer_id,
      ${organizationSelectSql},
      ${walletTypeSelectSql},
      COALESCE(w.${balanceColumn}, 0)::numeric AS balance
    FROM blockchain.wallets w
    INNER JOIN sdedba.ref_customer c
      ON c.customer_id::text = w.${customerIdColumn}::text
    ${organizationJoinSql}
    WHERE COALESCE(w.status, 'ACTIVE') = 'ACTIVE'
      AND w.wallet_address IS NOT NULL
      AND w.wallet_address ~ '^[a-f0-9]{40}$'
      AND w.${customerIdColumn}::text ~ '^[0-9]+$'
      AND COALESCE(w.${balanceColumn}, 0) > 0
    ORDER BY w.created_at DESC NULLS LAST
    LIMIT 200000
    `
  );

  console.log(`[TRANSACTION_FAST_WALLETS] eligibleWallets=${formatNumber(result.rows.length)} | customerSource=sdedba.ref_customer | organizationSource=${hasOrganizationTable ? `blockchain.${organizationTable}` : 'NONE'}`);

  return {
    balanceColumn,
    updatedAtColumn,
    wallets: result.rows.map((row) => ({
      ...row,
      balance: Number(row.balance || 0)
    }))
  };
}

async function batchUpdateWalletBalances(client, balanceColumn, updatedAtColumn, balanceDeltas) {
  const entries = Array.from(balanceDeltas.entries())
    .filter(([, delta]) => Number(delta) !== 0);

  if (!entries.length) return;

  const values = [];
  const placeholders = [];

  entries.forEach(([walletAddress, delta]) => {
    values.push(walletAddress, roundMoney(delta));
    placeholders.push(`($${values.length - 1}, $${values.length}::numeric)`);
  });

  const updatedAtSql = updatedAtColumn ? `, ${updatedAtColumn} = NOW()` : '';

  await client.query(
    `
    UPDATE blockchain.wallets w
    SET
      ${balanceColumn} = ROUND((COALESCE(w.${balanceColumn}, 0) + v.delta)::numeric, 2)
      ${updatedAtSql}
    FROM (
      VALUES ${placeholders.join(', ')}
    ) AS v(wallet_address, delta)
    WHERE w.wallet_address = v.wallet_address
    `,
    values
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
      source: 'DATA_GENERATOR_FAST',
      generated: true
    },
    transactionPurpose: row.transaction_purpose,
    transactionDescription: row.transaction_description || row.description,
    requestId: row.request_id,
    sourceSystem: row.source_system || 'BLOCKCHAIN_API_FAST_GENERATOR',
    requestSource: row.request_source || 'DATA_GENERATOR_FAST',
    createdBy: row.created_by || 'nix',
    updatedBy: row.created_by || 'nix',
    originalPayload: row
  };
}

async function saveEnterpriseTransactionBatch(client, rows) {
  for (const row of rows) {
    await enterprisePersistenceRepository.saveTransactionEnterprise(
      client,
      toEnterpriseTransactionData(row)
    );
  }
}

async function generateTransactionsFast(client, count) {
  const startedAt = nowMs();

  console.log(`[TRANSACTION_FAST_START] target=${formatNumber(count)}, batchSize=${formatNumber(BATCH_SIZE)}`);

  if (count <= 0) {
    return {
      transactionTable: await resolveTransactionTable(client),
      created: 0,
      skipped: 0,
      processingMs: 0,
      processingSeconds: 0,
      transactionsPerSecond: 0
    };
  }

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
        ['TRANSFER', 'WALLET_TO_WALLET', 'CUSTOMER_TO_CUSTOMER', 'CUSTOMER_TRANSFER', 'WALLET_TRANSFER'],
        'TRANSFER'
      )
    : null;

  const typeValue = transactionColumns.includes('type')
    ? await getPreferredAllowedValue(
        client,
        transactionTable,
        'type',
        ['TRANSFER', 'WALLET_TO_WALLET', 'CUSTOMER_TO_CUSTOMER', 'CUSTOMER_TRANSFER', 'WALLET_TRANSFER'],
        'TRANSFER'
      )
    : null;

  console.log('[TRANSACTION_FAST_ALLOWED_VALUES]', {
    statusValue,
    transactionStatusValue,
    transactionTypeValue,
    typeValue
  });

  const { balanceColumn, updatedAtColumn, wallets } = await getActiveWallets(client);

  if (wallets.length < 2) {
    throw new Error('At least 2 active wallets with positive balance are required');
  }

  let created = 0;
  let skipped = 0;

  while (created + skipped < count) {
    const batch = [];
    const balanceDeltas = new Map();
    const attemptsRemaining = count - created - skipped;
    const batchTarget = Math.min(BATCH_SIZE, attemptsRemaining);

    for (let i = 0; i < batchTarget; i++) {
      let sender = randomItem(wallets);
      let receiver = randomItem(wallets);

      let guard = 0;

      while (receiver.wallet_address === sender.wallet_address && guard < 20) {
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

      if (Number(sender.balance || 0) < totalAmount) {
        skipped++;
        continue;
      }

      sender.balance = roundMoney(Number(sender.balance || 0) - totalAmount);
      receiver.balance = roundMoney(Number(receiver.balance || 0) + amount);

      balanceDeltas.set(
        sender.wallet_address,
        roundMoney((balanceDeltas.get(sender.wallet_address) || 0) - totalAmount)
      );

      balanceDeltas.set(
        receiver.wallet_address,
        roundMoney((balanceDeltas.get(receiver.wallet_address) || 0) + amount)
      );

      const transactionReference = generateTransactionReference();
      const requestId = generateRequestId();
      const fabricTxId = `FABRIC_${crypto.randomBytes(16).toString('hex').toUpperCase()}`;

      batch.push({
        id: crypto.randomUUID(),
        transaction_id: crypto.randomUUID(),
        transaction_reference: transactionReference,
        request_id: requestId,
        fabric_transaction_id: fabricTxId,
        fabric_tx_id: fabricTxId,

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

        currency: DEFAULT_CURRENCY,
        currency_code: DEFAULT_CURRENCY,

        transaction_type: transactionTypeValue,
        type: typeValue,

        transaction_purpose: 'Generated wallet-to-wallet transaction',
        transaction_description: 'Synthetic transaction generated for dashboard, history, and performance testing',
        description: 'Synthetic transaction generated for testing',

        status: statusValue,
        transaction_status: transactionStatusValue,

        request_source: 'DATA_GENERATOR_FAST',
        source_system: 'BLOCKCHAIN_API_FAST_GENERATOR',
        created_by: 'nix',

        created_at: new Date(),
        updated_at: new Date(),
        completed_at: new Date()
      });
    }

    if (batch.length > 0) {
      await saveEnterpriseTransactionBatch(client, batch);
      await batchUpdateWalletBalances(client, balanceColumn, updatedAtColumn, balanceDeltas);

      created += batch.length;
    }

    if (created % LOG_EVERY === 0 || created + skipped >= count) {
      logProgress('TRANSACTION_FAST_PROGRESS', created, count, skipped, startedAt);
    }
  }

  const durationMs = nowMs() - startedAt;

  logSummary('TRANSACTION FAST GENERATION SUMMARY', {
    'Transaction Table': `blockchain.${transactionTable}`,
    'Transactions Created': formatNumber(created),
    'Transactions Skipped': formatNumber(skipped),
    'Processing Time': `${seconds(durationMs)} sec`,
    'Average Per Transaction': `${roundMs(durationMs / Math.max(created, 1))} ms`,
    'Throughput': `${ratePerSecond(created, durationMs)} transactions/sec`
  });

  return {
    transactionTable,
    created,
    skipped,
    processingMs: roundMs(durationMs),
    processingSeconds: seconds(durationMs),
    averageMsPerTransaction: roundMs(durationMs / Math.max(created, 1)),
    transactionsPerSecond: ratePerSecond(created, durationMs)
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
      AND wallet_address !~ '^WALLET_[A-F0-9]{40}$'
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

  logSection('BLOCKCHAIN DATA GENERATOR FAST V2 - PERFORMANCE RUN');

  console.log(`Run Started At                : ${new Date().toISOString()}`);
  console.log(`Target Wallets                : ${formatNumber(WALLET_COUNT)}`);
  console.log(`Target Transactions           : ${formatNumber(TRANSACTION_COUNT)}`);
  console.log(`Batch Size                    : ${formatNumber(BATCH_SIZE)}`);
  console.log(`Progress Log Frequency        : ${formatNumber(LOG_EVERY)}`);
  console.log(`Currency                      : ${DEFAULT_CURRENCY}`);
  console.log(`Default Wallet Password       : ${DEFAULT_PASSWORD}`);

  try {
    await client.query('BEGIN');

    /**
     * Prevent parallel data-generator runs from calculating the same
     * MAX(customer_id) + 1 range at the same time.
     */
    await client.query(`
      SELECT pg_advisory_xact_lock(hashtext('blockchain.wallets.customer_id.generator'))
    `);

    const walletsResult = await generateWalletsFast(client, WALLET_COUNT);
    const transactionsResult = await generateTransactionsFast(client, TRANSACTION_COUNT);
    const validation = await validateResults(client);

    await client.query('COMMIT');

    const totalDurationMs = nowMs() - totalStartedAt;
    const totalRowsCreated = Number(walletsResult.created || 0) + Number(transactionsResult.created || 0);

    logSummary('FINAL FAST EXECUTION SUMMARY', {
      'Execution Status': 'SUCCESS',
      'Run Completed At': new Date().toISOString(),
      'Total Processing Time': `${seconds(totalDurationMs)} sec`,
      'Wallets Created': formatNumber(walletsResult.created),
      'Transactions Created': formatNumber(transactionsResult.created),
      'Total Rows Created': formatNumber(totalRowsCreated),
      'Wallet Throughput': `${walletsResult.walletsPerSecond} wallets/sec`,
      'Transaction Throughput': `${transactionsResult.transactionsPerSecond} transactions/sec`,
      'Overall Throughput': `${ratePerSecond(totalRowsCreated, totalDurationMs)} rows/sec`,
      'Total Wallets In DB': formatNumber(validation.totalWallets),
      'Invalid Wallet Addresses': formatNumber(validation.invalidWallets),
      'Total Transactions In DB': formatNumber(validation.totalTransactions)
    });

    console.log('');
    console.log('TUNING NOTES');
    console.log('------------');
    console.log('- Increase --batchSize for higher throughput, for example 2000 or 5000.');
    console.log('- Use --logEvery 5000 for large tests.');
    console.log('- Keep --maxAmount lower if skipped transactions increase.');
    console.log('- Old WALLET_/ORG_WALLET_ rows are excluded from transaction generation.');
  } catch (error) {
    await client.query('ROLLBACK');

    logSummary('FINAL FAST EXECUTION SUMMARY', {
      'Execution Status': 'FAILED',
      'Error Message': error.message,
      'Error Code': error.code || 'N/A',
      'Failed At': new Date().toISOString()
    });

    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();

    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  }
}

main();

