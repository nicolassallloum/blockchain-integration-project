#!/bin/bash

OUTPUT_FILE="blockchain_update_needed_files.txt"

rm -f "$OUTPUT_FILE"

echo "==================================================" >> "$OUTPUT_FILE"
echo "BLOCKCHAIN INTEGRATION - NEEDED FILES EXPORT" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "Purpose: Export all code needed to update wallet/transaction data modeling and enterprise sync" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

add_file () {
  FILE_PATH="$1"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "FILE: $FILE_PATH" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  if [ -f "$FILE_PATH" ]; then
    sed -n '1,1200p' "$FILE_PATH" >> "$OUTPUT_FILE"
  else
    echo "NOT FOUND: $FILE_PATH" >> "$OUTPUT_FILE"
  fi
}

add_command () {
  TITLE="$1"
  COMMAND="$2"

  echo "" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"
  echo "$TITLE" >> "$OUTPUT_FILE"
  echo "==================================================" >> "$OUTPUT_FILE"

  eval "$COMMAND" >> "$OUTPUT_FILE" 2>&1
}

echo "" >> "$OUTPUT_FILE"
echo "================ PROJECT PATHS ================" >> "$OUTPUT_FILE"
echo "BASE_DIR: /home/nix/u01/blockchain-integration" >> "$OUTPUT_FILE"
echo "BACKEND : blockchain-api" >> "$OUTPUT_FILE"
echo "CHAINCODE: chaincode/kyc-wallet-chaincode-js" >> "$OUTPUT_FILE"
echo "ANGULAR : blockchain-test-ui" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND FILE TREE ================" >> "$OUTPUT_FILE"
find blockchain-api/src blockchain-api/postgresql blockchain-api/database blockchain-api/sql \
  -type f \
  \( -iname "*.js" -o -iname "*.json" -o -iname "*.sql" -o -iname "*.md" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/logs/*" \
  2>/dev/null | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ CHAINCODE FILE TREE ================" >> "$OUTPUT_FILE"
find chaincode/kyc-wallet-chaincode-js \
  -type f \
  \( -iname "*.js" -o -iname "*.json" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/coverage/*" \
  2>/dev/null | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR FILE TREE ================" >> "$OUTPUT_FILE"
find blockchain-test-ui/src \
  -type f \
  \( -iname "*.ts" -o -iname "*.html" -o -iname "*.css" -o -iname "*.scss" -o -iname "*.json" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  2>/dev/null | sort >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ PACKAGE FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/package.json"
add_file "blockchain-api/package-lock.json"
add_file "chaincode/kyc-wallet-chaincode-js/package.json"
add_file "chaincode/kyc-wallet-chaincode-js/package-lock.json"
add_file "blockchain-test-ui/package.json"
add_file "blockchain-test-ui/angular.json"
add_file "blockchain-test-ui/tsconfig.json"

echo "" >> "$OUTPUT_FILE"
echo "================ ENV FILE - SANITIZED ================" >> "$OUTPUT_FILE"
if [ -f "blockchain-api/.env" ]; then
  echo "FILE: blockchain-api/.env SANITIZED" >> "$OUTPUT_FILE"
  sed -E \
    -e 's/(PASSWORD|PASS|SECRET|KEY|TOKEN|PRIVATE|API_KEY|JWT_SECRET)=.*/\1=****/Ig' \
    blockchain-api/.env >> "$OUTPUT_FILE"
else
  echo "NOT FOUND: blockchain-api/.env" >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND MAIN FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/server.js"
add_file "blockchain-api/src/app.js"
add_file "blockchain-api/src/routes/index.js"

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND CONFIG FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/config/app.config.js"
add_file "blockchain-api/src/config/auth.config.js"
add_file "blockchain-api/src/config/blockchain.config.js"
add_file "blockchain-api/src/config/config.js"
add_file "blockchain-api/src/config/database.js"
add_file "blockchain-api/src/config/env.validator.js"
add_file "blockchain-api/src/config/index.js"
add_file "blockchain-api/src/config/logger.config.js"
add_file "blockchain-api/src/config/security.config.js"
add_file "blockchain-api/src/database/postgres.js"

echo "" >> "$OUTPUT_FILE"
echo "================ WALLET BACKEND FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/routes/wallet.routes.js"
add_file "blockchain-api/src/routes/wallet-query.routes.js"
add_file "blockchain-api/src/controllers/wallet.controller.js"
add_file "blockchain-api/src/controllers/wallet-auth.controller.js"
add_file "blockchain-api/src/controllers/wallet-query.controller.js"
add_file "blockchain-api/src/services/wallet.service.js"
add_file "blockchain-api/src/services/wallet-auth.service.js"
add_file "blockchain-api/src/services/wallet-query.service.js"
add_file "blockchain-api/src/utils/walletAddressGenerator.js"
add_file "blockchain-api/src/middlewares/wallet-login.validator.js"

echo "" >> "$OUTPUT_FILE"
echo "================ TRANSACTION BACKEND FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/routes/transaction.routes.js"
add_file "blockchain-api/src/routes/transactions.routes.js"
add_file "blockchain-api/src/controllers/transaction.controller.js"
add_file "blockchain-api/src/services/transaction.service.js"

echo "" >> "$OUTPUT_FILE"
echo "================ FABRIC BACKEND FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/routes/fabric.routes.js"
add_file "blockchain-api/src/controllers/fabric.controller.js"
add_file "blockchain-api/src/controllers/blockchain.controller.js"
add_file "blockchain-api/src/services/fabric.service.js"
add_file "blockchain-api/src/services/fabricGateway.service.js"
add_file "blockchain-api/src/services/blockchain.service.js"
add_file "blockchain-api/src/repositories/blockchain.repository.js"
add_file "blockchain-api/src/config/connection-org1.json"

echo "" >> "$OUTPUT_FILE"
echo "================ ORGANIZATION / REFERENCE FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/routes/organization.routes.js"
add_file "blockchain-api/src/routes/reference.routes.js"
add_file "blockchain-api/src/controllers/organization.controller.js"
add_file "blockchain-api/src/controllers/reference.controller.js"
add_file "blockchain-api/src/services/organization.service.js"

echo "" >> "$OUTPUT_FILE"
echo "================ DATABASE / AUDIT / COMMON FILES ================" >> "$OUTPUT_FILE"
add_file "blockchain-api/src/services/database.service.js"
add_file "blockchain-api/src/services/audit.service.js"
add_file "blockchain-api/src/middleware/apiKey.middleware.js"
add_file "blockchain-api/src/middleware/auditRequest.middleware.js"
add_file "blockchain-api/src/middleware/authorization.middleware.js"
add_file "blockchain-api/src/middleware/error.middleware.js"
add_file "blockchain-api/src/middleware/errorHandler.js"
add_file "blockchain-api/src/middleware/errorHandler.middleware.js"
add_file "blockchain-api/src/middleware/jwt.middleware.js"
add_file "blockchain-api/src/middleware/notFoundHandler.js"
add_file "blockchain-api/src/middleware/requestId.middleware.js"
add_file "blockchain-api/src/middleware/routeSecurity.middleware.js"
add_file "blockchain-api/src/middleware/security.middleware.js"
add_file "blockchain-api/src/middleware/sqlInjectionProtection.middleware.js"
add_file "blockchain-api/src/middleware/suspiciousRequest.middleware.js"
add_file "blockchain-api/src/middleware/validation.middleware.js"
add_file "blockchain-api/src/middlewares/errorHandler.middleware.js"
add_file "blockchain-api/src/middlewares/notFound.middleware.js"
add_file "blockchain-api/src/middlewares/requestLogger.middleware.js"
add_file "blockchain-api/src/utils/apiResponse.js"
add_file "blockchain-api/src/utils/asyncHandler.js"
add_file "blockchain-api/src/utils/authErrors.js"
add_file "blockchain-api/src/utils/jwt.util.js"
add_file "blockchain-api/src/utils/logger.js"
add_file "blockchain-api/src/utils/password.util.js"
add_file "blockchain-api/src/utils/response.util.js"
add_file "blockchain-api/src/utils/token.util.js"

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND SQL FILES ================" >> "$OUTPUT_FILE"
find blockchain-api \
  -type f \
  -iname "*.sql" \
  ! -path "*/node_modules/*" \
  2>/dev/null | sort | while read FILE; do
    add_file "$FILE"
  done

echo "" >> "$OUTPUT_FILE"
echo "================ CHAINCODE FILES ================" >> "$OUTPUT_FILE"
add_file "chaincode/kyc-wallet-chaincode-js/index.js"
add_file "chaincode/kyc-wallet-chaincode-js/lib/kycWalletContract.js"

echo "" >> "$OUTPUT_FILE"
echo "================ CHAINCODE COUCHDB INDEXES ================" >> "$OUTPUT_FILE"
find chaincode/kyc-wallet-chaincode-js/META-INF \
  -type f \
  -iname "*.json" \
  2>/dev/null | sort | while read FILE; do
    add_file "$FILE"
  done

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR ROUTES / SERVICES ================" >> "$OUTPUT_FILE"
add_file "blockchain-test-ui/src/app/app.routes.ts"
add_file "blockchain-test-ui/src/environments/environment.ts"
add_file "blockchain-test-ui/src/environments/environment.prod.ts"
add_file "blockchain-test-ui/src/app/core/interceptors/api-auth.interceptor.ts"
add_file "blockchain-test-ui/src/app/core/services/api-config.service.ts"
add_file "blockchain-test-ui/src/app/core/services/wallet-api.service.ts"
add_file "blockchain-test-ui/src/app/core/services/transaction-api.service.ts"
add_file "blockchain-test-ui/src/app/core/services/fabric-api.service.ts"
add_file "blockchain-test-ui/src/app/core/services/dashboard-api.service.ts"
add_file "blockchain-test-ui/src/app/services/wallet.service.ts"
add_file "blockchain-test-ui/src/app/services/transaction.service.ts"
add_file "blockchain-test-ui/src/app/services/fabric.service.ts"
add_file "blockchain-test-ui/src/app/services/wallet-session.service.ts"
add_file "blockchain-test-ui/src/app/services/wallet-session.ts"

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR WALLET SCREENS ================" >> "$OUTPUT_FILE"
add_file "blockchain-test-ui/src/app/pages/wallet-create/wallet-create.ts"
add_file "blockchain-test-ui/src/app/pages/wallet-create/wallet-create.html"
add_file "blockchain-test-ui/src/app/pages/wallet-create/wallet-create.css"
add_file "blockchain-test-ui/src/app/pages/organization-wallet-create/organization-wallet-create.ts"
add_file "blockchain-test-ui/src/app/pages/organization-wallet-create/organization-wallet-create.html"
add_file "blockchain-test-ui/src/app/pages/organization-wallet-create/organization-wallet-create.css"
add_file "blockchain-test-ui/src/app/pages/wallet-login/wallet-login.ts"
add_file "blockchain-test-ui/src/app/pages/wallet-login/wallet-login.html"
add_file "blockchain-test-ui/src/app/pages/wallet-login/wallet-login.css"
add_file "blockchain-test-ui/src/app/pages/wallet-query/wallet-query.ts"
add_file "blockchain-test-ui/src/app/pages/wallet-query/wallet-query.html"
add_file "blockchain-test-ui/src/app/pages/wallet-query/wallet-query.css"
add_file "blockchain-test-ui/src/app/pages/wallet-information/wallet-information.component.ts"
add_file "blockchain-test-ui/src/app/pages/wallet-information/wallet-information.component.html"
add_file "blockchain-test-ui/src/app/pages/wallet-information/wallet-information.component.css"

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR TRANSACTION SCREENS ================" >> "$OUTPUT_FILE"
add_file "blockchain-test-ui/src/app/features/transactions/wallet-transfer/wallet-transfer.component.ts"
add_file "blockchain-test-ui/src/app/features/transactions/wallet-transfer/wallet-transfer.component.html"
add_file "blockchain-test-ui/src/app/features/transactions/wallet-transfer/wallet-transfer.component.css"
add_file "blockchain-test-ui/src/app/features/transactions/organization-transfer/organization-transfer.component.ts"
add_file "blockchain-test-ui/src/app/features/transactions/organization-transfer/organization-transfer.component.html"
add_file "blockchain-test-ui/src/app/features/transactions/organization-transfer/organization-transfer.component.css"
add_file "blockchain-test-ui/src/app/features/transactions/transaction-history/transaction-history.component.ts"
add_file "blockchain-test-ui/src/app/features/transactions/transaction-history/transaction-history.component.html"
add_file "blockchain-test-ui/src/app/features/transactions/transaction-history/transaction-history.component.css"
add_file "blockchain-test-ui/src/app/features/transactions/balance-query/balance-query.component.ts"
add_file "blockchain-test-ui/src/app/features/transactions/balance-query/balance-query.component.html"
add_file "blockchain-test-ui/src/app/features/transactions/balance-query/balance-query.component.css"

echo "" >> "$OUTPUT_FILE"
echo "================ ANGULAR DASHBOARD / SIDEBAR / FABRIC TEST ================" >> "$OUTPUT_FILE"
add_file "blockchain-test-ui/src/app/features/dashboard/dashboard.component.ts"
add_file "blockchain-test-ui/src/app/features/dashboard/dashboard.component.css"
add_file "blockchain-test-ui/src/app/layout/sidebar/sidebar.component.html"
add_file "blockchain-test-ui/src/app/layout/sidebar/sidebar.component.css"
add_file "blockchain-test-ui/src/app/features/fabric-test/fabric-test.component.ts"
add_file "blockchain-test-ui/src/app/features/fabric-test/fabric-test.component.html"
add_file "blockchain-test-ui/src/app/features/fabric-test/fabric-test.component.css"

echo "" >> "$OUTPUT_FILE"
echo "================ NODE / NPM CHECKS ================" >> "$OUTPUT_FILE"
add_command "BACKEND NPM PACKAGE CHECK" "cd blockchain-api && npm list --depth=0"
add_command "CHAINCODE NPM PACKAGE CHECK" "cd chaincode/kyc-wallet-chaincode-js && npm list --depth=0"
add_command "ANGULAR NPM PACKAGE CHECK" "cd blockchain-test-ui && npm list --depth=0"

echo "" >> "$OUTPUT_FILE"
echo "================ BACKEND ROUTE GREP ================" >> "$OUTPUT_FILE"
add_command "WALLET ROUTES" "grep -Rni \"wallet\" blockchain-api/src/routes blockchain-api/src/controllers blockchain-api/src/services 2>/dev/null"
add_command "TRANSACTION ROUTES" "grep -Rni \"transaction\\|transfer\" blockchain-api/src/routes blockchain-api/src/controllers blockchain-api/src/services 2>/dev/null"
add_command "FABRIC METHODS" "grep -Rni \"submitTransaction\\|evaluateTransaction\\|CreateWallet\\|TransferBetweenWallets\\|TransferToOrganization\\|GetWalletBalance\\|GetTransactionHistory\" blockchain-api/src chaincode/kyc-wallet-chaincode-js/lib 2>/dev/null"

echo "" >> "$OUTPUT_FILE"
echo "================ POSTGRESQL DB STRUCTURE EXPORT SQL ================" >> "$OUTPUT_FILE"

cat > /tmp/export_blockchain_model_info.sql <<'SQL'
\pset pager off
\pset border 2

\echo '===================================================='
\echo 'SCHEMAS'
\echo '===================================================='
SELECT schema_name
FROM information_schema.schemata
WHERE upper(schema_name) IN ('BLOCKCHAIN','SDEDBA','SDEBDA','FINDBA','SUITEDBA')
ORDER BY schema_name;

\echo '===================================================='
\echo 'BLOCKCHAIN.WALLETS COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'BLOCKCHAIN'
  AND upper(table_name) = 'WALLETS'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'BLOCKCHAIN.TRANSACTIONS COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'BLOCKCHAIN'
  AND upper(table_name) = 'TRANSACTIONS'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'CUSTOMER TABLES'
\echo '===================================================='
SELECT table_schema, table_name
FROM information_schema.tables
WHERE upper(table_schema) IN ('SDEDBA','SDEBDA')
  AND upper(table_name) IN ('REFF_CUSTOMER','REF_CUSTOMER','CFG_CUSTOMER_DEF')
ORDER BY table_schema, table_name;

\echo '===================================================='
\echo 'CUSTOMER / CURRENCY TABLE COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) IN ('SDEDBA','SDEBDA')
  AND upper(table_name) IN ('REFF_CUSTOMER','REF_CUSTOMER','CFG_CUSTOMER_DEF','REF_COM_CURRENCY')
ORDER BY table_schema, table_name, ordinal_position;

\echo '===================================================='
\echo 'FINDBA.FIN_TRANSACTION COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'FINDBA'
  AND upper(table_name) = 'FIN_TRANSACTION'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'SUITEDBA.CFG_OBJECT_API_DEF COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_schema) = 'SUITEDBA'
  AND upper(table_name) = 'CFG_OBJECT_API_DEF'
ORDER BY ordinal_position;

\echo '===================================================='
\echo 'STATUS TABLES AND COLUMNS'
\echo '===================================================='
SELECT table_schema, table_name, column_name, data_type, udt_name, is_nullable, column_default
FROM information_schema.columns
WHERE upper(table_name) = 'STS_STATUS'
ORDER BY table_schema, table_name, ordinal_position;

\echo '===================================================='
\echo 'REQUIRED SEQUENCES'
\echo '===================================================='
SELECT sequence_schema, sequence_name, data_type
FROM information_schema.sequences
WHERE upper(sequence_schema) IN ('SDEDBA','SDEBDA','FINDBA','SUITEDBA','BLOCKCHAIN')
  AND (
       upper(sequence_name) LIKE '%CUSTOMER%'
    OR upper(sequence_name) LIKE '%FIN_TRANSACTION%'
    OR upper(sequence_name) LIKE '%CFG_CUSTOMER_DEF%'
    OR upper(sequence_name) LIKE '%OBJECT_API_DEF%'
    OR upper(sequence_name) LIKE '%WALLET%'
    OR upper(sequence_name) LIKE '%TRANSACTION%'
  )
ORDER BY sequence_schema, sequence_name;

\echo '===================================================='
\echo 'CURRENT BLOCKCHAIN INDEXES'
\echo '===================================================='
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE upper(schemaname) = 'BLOCKCHAIN'
  AND upper(tablename) IN ('WALLETS','TRANSACTIONS')
ORDER BY tablename, indexname;

\echo '===================================================='
\echo 'PRIMARY KEYS AND FOREIGN KEYS'
\echo '===================================================='
SELECT
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_schema AS foreign_table_schema,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
       ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE upper(tc.table_schema) IN ('BLOCKCHAIN','SDEDBA','SDEBDA','FINDBA','SUITEDBA')
  AND upper(tc.table_name) IN (
      'WALLETS',
      'TRANSACTIONS',
      'REFF_CUSTOMER',
      'REF_CUSTOMER',
      'CFG_CUSTOMER_DEF',
      'FIN_TRANSACTION',
      'CFG_OBJECT_API_DEF',
      'REF_COM_CURRENCY',
      'STS_STATUS'
  )
ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;
SQL

cat /tmp/export_blockchain_model_info.sql >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "================ POSTGRESQL DB STRUCTURE OUTPUT ================" >> "$OUTPUT_FILE"
echo "Trying DB export using postgres user first..." >> "$OUTPUT_FILE"

if command -v psql >/dev/null 2>&1; then
  psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \
    -f /tmp/export_blockchain_model_info.sql >> "$OUTPUT_FILE" 2>&1

  if [ $? -ne 0 ]; then
    echo "" >> "$OUTPUT_FILE"
    echo "postgres user failed. Trying postrges user..." >> "$OUTPUT_FILE"

    psql -h 172.31.13.133 -p 5444 -U postgres -d vfds_dev \
      -f /tmp/export_blockchain_model_info.sql >> "$OUTPUT_FILE" 2>&1
  fi
else
  echo "psql not found on this server." >> "$OUTPUT_FILE"
fi

echo "" >> "$OUTPUT_FILE"
echo "================ FINAL EXPORT SUMMARY ================" >> "$OUTPUT_FILE"
echo "Generated at: $(date)" >> "$OUTPUT_FILE"
echo "Output file: $OUTPUT_FILE" >> "$OUTPUT_FILE"
echo "File size:" >> "$OUTPUT_FILE"
ls -lh "$OUTPUT_FILE" >> "$OUTPUT_FILE"
echo "Line count:" >> "$OUTPUT_FILE"
wc -l "$OUTPUT_FILE" >> "$OUTPUT_FILE"

echo "" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"
echo "EXPORT COMPLETED" >> "$OUTPUT_FILE"
echo "Output file: $OUTPUT_FILE" >> "$OUTPUT_FILE"
echo "==================================================" >> "$OUTPUT_FILE"

echo "Done. File created: $OUTPUT_FILE"
echo ""
echo "Copy to Windows using PowerShell:"
echo "New-Item -ItemType Directory -Force \"C:\\Users\\Public\\BlockChain\\Updated Files\""
echo "scp nix@172.31.13.90:/home/nix/u01/blockchain-integration/$OUTPUT_FILE \"C:\\Users\\Public\\BlockChain\\Updated Files\\blockchain_update_needed_files.txt\""
