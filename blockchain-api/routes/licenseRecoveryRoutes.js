'use strict';

const express = require('express');
const crypto = require('node:crypto');
const {
    verifyMessage,
    getAddress
} = require('ethers');

class RecoveryRequestError extends Error {
    constructor(message, statusCode = 401) {
        super(message);
        this.name = 'RecoveryRequestError';
        this.statusCode = statusCode;
    }
}

function normalizeAddress(value) {
    const address = String(value ?? '')
        .trim()
        .replace(/^0x/i, '');

    if (!/^[0-9a-fA-F]{40}$/.test(address)) {
        throw new RecoveryRequestError(
            'Invalid wallet address.',
            400
        );
    }

    return getAddress(`0x${address}`);
}

function calculateStatus(license) {
    if (license.revoked) {
        return 'REVOKED';
    }

    const now = new Date();
    const validFrom = new Date(license.validFrom);
    const validUntil = new Date(license.validUntil);

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

    const graceUntil = new Date(validUntil);

    graceUntil.setUTCDate(
        graceUntil.getUTCDate() +
        Number(license.graceDays ?? 0)
    );

    if (now <= graceUntil) {
        return 'GRACE_PERIOD';
    }

    return 'EXPIRED';
}

function logRouteError(context, error) {
    console.error(
        `[${context}]`,
        {
            name: error?.name,
            message: error?.message,
            code: error?.code,
            detail: error?.detail,
            table: error?.table,
            column: error?.column,
            constraint: error?.constraint,
            stack: error?.stack
        }
    );
}

function publicErrorDetails(error) {
    if (process.env.NODE_ENV === 'production') {
        return undefined;
    }

    return {
        message: error?.message,
        code: error?.code,
        detail: error?.detail,
        table: error?.table,
        constraint: error?.constraint
    };
}

