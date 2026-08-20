'use strict';

const express = require('express');
const crypto = require('crypto');
const {
  getAddress,
  verifyMessage,
  Wallet
} = require('ethers');

class LicenseAccessError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'LicenseAccessError';
    this.statusCode = statusCode;
  }
}

function normalizeAddress(value) {
  try {
    return getAddress(
      String(value || '').trim()
    );
  } catch {
    throw new LicenseAccessError(
      'A valid wallet address is required.'
    );
  }
}

function normalizeUuid(value, fieldName) {
  const normalized =
    String(value || '').trim();

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(normalized)
  ) {
    throw new LicenseAccessError(
      `${fieldName} must be a valid UUID.`
    );
  }

  return normalized;
}

function normalizeDigest(value, fieldName) {
  const digest =
    String(value || '')
      .trim()
      .toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(digest)) {
    throw new LicenseAccessError(
      `${fieldName} must be a SHA-256 hex digest.`
    );
  }

  return digest;
}

function getHmacSecret() {
  const secret =
    String(
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

function createWordVerifier(
  licenseId,
  position,
  wordDigest
) {
  const message =
    `${licenseId}:${position}:${wordDigest}`;

  return crypto
    .createHmac(
      'sha256',
      getHmacSecret()
    )
    .update(message)
    .digest('hex');
}

function hashResetToken(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''))
    .digest('hex');
}

function secureEqual(left, right) {
  const leftBuffer =
    Buffer.from(String(left || ''), 'hex');

  const rightBuffer =
    Buffer.from(String(right || ''), 'hex');

  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    crypto.timingSafeEqual(
      leftBuffer,
      rightBuffer
    )
  );
}

function calculateStatus(license) {
  if (license.revoked) {
    return 'REVOKED';
  }

  const now = new Date();
  const validFrom =
    new Date(license.validFrom);
  const validUntil =
    new Date(license.validUntil);

  if (
    Number.isNaN(validFrom.getTime()) ||
    Number.isNaN(validUntil.getTime())
  ) {
    return 'INVALID_VALIDITY_DATES';
  }

  if (now < validFrom) {
    return 'NOT_YET_VALID';
  }

  if (now <= validUntil) {
    return 'ACTIVE';
  }

  const graceUntil =
    new Date(validUntil);

  graceUntil.setUTCDate(
    graceUntil.getUTCDate() +
    Number(license.graceDays || 0)
  );

  if (now <= graceUntil) {
    return 'GRACE_PERIOD';
  }

  return 'EXPIRED';
}

function randomPositions() {
  const first =
    crypto.randomInt(1, 13);

  let second =
    crypto.randomInt(1, 13);

  while (second === first) {
    second =
      crypto.randomInt(1, 13);
  }

  return [first, second];
}

