import { Wallet, getAddress, verifyMessage } from "ethers";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

async function readStandardInput() {
    const chunks = [];

    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }

    return Buffer.concat(chunks).toString("utf8");
}

function normalizeStoredAddress(address) {
    const value = String(address ?? "")
        .trim()
        .replace(/^0x/i, "");

    return getAddress(`0x${value}`);
}

async function main() {
    const walletFile = process.argv[2];

    if (!walletFile) {
        throw new Error(
            "Wallet keystore file argument is required."
        );
    }

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

    const expectedAddress = normalizeStoredAddress(
        encryptedWallet.address
    );

    let recoveredWallet;

    try {
        recoveredWallet = Wallet.fromPhrase(
            recoveryPhrase
        );
    } catch {
        throw new Error(
            "The entered recovery phrase is invalid."
        );
    }

    const recoveredAddress = getAddress(
        recoveredWallet.address
    );

    if (recoveredAddress !== expectedAddress) {
        throw new Error(
            "The 12 recovery words do not belong to this wallet."
        );
    }

    const challenge =
        `VALOORES-LICENSE-RECOVERY-` +
        randomBytes(32).toString("hex");

    const signature = await recoveredWallet.signMessage(
        challenge
    );

    const signerAddress = getAddress(
        verifyMessage(challenge, signature)
    );

    if (signerAddress !== expectedAddress) {
        throw new Error(
            "Recovery challenge signature verification failed."
        );
    }

    console.log("");
    console.log(
        "============================================================"
    );
    console.log(
        "[PASS] 12-WORD LICENSE RECOVERY TEST COMPLETED"
    );
    console.log(
        "============================================================"
    );
    console.log(`Expected wallet : ${expectedAddress}`);
    console.log(`Recovered wallet: ${recoveredAddress}`);
    console.log("Recovery words  : 12");
    console.log("Addresses match : YES");
    console.log("Challenge signed: YES");
    console.log("Signature valid : YES");
    console.log("Password used   : NO");
    console.log("Recovery file   : NOT USED");
}

main().catch((error) => {
    console.error("");
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
