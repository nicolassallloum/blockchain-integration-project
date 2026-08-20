'use strict';

require('dotenv').config();

const readline = require('node:readline/promises');
const {
  stdin: input,
  stdout: output
} = require('node:process');

const {
  Wallet
} = require('ethers');

const {
  licensePool
} = require('../src/config/license-database');

const contractRef =
  String(process.argv[2] || 'VAL-01').trim();

const encryptionPassword =
  String(
    process.env.LICENSE_WALLET_ENCRYPTION_PASSWORD ||
    ''
  );

if (encryptionPassword.length < 12) {
  console.error(
    '[FAIL] LICENSE_WALLET_ENCRYPTION_PASSWORD must contain at least 12 characters.'
  );

  process.exit(1);
}

/*
 * Reduce the time the password remains available through
 * the Node.js process environment.
 */
delete process.env.LICENSE_WALLET_ENCRYPTION_PASSWORD;

async function main() {
  const client = await licensePool.connect();

  const prompt = readline.createInterface({
    input,
    output
  });

  let transactionStarted = false;

  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const licenseResult = await client.query(
      `
        SELECT
          license_id::text AS "licenseId",
          customer_id::text AS "customerId",
          install_id::text AS "installId",
          contract_ref AS "contractRef",
          sequence_number AS "sequenceNumber",
          product_modules AS "productModules",
          max_users AS "maxUsers",
          grace_days AS "graceDays",
          valid_from AS "validFrom",
          valid_until AS "validUntil",
          issued_at AS "issuedAt",
          issued_by AS "issuedBy",
          revoked
        FROM
          vfort.issued_license
        WHERE
          contract_ref = $1
        FOR UPDATE
      `,
      [contractRef]
    );

    if (licenseResult.rowCount !== 1) {
      throw new Error(
        `Exactly one license was expected for contract_ref ${contractRef}; found ${licenseResult.rowCount}.`
      );
    }

    const license = licenseResult.rows[0];

    const existingResult = await client.query(
      `
        SELECT
          license_id,
          wallet_address
        FROM
          vfort.license_wallet_blockchain
        WHERE
          license_id = $1::uuid
          OR customer_id = $2::uuid
          OR install_id = $3::uuid
      `,
      [
        license.licenseId,
        license.customerId,
        license.installId
      ]
    );

    if (existingResult.rowCount > 0) {
      throw new Error(
        `A wallet mapping already exists for ${contractRef}: ${existingResult.rows[0].wallet_address}`
      );
    }

    const wallet = Wallet.createRandom();

    const mnemonic =
      wallet.mnemonic?.phrase;

    if (!mnemonic) {
      throw new Error(
        'The generated wallet did not contain a BIP-39 recovery phrase.'
      );
    }

    const words = mnemonic
      .trim()
      .split(/\s+/);

    if (words.length !== 12) {
      throw new Error(
        `Expected 12 recovery words but generated ${words.length}.`
      );
    }

    const encryptedWalletText =
      await wallet.encrypt(encryptionPassword);

    const encryptedWallet =
      JSON.parse(encryptedWalletText);

    console.log('');
    console.log('================================================');
    console.log('VALOORES LICENSE RECOVERY WORDS');
    console.log('Contract:', license.contractRef);
    console.log('Wallet:', wallet.address);
    console.log('================================================');
    console.log('');

    words.forEach((word, index) => {
      console.log(
        `${String(index + 1).padStart(2, '0')}. ${word}`
      );
    });

    console.log('');
    console.log(
      'Save these words offline. They will not be stored in PostgreSQL or Fabric.'
    );
    console.log('');

    const confirmationWord3 = (
      await prompt.question(
        'Enter recovery word #3 to confirm: '
      )
    ).trim().toLowerCase();

    const confirmationWord9 = (
      await prompt.question(
        'Enter recovery word #9 to confirm: '
      )
    ).trim().toLowerCase();

    if (
      confirmationWord3 !== words[2].toLowerCase() ||
      confirmationWord9 !== words[8].toLowerCase()
    ) {
      throw new Error(
        'Recovery-word confirmation failed. No wallet mapping was saved.'
      );
    }

    await client.query(
      `
        INSERT INTO
          vfort.license_wallet_blockchain
        (
          license_id,
          customer_id,
          install_id,
          wallet_address,
          wallet_public_key,
          encrypted_wallet_json,
          wallet_type,
          derivation_path,
          recovery_word_count,
          recovery_confirmed,
          wallet_status,
          wallet_version,
          blockchain_tx_id,
          blockchain_block_number,
          created_at,
          updated_at
        )
        VALUES
        (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5,
          $6::jsonb,
          'BIP39_SECP256K1',
          $7,
          12,
          TRUE,
          'ACTIVE',
          1,
          NULL,
          NULL,
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `,
      [
        license.licenseId,
        license.customerId,
        license.installId,
        wallet.address,
        wallet.publicKey,
        JSON.stringify(encryptedWallet),
        wallet.path || "m/44'/60'/0'/0/0"
      ]
    );

    await client.query('COMMIT');
    transactionStarted = false;

    console.log('');
    console.log('[PASS] Production wallet mapping created.');
    console.log('[PASS] Contract:', license.contractRef);
    console.log('[PASS] License ID:', license.licenseId);
    console.log('[PASS] Wallet address:', wallet.address);
    console.log('[PASS] Recovery confirmed: true');
    console.log('[PENDING] Hyperledger Fabric submission');
    console.log('');
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          '[ROLLBACK ERROR]',
          rollbackError.message
        );
      }
    }

    console.error(
      '[FAIL]',
      error.message
    );

    process.exitCode = 1;
  } finally {
    prompt.close();
    client.release();
    await licensePool.end();
  }
}

main();
