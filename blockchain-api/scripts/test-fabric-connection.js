require("@dotenvx/dotenvx").config();

const fabricService = require("../src/services/fabric.service");

async function main() {
  console.log("Fabric SDK connection validation");
  console.log("==============================");

  console.log("\n1. Checking fabric service methods...");
  const requiredMethods = ["connect", "evaluateTransaction", "submitTransaction", "disconnect"];

  for (const methodName of requiredMethods) {
    if (typeof fabricService[methodName] !== "function") {
      throw new Error(`Missing fabricService.${methodName} method`);
    }

    console.log(`OK: fabricService.${methodName} exists`);
  }

  console.log("\n2. Checking configured connection...");
  const connection = await fabricService.connect();

  if (!connection || !connection.network || !connection.contract) {
    throw new Error("Fabric connection did not return network and contract objects");
  }

  console.log("OK: Fabric gateway connected");
  console.log(`Channel: ${connection.channelName || process.env.FABRIC_CHANNEL_NAME || "kycchannelnix1"}`);
  console.log(`Chaincode: ${connection.chaincodeName || process.env.FABRIC_CHAINCODE_NAME || "kyc-wallet-chaincode-js"}`);

  console.log("\n3. Testing read-only chaincode evaluation using GetHistoryForKey...");
  const historyResult = await fabricService.evaluateTransaction(
    "GetHistoryForKey",
    ["PHASE_38_FABRIC_CONNECTION_TEST_KEY"],
    {
      sourceSystem: "BLOCKCHAIN_API",
      requestSource: "PHASE_38_FABRIC_TEST",
      createdBy: "phase-38-test"
    }
  );

  console.log("OK: Chaincode evaluate transaction completed");
  console.log(JSON.stringify(historyResult, null, 2));

  console.log("\n4. Closing Fabric connection...");
  await fabricService.disconnect();

  console.log("\nFabric SDK connection validation completed.");
}

main().catch(async (error) => {
  console.error("Fabric SDK connection validation failed.");
  console.error(error);

  try {
    if (fabricService && typeof fabricService.disconnect === "function") {
      await fabricService.disconnect();
    }
  } catch (disconnectError) {
    console.error("Fabric disconnect also failed:", disconnectError.message);
  }

  process.exit(1);
});
