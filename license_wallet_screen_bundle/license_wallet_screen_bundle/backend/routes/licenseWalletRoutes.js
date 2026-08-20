'use strict';

const express = require('express');
const { getAddress } = require('ethers');

class LicenseWalletRequestError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'LicenseWalletRequestError';
    this.statusCode = statusCode;
  }
}

function normalizeAddress(value) {
  try {
    return getAddress(String(value || '').trim());
  } catch {
    throw new LicenseWalletRequestError(
      'A valid Ethereum wallet address is required.'
    );
  }
}

function validatePublicKey(value) {
  const publicKey = String(value || '').trim();

  if (!/^0x(?:[0-9a-fA-F]{66}|[0-9a-fA-F]{130})$/.test(publicKey)) {
    throw new LicenseWalletRequestError(
      'A valid secp256k1 public key is required.'
    );
  }

  return publicKey;
}

function validateUuid(value, fieldName) {
  const normalized = String(value || '').trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)) {
    throw new LicenseWalletRequestError(
      `${fieldName} must be a valid UUID.`
    );
  }

  return normalized;
}

function rejectSensitiveFields(body) {
  const forbiddenFields = [
    'mnemonic',
    'recoveryWords',
    'recoveryPhrase',
    'privateKey',
    'encryptionPassword'
  ];

  for (const field of forbiddenFields) {
    if (Object.prototype.hasOwnProperty.call(body || {}, field)) {
      throw new LicenseWalletRequestError(
        `${field} must never be sent to the server.`
      );
    }
  }
}

function publicError(error) {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }

  return {
    message: error?.message,
    code: error?.code,
    detail: error?.detail,
    constraint: error?.constraint
  };
}

module.exports = function createLicenseWalletRoutes(pool) {
  if (
    !pool ||
    typeof pool.query !== 'function' ||
    typeof pool.connect !== 'function'
  ) {
    throw new Error(
      'A valid licensing PostgreSQL pool is required.'
    );
  }

  const router = express.Router();

  router.get('/available-licenses', async (_request, response) => {
    try {
      const result = await pool.query(`
        SELECT
          il.license_id::text AS "licenseId",
          il.customer_id::text AS "customerId",
          il.install_id::text AS "installId",
          il.contract_ref AS "contractRef",
          il.sequence_number AS "sequenceNumber",
          il.product_modules AS "productModules",
          il.max_users AS "maxUsers",
          il.grace_days AS "graceDays",
          il.valid_from AS "validFrom",
          il.valid_until AS "validUntil",
          il.issued_at AS "issuedAt",
          il.issued_by AS "issuedBy",
          il.revoked
        FROM
          vfort.issued_license il
        LEFT JOIN
          vfort.license_wallet_blockchain lw
            ON lw.license_id = il.license_id
        WHERE
          lw.license_id IS NULL
        ORDER BY
          il.issued_at DESC,
          il.contract_ref
      `);

      response.status(200).json({
        success: true,
        count: result.rowCount,
        licenses: result.rows
      });
    } catch (error) {
      console.error(
        '[LICENSE_WALLET_AVAILABLE_LICENSES_ERROR]',
        error
      );

      response.status(500).json({
        success: false,
        message: 'Unable to load available licenses.',
        error: publicError(error)
      });
    }
  });

  router.post('/provision', async (request, response) => {
    let client;
    let transactionStarted = false;

    try {
      rejectSensitiveFields(request.body);

      const {
        licenseId,
        walletAddress,
        walletPublicKey,
        encryptedWalletJson,
        derivationPath,
        recoveryConfirmed
      } = request.body || {};

      const normalizedLicenseId =
        validateUuid(licenseId, 'licenseId');

      const normalizedWalletAddress =
        normalizeAddress(walletAddress);

      const normalizedPublicKey =
        validatePublicKey(walletPublicKey);

      if (
        !encryptedWalletJson ||
        typeof encryptedWalletJson !== 'object' ||
        Array.isArray(encryptedWalletJson)
      ) {
        throw new LicenseWalletRequestError(
          'encryptedWalletJson must be a valid JSON object.'
        );
      }

      if (recoveryConfirmed !== true) {
        throw new LicenseWalletRequestError(
          'Recovery-word confirmation is required.'
        );
      }

      const normalizedPath = String(
        derivationPath || "m/44'/60'/0'/0/0"
      ).trim();

      if (normalizedPath.length > 64) {
        throw new LicenseWalletRequestError(
          'The derivation path is too long.'
        );
      }

      client = await pool.connect();
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
            license_id = $1::uuid
          FOR UPDATE
        `,
        [normalizedLicenseId]
      );

      if (licenseResult.rowCount !== 1) {
        throw new LicenseWalletRequestError(
          'The selected license was not found.',
          404
        );
      }

      const license = licenseResult.rows[0];

      const existingResult = await client.query(
        `
          SELECT
            license_id::text AS "licenseId",
            wallet_address AS "walletAddress"
          FROM
            vfort.license_wallet_blockchain
          WHERE
            license_id = $1::uuid
            OR LOWER(wallet_address) = LOWER($2)
          FOR UPDATE
        `,
        [normalizedLicenseId, normalizedWalletAddress]
      );

      if (existingResult.rowCount > 0) {
        throw new LicenseWalletRequestError(
          'This license or wallet address is already provisioned.',
          409
        );
      }

      const insertResult = await client.query(
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
          RETURNING
            license_id::text AS "licenseId",
            customer_id::text AS "customerId",
            install_id::text AS "installId",
            wallet_address AS "walletAddress",
            wallet_public_key AS "walletPublicKey",
            wallet_type AS "walletType",
            derivation_path AS "derivationPath",
            recovery_word_count AS "recoveryWordCount",
            recovery_confirmed AS "recoveryConfirmed",
            wallet_status AS "walletStatus",
            wallet_version AS "walletVersion",
            blockchain_tx_id AS "blockchainTransactionId",
            blockchain_block_number::text AS "blockchainBlockNumber",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          license.licenseId,
          license.customerId,
          license.installId,
          normalizedWalletAddress,
          normalizedPublicKey,
          JSON.stringify(encryptedWalletJson),
          normalizedPath
        ]
      );

      await client.query('COMMIT');
      transactionStarted = false;

      response.status(201).json({
        success: true,
        message: 'License wallet provisioned successfully.',
        wallet: insertResult.rows[0],
        license,
        blockchain: {
          status: 'PENDING_CHAINCODE_DEPLOYMENT',
          verified: false,
          transactionId: null,
          blockNumber: null
        }
      });
    } catch (error) {
      if (transactionStarted && client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error(
            '[LICENSE_WALLET_ROLLBACK_ERROR]',
            rollbackError
          );
        }
      }

      console.error(
        '[LICENSE_WALLET_PROVISION_ERROR]',
        error
      );

      const statusCode =
        error instanceof LicenseWalletRequestError
          ? error.statusCode
          : error?.code === '23505'
            ? 409
            : 500;

      response.status(statusCode).json({
        success: false,
        message:
          error instanceof LicenseWalletRequestError
            ? error.message
            : 'Unable to provision the license wallet.',
        error: publicError(error)
      });
    } finally {
      client?.release();
    }
  });

  return router;
};
