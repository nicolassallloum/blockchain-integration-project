#!/bin/bash

set -e

PROJECT_DIR="/home/nix/u01/blockchain-integration/blockchain-test-ui"

cd "$PROJECT_DIR"

echo "Creating Step 32.2 Bulk Wallet pages..."

mkdir -p src/app/pages/wallet-bulk-csv
mkdir -p src/app/pages/wallet-bulk-table

touch src/app/pages/wallet-bulk-csv/wallet-bulk-csv.ts
touch src/app/pages/wallet-bulk-csv/wallet-bulk-csv.html
touch src/app/pages/wallet-bulk-csv/wallet-bulk-csv.scss

touch src/app/pages/wallet-bulk-table/wallet-bulk-table.ts
touch src/app/pages/wallet-bulk-table/wallet-bulk-table.html
touch src/app/pages/wallet-bulk-table/wallet-bulk-table.scss

cat > bulk-wallet-sample.csv <<'EOF'
customerId,fullName,nationalIdHash,emailHash,mobileHash,countryId,organizationId,organizationType,initialBalance,currencyCode
CUST3001,Ali Haddad,NID_HASH_3001,EMAIL_HASH_3001,MOBILE_HASH_3001,1,1,BANK,100,USD
CUST3002,Maya Khoury,NID_HASH_3002,EMAIL_HASH_3002,MOBILE_HASH_3002,1,2,BANK,250,USD
CUST3003,Karim Nassar,NID_HASH_3003,EMAIL_HASH_3003,MOBILE_HASH_3003,1,3,GOVERNMENT,0,USD
EOF

echo "Done."
echo ""
echo "Created:"
echo "src/app/pages/wallet-bulk-csv/wallet-bulk-csv.ts"
echo "src/app/pages/wallet-bulk-csv/wallet-bulk-csv.html"
echo "src/app/pages/wallet-bulk-csv/wallet-bulk-csv.scss"
echo "src/app/pages/wallet-bulk-table/wallet-bulk-table.ts"
echo "src/app/pages/wallet-bulk-table/wallet-bulk-table.html"
echo "src/app/pages/wallet-bulk-table/wallet-bulk-table.scss"
echo "bulk-wallet-sample.csv"
echo ""
echo "Now paste the component code into the created files."