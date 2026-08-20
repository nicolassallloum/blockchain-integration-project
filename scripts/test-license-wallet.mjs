import { Wallet } from "ethers";
import { writeFile, chmod } from "node:fs/promises";

async function main() {
    const password = process.env.WALLET_PASSWORD;

    if (!password || password.length < 12) {
        throw new Error(
            "WALLET_PASSWORD must contain at least 12 characters."
        );
    }

    const wallet = Wallet.createRandom();

    if (!wallet.mnemonic) {
        throw new Error("Unable to generate the recovery phrase.");
    }

    const recoveryWords = wallet.mnemonic.phrase;
    const encryptedWalletJson = await wallet.encrypt(password);

    const outputFile =
        `wallet-${wallet.address.toLowerCase()}.json`;

    await writeFile(
        outputFile,
        encryptedWalletJson,
        {
            encoding: "utf8",
            mode: 0o600
        }
    );

    await chmod(outputFile, 0o600);

    console.log("");
    console.log("=================================================");
    console.log("LICENSE WALLET GENERATED SUCCESSFULLY");
    console.log("=================================================");
    console.log(`Wallet Address   : ${wallet.address}`);
    console.log(`Wallet Public Key: ${wallet.publicKey}`);
    console.log(`Derivation Path  : ${wallet.path}`);
    console.log(`Encrypted Wallet : ${outputFile}`);
    console.log("");
    console.log("=================================================");
    console.log("12 RECOVERY WORDS — DISPLAY ONCE");
    console.log("=================================================");

    recoveryWords
        .split(" ")
        .forEach((word, index) => {
            console.log(
                `${String(index + 1).padStart(2, "0")}. ${word}`
            );
        });

    console.log("");
    console.log("IMPORTANT:");
    console.log("- Do not save the recovery words in PostgreSQL.");
    console.log("- Do not save the recovery words on Fabric.");
    console.log("- Do not store the plain password.");
    console.log("- Store only the encrypted wallet JSON.");
    console.log("=================================================");
}

main().catch((error) => {
    console.error("");
    console.error("Wallet generation failed:");
    console.error(error.message);
    process.exit(1);
});
