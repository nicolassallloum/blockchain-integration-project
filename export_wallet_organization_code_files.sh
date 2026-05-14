#!/bin/bash

OUTPUT_FILE="wallet_organization_code_update_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "WALLET CREATION - ORGANIZATION_CODE UPDATE FILES" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

add_file () {
  FILE_PATH="$1"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "FILE: $FILE_PATH" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  if [ -f "$FILE_PATH" ]; then
    sed -n '1,700p' "$FILE_PATH" >> "$OUTPUT_FILE"
  else
    echo "NOT FOUND: $FILE_PATH" >> "$OUTPUT_FILE"
  fi
}

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND WALLET FILES ================" >> "$OUTPUT_FILE"

add_file "blockchain-api/src/controllers/wallet.controller.js"
add_file "blockchain-api/src/services/wallet.service.js"
add_file "blockchain-api/src/routes/wallet.routes.js"
add_file "blockchain-api/src/db/pool.js"
add_file "blockchain-api/src/db/queries/wallet.queries.js"
add_file "blockchain-api/src/repositories/wallet.repository.js"

echo "" >> "$OUTPUT_FILE"
echo "================ FRONTEND WALLET FILES ================" >> "$OUTPUT_FILE"

add_file "blockchain-test-ui/src/app/features/wallet-create/wallet-create.component.ts"
add_file "blockchain-test-ui/src/app/features/wallet-create/wallet-create.component.html"
add_file "blockchain-test-ui/src/app/features/wallet-create/wallet-create.component.scss"
add_file "blockchain-test-ui/src/app/pages/dashboard/dashboard.ts"
add_file "blockchain-test-ui/src/app/pages/dashboard/dashboard.html"
add_file "blockchain-test-ui/src/app/services/blockchain-api.service.ts"

echo "" >> "$OUTPUT_FILE"
echo "================ SEARCH RESULTS ================" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

echo "---- Backend organization references ----" >> "$OUTPUT_FILE"
grep -Rni "organization_id\|organizationId\|organization_code\|organizationCode" blockchain-api/src 2>/dev/null >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "---- Frontend organization references ----" >> "$OUTPUT_FILE"
grep -Rni "organization_id\|organizationId\|organization_code\|organizationCode" blockchain-test-ui/src/app 2>/dev/null >> "$OUTPUT_FILE"

echo ""
echo "Done."
echo "Output file created:"
echo "$OUTPUT_FILE"