module.exports =
function createLicenseAccessRoutes(pool) {
  if (
    !pool ||
    typeof pool.query !== 'function' ||
    typeof pool.connect !== 'function'
  ) {
    throw new Error(
      'A valid licensing database pool is required.'
    );
  }

  const router = express.Router();

  /*
   * -------------------------------------------------------
   * GET ENCRYPTED WALLET
   *
   * Password stays inside Angular.
   * Backend returns only the encrypted JSON wallet.
   * -------------------------------------------------------
   */
  router.get(
    '/wallet/:walletAddress',
    async (request, response) => {
      try {
        const walletAddress =
          normalizeAddress(
            request.params.walletAddress
          );

        const result = await pool.query(
          `
            SELECT
              lw.license_id::text
                AS "licenseId",

              lw.customer_id::text
                AS "customerId",

              lw.install_id::text
                AS "installId",

              lw.wallet_address
                AS "walletAddress",

              lw.encrypted_wallet_json
                AS "encryptedWalletJson",

              lw.wallet_type
                AS "walletType",

              lw.derivation_path
                AS "derivationPath",

              lw.wallet_status
                AS "walletStatus",

              il.contract_ref
                AS "contractRef"

            FROM
              vfort.license_wallet_blockchain lw

            INNER JOIN
              vfort.issued_license il
                ON il.license_id =
                   lw.license_id

            WHERE
              LOWER(lw.wallet_address) =
              LOWER($1)

            LIMIT 1
          `,
          [walletAddress]
        );

        if (result.rowCount !== 1) {
          throw new LicenseAccessError(
            'Wallet was not found.',
            404
          );
        }

        const wallet = result.rows[0];

        if (
          String(wallet.walletStatus)
            .toUpperCase() !== 'ACTIVE'
        ) {
          throw new LicenseAccessError(
            'The wallet is not active.',
            403
          );
        }

        return response.status(200).json({
          success: true,
          wallet
        });
      } catch (error) {
        const statusCode =
          error instanceof LicenseAccessError
            ? error.statusCode
            : 500;

        console.error(
          '[LICENSE_ACCESS_WALLET_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,
            message:
              error instanceof LicenseAccessError
                ? error.message
                : 'Unable to retrieve wallet.'
          });
      }
    }
  );

  /*
   * -------------------------------------------------------
   * CREATE RANDOM 2-WORD RECOVERY CHALLENGE
   * -------------------------------------------------------
   */
  router.post(
    '/forgot-password/challenge',
    async (request, response) => {
      const client =
        await pool.connect();

      try {
        const walletAddress =
          normalizeAddress(
            request.body?.walletAddress
          );

        await client.query('BEGIN');

        const walletResult =
          await client.query(
            `
              SELECT
                lw.license_id::text
                  AS "licenseId",

                lw.wallet_address
                  AS "walletAddress",

                lw.wallet_status
                  AS "walletStatus",

                il.contract_ref
                  AS "contractRef"

              FROM
                vfort.license_wallet_blockchain lw

              INNER JOIN
                vfort.issued_license il
                  ON il.license_id =
                     lw.license_id

              WHERE
                LOWER(lw.wallet_address) =
                LOWER($1)

              FOR UPDATE
            `,
            [walletAddress]
          );

        if (walletResult.rowCount !== 1) {
          throw new LicenseAccessError(
            'Wallet was not found.',
            404
          );
        }

        const wallet =
          walletResult.rows[0];

        const verifierResult =
          await client.query(
            `
              SELECT
                COUNT(*)::integer
                  AS "verifierCount"

              FROM
                vfort.license_wallet_recovery_verifier

              WHERE
                license_id = $1::uuid
            `,
            [wallet.licenseId]
          );

        if (
          verifierResult.rows[0]
            .verifierCount !== 12
        ) {
          throw new LicenseAccessError(
            'Recovery-word verification is not configured for this license.',
            409
          );
        }

        /*
         * Expire previous unused challenges.
         */
        await client.query(
          `
            UPDATE
              vfort.license_word_recovery_challenge

            SET
              used_at = CURRENT_TIMESTAMP

            WHERE
              LOWER(wallet_address) =
              LOWER($1)

              AND used_at IS NULL
          `,
          [walletAddress]
        );

        const [
          position1,
          position2
        ] = randomPositions();

        const challengeId =
          crypto.randomUUID();

        const insertResult =
          await client.query(
            `
              INSERT INTO
                vfort.license_word_recovery_challenge
              (
                challenge_id,
                license_id,
                wallet_address,
                word_position_1,
                word_position_2,
                attempt_count,
                max_attempts,
                expires_at,
                created_at
              )
              VALUES
              (
                $1::uuid,
                $2::uuid,
                $3,
                $4,
                $5,
                0,
                5,
                CURRENT_TIMESTAMP +
                  INTERVAL '3 minutes',
                CURRENT_TIMESTAMP
              )
              RETURNING
                challenge_id::text
                  AS "challengeId",

                word_position_1
                  AS "wordPosition1",

                word_position_2
                  AS "wordPosition2",

                expires_at
                  AS "expiresAt"
            `,
            [
              challengeId,
              wallet.licenseId,
              walletAddress,
              position1,
              position2
            ]
          );

        await client.query('COMMIT');

        return response
          .status(201)
          .json({
            success: true,

            message:
              'Recovery challenge created.',

            walletAddress:
              wallet.walletAddress,

            contractRef:
              wallet.contractRef,

            ...insertResult.rows[0]
          });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {}

        const statusCode =
          error instanceof LicenseAccessError
            ? error.statusCode
            : 500;

        console.error(
          '[LICENSE_WORD_CHALLENGE_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,
            message:
              error instanceof LicenseAccessError
                ? error.message
                : 'Unable to create recovery challenge.'
          });
      } finally {
        client.release();
      }
    }
  );

  /*
   * -------------------------------------------------------
   * VERIFY THE TWO RANDOM WORD DIGESTS
   *
   * Angular sends SHA-256 digests.
   * Actual recovery words are never sent.
   * -------------------------------------------------------
   */
  router.post(
    '/forgot-password/verify',
    async (request, response) => {
      const client =
        await pool.connect();

      try {
        const challengeId =
          normalizeUuid(
            request.body?.challengeId,
            'challengeId'
          );

        const digest1 =
          normalizeDigest(
            request.body?.wordDigest1,
            'wordDigest1'
          );

        const digest2 =
          normalizeDigest(
            request.body?.wordDigest2,
            'wordDigest2'
          );

        await client.query('BEGIN');

        const challengeResult =
          await client.query(
            `
              SELECT
                challenge_id::text
                  AS "challengeId",

                license_id::text
                  AS "licenseId",

                wallet_address
                  AS "walletAddress",

                word_position_1
                  AS "wordPosition1",

                word_position_2
                  AS "wordPosition2",

                attempt_count
                  AS "attemptCount",

                max_attempts
                  AS "maxAttempts",

                expires_at
                  AS "expiresAt",

                used_at
                  AS "usedAt"

              FROM
                vfort.license_word_recovery_challenge

              WHERE
                challenge_id = $1::uuid

              FOR UPDATE
            `,
            [challengeId]
          );

        if (challengeResult.rowCount !== 1) {
          throw new LicenseAccessError(
            'Recovery challenge was not found.',
            404
          );
        }

        const challenge =
          challengeResult.rows[0];

        if (challenge.usedAt) {
          throw new LicenseAccessError(
            'This recovery challenge has already been used.',
            409
          );
        }

        if (
          new Date(challenge.expiresAt)
          <= new Date()
        ) {
          throw new LicenseAccessError(
            'Recovery challenge has expired.',
            410
          );
        }

        if (
          challenge.attemptCount >=
          challenge.maxAttempts
        ) {
          throw new LicenseAccessError(
            'Maximum recovery attempts reached.',
            429
          );
        }

        const verifierResult =
          await client.query(
            `
              SELECT
                word_position
                  AS "wordPosition",

                word_verifier
                  AS "wordVerifier"

              FROM
                vfort.license_wallet_recovery_verifier

              WHERE
                license_id = $1::uuid

                AND word_position =
                    ANY($2::smallint[])
            `,
            [
              challenge.licenseId,
              [
                challenge.wordPosition1,
                challenge.wordPosition2
              ]
            ]
          );

        const verifierMap =
          new Map(
            verifierResult.rows.map(
              (row) => [
                Number(row.wordPosition),
                row.wordVerifier
              ]
            )
          );

        const calculated1 =
          createWordVerifier(
            challenge.licenseId,
            challenge.wordPosition1,
            digest1
          );

        const calculated2 =
          createWordVerifier(
            challenge.licenseId,
            challenge.wordPosition2,
            digest2
          );

        const expected1 =
          verifierMap.get(
            Number(
              challenge.wordPosition1
            )
          );

        const expected2 =
          verifierMap.get(
            Number(
              challenge.wordPosition2
            )
          );

        const valid =
          secureEqual(
            calculated1,
            expected1
          ) &&
          secureEqual(
            calculated2,
            expected2
          );

        if (!valid) {
          await client.query(
            `
              UPDATE
                vfort.license_word_recovery_challenge

              SET
                attempt_count =
                  attempt_count + 1

              WHERE
                challenge_id = $1::uuid
            `,
            [challengeId]
          );

          await client.query('COMMIT');

          return response
            .status(401)
            .json({
              success: false,
              message:
                'Recovery words are incorrect.'
            });
        }

        await client.query(
          `
            UPDATE
              vfort.license_word_recovery_challenge

            SET
              used_at = CURRENT_TIMESTAMP

            WHERE
              challenge_id = $1::uuid
          `,
          [challengeId]
        );

        /*
         * Two recovery words were successfully verified.
         * Issue a short-lived password-reset authorization.
         */
        const passwordResetToken =
          crypto.randomBytes(32)
            .toString('hex');

        const passwordResetTokenHash =
          hashResetToken(
            passwordResetToken
          );

        await client.query(
          `
            UPDATE
              vfort.license_word_recovery_challenge

            SET
              password_reset_token_hash = $2,
              password_reset_expires_at =
                CURRENT_TIMESTAMP +
                INTERVAL '10 minutes',
              password_reset_used_at = NULL

            WHERE
              challenge_id = $1::uuid
          `,
          [
            challengeId,
            passwordResetTokenHash
          ]
        );

        const licenseResult =
          await client.query(
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

                il.issued_at
                  AS "issuedAt",

                il.issued_by
                  AS "issuedBy",

                il.revoked,

                il.signed_jwt
                  AS "signedJwt",

                lw.wallet_address
                  AS "walletAddress",

                lw.wallet_status
                  AS "walletStatus"

              FROM
                vfort.issued_license il

              INNER JOIN
                vfort.license_wallet_blockchain lw
                  ON lw.license_id =
                     il.license_id

              WHERE
                il.license_id =
                $1::uuid
            `,
            [challenge.licenseId]
          );

        if (licenseResult.rowCount !== 1) {
          throw new LicenseAccessError(
            'License was not found.',
            404
          );
        }

        const license =
          licenseResult.rows[0];

        license.calculatedStatus =
          calculateStatus(license);

        await client.query('COMMIT');

        console.log(
          '[LICENSE_WORD_VERIFY_SUCCESS]',
          {
            licenseId:
              license.licenseId,
            contractRef:
              license.contractRef,
            walletAddress:
              license.walletAddress
          }
        );

        return response.status(200).json({
          success: true,

          message:
            'Recovery words verified successfully.',

          license,

          /*
           * User terminology:
           * License Hash = signed_jwt
           */
          licenseHash:
            license.signedJwt,

          passwordReset: {
            allowed: true,
            resetToken:
              passwordResetToken,
            expiresInSeconds: 600
          }
        });
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch {}

        const statusCode =
          error instanceof LicenseAccessError
            ? error.statusCode
            : 500;

        console.error(
          '[LICENSE_WORD_VERIFY_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,
            message:
              error instanceof LicenseAccessError
                ? error.message
                : 'Unable to verify recovery words.'
          });
      } finally {
        client.release();
      }
    }
  );


  /*
   * =======================================================
   * RESET WALLET PASSWORD
   *
   * Browser responsibilities:
   *   1. Reconstruct wallet from 12 recovery words.
   *   2. Confirm derived address = existing address.
   *   3. Generate a new password locally.
   *   4. Encrypt same wallet locally.
   *
   * Backend receives:
   *   - wallet address
   *   - short-lived reset token
   *   - new encrypted wallet JSON
   *
   * Backend NEVER receives:
   *   - recovery words
   *   - private key
   *   - plaintext password
   * =======================================================
   */
  router.post(
    '/password-reset/complete',
    async (request, response) => {

      const client =
        await pool.connect();

      try {
        const walletAddress =
          normalizeAddress(
            request.body?.walletAddress
          );

        const resetToken =
          String(
            request.body?.resetToken || ''
          ).trim();

        const encryptedWalletJson =
          request.body?.encryptedWalletJson;

        const signature =
          String(
            request.body?.signature || ''
          ).trim();

        if (!signature) {
          throw new LicenseAccessError(
            'Wallet ownership signature is required.'
          );
        }

        if (
          !resetToken ||
          resetToken.length < 32
        ) {
          throw new LicenseAccessError(
            'A valid password-reset token is required.'
          );
        }

        if (
          !encryptedWalletJson ||
          typeof encryptedWalletJson !== 'object' ||
          Array.isArray(encryptedWalletJson)
        ) {
          throw new LicenseAccessError(
            'Encrypted wallet JSON is required.'
          );
        }

        const resetTokenHash =
          hashResetToken(resetToken);

        await client.query('BEGIN');

        const authorizationResult =
          await client.query(
            `
              SELECT
                challenge_id::text
                  AS "challengeId",

                license_id::text
                  AS "licenseId",

                wallet_address
                  AS "walletAddress",

                password_reset_token_hash
                  AS "passwordResetTokenHash",

                password_reset_expires_at
                  AS "passwordResetExpiresAt",

                password_reset_used_at
                  AS "passwordResetUsedAt"

              FROM
                vfort.license_word_recovery_challenge

              WHERE
                LOWER(wallet_address) =
                  LOWER($1)

                AND
                  password_reset_token_hash =
                  $2

              ORDER BY
                created_at DESC

              LIMIT 1

              FOR UPDATE
            `,
            [
              walletAddress,
              resetTokenHash
            ]
          );

        if (
          authorizationResult.rowCount !== 1
        ) {
          throw new LicenseAccessError(
            'Password-reset authorization is invalid.',
            401
          );
        }

        const authorization =
          authorizationResult.rows[0];

        if (
          authorization.passwordResetUsedAt
        ) {
          throw new LicenseAccessError(
            'Password-reset authorization has already been used.',
            409
          );
        }

        if (
          !authorization.passwordResetExpiresAt ||
          new Date(
            authorization.passwordResetExpiresAt
          ) <= new Date()
        ) {
          throw new LicenseAccessError(
            'Password-reset authorization has expired.',
            410
          );
        }

        /*
         * Verify that the wallet reconstructed from the
         * 12 recovery words is the SAME wallet.
         */
        const resetMessage =
          `VALOORES_LICENSE_PASSWORD_RESET:` +
          `${walletAddress}:${resetToken}`;

        let signingAddress;

        try {
          signingAddress =
            getAddress(
              verifyMessage(
                resetMessage,
                signature
              )
            );
        } catch {
          throw new LicenseAccessError(
            'Wallet ownership signature is invalid.',
            401
          );
        }

        if (
          signingAddress !== walletAddress
        ) {
          throw new LicenseAccessError(
            'Recovery phrase does not belong to this wallet.',
            401
          );
        }

        /*
         * Ethers V3 keystore contains its public address.
         * Validate that the replacement encrypted JSON
         * also belongs to this wallet.
         */
        const encryptedAddress =
          String(
            encryptedWalletJson.address ||
            ''
          )
            .replace(/^0x/i, '')
            .toLowerCase();

        if (
          encryptedAddress !==
          walletAddress
            .slice(2)
            .toLowerCase()
        ) {
          throw new LicenseAccessError(
            'Encrypted wallet does not match the existing wallet address.',
            400
          );
        }

        /*
         * Wallet address does NOT change.
         * License/customer/install mappings do NOT change.
         */
        const walletUpdateResult =
          await client.query(
            `
              UPDATE
                vfort.license_wallet_blockchain

              SET
                encrypted_wallet_json =
                  $2::jsonb,

                wallet_version =
                  wallet_version + 1,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                license_id =
                  $1::uuid

                AND
                  LOWER(wallet_address) =
                  LOWER($3)

              RETURNING
                license_id::text
                  AS "licenseId",

                wallet_address
                  AS "walletAddress",

                wallet_status
                  AS "walletStatus",

                wallet_version
                  AS "walletVersion",

                updated_at
                  AS "updatedAt"
            `,
            [
              authorization.licenseId,
              JSON.stringify(
                encryptedWalletJson
              ),
              walletAddress
            ]
          );

        if (
          walletUpdateResult.rowCount !== 1
        ) {
          throw new LicenseAccessError(
            'Wallet was not found.',
            404
          );
        }

        await client.query(
          `
            UPDATE
              vfort.license_word_recovery_challenge

            SET
              password_reset_used_at =
                CURRENT_TIMESTAMP

            WHERE
              challenge_id =
                $1::uuid
          `,
          [
            authorization.challengeId
          ]
        );

        await client.query('COMMIT');

        console.log(
          '[LICENSE_PASSWORD_RESET_SUCCESS]',
          {
            licenseId:
              walletUpdateResult
                .rows[0]
                .licenseId,

            walletAddress:
              walletUpdateResult
                .rows[0]
                .walletAddress,

            walletVersion:
              walletUpdateResult
                .rows[0]
                .walletVersion
          }
        );

        return response
          .status(200)
          .json({
            success: true,

            message:
              'Wallet password changed successfully.',

            wallet:
              walletUpdateResult.rows[0]
          });

      } catch (error) {

        try {
          await client.query('ROLLBACK');
        } catch {}

        const statusCode =
          error instanceof LicenseAccessError
            ? error.statusCode
            : 500;

        console.error(
          '[LICENSE_PASSWORD_RESET_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,

            message:
              error instanceof LicenseAccessError
                ? error.message
                : 'Unable to change wallet password.'
          });

      } finally {
        client.release();
      }
    }
  );


  /*
   * =======================================================
   * LOGIN TO APPLICATION LICENSE
   *
   * Request:
   *   walletAddress
   *   walletPassword
   *
   * Backend:
   *   1. Find encrypted wallet.
   *   2. Decrypt using supplied password.
   *   3. Verify derived address matches stored address.
   *   4. Load application license.
   *   5. Return client/license information + license hash.
   *
   * Password is NEVER stored or logged.
   * =======================================================
   */
  router.post(
    '/login',
    async (request, response) => {

      try {
        const walletAddress =
          normalizeAddress(
            request.body?.walletAddress
          );

        const walletPassword =
          String(
            request.body?.walletPassword ||
            ''
          );

        if (!walletPassword) {
          throw new LicenseAccessError(
            'Wallet password is required.'
          );
        }

        /*
         * Find wallet + associated license.
         */
        const walletResult =
          await pool.query(
            `
              SELECT
                lw.license_id::text
                  AS "licenseId",

                lw.customer_id::text
                  AS "customerId",

                lw.install_id::text
                  AS "installId",

                lw.wallet_address
                  AS "walletAddress",

                lw.encrypted_wallet_json
                  AS "encryptedWalletJson",

                lw.wallet_type
                  AS "walletType",

                lw.derivation_path
                  AS "derivationPath",

                lw.wallet_status
                  AS "walletStatus",

                lw.wallet_version
                  AS "walletVersion",

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

                il.revoked,

                il.signed_jwt
                  AS "signedJwt"

              FROM
                vfort.license_wallet_blockchain lw

              INNER JOIN
                vfort.issued_license il
                  ON il.license_id =
                     lw.license_id

              WHERE
                LOWER(lw.wallet_address) =
                  LOWER($1)

              LIMIT 1
            `,
            [walletAddress]
          );

        if (walletResult.rowCount !== 1) {
          throw new LicenseAccessError(
            'Wallet was not found.',
            404
          );
        }

        const data =
          walletResult.rows[0];

        if (
          String(data.walletStatus)
            .toUpperCase() !== 'ACTIVE'
        ) {
          throw new LicenseAccessError(
            'Wallet is not active.',
            403
          );
        }

        /*
         * Password verification:
         * decrypt the encrypted wallet.
         *
         * IMPORTANT:
         * never log walletPassword.
         */
        let decryptedWallet;

        try {
          decryptedWallet =
            await Wallet.fromEncryptedJson(
              JSON.stringify(
                data.encryptedWalletJson
              ),
              walletPassword
            );
        } catch {
          throw new LicenseAccessError(
            'Wallet address or password is incorrect.',
            401
          );
        }

        /*
         * Confirm decrypted wallet is exactly
         * the wallet stored for this license.
         */
        if (
          getAddress(
            decryptedWallet.address
          ) !== walletAddress
        ) {
          throw new LicenseAccessError(
            'Wallet address or password is incorrect.',
            401
          );
        }

        const license = {
          licenseId:
            data.licenseId,

          customerId:
            data.customerId,

          installId:
            data.installId,

          contractRef:
            data.contractRef,

          sequenceNumber:
            data.sequenceNumber,

          productModules:
            data.productModules,

          maxUsers:
            data.maxUsers,

          graceDays:
            data.graceDays,

          validFrom:
            data.validFrom,

          validUntil:
            data.validUntil,

          issuedAt:
            data.issuedAt,

          issuedBy:
            data.issuedBy,

          revoked:
            data.revoked,

          walletAddress:
            data.walletAddress,

          walletStatus:
            data.walletStatus,

          walletVersion:
            data.walletVersion,

          calculatedStatus:
            calculateStatus(data)
        };

        console.log(
          '[LICENSE_LOGIN_SUCCESS]',
          {
            licenseId:
              data.licenseId,

            contractRef:
              data.contractRef,

            walletAddress:
              data.walletAddress
          }
        );

        /*
         * NEVER return walletPassword.
         */
        return response
          .status(200)
          .json({
            success: true,

            message:
              'License wallet authenticated successfully.',

            wallet: {
              walletAddress:
                data.walletAddress,

              walletStatus:
                data.walletStatus,

              walletVersion:
                data.walletVersion
            },

            license,

            licenseHash:
              data.signedJwt
          });

      } catch (error) {

        const statusCode =
          error instanceof LicenseAccessError
            ? error.statusCode
            : 500;

        console.error(
          '[LICENSE_LOGIN_ERROR]',
          error.message
        );

        return response
          .status(statusCode)
          .json({
            success: false,

            message:
              error instanceof LicenseAccessError
                ? error.message
                : 'Unable to authenticate license wallet.'
          });
      }
    }
  );


  /*
   * =========================================================
   * SIMPLE WALLET PASSWORD RESET
   *
   * POST /api/license-access/password-reset
   *
   * Frontend sends:
   *   walletAddress
   *   resetToken
   *   recoveryWords[12]
   *
   * Backend:
   *   - validates reset authorization
   *   - reconstructs same wallet
   *   - verifies same wallet address
   *   - generates new password
   *   - encrypts same wallet
   *   - updates encrypted_wallet_json
   *   - increments wallet_version
   *   - returns new password ONCE
   *
   * NEVER LOG OR STORE:
   *   - recoveryWords
   *   - recovery phrase
   *   - newWalletPassword
   *   - private key
   * =========================================================
   */
  router.post(
    '/password-reset',
    async (request, response) => {

      const client = await pool.connect();
      let transactionStarted = false;

      try {

        const rawWalletAddress =
          String(
            request.body?.walletAddress || ''
          ).trim();

        const resetToken =
          String(
            request.body?.resetToken || ''
          ).trim();

        const recoveryWords =
          request.body?.recoveryWords;

        if (!rawWalletAddress) {
          return response.status(400).json({
            success: false,
            message: 'walletAddress is required.'
          });
        }

        let walletAddress;

        try {
          walletAddress =
            getAddress(rawWalletAddress);
        } catch {
          return response.status(400).json({
            success: false,
            message: 'Invalid wallet address.'
          });
        }

        if (!resetToken) {
          return response.status(400).json({
            success: false,
            message: 'resetToken is required.'
          });
        }

        if (
          !Array.isArray(recoveryWords) ||
          recoveryWords.length !== 12
        ) {
          return response.status(400).json({
            success: false,
            message:
              'Exactly 12 recovery words are required.'
          });
        }

        const normalizedWords =
          recoveryWords.map(
            (word) =>
              String(word || '')
                .trim()
                .toLowerCase()
          );

        if (
          normalizedWords.some(
            (word) => !word
          )
        ) {
          return response.status(400).json({
            success: false,
            message:
              'All 12 recovery words are required.'
          });
        }

        /*
         * Hash reset token.
         * Only the token hash exists in PostgreSQL.
         */
        const resetTokenHash =
          crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        await client.query('BEGIN');
        transactionStarted = true;

        /*
         * Find active password reset authorization.
         */
        const resetResult =
          await client.query(
            `
              SELECT
                challenge_id::text
                  AS "challengeId",

                license_id::text
                  AS "licenseId",

                wallet_address
                  AS "walletAddress",

                password_reset_expires_at
                  AS "passwordResetExpiresAt",

                password_reset_used_at
                  AS "passwordResetUsedAt"

              FROM
                vfort.license_word_recovery_challenge

              WHERE
                LOWER(wallet_address) =
                  LOWER($1)

                AND password_reset_token_hash =
                  $2

              ORDER BY
                created_at DESC

              LIMIT 1

              FOR UPDATE
            `,
            [
              walletAddress,
              resetTokenHash
            ]
          );

        if (resetResult.rowCount !== 1) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(401).json({
            success: false,
            message:
              'Invalid password-reset authorization.'
          });
        }

        const authorization =
          resetResult.rows[0];

        if (
          authorization.passwordResetUsedAt
        ) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(409).json({
            success: false,
            message:
              'Password-reset authorization has already been used.'
          });
        }

        if (
          !authorization.passwordResetExpiresAt ||
          new Date(
            authorization.passwordResetExpiresAt
          ) <= new Date()
        ) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(410).json({
            success: false,
            message:
              'Password-reset authorization has expired.'
          });
        }

        /*
         * Reconstruct wallet from the 12 recovery words.
         */
        const recoveryPhrase =
          normalizedWords.join(' ');

        let recoveredWallet;

        try {
          recoveredWallet =
            Wallet.fromPhrase(
              recoveryPhrase
            );
        } catch {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(400).json({
            success: false,
            message:
              'Invalid recovery words.'
          });
        }

        const recoveredAddress =
          getAddress(
            recoveredWallet.address
          );

        /*
         * Critical ownership validation.
         */
        if (
          recoveredAddress !==
          walletAddress
        ) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(403).json({
            success: false,
            message:
              'Recovery words do not belong to this wallet.'
          });
        }

        /*
         * Confirm wallet exists and belongs
         * to the reset authorization license.
         */
        const walletResult =
          await client.query(
            `
              SELECT
                license_id::text
                  AS "licenseId",

                customer_id::text
                  AS "customerId",

                install_id::text
                  AS "installId",

                wallet_address
                  AS "walletAddress",

                wallet_status
                  AS "walletStatus",

                wallet_version
                  AS "walletVersion"

              FROM
                vfort.license_wallet_blockchain

              WHERE
                license_id =
                  $1::uuid

                AND LOWER(wallet_address) =
                  LOWER($2)

              LIMIT 1

              FOR UPDATE
            `,
            [
              authorization.licenseId,
              walletAddress
            ]
          );

        if (walletResult.rowCount !== 1) {
          await client.query('ROLLBACK');
          transactionStarted = false;

          return response.status(404).json({
            success: false,
            message:
              'License wallet was not found.'
          });
        }

        const existingWallet =
          walletResult.rows[0];

        /*
         * Generate new secure password.
         */
        const newWalletPassword =
          `VAL-${crypto
            .randomBytes(24)
            .toString('hex')}`;

        /*
         * Encrypt SAME wallet/private key
         * using NEW password.
         */
        const encryptedWalletText =
          await recoveredWallet.encrypt(
            newWalletPassword
          );

        const encryptedWalletJson =
          JSON.parse(
            encryptedWalletText
          );

        /*
         * Extra safety check.
         */
        const encryptedAddress =
          getAddress(
            `0x${encryptedWalletJson.address}`
          );

        if (
          encryptedAddress !==
          walletAddress
        ) {
          throw new Error(
            'Encrypted wallet address validation failed.'
          );
        }

        /*
         * Update only encrypted wallet credentials.
         */
        const updateResult =
          await client.query(
            `
              UPDATE
                vfort.license_wallet_blockchain

              SET
                encrypted_wallet_json =
                  $1::jsonb,

                wallet_version =
                  wallet_version + 1,

                updated_at =
                  CURRENT_TIMESTAMP

              WHERE
                license_id =
                  $2::uuid

                AND LOWER(wallet_address) =
                  LOWER($3)

              RETURNING
                license_id::text
                  AS "licenseId",

                customer_id::text
                  AS "customerId",

                install_id::text
                  AS "installId",

                wallet_address
                  AS "walletAddress",

                wallet_status
                  AS "walletStatus",

                wallet_version
                  AS "walletVersion",

                updated_at
                  AS "updatedAt"
            `,
            [
              JSON.stringify(
                encryptedWalletJson
              ),
              authorization.licenseId,
              walletAddress
            ]
          );

        /*
         * Make reset authorization one-time use.
         */
        await client.query(
          `
            UPDATE
              vfort.license_word_recovery_challenge

            SET
              password_reset_used_at =
                CURRENT_TIMESTAMP

            WHERE
              challenge_id =
                $1::uuid
          `,
          [
            authorization.challengeId
          ]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        console.log(
          '[LICENSE_SIMPLE_PASSWORD_RESET_SUCCESS]',
          {
            licenseId:
              authorization.licenseId,
            walletAddress,
            walletVersion:
              updateResult.rows[0]
                .walletVersion
          }
        );

        /*
         * Return password ONCE.
         * Never log it.
         */
        return response.status(200).json({
          success: true,

          message:
            'Wallet password changed successfully.',

          wallet:
            updateResult.rows[0],

          newWalletPassword
        });

      } catch (error) {

        if (transactionStarted) {
          try {
            await client.query(
              'ROLLBACK'
            );
          } catch {}
        }

        console.error(
          '[LICENSE_SIMPLE_PASSWORD_RESET_ERROR]',
          error.message
        );

        return response.status(500).json({
          success: false,
          message:
            'Unable to change wallet password.'
        });

      } finally {
        client.release();
      }
    }
  );

  return router;
};
