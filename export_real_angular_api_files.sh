#!/bin/bash

OUTPUT_FILE="real_angular_api_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "REAL ANGULAR API FILE EXPORT" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "Current folder: $(pwd)" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR PROJECT SEARCH ================" >> "$OUTPUT_FILE"
find . -maxdepth 4 -type f \( \
  -name "angular.json" -o \
  -name "package.json" -o \
  -name "environment.ts" -o \
  -name "environment.development.ts" -o \
  -name "*transaction*.ts" -o \
  -name "*api*.ts" -o \
  -name "*interceptor*.ts" -o \
  -name "*organization-transfer*.ts" \
\) | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ API SEARCH ================" >> "$OUTPUT_FILE"
grep -R "apiBaseUrl\|baseUrl\|4200\|3001\|x-api-key\|organization-transfer\|INTERNAL_API_KEY" -n . \
  --include="*.ts" \
  --include="*.json" \
  --include="*.html" \
  --exclude-dir=node_modules \
  --exclude-dir=.angular \
  --exclude-dir=dist \
  --exclude-dir=blockchain-api \
  >> "$OUTPUT_FILE" 2>/dev/null || true

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

add_file "blockchain-test-ui/src/environments/environment.ts"
add_file "blockchain-test-ui/src/environments/environment.development.ts"
add_file "blockchain-test-ui/src/app/services/transaction.service.ts"
add_file "blockchain-test-ui/src/app/core/services/transaction-api.service.ts"
add_file "blockchain-test-ui/src/app/core/services/api-config.service.ts"
add_file "blockchain-test-ui/src/app/core/interceptors/api-auth.interceptor.ts"
add_file "blockchain-test-ui/src/app/features/transactions/organization-transfer/organization-transfer.component.ts"
add_file "blockchain-test-ui/src/app/features/transactions/organization-transfer/organization-transfer.component.html"
add_file "blockchain-test-ui/angular.json"
add_file "blockchain-test-ui/package.json"

echo ""
echo "Export completed:"
echo "$(pwd)/$OUTPUT_FILE"
