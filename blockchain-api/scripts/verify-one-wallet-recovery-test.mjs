import { Wallet } from "ethers";
import { readFile } from "node:fs/promises";

const walletFile = process.env.WALLET_FILE;
const recoveryFile = process.env.RECOVERY_FILE;

function normalizeAddress(value) {
    const address = String(value ?? "")
        .trim()
        .toLowerCase();

    return address.startsWith("0x")
        ? address
        : `0x${address}`;
}

async function main() {
    if (!walletFile) {
        throw new Error("WALLET_FILE is required.");
    }

    if (!recoveryFile) {
        throw new Error("RECOVERY_FILE is required.");
    }

    /*
     * Read only the public address from the encrypted JSON.
     * The wallet password is not required.
     */
    const encryptedWallet = JSON.parse(
        await readFile(walletFile, "utf8")
    );

    const expectedAddress =
        normalizeAddress(encryptedWallet.address);

    const recoveryPhrase = (
        await readFile(recoveryFile, "utf8")
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const words = recoveryPhrase.split(" ");

    if (words.length !== 12) {
        throw new Error(
            `Expected 12 recovery words but found ${words.length}.`
        );
    }

    const recoveredWallet =
        Wallet.fromPhrase(recoveryPhrase);

    const recoveredAddress =
        normalizeAddress(
            recoveredWallet.address
        );

    if (recoveredAddress !== expectedAddress) {
        throw new Error(
            "Recovery words generated the wrong wallet address."
        );
    }

    const challenge =
        `LICENSE-RECOVERY-TEST-${Date.now()}`;

    const signature =
        await recoveredWallet.signMessage(
            challenge
        );

    if (!signature) {
        throw new Error(
            "Recovery wallet could not sign the challenge."
        );
    }

    console.log("");
    console.log(
        "============================================================"
    );

    console.log(
        "[PASS] PASSWORD-FREE RECOVERY TEST COMPLETED"
    );

    console.log(
        "============================================================"
    );

    console.log(
        "Recovery word count : 12"
    );

    console.log(
        `Expected address    : ${expectedAddress}`
    );

    console.log(
        `Recovered address   : ${recoveredAddress}`
    );

    console.log(
        "Addresses match     : YES"
    );

    console.log(
        "Challenge signed    : YES"
    );

    console.log(
        "Wallet password used: NO"
    );
}

main().catch((error) => {
    console.error("");
    console.error(`[FAIL] ${error.message}`);
    process.exit(1);
});
