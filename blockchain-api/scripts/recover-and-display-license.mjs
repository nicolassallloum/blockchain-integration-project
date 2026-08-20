import pg from "pg";
import {
    Wallet,
    getAddress,
    verifyMessage
} from "ethers";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const { Client } = pg;

async function readStandardInput() {
    const chunks = [];

    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

function requiredEnvironment(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Missing environment variable: ${name}`
        );
    }

    return value;
}

function normalizeAddress(address) {
    const value = String(address ?? "")
        .trim()
        .replace(/^0x/i, "");

    return getAddress(`0x${value}`);
}

function displayValue(label, value) {
    let output = value;

    if (value === null || value === undefined) {
        output = "NULL";
    } else if (Array.isArray(value)) {
        output = value.join(", ");
    } else if (value instanceof Date) {
        output = value.toISOString();
    } else if (typeof value === "boolean") {
        output = value ? "YES" : "NO";
    } else if (typeof value === "object") {
        output = JSON.stringify(value);
    }

    console.log(
        `${label.padEnd(26)}: ${output}`
    );
}

function maskJwt(jwt) {
    if (!jwt) {
        return "NOT STORED";
    }

    if (jwt.length <= 50) {
        return "[STORED]";
    }

    return (
        jwt.slice(0, 24) +
        "..." +
        jwt.slice(-16)
    );
}

function calculateLicenseStatus(license) {
    if (license.revoked) {
        return "REVOKED";
    }

    const now = new Date();
    const validFrom = new Date(license.valid_from);
    const validUntil = new Date(license.valid_until);

    if (now < validFrom) {
        return "NOT_YET_VALID";
    }

    if (now > validUntil) {
        const graceUntil = new Date(validUntil);

        graceUntil.setDate(
            graceUntil.getDate() +
            Number(license.grace_days ?? 0)
        );

        if (now <= graceUntil) {
            return "GRACE_PERIOD";
        }

        return "EXPIRED";
    }

    return "ACTIVE";
}

async function main() {
    const customerId = process.argv[2];
    const walletFile = process.argv[3];

    if (!customerId) {
        throw new Error(
            "Customer ID argument is required."
        );
    }

    if (!walletFile) {
        throw new Error(
            "Wallet keystore file argument is required."
        );
    }

    /*
     * Read the recovery phrase from standard input.
     * It is not written to a file or database.
     */
    const recoveryPhrase = (
        await readStandardInput()
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const recoveryWords = recoveryPhrase.split(" ");

    if (recoveryWords.length !== 12) {
        throw new Error(
            `Exactly 12 recovery words are required; ` +
            `received ${recoveryWords.length}.`
        );
    }

    const encryptedWallet = JSON.parse(
        await readFile(walletFile, "utf8")
    );

    const expectedAddress = normalizeAddress(
        encryptedWallet.address
    );

    let recoveredWallet;

    try {
        recoveredWallet = Wallet.fromPhrase(
            recoveryPhrase
        );
    } catch {
        throw new Error(
            "The entered 12-word recovery phrase is invalid."
        );
    }

    const recoveredAddress = getAddress(
        recoveredWallet.address
    );

    if (recoveredAddress !== expectedAddress) {
        throw new Error(
            "The recovery words do not belong to this customer wallet."
        );
    }

    /*
     * Sign and verify a random challenge.
     */
    const challenge =
        "VALOORES-LICENSE-RECOVERY-" +
        randomBytes(32).toString("hex");

    const signature = await recoveredWallet.signMessage(
        challenge
    );

    const signerAddress = getAddress(
        verifyMessage(challenge, signature)
    );

    if (signerAddress !== expectedAddress) {
        throw new Error(
            "Wallet challenge-signature verification failed."
        );
    }

    const client = new Client({
        host: requiredEnvironment("POSTGRES_HOST"),
        port: Number(
            requiredEnvironment("POSTGRES_PORT")
        ),
        database: requiredEnvironment(
            "POSTGRES_DATABASE"
        ),
        user: requiredEnvironment("POSTGRES_USER"),
        password: requiredEnvironment(
            "POSTGRES_PASSWORD"
        ),
        connectionTimeoutMillis: 10000
    });

    await client.connect();

    try {
        /*
         * The customer ID and recovered wallet address must
         * match the same PostgreSQL wallet record.
         */
        const walletResult = await client.query(
            `
                SELECT
                    customer_id::text AS customer_id,
                    source_license_id::text
                        AS source_license_id,
                    install_id::text AS install_id,
                    wallet_address,
                    wallet_public_key,
                    wallet_type,
                    derivation_path,
                    recovery_word_count,
                    wallet_status,
                    created_at,
                    updated_at
                FROM
                    vfort.license_user_wallet_test
                WHERE
                    customer_id = $1::uuid
                    AND LOWER(wallet_address) =
                        LOWER($2)
            `,
            [
                customerId,
                recoveredAddress
            ]
        );

        if (walletResult.rowCount !== 1) {
            throw new Error(
                "The recovered wallet is not linked to " +
                "the supplied customer ID."
            );
        }

        const walletRecord = walletResult.rows[0];

        const licenseResult = await client.query(
            `
                SELECT
                    license_id::text AS license_id,
                    customer_id::text AS customer_id,
                    install_id::text AS install_id,
                    contract_ref,
                    sequence_number,
                    product_modules,
                    max_users,
                    grace_days,
                    valid_from,
                    valid_until,
                    issued_at,
                    issued_by,
                    signed_jwt,
                    revoked
                FROM
                    vfort.issued_license_blockchain_test
                WHERE
                    customer_id = $1::uuid
                ORDER BY
                    issued_at DESC,
                    license_id
            `,
            [customerId]
        );

        if (licenseResult.rowCount === 0) {
            throw new Error(
                "No license records were found for this customer."
            );
        }

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "[PASS] 12-WORD LICENSE RECOVERY COMPLETED"
        );
        console.log(
            "============================================================"
        );

        displayValue(
            "Customer ID",
            walletRecord.customer_id
        );

        displayValue(
            "Expected wallet",
            expectedAddress
        );

        displayValue(
            "Recovered wallet",
            recoveredAddress
        );

        displayValue(
            "Addresses match",
            true
        );

        displayValue(
            "Challenge signed",
            true
        );

        displayValue(
            "Signature verified",
            true
        );

        displayValue(
            "Password used",
            false
        );

        displayValue(
            "Recovery file used",
            false
        );

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "CUSTOMER WALLET INFORMATION"
        );
        console.log(
            "============================================================"
        );

        displayValue(
            "Customer ID",
            walletRecord.customer_id
        );

        displayValue(
            "Source License ID",
            walletRecord.source_license_id
        );

        displayValue(
            "Install ID",
            walletRecord.install_id
        );

        displayValue(
            "Wallet Address",
            walletRecord.wallet_address
        );

        displayValue(
            "Wallet Public Key",
            walletRecord.wallet_public_key
        );

        displayValue(
            "Wallet Type",
            walletRecord.wallet_type
        );

        displayValue(
            "Derivation Path",
            walletRecord.derivation_path
        );

        displayValue(
            "Recovery Word Count",
            walletRecord.recovery_word_count
        );

        displayValue(
            "Wallet Status",
            walletRecord.wallet_status
        );

        displayValue(
            "Wallet Created At",
            walletRecord.created_at
        );

        displayValue(
            "Wallet Updated At",
            walletRecord.updated_at
        );

        for (
            let index = 0;
            index < licenseResult.rows.length;
            index += 1
        ) {
            const license = licenseResult.rows[index];

            console.log("");
            console.log(
                "============================================================"
            );
            console.log(
                `LICENSE ${index + 1} OF ` +
                `${licenseResult.rows.length}`
            );
            console.log(
                "============================================================"
            );

            displayValue(
                "License ID",
                license.license_id
            );

            displayValue(
                "Customer ID",
                license.customer_id
            );

            displayValue(
                "Install ID",
                license.install_id
            );

            displayValue(
                "Contract Reference",
                license.contract_ref
            );

            displayValue(
                "Sequence Number",
                license.sequence_number
            );

            displayValue(
                "Product Modules",
                license.product_modules
            );

            displayValue(
                "Maximum Users",
                license.max_users
            );

            displayValue(
                "Grace Days",
                license.grace_days
            );

            displayValue(
                "Valid From",
                license.valid_from
            );

            displayValue(
                "Valid Until",
                license.valid_until
            );

            displayValue(
                "Calculated Status",
                calculateLicenseStatus(
                    license
                )
            );

            displayValue(
                "Issued At",
                license.issued_at
            );

            displayValue(
                "Issued By",
                license.issued_by
            );

            displayValue(
                "Revoked",
                license.revoked
            );

            displayValue(
                "Signed JWT Stored",
                Boolean(license.signed_jwt)
            );

            displayValue(
                "Signed JWT Preview",
                maskJwt(license.signed_jwt)
            );
        }

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            `[PASS] ${licenseResult.rowCount} LICENSE RECORD(S) DISPLAYED`
        );
        console.log(
            "============================================================"
        );
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("");
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
