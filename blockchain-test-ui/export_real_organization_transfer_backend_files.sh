#!/bin/bash

OUTPUT_FILE="real_organization_transfer_backend_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "REAL ORGANIZATION TRANSFER BACKEND FILE EXPORT" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ PROJECT TREE SEARCH ================" >> "$OUTPUT_FILE"
find . -type f \( \
  -iname "server.js" -o \
  -iname "app.js" -o \
  -iname "*transaction*.js" -o \
  -iname "*wallet*.js" -o \
  -iname "*fabric*.js" -o \
  -iname "*route*.js" -o \
  -iname "*controller*.js" -o \
  -iname "*service*.js" \
\) | sort >> "$OUTPUT_FILE"

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

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND ROUTE SEARCH ================" >> "$OUTPUT_FILE"
grep -R "organization-transfer\|wallet-transfer\|transactions\|TransferToOrganization\|TransferBetweenWallets" -n . \
  --include="*.js" \
  --exclude-dir=node_modules \
  --exclude-dir=dist \
  --exclude-dir=build \
  >> "$OUTPUT_FILE" 2>/dev/null || true

echo "" >> "$OUTPUT_FILE"
echo "================ LIKELY BACKEND FILES ================" >> "$OUTPUT_FILE"

BACKEND_DIR="blockchain-api"

add_file "$BACKEND_DIR/server.js"
add_file "$BACKEND_DIR/app.js"
add_file "$BACKEND_DIR/src/server.js"
add_file "$BACKEND_DIR/src/app.js"

add_file "$BACKEND_DIR/routes/transaction.routes.js"
add_file "$BACKEND_DIR/src/routes/transaction.routes.js"
add_file "$BACKEND_DIR/routes/transactions.routes.js"
add_file "$BACKEND_DIR/src/routes/transactions.routes.js"

add_file "$BACKEND_DIR/controllers/transaction.controller.js"
add_file "$BACKEND_DIR/src/controllers/transaction.controller.js"
add_file "$BACKEND_DIR/controllers/transactions.controller.js"
add_file "$BACKEND_DIR/src/controllers/transactions.controller.js"

add_file "$BACKEND_DIR/services/transaction.service.js"
add_file "$BACKEND_DIR/src/services/transaction.service.js"
add_file "$BACKEND_DIR/services/fabric.service.js"
add_file "$BACKEND_DIR/src/services/fabric.service.js"

add_file "$BACKEND_DIR/middlewares/error.middleware.js"
add_file "$BACKEND_DIR/src/middlewares/error.middleware.js"

echo ""
echo "Export completed:"
echo "/u01/blockchain-integration/$OUTPUT_FILE"
