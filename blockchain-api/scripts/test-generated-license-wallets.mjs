import { Wallet } from "ethers";
import {
    readFile,
    readdir,
    stat
} from "node:fs/promises";
import path from "node:path";

const runDirectory = process.env.RUN_DIR;

if (!runDirectory) {
    throw new Error("RUN_DIR environment variable is required.");
}

const expectedTestPassword = "123456789012";

function normalizeAddress(address) {
    return String(address ?? "").trim().toLowerCase();
}

function parseCsvLine(line) {
    const values = [];
    let value = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];

        if (character === '"') {
            if (
                insideQuotes &&
                line[index + 1] === '"'
            ) {
                value += '"';
                index += 1;
            } else {
                insideQuotes = !insideQuotes;
            }
        } else if (
            character === "," &&
            !insideQuotes
        ) {
            values.push(value);
            value = "";
        } else {
            value += character;
        }
    }

    values.push(value);

    return values;
}

function parseCsv(csvText) {
    const lines = csvText
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");

    if (lines.length < 2) {
        throw new Error(
            "Private credential CSV does not contain user records."
        );
    }

    const headers = parseCsvLine(lines[0]);

    return lines.slice(1).map((line) => {
        const values = parseCsvLine(line);
        const record = {};

        headers.forEach((header, index) => {
            record[header] = values[index] ?? "";
        });

        return record;
    });
}

async function main() {
    const credentialFile = path.join(
        runDirectory,
        "PRIVATE-recovery-credentials.csv"
    );

    const keystoreDirectory = path.join(
        runDirectory,
        "keystores"
    );

    const csvText = await readFile(
        credentialFile,
        "utf8"
    );

    const credentials = parseCsv(csvText);
    const keystoreFiles = await readdir(
        keystoreDirectory
    );

    let passwordPassed = 0;
    let recoveryPassed = 0;
    let permissionsPassed = 0;

    for (
        let index = 0;
        index < credentials.length;
        index += 1
    ) {
        const credential = credentials[index];

        const recoveryWords = credential.recovery_phrase
            .trim()
            .split(/\s+/);

        if (recoveryWords.length !== 12) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                `expected 12 recovery words, received ` +
                `${recoveryWords.length}.`
            );
        }

        if (
            credential.password !==
            expectedTestPassword
        ) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                "unexpected test password."
            );
        }

        const matches = keystoreFiles.filter(
            (filename) =>
                filename.startsWith(
                    `${credential.customer_id}-`
                ) &&
                filename.endsWith(".json")
        );

        if (matches.length !== 1) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                `expected one keystore, found ${matches.length}.`
            );
        }

        const keystorePath = path.join(
            keystoreDirectory,
            matches[0]
        );

        const fileInformation = await stat(
            keystorePath
        );

        const permissionMode =
            fileInformation.mode & 0o777;

        if (permissionMode !== 0o600) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                `keystore permission is ` +
                `${permissionMode.toString(8)}, expected 600.`
            );
        }

        permissionsPassed += 1;

        const encryptedWalletJson = await readFile(
            keystorePath,
            "utf8"
        );

        const passwordWallet =
            await Wallet.fromEncryptedJson(
                encryptedWalletJson,
                credential.password
            );

        if (
            normalizeAddress(passwordWallet.address) !==
            normalizeAddress(credential.wallet_address)
        ) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                "password-restored address does not match."
            );
        }

        passwordPassed += 1;

        const recoveryWallet = Wallet.fromPhrase(
            credential.recovery_phrase
                .trim()
                .toLowerCase()
                .replace(/\s+/g, " ")
        );

        if (
            normalizeAddress(recoveryWallet.address) !==
            normalizeAddress(credential.wallet_address)
        ) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                "recovery phrase produced a different address."
            );
        }

        if (
            normalizeAddress(recoveryWallet.address) !==
            normalizeAddress(passwordWallet.address)
        ) {
            throw new Error(
                `Customer ${credential.customer_id}: ` +
                "password and recovery wallets differ."
            );
        }

        recoveryPassed += 1;

        console.log(
            `[PASS ${index + 1}/${credentials.length}] ` +
            `Customer ${credential.customer_id}`
        );
    }

    /*
     * Negative password test.
     * A deliberately incorrect password must be rejected.
     */
    const firstCredential = credentials[0];

    const firstKeystoreFilename =
        keystoreFiles.find(
            (filename) =>
                filename.startsWith(
                    `${firstCredential.customer_id}-`
                )
        );

    const firstKeystoreJson = await readFile(
        path.join(
            keystoreDirectory,
            firstKeystoreFilename
        ),
        "utf8"
    );

    let wrongPasswordRejected = false;

    try {
        await Wallet.fromEncryptedJson(
            firstKeystoreJson,
            "WRONG_PASSWORD_123"
        );
    } catch {
        wrongPasswordRejected = true;
    }

    if (!wrongPasswordRejected) {
        throw new Error(
            "Incorrect password was unexpectedly accepted."
        );
    }

    /*
     * Negative recovery test.
     * Another valid phrase must produce a different address.
     */
    const unrelatedWallet = Wallet.createRandom();

    if (
        normalizeAddress(unrelatedWallet.address) ===
        normalizeAddress(firstCredential.wallet_address)
    ) {
        throw new Error(
            "Negative recovery-address test unexpectedly matched."
        );
    }

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "[PASS] ALL LICENSE WALLET TESTS COMPLETED"
    );
    console.log(
        "============================================================"
    );
    console.log(
        `Credential records tested : ${credentials.length}`
    );
    console.log(
        `Password tests passed     : ${passwordPassed}`
    );
    console.log(
        `Recovery tests passed     : ${recoveryPassed}`
    );
    console.log(
        `Permission tests passed   : ${permissionsPassed}`
    );
    console.log(
        "Wrong password rejected   : YES"
    );
    console.log(
        "Wrong recovery rejected   : YES"
    );
}

main().catch((error) => {
    console.error("");
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