module.exports = function createLicenseRecoveryRoutes(pool) {
    if (
        !pool ||
        typeof pool.query !== 'function' ||
        typeof pool.connect !== 'function'
    ) {
        throw new Error(
            'A valid PostgreSQL pool is required for license recovery.'
        );
    }

    const router = express.Router();

    /*
     * Diagnostic endpoint.
     *
     * GET /api/license-recovery/health
     */
    router.get('/health', async (_request, response) => {
        try {
            const result = await pool.query(`
                SELECT
                    current_database() AS "databaseName",
                    current_user AS "databaseUser",
                    to_regclass(
                        'vfort.license_recovery_challenge'
                    )::text AS "challengeTable",
                    to_regclass(
                    'vfort.license_wallet_blockchain'
                    )::text AS "walletTable",
                    to_regclass(
                    'vfort.issued_license'
                    )::text AS "licenseTable",
                    CURRENT_TIMESTAMP AS "serverTime"
            `);

            const health = result.rows[0];

            const ready = Boolean(
                health.challengeTable &&
                health.walletTable &&
                health.licenseTable
            );

            response
                .status(ready ? 200 : 503)
                .json({
                    success: ready,
                    service: 'license-recovery',
                    ...health
                });
        } catch (error) {
            logRouteError(
                'LICENSE_RECOVERY_HEALTH_ERROR',
                error
            );

            response.status(500).json({
                success: false,
                message:
                    'License recovery database health check failed.',
                error: publicErrorDetails(error)
            });
        }
    });

    /*
     * Create a one-time challenge.
     *
     * POST /api/license-recovery/challenge
     *
     * Body:
     * {
     *   "walletAddress": "0x..."
     * }
     */
    router.post('/challenge', async (request, response) => {
        try {
            const walletAddress = normalizeAddress(
                request.body?.walletAddress
            );

            const challengeId = crypto.randomUUID();

            const challenge =
                'VALOORES-LICENSE-RECOVERY-' +
                crypto.randomBytes(32).toString('hex');

            const expiresAt = new Date(
                Date.now() + 3 * 60 * 1000
            );

            await pool.query(
                `
                    INSERT INTO
                        vfort.license_recovery_challenge
                    (
                        challenge_id,
                        wallet_address,
                        challenge_text,
                        expires_at
                    )
                    VALUES
                    (
                        $1::uuid,
                        $2,
                        $3,
                        $4::timestamptz
                    )
                `,
                [
                    challengeId,
                    walletAddress,
                    challenge,
                    expiresAt.toISOString()
                ]
            );

            response.status(200).json({
                success: true,
                challengeId,
                challenge,
                expiresAt: expiresAt.toISOString()
            });
        } catch (error) {
            logRouteError(
                'LICENSE_RECOVERY_CHALLENGE_ERROR',
                error
            );

            const statusCode =
                error instanceof RecoveryRequestError
                    ? error.statusCode
                    : 500;

            response.status(statusCode).json({
                success: false,
                message:
                    statusCode === 400
                        ? error.message
                        : 'Unable to create recovery challenge.',
                error: publicErrorDetails(error)
            });
        }
    });

    /*
     * Verify the challenge signature and return all linked
     * wallet and license information.
     *
     * POST /api/license-recovery/recover
     *
     * Body:
     * {
     *   "walletAddress": "0x...",
     *   "challengeId": "UUID",
     *   "signature": "0x..."
     * }
     */
    router.post('/recover', async (request, response) => {
        let client;
        let transactionStarted = false;

        try {
            const {
                walletAddress,
                challengeId,
                signature
            } = request.body ?? {};

            if (
                !challengeId ||
                !signature
            ) {
                throw new RecoveryRequestError(
                    'Wallet address, challenge ID, and signature are required.',
                    400
                );
            }

            const normalizedWalletAddress =
                normalizeAddress(walletAddress);

            client = await pool.connect();

            await client.query('BEGIN');
            transactionStarted = true;

            const challengeResult = await client.query(
                `
                    SELECT
                        challenge_text,
                        wallet_address,
                        expires_at,
                        used_at
                    FROM
                        vfort.license_recovery_challenge
                    WHERE
                        challenge_id = $1::uuid
                    FOR UPDATE
                `,
                [challengeId]
            );

            if (challengeResult.rowCount !== 1) {
                throw new RecoveryRequestError(
                    'Invalid recovery challenge.'
                );
            }

            const challengeRecord =
                challengeResult.rows[0];

            if (challengeRecord.used_at) {
                throw new RecoveryRequestError(
                    'Recovery challenge has already been used.'
                );
            }

            if (
                new Date(challengeRecord.expires_at) <
                new Date()
            ) {
                throw new RecoveryRequestError(
                    'Recovery challenge has expired.'
                );
            }

            const challengeWallet = normalizeAddress(
                challengeRecord.wallet_address
            );

            if (
                challengeWallet !==
                normalizedWalletAddress
            ) {
                throw new RecoveryRequestError(
                    'Wallet challenge mismatch.'
                );
            }

            let recoveredSigner;

            try {
                recoveredSigner = getAddress(
                    verifyMessage(
                        challengeRecord.challenge_text,
                        signature
                    )
                );
            } catch {
                throw new RecoveryRequestError(
                    'Invalid recovery signature.'
                );
            }

            if (
                recoveredSigner !==
                normalizedWalletAddress
            ) {
                throw new RecoveryRequestError(
                    'Recovery signature does not match the wallet.'
                );
            }

            const walletResult = await client.query(
                `
                    SELECT
                        customer_id::text
                            AS "customerId",

                        license_id::text
                            AS "licenseId",

                        install_id::text
                            AS "installId",

                        wallet_address
                            AS "walletAddress",

                        wallet_public_key
                            AS "walletPublicKey",

                        wallet_type
                            AS "walletType",

                        derivation_path
                            AS "derivationPath",

                        recovery_word_count
                            AS "recoveryWordCount",

                        wallet_status
                            AS "walletStatus",

                        created_at
                            AS "createdAt",

                        updated_at
                            AS "updatedAt"
                    FROM
                        vfort.license_wallet_blockchain
                    WHERE
                        LOWER(wallet_address) =
                        LOWER($1)
                `,
                [normalizedWalletAddress]
            );

            if (walletResult.rowCount !== 1) {
                throw new RecoveryRequestError(
                    'The recovered wallet is not linked to a license.'
                );
            }

            const wallet = walletResult.rows[0];

            if (wallet.walletStatus !== 'ACTIVE') {
                throw new RecoveryRequestError(
                    `Wallet status is ${wallet.walletStatus}.`
                );
            }

            const licenseResult = await client.query(
                `
                    SELECT
                        license_id::text
                            AS "licenseId",

                        customer_id::text
                            AS "customerId",

                        install_id::text
                            AS "installId",

                        contract_ref
                            AS "contractRef",

                        sequence_number
                            AS "sequenceNumber",

                        product_modules
                            AS "productModules",

                        max_users
                            AS "maxUsers",

                        grace_days
                            AS "graceDays",

                        valid_from
                            AS "validFrom",

                        valid_until
                            AS "validUntil",

                        issued_at
                            AS "issuedAt",

                        issued_by
                            AS "issuedBy",

                        signed_jwt
                            AS "signedJwt",

                        revoked
                    FROM
                        vfort.issued_license
                    WHERE
                        license_id = $1::uuid
                        AND customer_id = $2::uuid
                        AND install_id = $3::uuid
                    ORDER BY
                        issued_at DESC NULLS LAST,
                        license_id
                `,
                [
                    wallet.licenseId,
                    wallet.customerId,
                    wallet.installId
                ]
            );

            if (licenseResult.rowCount === 0) {
                throw new RecoveryRequestError(
                    'No license records are linked to this wallet.'
                );
            }

            const licenses = licenseResult.rows.map(
                (license) => ({
                    ...license,
                    calculatedStatus:
                        calculateStatus(license)
                })
            );

            const challengeUpdateResult =
                await client.query(
                    `
                        UPDATE
                            vfort.license_recovery_challenge
                        SET
                            used_at = CURRENT_TIMESTAMP
                        WHERE
                            challenge_id = $1::uuid
                            AND used_at IS NULL
                    `,
                    [challengeId]
                );

            if (challengeUpdateResult.rowCount !== 1) {
                throw new RecoveryRequestError(
                    'Recovery challenge could not be finalized.'
                );
            }

            await client.query('COMMIT');
            transactionStarted = false;

            response.status(200).json({
                success: true,
                message:
                    'License recovered successfully.',
                recoveredAt: new Date().toISOString(),
                verification: {
                    walletAddress:
                        normalizedWalletAddress,
                    challengeVerified: true,
                    signatureVerified: true,
                    passwordUsed: false,
                    recoveryWordsReceivedByServer: false
                },
                wallet,
                licenses
            });
        } catch (error) {
            if (
                client &&
                transactionStarted
            ) {
                try {
                    await client.query('ROLLBACK');
                } catch (rollbackError) {
                    logRouteError(
                        'LICENSE_RECOVERY_ROLLBACK_ERROR',
                        rollbackError
                    );
                }
            }

            logRouteError(
                'LICENSE_RECOVERY_REQUEST_ERROR',
                error
            );

            const statusCode =
                error instanceof RecoveryRequestError
                    ? error.statusCode
                    : 500;

            response.status(statusCode).json({
                success: false,
                message:
                    statusCode === 400
                        ? error.message
                        : statusCode === 401
                            ? 'License recovery failed. Verify the recovery words and try again.'
                            : 'License recovery service failed.',
                error: publicErrorDetails(error)
            });
        } finally {
            if (client) {
                client.release();
            }
        }
    });

    return router;
};