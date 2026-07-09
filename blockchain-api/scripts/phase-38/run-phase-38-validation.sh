#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="/home/nix/u01/blockchain-integration"
OUTPUT_DIR="$ROOT_DIR/inspection-output/phase-38-validation-$(date +%Y%m%d_%H%M%S)"

mkdir -p "$OUTPUT_DIR"

echo "Phase 38 full blockchain validation"
echo "Output: $OUTPUT_DIR"

cd "$ROOT_DIR"
pwd | tee "$OUTPUT_DIR/root-pwd.txt"
git status --short | tee "$OUTPUT_DIR/git-status-before.txt"

cd "$ROOT_DIR/blockchain-api"

echo "== Backend Fabric validation script syntax =="
node --check scripts/test-fabric-connection.js | tee "$OUTPUT_DIR/backend-fabric-test-syntax.txt"

echo "== Backend hash tests =="
npm run test:hash | tee "$OUTPUT_DIR/backend-test-hash.txt"

echo "== Backend blockchain key tests =="
npm run test:key | tee "$OUTPUT_DIR/backend-test-key.txt"

echo "== Backend Fabric SDK test =="
npm run fabric:test | tee "$OUTPUT_DIR/backend-fabric-test.txt"

cd "$ROOT_DIR/chaincode/kyc-wallet-chaincode-js"

echo "== Chaincode syntax check =="
npm run check:syntax | tee "$OUTPUT_DIR/chaincode-syntax.txt"

echo "== Chaincode Phase 10 proof test =="
node tests/phase10-proof.test.js | tee "$OUTPUT_DIR/chaincode-phase10-proof-test.txt"

echo "== Chaincode Phase 28 audit proof test =="
node tests/phase28-audit-proof.test.js | tee "$OUTPUT_DIR/chaincode-phase28-audit-proof-test.txt"

cd "$ROOT_DIR"

echo "== Git status after validation =="
git status --short | tee "$OUTPUT_DIR/git-status-after.txt"

echo "Phase 38 full blockchain validation completed successfully."
echo "Evidence saved to: $OUTPUT_DIR"
