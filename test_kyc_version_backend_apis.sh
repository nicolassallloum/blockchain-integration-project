#!/usr/bin/env bash

set -Eeuo pipefail

CUSTOMER_ID="991785320715307182"
BASE_URL="http://127.0.0.1:3001/api/v1/valoores-blockchain"

RESULT_DIR="$HOME/u01/blockchain-integration/versioning-api-test-results"
mkdir -p "$RESULT_DIR"

request() {
  local url="$1"
  local output="$2"

  curl \
    --fail-with-body \
    --silent \
    --show-error \
    "$url" \
    --output "$output"

  jq . "$output"
}

echo "============================================================"
echo "1. LATEST VERSION"
echo "============================================================"

request \
  "${BASE_URL}/customers/${CUSTOMER_ID}/versions/latest" \
  "${RESULT_DIR}/latest.json"

echo
echo "============================================================"
echo "2. ALL VERSIONS"
echo "============================================================"

request \
  "${BASE_URL}/customers/${CUSTOMER_ID}/versions" \
  "${RESULT_DIR}/versions.json"

echo
echo "============================================================"
echo "3. VERSION 1"
echo "============================================================"

request \
  "${BASE_URL}/customers/${CUSTOMER_ID}/versions/1" \
  "${RESULT_DIR}/version_1.json"

echo
echo "============================================================"
echo "4. VERSION 2"
echo "============================================================"

request \
  "${BASE_URL}/customers/${CUSTOMER_ID}/versions/2" \
  "${RESULT_DIR}/version_2.json"

echo
echo "============================================================"
echo "5. VERSION COMPARISON"
echo "============================================================"

request \
  "${BASE_URL}/customers/${CUSTOMER_ID}/versions/compare?oldVersion=1&newVersion=2" \
  "${RESULT_DIR}/comparison_1_2.json"

jq -e '
  .success == true
  and
  .blockchain.functionName == "GetLatestResidentVersion"
  and
  .data.versionNumber == 2
  and
  .data.versionOperation == "UPDATE"
' "${RESULT_DIR}/latest.json" >/dev/null

jq -e '
  .success == true
  and
  .blockchain.functionName == "GetResidentVersions"
  and
  (.data.versions | length) == 2
  and
  .data.versions[0].versionNumber == 1
  and
  .data.versions[1].versionNumber == 2
' "${RESULT_DIR}/versions.json" >/dev/null

jq -e '
  .success == true
  and
  .blockchain.functionName == "GetResidentVersion"
  and
  .data.versionNumber == 1
  and
  .data.versionOperation == "CREATE"
  and
  .data.payload.formData.STATUS_NAME == "Draft"
' "${RESULT_DIR}/version_1.json" >/dev/null

jq -e '
  .success == true
  and
  .blockchain.functionName == "GetResidentVersion"
  and
  .data.versionNumber == 2
  and
  .data.versionOperation == "UPDATE"
  and
  .data.payload.formData.STATUS_NAME == "Submitted"
' "${RESULT_DIR}/version_2.json" >/dev/null

jq -e '
  .success == true
  and
  .blockchain.functionName == "CompareResidentVersions"
  and
  .data.oldVersionNumber == 1
  and
  .data.newVersionNumber == 2
  and
  .data.changeCount == 7
' "${RESULT_DIR}/comparison_1_2.json" >/dev/null

echo
echo "============================================================"
echo "KYC VERSION BACKEND API TEST PASSED"
echo "============================================================"
echo "Customer ID        : $CUSTOMER_ID"
echo "Latest version     : 2"
echo "Versions returned  : 2"
echo "Comparison changes : 7"
echo "Results directory  : $RESULT_DIR"
