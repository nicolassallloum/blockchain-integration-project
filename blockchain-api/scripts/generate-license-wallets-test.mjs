import pg from "pg";
import { Wallet } from "ethers";
import {
    chmod,
    mkdir,
    rm,
    writeFile
} from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

const FIXED_TEST_PASSWORD = "123456789012";

const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

const outputDirectory = path.resolve(
    "license-wallet-output",
    timestamp
);

const keystoreDirectory = path.join(
    outputDirectory,
    "keystores"
);

function csvValue(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function csvRow(values) {
    return values.map(csvValue).join(",");
}

function requireEnvironment(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Required environment variable is missing: ${name}`
        );
    }

    return value;
}

async function main() {
    const client = new Client({
        host: requireEnvironment("POSTGRES_HOST"),
        port: Number(
            requireEnvironment("POSTGRES_PORT")
        ),
        database: requireEnvironment("POSTGRES_DATABASE"),
        user: requireEnvironment("POSTGRES_USER"),
        password: requireEnvironment("POSTGRES_PASSWORD"),
        connectionTimeoutMillis: 10000
    });

    let transactionStarted = false;
    let outputCreated = false;

    try {
        await client.connect();

        console.log(
            "[PASS] Connected to remote PostgreSQL"
        );

        await client.query(`
            CREATE TABLE IF NOT EXISTS
                vfort.license_user_wallet_test
            (
                customer_id UUID PRIMARY KEY,

                source_license_id UUID NOT NULL,
                install_id UUID NOT NULL,

                wallet_address VARCHAR(42)
                    NOT NULL
                    UNIQUE,

                wallet_public_key TEXT
                    NOT NULL,

                encrypted_wallet_json JSONB
                    NOT NULL,

                wallet_type VARCHAR(40)
                    NOT NULL
                    DEFAULT 'BIP39_SECP256K1',

                derivation_path VARCHAR(64)
                    NOT NULL
                    DEFAULT 'm/44''/60''/0''/0/0',

                recovery_word_count SMALLINT
                    NOT NULL
                    DEFAULT 12,

                wallet_status VARCHAR(20)
                    NOT NULL
                    DEFAULT 'ACTIVE',

                created_at TIMESTAMPTZ
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                updated_at TIMESTAMPTZ
                    NOT NULL
                    DEFAULT CURRENT_TIMESTAMP,

                CONSTRAINT chk_license_wallet_status
                CHECK (
                    wallet_status IN (
                        'ACTIVE',
                        'LOCKED',
                        'REVOKED',
                        'ROTATED'
                    )
                ),

                CONSTRAINT chk_license_wallet_word_count
                CHECK (
                    recovery_word_count = 12
                )
            )
        `);

        const result = await client.query(`
            SELECT DISTINCT ON (license.customer_id)
                license.license_id::text AS license_id,
                license.customer_id::text AS customer_id,
                license.install_id::text AS install_id
            FROM
                vfort.issued_license_blockchain_test license
            WHERE
                license.customer_id IS NOT NULL
                AND license.license_id IS NOT NULL
                AND license.install_id IS NOT NULL
                AND COALESCE(license.revoked, FALSE) = FALSE
                AND NOT EXISTS
                (
                    SELECT 1
                    FROM vfort.license_user_wallet_test wallet
                    WHERE
                        wallet.customer_id =
                        license.customer_id
                )
            ORDER BY
                license.customer_id,
                license.issued_at DESC NULLS LAST,
                license.license_id
        `);

        const customers = result.rows;

        console.log(
            `Customers requiring wallets: ${customers.length}`
        );

        if (customers.length === 0) {
            console.log(
                "[PASS] All active customers already have wallets"
            );

            return;
        }

        await mkdir(
            keystoreDirectory,
            {
                recursive: true,
                mode: 0o700
            }
        );

        outputCreated = true;

        const generatedWallets = [];

        const publicRows = [
            csvRow([
                "customer_id",
                "license_id",
                "install_id",
                "wallet_address",
                "wallet_public_key",
                "derivation_path",
                "keystore_file"
            ])
        ];

        const privateRows = [
            csvRow([
                "customer_id",
                "license_id",
                "install_id",
                "wallet_address",
                "password",
                "recovery_phrase"
            ])
        ];

        for (
            let index = 0;
            index < customers.length;
            index += 1
        ) {
            const customer = customers[index];
            const wallet = Wallet.createRandom();

            if (!wallet.mnemonic) {
                throw new Error(
                    `Mnemonic generation failed for ${customer.customer_id}`
                );
            }

            const encryptedWallet =
                await wallet.encrypt(
                    FIXED_TEST_PASSWORD
                );

            const keystoreFilename =
                `${customer.customer_id}-` +
                `${wallet.address.toLowerCase()}.json`;

            const keystorePath = path.join(
                keystoreDirectory,
                keystoreFilename
            );

            await writeFile(
                keystorePath,
                encryptedWallet,
                {
                    encoding: "utf8",
                    mode: 0o600
                }
            );

            await chmod(
                keystorePath,
                0o600
            );

            generatedWallets.push({
                customerId: customer.customer_id,
                licenseId: customer.license_id,
                installId: customer.install_id,
                walletAddress: wallet.address,
                walletPublicKey: wallet.publicKey,
                encryptedWalletJson: encryptedWallet,
                derivationPath:
                    wallet.path ?? "m/44'/60'/0'/0/0"
            });

            publicRows.push(
                csvRow([
                    customer.customer_id,
                    customer.license_id,
                    customer.install_id,
                    wallet.address,
                    wallet.publicKey,
                    wallet.path ?? "m/44'/60'/0'/0/0",
                    path.relative(
                        outputDirectory,
                        keystorePath
                    )
                ])
            );

            privateRows.push(
                csvRow([
                    customer.customer_id,
                    customer.license_id,
                    customer.install_id,
                    wallet.address,
                    FIXED_TEST_PASSWORD,
                    wallet.mnemonic.phrase
                ])
            );

            console.log(
                `[${index + 1}/${customers.length}] ` +
                `Wallet generated for customer ` +
                `${customer.customer_id}`
            );
        }

        const publicFile = path.join(
            outputDirectory,
            "public-wallet-bindings.csv"
        );

        const privateFile = path.join(
            outputDirectory,
            "PRIVATE-recovery-credentials.csv"
        );

        await writeFile(
            publicFile,
            `${publicRows.join("\n")}\n`,
            {
                encoding: "utf8",
                mode: 0o600
            }
        );

        await writeFile(
            privateFile,
            `${privateRows.join("\n")}\n`,
            {
                encoding: "utf8",
                mode: 0o600
            }
        );

        await chmod(publicFile, 0o600);
        await chmod(privateFile, 0o600);

        await client.query("BEGIN");
        transactionStarted = true;

        for (const wallet of generatedWallets) {
            await client.query(
                `
                    INSERT INTO
                        vfort.license_user_wallet_test
                    (
                        customer_id,
                        source_license_id,
                        install_id,
                        wallet_address,
                        wallet_public_key,
                        encrypted_wallet_json,
                        wallet_type,
                        derivation_path,
                        recovery_word_count,
                        wallet_status
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
                        'ACTIVE'
                    )
                    ON CONFLICT (customer_id)
                    DO NOTHING
                `,
                [
                    wallet.customerId,
                    wallet.licenseId,
                    wallet.installId,
                    wallet.walletAddress,
                    wallet.walletPublicKey,
                    wallet.encryptedWalletJson,
                    wallet.derivationPath
                ]
            );
        }

        await client.query("COMMIT");
        transactionStarted = false;

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "[PASS] LICENSE WALLET GENERATION COMPLETED"
        );
        console.log(
            "============================================================"
        );
        console.log(
            `Generated wallets : ${generatedWallets.length}`
        );
        console.log(
            `Output directory  : ${outputDirectory}`
        );
        console.log(
            `Public file       : ${publicFile}`
        );
        console.log(
            `Private file      : ${privateFile}`
        );
        console.log("");
        console.log(
            "Do not display or paste the private credentials file."
        );
    } catch (error) {
        if (transactionStarted) {
            await client.query("ROLLBACK");
        }

        if (outputCreated) {
            await rm(
                outputDirectory,
                {
                    recursive: true,
                    force: true
                }
            );
        }

        throw error;
    } finally {
        await client.end().catch(() => {});
    }
}

main().catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
