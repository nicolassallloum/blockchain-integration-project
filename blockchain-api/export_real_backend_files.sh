#!/bin/bash

OUTPUT_FILE="real_backend_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "REAL BLOCKCHAIN API BACKEND FILE EXPORT" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "Current folder: $(pwd)" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ FILE TREE ================" >> "$OUTPUT_FILE"
find . -maxdepth 4 -type f \( \
  -name "server.js" -o \
  -name "app.js" -o \
  -name "index.js" -o \
  -name "*transaction*.js" -o \
  -name "*wallet*.js" -o \
  -name "*fabric*.js" -o \
  -name "*auth*.js" -o \
  -name "*api*.js" \
\) | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ ROUTE / API KEY SEARCH ================" >> "$OUTPUT_FILE"
grep -R "organization-transfer\|wallet-transfer\|transactions\|x-api-key\|INVALID_API_KEY\|INTERNAL_API_KEY\|API_KEY\|Unauthorized service request" -n . \
  --include="*.js" \
  --include=".env" \
  --exclude-dir=node_modules \
  --exclude-dir=logs \
  >> "$OUTPUT_FILE" 2>/dev/null || true

add_file () {
  FILE_PATH="$1"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "FILE: $FILE_PATH" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  if [ -f "$FILE_PATH" ]; then
    sed -n '1,900p' "$FILE_PATH" >> "$OUTPUT_FILE"
  else
    echo "NOT FOUND: $FILE_PATH" >> "$OUTPUT_FILE"
  fi
}

add_file ".env"
add_file "server.js"
add_file "app.js"
add_file "index.js"
add_file "config/config.js"

add_file "routes/transaction.routes.js"
add_file "src/routes/transaction.routes.js"

add_file "controllers/transaction.controller.js"
add_file "src/controllers/transaction.controller.js"

add_file "services/transaction.service.js"
add_file "src/services/transaction.service.js"

add_file "services/fabric.service.js"
add_file "src/services/fabric.service.js"

add_file "middlewares/auth.middleware.js"
add_file "src/middlewares/auth.middleware.js"
add_file "middlewares/api-key.middleware.js"
add_file "src/middlewares/api-key.middleware.js"

echo ""
echo "Export completed:"
echo "$(pwd)/$OUTPUT_FILE"
