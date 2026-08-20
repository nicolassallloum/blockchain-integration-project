import pg from "pg";
import { Wallet } from "ethers";
import {
    readFile,
    readdir,
    stat
} from "node:fs/promises";
import path from "node:path";

const { Client } = pg;

const keystoreDirectory =
    process.env.KEYSTORE_DIR;

const fixedTestPassword =
    "123456789012";

function required(name) {
    const value = process.env[name];

    if (!value) {
        throw new Error(
            `Missing environment variable: ${name}`
        );
    }

    return value;
}

function normalizeAddress(value) {
    const address = String(value ?? "")
        .trim()
        .toLowerCase();

    return address.startsWith("0x")
        ? address
        : `0x${address}`;
}

async function main() {
    if (
        !keystoreDirectory
    ) {
        throw new Error(
            "KEYSTORE_DIR environment variable is required."
        );
    }

    const client = new Client({
        host: required("POSTGRES_HOST"),
        port: Number(
            required("POSTGRES_PORT")
        ),
        database: required(
            "POSTGRES_DATABASE"
        ),
        user: required("POSTGRES_USER"),
        password: required(
            "POSTGRES_PASSWORD"
        ),
        connectionTimeoutMillis: 10000
    });

    await client.connect();

    try {
        const result = await client.query(`
            SELECT
                customer_id::text AS customer_id,
                source_license_id::text
                    AS source_license_id,
                install_id::text AS install_id,
                wallet_address,
                wallet_status
            FROM
                vfort.license_user_wallet_test
            ORDER BY
                customer_id
        `);

        const databaseWallets = result.rows;

        const allFiles = await readdir(
            keystoreDirectory
        );

        const keystoreFiles = allFiles.filter(
            (filename) =>
                filename.endsWith(".json")
        );

        console.log(
            `Database wallets : ${databaseWallets.length}`
        );

        console.log(
            `Keystore files   : ${keystoreFiles.length}`
        );

        if (
            databaseWallets.length !==
            keystoreFiles.length
        ) {
            throw new Error(
                "Database wallet count does not match " +
                "the keystore file count."
            );
        }

        const decryptedAddresses =
            new Set();

        let permissionPassed = 0;
        let passwordPassed = 0;
        let databasePassed = 0;

        for (
            let index = 0;
            index < databaseWallets.length;
            index += 1
        ) {
            const databaseWallet =
                databaseWallets[index];

            const matchingFiles =
                keystoreFiles.filter(
                    (filename) =>
                        filename.startsWith(
                            `${databaseWallet.customer_id}-`
                        )
                );

            if (
                matchingFiles.length !== 1
            ) {
                throw new Error(
                    `Customer ${databaseWallet.customer_id}: ` +
                    `expected one keystore but found ` +
                    `${matchingFiles.length}.`
                );
            }

            const keystorePath = path.join(
                keystoreDirectory,
                matchingFiles[0]
            );

            const fileStat =
                await stat(keystorePath);

            const permission =
                fileStat.mode & 0o777;

            if (
                permission !== 0o600
            ) {
                throw new Error(
                    `Customer ${databaseWallet.customer_id}: ` +
                    `file permission is ` +
                    `${permission.toString(8)} instead of 600.`
                );
            }

            permissionPassed += 1;

            const encryptedJson =
                await readFile(
                    keystorePath,
                    "utf8"
                );

            const decryptedWallet =
                await Wallet.fromEncryptedJson(
                    encryptedJson,
                    fixedTestPassword
                );

            passwordPassed += 1;

            const decryptedAddress =
                normalizeAddress(
                    decryptedWallet.address
                );

            const databaseAddress =
                normalizeAddress(
                    databaseWallet.wallet_address
                );

            if (
                decryptedAddress !==
                databaseAddress
            ) {
                throw new Error(
                    `Customer ${databaseWallet.customer_id}: ` +
                    `database address ${databaseAddress} ` +
                    `does not match decrypted address ` +
                    `${decryptedAddress}.`
                );
            }

            if (
                decryptedAddresses.has(
                    decryptedAddress
                )
            ) {
                throw new Error(
                    `Duplicate wallet address detected: ` +
                    decryptedAddress
                );
            }

            decryptedAddresses.add(
                decryptedAddress
            );

            databasePassed += 1;

            console.log(
                `[PASS ${index + 1}/` +
                `${databaseWallets.length}] ` +
                `Customer ${databaseWallet.customer_id}`
            );
        }

        const firstFile = path.join(
            keystoreDirectory,
            keystoreFiles[0]
        );

        const firstEncryptedJson =
            await readFile(
                firstFile,
                "utf8"
            );

        let wrongPasswordRejected = false;

        try {
            await Wallet.fromEncryptedJson(
                firstEncryptedJson,
                "WRONG_PASSWORD_123"
            );
        } catch {
            wrongPasswordRejected = true;
        }

        if (
            !wrongPasswordRejected
        ) {
            throw new Error(
                "Wrong password was unexpectedly accepted."
            );
        }

        console.log("");
        console.log(
            "============================================================"
        );
        console.log(
            "[PASS] WALLET AND DATABASE TEST COMPLETED"
        );
        console.log(
            "============================================================"
        );
        console.log(
            `Wallets tested          : ${databaseWallets.length}`
        );
        console.log(
            `Password tests passed   : ${passwordPassed}`
        );
        console.log(
            `Database matches passed : ${databasePassed}`
        );
        console.log(
            `Permission tests passed : ${permissionPassed}`
        );
        console.log(
            `Unique addresses        : ${decryptedAddresses.size}`
        );
        console.log(
            "Wrong password rejected : YES"
        );
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error("");
    console.error(
        `[FAIL] ${error.message}`
    );
    process.exit(1);
});
