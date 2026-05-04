"use strict";

require("dotenv").config();

const fabricService = require("../src/services/fabric.service");

async function main() {
  console.log("==================================================");
  console.log("STEP 20 — Fabric SDK Connection Test");
  console.log("==================================================");

  console.log("\n1. Checking Fabric SDK configuration...");
  const info = fabricService.getConnectionInfo();
  console.log(JSON.stringify(info, null, 2));

  console.log("\n2. Testing chaincode evaluate transaction...");

  const functionName =
    process.env.FABRIC_TEST_FUNCTION ||
    "GetWalletBalance";

  const args = process.env.FABRIC_TEST_ARGS
    ? JSON.parse(process.env.FABRIC_TEST_ARGS)
    : ["WALLET_TEST_ADDRESS"];

  const result = await fabricService.evaluateTransaction(
    functionName,
    args
  );

  console.log("\n3. Fabric evaluate result:");
  console.log(JSON.stringify(result, null, 2));

  if (!result.success) {
    console.log("\nConnection reached the SDK layer, but chaincode evaluation failed.");
    console.log("This may be normal if the test wallet does not exist.");
    process.exit(1);
  }

  console.log("\nFabric SDK connection test completed successfully.");
}

main().catch((error) => {
  console.error("Fabric SDK connection test failed.");
  console.error(error);
  process.exit(1);
});
