#!/bin/bash

OUTPUT_FILE="organization_transfer_backend_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "ORGANIZATION TRANSFER BACKEND FILE EXPORT" >> "$OUTPUT_FILE"
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

add_file "src/app.js"
add_file "src/server.js"
add_file "src/routes/transaction.routes.js"
add_file "src/controllers/transaction.controller.js"
add_file "src/services/transaction.service.js"
add_file "src/services/fabric.service.js"
add_file "src/middlewares/error.middleware.js"

echo "" >> "$OUTPUT_FILE"
echo "================ ROUTE SEARCH ================" >> "$OUTPUT_FILE"
grep -R "organization-transfer\|wallet-transfer\|transactions" -n src >> "$OUTPUT_FILE" 2>/dev/null || true

echo ""
echo "Export completed: $OUTPUT_FILE"
