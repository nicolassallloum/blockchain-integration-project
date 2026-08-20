import { Wallet } from "ethers";
import { readFile } from "node:fs/promises";

async function main() {
    const walletFile = process.env.WALLET_FILE;
    const password = process.env.WALLET_PASSWORD;

    if (!walletFile) {
        throw new Error("WALLET_FILE is required.");
    }

    if (!password) {
        throw new Error("WALLET_PASSWORD is required.");
    }

    const encryptedJson = await readFile(walletFile, "utf8");

    const wallet = await Wallet.fromEncryptedJson(
        encryptedJson,
        password
    );

    console.log("[PASS] Wallet decrypted successfully");
    console.log(`Wallet address: ${wallet.address}`);
}

main().catch((error) => {
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
