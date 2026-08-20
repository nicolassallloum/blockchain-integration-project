import { Wallet } from "ethers";
import { readFile } from "node:fs/promises";

async function main() {
    const walletFile = process.env.WALLET_FILE;
    const recoveryPhrase = process.env.RECOVERY_PHRASE;

    if (!walletFile) {
        throw new Error("WALLET_FILE is required.");
    }

    if (!recoveryPhrase) {
        throw new Error("RECOVERY_PHRASE is required.");
    }

    const normalizedPhrase = recoveryPhrase
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const words = normalizedPhrase.split(" ");

    if (words.length !== 12) {
        throw new Error(
            `Exactly 12 recovery words are required; received ${words.length}.`
        );
    }

    const encryptedJson = JSON.parse(
        await readFile(walletFile, "utf8")
    );

    const expectedAddress =
        `0x${encryptedJson.address}`.toLowerCase();

    const recoveredWallet =
        Wallet.fromPhrase(normalizedPhrase);

    const recoveredAddress =
        recoveredWallet.address.toLowerCase();

    if (expectedAddress !== recoveredAddress) {
        throw new Error(
            "The recovery words do not belong to this wallet."
        );
    }

    console.log(
        "[PASS] Recovery words reconstructed the correct wallet"
    );
    console.log(`Wallet address: ${recoveredWallet.address}`);
}

main().catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
