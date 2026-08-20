import { Wallet } from "ethers";
import {
    chmod,
    readFile,
    writeFile
} from "node:fs/promises";

const walletFile = process.env.WALLET_FILE;
const walletPassword = process.env.WALLET_PASSWORD;
const recoveryFile = process.env.RECOVERY_FILE;

function required(value, name) {
    if (!value) {
        throw new Error(
            `Missing environment variable: ${name}`
        );
    }

    return value;
}

async function main() {
    required(walletFile, "WALLET_FILE");
    required(walletPassword, "WALLET_PASSWORD");
    required(recoveryFile, "RECOVERY_FILE");

    const encryptedWalletJson = await readFile(
        walletFile,
        "utf8"
    );

    const unlockedWallet =
        await Wallet.fromEncryptedJson(
            encryptedWalletJson,
            walletPassword
        );

    const recoveryPhrase =
        unlockedWallet.mnemonic?.phrase;

    if (!recoveryPhrase) {
        throw new Error(
            "This keystore does not contain recoverable " +
            "mnemonic metadata."
        );
    }

    const normalizedPhrase = recoveryPhrase
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const words = normalizedPhrase.split(" ");

    if (words.length !== 12) {
        throw new Error(
            `Expected 12 recovery words but found ${words.length}.`
        );
    }

    const reconstructedWallet =
        Wallet.fromPhrase(normalizedPhrase);

    if (
        reconstructedWallet.address.toLowerCase() !==
        unlockedWallet.address.toLowerCase()
    ) {
        throw new Error(
            "The reconstructed wallet address does not match."
        );
    }

    await writeFile(
        recoveryFile,
        `${normalizedPhrase}\n`,
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    await chmod(recoveryFile, 0o600);

    console.log(
        "[PASS] Recovery phrase extracted securely"
    );

    console.log(
        "[PASS] Recovery phrase contains 12 words"
    );

    console.log(
        "[PASS] Recovery phrase recreated the same wallet"
    );

    console.log(
        `Wallet address: ${unlockedWallet.address}`
    );

    console.log(
        `Protected recovery file: ${recoveryFile}`
    );

    console.log(
        "The recovery words were not printed."
    );
}

main().catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
