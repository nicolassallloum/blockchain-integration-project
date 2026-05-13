#!/bin/bash

OUTPUT_FILE="enterprise_persistence_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "BLOCKCHAIN ENTERPRISE PERSISTENCE FILE EXPORT" >> "$OUTPUT_FILE"
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

add_file "blockchain-api/package.json"
add_file "blockchain-api/.env.example"

add_file "blockchain-api/src/app.js"
add_file "blockchain-api/src/server.js"
add_file "blockchain-api/src/index.js"

add_file "blockchain-api/src/config/config.js"
add_file "blockchain-api/src/config/app.config.js"
add_file "blockchain-api/src/config/blockchain.config.js"
add_file "blockchain-api/src/config/database.js"
add_file "blockchain-api/src/config/env.validator.js"
add_file "blockchain-api/src/config/index.js"
add_file "blockchain-api/src/config/logger.config.js"

add_file "blockchain-api/src/database/postgres.js"

add_file "blockchain-api/src/repositories/blockchain.repository.js"

add_file "blockchain-api/src/services/wallet.service.js"
add_file "blockchain-api/src/services/wallet-query.service.js"
add_file "blockchain-api/src/services/transaction.service.js"
add_file "blockchain-api/src/services/database.service.js"
add_file "blockchain-api/src/services/fabric.service.js"
add_file "blockchain-api/src/services/fabricGateway.service.js"
add_file "blockchain-api/src/services/blockchain.service.js"
add_file "blockchain-api/src/services/audit.service.js"

add_file "blockchain-api/src/controllers/wallet.controller.js"
add_file "blockchain-api/src/controllers/wallet-query.controller.js"
add_file "blockchain-api/src/controllers/transaction.controller.js"
add_file "blockchain-api/src/controllers/fabric.controller.js"
add_file "blockchain-api/src/controllers/blockchain.controller.js"

add_file "blockchain-api/src/routes/index.js"
add_file "blockchain-api/src/routes/wallet.routes.js"
add_file "blockchain-api/src/routes/wallet-query.routes.js"
add_file "blockchain-api/src/routes/transaction.routes.js"
add_file "blockchain-api/src/routes/transactions.routes.js"
add_file "blockchain-api/src/routes/fabric.routes.js"
add_file "blockchain-api/src/routes/blockchain.routes.js"

add_file "blockchain-api/src/utils/logger.js"
add_file "blockchain-api/src/utils/apiResponse.js"
add_file "blockchain-api/src/utils/asyncHandler.js"
add_file "blockchain-api/src/utils/response.util.js"

add_file "blockchain-api/postgresql/step-21-wallet-alignment-fix.sql"
add_file "blockchain-api/postgresql/step-23-wallet-transfer-compatibility-patch.sql"
add_file "blockchain-api/postgresql/step-23-transaction-type-constraint-fix.sql"

echo "" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"
echo "DATABASE MIGRATIONS FILE TREE" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"
find blockchain-api/database/migrations -type f | sort >> "$OUTPUT_FILE" 2>/dev/null || true

echo "" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"
echo "DATABASE SCRIPTS FILE TREE" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"
find blockchain-api/database/scripts -type f | sort >> "$OUTPUT_FILE" 2>/dev/null || true

echo ""
echo "Export completed:"
echo "$OUTPUT_FILE"
