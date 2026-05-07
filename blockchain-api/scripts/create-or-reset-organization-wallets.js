'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../src/config/database');

function getPool() {
  if (db.pool) return db.pool;
  if (typeof db.getPool === 'function') return db.getPool();
  if (typeof db.connect === 'function' && typeof db.query === 'function') return db;

  throw new Error('PostgreSQL pool not found in src/config/database.js');
}

async function getTableColumns(client, tableName) {
  const result = await client.query(
    `
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'blockchain'
      AND table_name = $1
    ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function buildOrganizationEmail(organizationName) {
  const slug = String(organizationName || 'organization')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return `${slug || 'organization'}@gmail.com`;
}

function buildOrganizationCustomerId(organizationId) {
  return `ORG_${String(organizationId).replace(/-/g, '').slice(0, 24)}`;
}

function generatePassword() {
  return `Org@${crypto.randomBytes(8).toString('hex')}#${Date.now().toString().slice(-4)}`;
}

function generateWalletAddress() {
  return `ORG_WALLET_${Date.now()}_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
}

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

async function insertWallet(client, walletColumns, valuesByColumn) {
  const insertColumns = [];
  const insertValues = [];
  const placeholders = [];

  Object.entries(valuesByColumn).forEach(([column, value]) => {
    if (walletColumns.includes(column)) {
      insertColumns.push(column);
      insertValues.push(value);
      placeholders.push(`$${insertValues.length}`);
    }
  });

  const result = await client.query(
    `
    INSERT INTO blockchain.wallets (${insertColumns.join(', ')})
    VALUES (${placeholders.join(', ')})
    RETURNING *
    `,
    insertValues
  );

  return result.rows[0];
}

async function main() {
  const pool = getPool();
  const client = await pool.connect();

  const credentialRows = [];

  try {
    await client.query('BEGIN');

    const walletColumns = await getTableColumns(client, 'wallets');

    const orgResult = await client.query(
      `
      SELECT
        organization_id::text AS organization_id,
        organization_name,
        registration_number,
        country_code,
        COALESCE(status, 'ACTIVE') AS status
      FROM blockchain.blockchain_organization
      WHERE COALESCE(status, 'ACTIVE') = 'ACTIVE'
      ORDER BY organization_name ASC
      `
    );

    console.log(`Found ${orgResult.rowCount} active organizations.`);

    for (const org of orgResult.rows) {
      const organizationId = org.organization_id;
      const organizationName = org.organization_name;
      const organizationCode =
        org.registration_number ||
        organizationId;

      const plainPassword = generatePassword();
      const passwordHash = await bcrypt.hash(plainPassword, 10);

      const existingWallet = await client.query(
        `
        SELECT
          wallet_id,
          wallet_address,
          customer_id,
          full_name,
          current_balance,
          currency_code
        FROM blockchain.wallets
        WHERE organization_id::text = $1
          AND UPPER(COALESCE(wallet_type, '')) = 'ORGANIZATION'
        LIMIT 1
        `,
        [organizationId]
      );

      if (existingWallet.rowCount > 0) {
        const wallet = existingWallet.rows[0];

        await client.query(
          `
          UPDATE blockchain.wallets
          SET
            password_hash = $1,
            updated_at = NOW()
          WHERE wallet_id = $2
          `,
          [passwordHash, wallet.wallet_id]
        );

        credentialRows.push({
          action: 'PASSWORD_RESET',
          organizationId,
          organizationName,
          organizationCode,
          walletAddress: wallet.wallet_address,
          customerId: wallet.customer_id,
          walletType: 'ORGANIZATION',
          emailHash: buildOrganizationEmail(organizationName),
          password: plainPassword,
          currentBalance: wallet.current_balance ?? 0,
          currencyCode: wallet.currency_code || 'USD'
        });

        console.log(`RESET PASSWORD: ${organizationName} -> ${wallet.wallet_address}`);
        continue;
      }

      const walletAddress = generateWalletAddress();
      const customerId = buildOrganizationCustomerId(organizationId);
      const emailHash = buildOrganizationEmail(organizationName);

      const insertedWallet = await insertWallet(client, walletColumns, {
        wallet_address: walletAddress,
        customer_id: customerId,
        organization_id: organizationId,
        organization_code: organizationCode,
        wallet_type: 'ORGANIZATION',
        full_name: organizationName,
        national_id_hash: organizationId,
        ledger_doc_type: 'organization_wallet',
        ledger_key: organizationId,
        mobile_hash: null,
        email_hash: emailHash,
        password_hash: passwordHash,
        current_balance: 0,
        currency_code: 'USD',
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date()
      });

      credentialRows.push({
        action: 'CREATED',
        organizationId,
        organizationName,
        organizationCode,
        walletAddress: insertedWallet.wallet_address || walletAddress,
        customerId: insertedWallet.customer_id || customerId,
        walletType: 'ORGANIZATION',
        emailHash,
        password: plainPassword,
        currentBalance: insertedWallet.current_balance ?? 0,
        currencyCode: insertedWallet.currency_code || 'USD'
      });

      console.log(`CREATED: ${organizationName} -> ${walletAddress}`);
    }

    await client.query('COMMIT');

    const outputDir = path.join(process.cwd(), 'outputs');
    fs.mkdirSync(outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    const csvFile = path.join(
      outputDir,
      `organization_wallet_credentials_${timestamp}.csv`
    );

    const jsonFile = path.join(
      outputDir,
      `organization_wallet_credentials_${timestamp}.json`
    );

    const csvHeader = [
      'action',
      'organization_id',
      'organization_name',
      'organization_code',
      'wallet_address',
      'customer_id',
      'wallet_type',
      'email_hash',
      'password',
      'current_balance',
      'currency_code'
    ];

    const csvLines = [
      csvHeader.join(','),
      ...credentialRows.map((row) =>
        [
          row.action,
          row.organizationId,
          row.organizationName,
          row.organizationCode,
          row.walletAddress,
          row.customerId,
          row.walletType,
          row.emailHash,
          row.password,
          row.currentBalance,
          row.currencyCode
        ].map(csvEscape).join(',')
      )
    ];

    fs.writeFileSync(csvFile, csvLines.join('\n'), 'utf8');
    fs.writeFileSync(jsonFile, JSON.stringify(credentialRows, null, 2), 'utf8');

    console.log('====================================================');
    console.log('Organization wallet credentials exported.');
    console.log(`Total credentials: ${credentialRows.length}`);
    console.log(`CSV file: ${csvFile}`);
    console.log(`JSON file: ${jsonFile}`);
    console.log('====================================================');

    console.table(
      credentialRows.map((row) => ({
        action: row.action,
        organizationName: row.organizationName,
        walletAddress: row.walletAddress,
        password: row.password
      }))
    );
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('Organization wallet creation/reset failed:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      constraint: error.constraint,
      table: error.table,
      column: error.column
    });

    process.exitCode = 1;
  } finally {
    client.release();

    if (pool.end) {
      await pool.end();
    }
  }
}

main();
