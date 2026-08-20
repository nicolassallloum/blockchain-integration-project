'use strict';

const express = require('express');
const crypto = require('crypto');
const { getAddress, Wallet } = require('ethers');

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
const {
  audit,
  requestSnapshot
} = require(
  '../src/utils/professionalAuditLogger'
);
const {
  licenseAudit
} = require('../src/utils/licenseAuditLogger');
function getRecoveryHmacSecret() {
  const secret = String(
    process.env.LICENSE_RECOVERY_HMAC_SECRET ||
    ''
  );

  if (secret.length < 32) {
    throw new Error(
      'LICENSE_RECOVERY_HMAC_SECRET is not configured.'
    );
  }

  return secret;
}

function normalizeRecoveryDigests(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 12
  ) {
    throw new LicenseWalletRequestError(
      'Exactly 12 recovery-word digests are required.'
    );
  }

  return value.map((item, index) => {
    const digest = String(item || '')
      .trim()
      .toLowerCase();

    if (!/^[0-9a-f]{64}$/.test(digest)) {
      throw new LicenseWalletRequestError(
        `Recovery-word digest ${index + 1} is invalid.`
      );
    }

    return digest;
  });
}

function createRecoveryVerifier(
  licenseId,
  position,
  digest
) {
  return crypto
    .createHmac(
      'sha256',
      getRecoveryHmacSecret()
    )
    .update(
      `${licenseId}:${position}:${digest}`
    )
    .digest('hex');
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
        recoveryConfirmed,
        recoveryWordDigests
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

      const normalizedRecoveryDigests =
        normalizeRecoveryDigests(
          recoveryWordDigests
        );

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
            revoked,
            signed_jwt AS "signedJwt"
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

      for (
        let index = 0;
        index < normalizedRecoveryDigests.length;
        index += 1
      ) {
        const position = index + 1;

        const verifier =
          createRecoveryVerifier(
            license.licenseId,
            position,
            normalizedRecoveryDigests[index]
          );

        await client.query(
          `
            INSERT INTO
              vfort.license_wallet_recovery_verifier
            (
              license_id,
              word_position,
              word_verifier,
              created_at,
              updated_at
            )
            VALUES
            (
              $1::uuid,
              $2,
              $3,
              CURRENT_TIMESTAMP,
              CURRENT_TIMESTAMP
            )
            ON CONFLICT
              (license_id, word_position)
            DO UPDATE SET
              word_verifier =
                EXCLUDED.word_verifier,
              updated_at =
                CURRENT_TIMESTAMP
          `,
          [
            license.licenseId,
            position,
            verifier
          ]
        );
      }

      await client.query('COMMIT');
      transactionStarted = false;

      console.log(
        '[LICENSE_WALLET_PROVISION_SUCCESS]',
        {
          licenseId: license.licenseId,
          contractRef: license.contractRef,
          walletAddress:
            insertResult.rows[0].walletAddress
        }
      );

      return response.status(201).json({
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


  /*
   * =======================================================
   * GENERATE BLOCKCHAIN LICENSE WALLET
   *
   * Request:
   *   { licenseId }
   *
   * Generates:
   *   - wallet address
   *   - random wallet password
   *   - 12 recovery words
   *
   * Sensitive plaintext credentials are returned once.
   * They are NOT stored in PostgreSQL.
   * =======================================================
   */
  router.post(
    '/generate',
    async (request, response) => {

      try {
        const licenseId =
          String(
            request.body?.licenseId || ''
          ).trim();

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(licenseId)
        ) {
          throw new LicenseWalletRequestError(
            'licenseId must be a valid UUID.'
          );
        }

        /*
         * Verify selected license exists
         * and does not already have a wallet.
         */
        const licenseResult =
          await pool.query(
            `
              SELECT
                il.license_id::text
                  AS "licenseId",

                il.customer_id::text
                  AS "customerId",

                il.install_id::text
                  AS "installId",

                il.contract_ref
                  AS "contractRef",

                il.sequence_number
                  AS "sequenceNumber",

                il.product_modules
                  AS "productModules",

                il.max_users
                  AS "maxUsers",

                il.grace_days
                  AS "graceDays",

                il.valid_from
                  AS "validFrom",

                il.valid_until
                  AS "validUntil",

                il.revoked

              FROM
                vfort.issued_license il

              LEFT JOIN
                vfort.license_wallet_blockchain lw
                  ON lw.license_id =
                     il.license_id

              WHERE
                il.license_id =
                  $1::uuid

                AND lw.license_id IS NULL
            `,
            [licenseId]
          );

        if (licenseResult.rowCount !== 1) {
          throw new LicenseWalletRequestError(
            'License was not found or already has a wallet.',
            409
          );
        }

        const license =
          licenseResult.rows[0];

        /*
         * Generate blockchain-compatible wallet.
         */
        const wallet =
          Wallet.createRandom();

        const phrase =
          wallet.mnemonic?.phrase;

        if (!phrase) {
          throw new Error(
            'Unable to generate recovery phrase.'
          );
        }

        const recoveryWords =
          phrase
            .trim()
            .toLowerCase()
            .split(/\s+/);

        if (recoveryWords.length !== 12) {
          throw new Error(
            'Wallet generation did not produce exactly 12 recovery words.'
          );
        }

        /*
         * Generate cryptographically random password.
         */
        const walletPassword =
          `VAL-${crypto.randomBytes(24)
            .toString('hex')}`;

        /*
         * Encrypt wallet using generated password.
         */
        const encryptedWalletText =
          await wallet.encrypt(
            walletPassword
          );

        const encryptedWalletJson =
          JSON.parse(
            encryptedWalletText
          );

        /*
         * Hash each recovery word.
         * Only these digests are stored.
         */
        const recoveryWordDigests =
          recoveryWords.map(
            (word) =>
              crypto
                .createHash('sha256')
                .update(
                  word
                    .trim()
                    .toLowerCase()
                )
                .digest('hex')
          );

        const generationId =
          crypto.randomUUID();

        const derivationPath =
          wallet.path ||
          "m/44'/60'/0'/0/0";

        const walletPublicKey =
          wallet.publicKey;

        /*
         * Invalidate previous unused generation attempts
         * for this license.
         */
        await pool.query(
          `
            UPDATE
              vfort.license_wallet_generation

            SET
              used_at =
                CURRENT_TIMESTAMP

            WHERE
              license_id =
                $1::uuid

              AND used_at IS NULL
          `,
          [licenseId]
        );

        /*
         * Store only non-plaintext provisioning data.
         */
        const generationResult =
          await pool.query(
            `
              INSERT INTO
                vfort.license_wallet_generation
              (
                generation_id,
                license_id,
                wallet_address,
                wallet_public_key,
                encrypted_wallet_json,
                derivation_path,
                recovery_word_digests,
                expires_at,
                created_at
              )
              VALUES
              (
                $1::uuid,
                $2::uuid,
                $3,
                $4,
                $5::jsonb,
                $6,
                $7::jsonb,
                CURRENT_TIMESTAMP +
                  INTERVAL '10 minutes',
                CURRENT_TIMESTAMP
              )
              RETURNING
                generation_id::text
                  AS "generationId",

                expires_at
                  AS "expiresAt"
            `,
            [
              generationId,
              licenseId,
              wallet.address,
              walletPublicKey,
              JSON.stringify(
                encryptedWalletJson
              ),
              derivationPath,
              JSON.stringify(
                recoveryWordDigests
              )
            ]
          );

        /*
         * NEVER log:
         * - walletPassword
         * - recoveryWords
         * - private key
         */
        console.log(
          '[LICENSE_WALLET_GENERATED]',
          {
            generationId,
            licenseId,
            contractRef:
              license.contractRef,
            walletAddress:
              wallet.address
          }
        );

        return response
          .status(201)
          .json({
            success: true,

            message:
              'Blockchain license wallet generated successfully.',

            generationId:
              generationResult.rows[0]
                .generationId,

            expiresAt:
              generationResult.rows[0]
                .expiresAt,

            expiresInSeconds: 600,

            license,

            wallet: {
              walletAddress:
                wallet.address,

              walletPassword,

              recoveryWords
            }
          });

      } catch (error) {

        const statusCode =
          error instanceof LicenseWalletRequestError
            ? error.statusCode || 400
            : 500;

        console.error(
          '[LICENSE_WALLET_GENERATE_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,

            message:
              error instanceof LicenseWalletRequestError
                ? error.message
                : 'Unable to generate blockchain wallet.'
          });
      }
    }
  );


  /*
   * =======================================================
   * PROVISION PRE-GENERATED WALLET
   *
   * Frontend sends only:
   *   generationId
   *   recoveryConfirmed
   * =======================================================
   */
  router.post(
    '/provision-generated',
    async (request, response) => {

      const client =
        await pool.connect();

      let transactionStarted = false;

      try {
        const generationId =
          String(
            request.body?.generationId ||
            ''
          ).trim();

        const recoveryConfirmed =
          request.body?.recoveryConfirmed;

        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            .test(generationId)
        ) {
          throw new LicenseWalletRequestError(
            'generationId must be a valid UUID.'
          );
        }

        if (recoveryConfirmed !== true) {
          throw new LicenseWalletRequestError(
            'Recovery information confirmation is required.'
          );
        }

        await client.query('BEGIN');
        transactionStarted = true;

        const generationResult =
          await client.query(
            `
              SELECT
                g.generation_id::text
                  AS "generationId",

                g.license_id::text
                  AS "licenseId",

                g.wallet_address
                  AS "walletAddress",

                g.wallet_public_key
                  AS "walletPublicKey",

                g.encrypted_wallet_json
                  AS "encryptedWalletJson",

                g.derivation_path
                  AS "derivationPath",

                g.recovery_word_digests
                  AS "recoveryWordDigests",

                g.expires_at
                  AS "expiresAt",

                g.used_at
                  AS "usedAt",

                il.customer_id::text
                  AS "customerId",

                il.install_id::text
                  AS "installId",

                il.contract_ref
                  AS "contractRef",

                il.sequence_number
                  AS "sequenceNumber",

                il.product_modules
                  AS "productModules",

                il.max_users
                  AS "maxUsers",

                il.grace_days
                  AS "graceDays",

                il.valid_from
                  AS "validFrom",

                il.valid_until
                  AS "validUntil",

                il.issued_at
                  AS "issuedAt",

                il.issued_by
                  AS "issuedBy",

                il.revoked

              FROM
                vfort.license_wallet_generation g

              INNER JOIN
                vfort.issued_license il
                  ON il.license_id =
                     g.license_id

              WHERE
                g.generation_id =
                  $1::uuid

              FOR UPDATE OF g
            `,
            [generationId]
          );

        if (generationResult.rowCount !== 1) {
          throw new LicenseWalletRequestError(
            'Wallet generation was not found.',
            404
          );
        }

        const generated =
          generationResult.rows[0];

        if (generated.usedAt) {
          throw new LicenseWalletRequestError(
            'This wallet generation has already been used.',
            409
          );
        }

        if (
          new Date(
            generated.expiresAt
          ) <= new Date()
        ) {
          throw new LicenseWalletRequestError(
            'Wallet generation has expired. Generate a new wallet.',
            410
          );
        }

        const existingResult =
          await client.query(
            `
              SELECT
                license_id
              FROM
                vfort.license_wallet_blockchain

              WHERE
                license_id =
                  $1::uuid

                OR LOWER(wallet_address) =
                   LOWER($2)

              FOR UPDATE
            `,
            [
              generated.licenseId,
              generated.walletAddress
            ]
          );

        if (existingResult.rowCount > 0) {
          throw new LicenseWalletRequestError(
            'This license or wallet is already provisioned.',
            409
          );
        }

        const walletResult =
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
              RETURNING
                license_id::text
                  AS "licenseId",

                customer_id::text
                  AS "customerId",

                install_id::text
                  AS "installId",

                wallet_address
                  AS "walletAddress",

                wallet_type
                  AS "walletType",

                derivation_path
                  AS "derivationPath",

                recovery_word_count
                  AS "recoveryWordCount",

                recovery_confirmed
                  AS "recoveryConfirmed",

                wallet_status
                  AS "walletStatus",

                wallet_version
                  AS "walletVersion",

                blockchain_tx_id
                  AS "blockchainTransactionId",

                blockchain_block_number::text
                  AS "blockchainBlockNumber",

                created_at
                  AS "createdAt",

                updated_at
                  AS "updatedAt"
            `,
            [
              generated.licenseId,
              generated.customerId,
              generated.installId,
              generated.walletAddress,
              generated.walletPublicKey,
              JSON.stringify(
                generated.encryptedWalletJson
              ),
              generated.derivationPath
            ]
          );

        const recoveryWordDigests =
          Array.isArray(
            generated.recoveryWordDigests
          )
            ? generated.recoveryWordDigests
            : [];

        if (
          recoveryWordDigests.length !== 12
        ) {
          throw new Error(
            'Generated recovery digest count is invalid.'
          );
        }

        /*
         * Store protected recovery verifiers.
         */
        for (
          let index = 0;
          index < 12;
          index += 1
        ) {
          const position =
            index + 1;

          const verifier =
            createRecoveryVerifier(
              generated.licenseId,
              position,
              recoveryWordDigests[index]
            );

          await client.query(
            `
              INSERT INTO
                vfort.license_wallet_recovery_verifier
              (
                license_id,
                word_position,
                word_verifier,
                created_at,
                updated_at
              )
              VALUES
              (
                $1::uuid,
                $2,
                $3,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
              )
              ON CONFLICT
                (license_id, word_position)

              DO UPDATE SET
                word_verifier =
                  EXCLUDED.word_verifier,

                updated_at =
                  CURRENT_TIMESTAMP
            `,
            [
              generated.licenseId,
              position,
              verifier
            ]
          );
        }

        await client.query(
          `
            UPDATE
              vfort.license_wallet_generation

            SET
              used_at =
                CURRENT_TIMESTAMP

            WHERE
              generation_id =
                $1::uuid
          `,
          [generationId]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        console.log(
          '[LICENSE_GENERATED_WALLET_PROVISION_SUCCESS]',
          {
            generationId,
            licenseId:
              generated.licenseId,
            contractRef:
              generated.contractRef,
            walletAddress:
              generated.walletAddress
          }
        );

        return response
          .status(201)
          .json({
            success: true,

            message:
              'Generated license wallet provisioned successfully.',

            wallet:
              walletResult.rows[0],

            license: {
              licenseId:
                generated.licenseId,

              customerId:
                generated.customerId,

              installId:
                generated.installId,

              contractRef:
                generated.contractRef,

              sequenceNumber:
                generated.sequenceNumber,

              productModules:
                generated.productModules,

              maxUsers:
                generated.maxUsers,

              graceDays:
                generated.graceDays,

              validFrom:
                generated.validFrom,

              validUntil:
                generated.validUntil,

              issuedAt:
                generated.issuedAt,

              issuedBy:
                generated.issuedBy,

              revoked:
                generated.revoked
            },

            blockchain: {
              status:
                'PENDING_CHAINCODE_DEPLOYMENT',

              verified: false,

              transactionId: null,
              blockNumber: null
            }
          });

      } catch (error) {

        if (transactionStarted) {
          try {
            await client.query('ROLLBACK');
          } catch {}
        }

        const statusCode =
          error instanceof LicenseWalletRequestError
            ? error.statusCode || 400
            : 500;

        console.error(
          '[LICENSE_GENERATED_WALLET_PROVISION_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,

            message:
              error instanceof LicenseWalletRequestError
                ? error.message
                : 'Unable to provision generated wallet.'
          });

      } finally {
        client.release();
      }
    }
  );

  return router;
};
