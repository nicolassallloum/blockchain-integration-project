# KYC Storage Modes Patch

This patch is based on the active files exported on 2026-07-23.

## Existing route retained

`POST /api/v1/kyc/blockchain-wallet`

No duplicate KYC module or endpoint is created.

## Implemented modes

| Mode | KYC request in PostgreSQL | Wallet in PostgreSQL | Fabric CreateWallet | Existing wallet login |
|---|---:|---:|---:|---:|
| `POSTGRES_ONLY` | Yes | No | No | No wallet exists |
| `BLOCKCHAIN_ONLY` | No | No | Yes | No |
| `POSTGRES_AND_BLOCKCHAIN` | Yes | Yes | Yes | Yes |

### Important PostgreSQL-only meaning

The current architecture cannot insert a complete enterprise wallet/customer row without a wallet address because the enterprise persistence flow is wallet-based. Therefore, `POSTGRES_ONLY` saves the full screen payload and file references in the existing staging/request table:

`blockchain.blockchain_kyc_wallet_requests`

It does not create a row in `blockchain.wallets`.

### Important blockchain-only login impact

The current login service queries `blockchain.wallets.password_hash`. A blockchain-only wallet has no `blockchain.wallets` row, so it cannot use the current login endpoint. The response and screen display this limitation.

The existing chaincode contract receives a bcrypt password hash. The plain password is never sent to Fabric. This patch also removes password fields from the `originalPayload` object passed to enterprise PostgreSQL persistence.

## Changed files

- `blockchain-api/src/controllers/blockchain-kyc.controller.js`
- `blockchain-api/src/services/blockchain-kyc.service.js`
- `blockchain-api/src/services/wallet.service.js`
- `blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.ts`
- `blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.html`
- `blockchain-test-ui/src/app/pages/blockchain-kyc/blockchain-kyc.component.scss`

Unchanged:

- `blockchain-api/src/routes/blockchain-kyc.routes.js`
- `blockchain-api/src/server.js`
- `blockchain-test-ui/src/app/app.routes.ts`

## 1. Extract the patch

```bash
cd ~/u01/blockchain-integration
mkdir -p kyc-storage-modes-patch
tar -xzf /path/to/kyc_storage_modes_patch_20260723.tar.gz \
  -C kyc-storage-modes-patch --strip-components=1
```

## 2. Load database environment

```bash
cd ~/u01/blockchain-integration
source "$HOME/blockchain-audit-env.sh"

export PGHOST="${POSTGRES_HOST:-172.31.13.133}"
export PGPORT="${POSTGRES_PORT:-5444}"
export PGDATABASE="${POSTGRES_DATABASE:-${POSTGRES_DB:-vfds_dev}}"
export PGUSER="${POSTGRES_USER:-pgdata}"
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not loaded}"
```

## 3. Back up the active PostgreSQL table

```bash
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p ~/u01/blockchain-integration/backups/kyc-storage-modes-db-$TIMESTAMP

pg_dump \
  --format=custom \
  --table=blockchain.blockchain_kyc_wallet_requests \
  --file="$HOME/u01/blockchain-integration/backups/kyc-storage-modes-db-$TIMESTAMP/blockchain_kyc_wallet_requests.dump" \
  "$PGDATABASE"

pg_dump \
  --schema-only \
  --table=blockchain.blockchain_kyc_wallet_requests \
  --file="$HOME/u01/blockchain-integration/backups/kyc-storage-modes-db-$TIMESTAMP/blockchain_kyc_wallet_requests_schema.sql" \
  "$PGDATABASE"
```

## 4. Apply the database migration

The migration adds only:

- `full_name`
- `storage_mode`
- a storage-mode check constraint
- customer and storage/status indexes

```bash
psql -X -v ON_ERROR_STOP=1 \
  -f ~/u01/blockchain-integration/kyc-storage-modes-patch/database/phase_kyc_storage_modes.sql
```

Validate:

```bash
psql -X -v ON_ERROR_STOP=1 -c "
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'blockchain'
  AND table_name = 'blockchain_kyc_wallet_requests'
  AND column_name IN ('full_name', 'storage_mode')
ORDER BY column_name;
"
```

## 5. Apply the source replacements with automatic backups

```bash
cd ~/u01/blockchain-integration/kyc-storage-modes-patch

./scripts/apply_source_files.sh \
  "$HOME/u01/blockchain-integration" \
  | tee apply_source_files_$(date +%Y%m%d_%H%M%S).log
```

The command prints a backup directory. Save it for rollback.

## 6. Validate source syntax and Angular build

```bash
cd ~/u01/blockchain-integration/blockchain-api
node --check src/controllers/blockchain-kyc.controller.js
node --check src/services/blockchain-kyc.service.js
node --check src/services/wallet.service.js

cd ~/u01/blockchain-integration/blockchain-test-ui
npm run build 2>&1 | tee /tmp/kyc_storage_modes_angular_build.log
```

Do not restart services if the Angular build fails.

## 7. Restart backend

```bash
cd ~/u01/blockchain-integration/blockchain-api
mkdir -p logs

pkill -f "node src/server.js" 2>/dev/null || true
sleep 2

nohup npm start \
  > logs/kyc_storage_modes_backend.log 2>&1 &

echo $! > /tmp/blockchain_api_kyc_storage_modes.pid
sleep 5

curl -sS http://127.0.0.1:3001/health | jq .
tail -n 100 logs/kyc_storage_modes_backend.log
```

If the server is managed by systemd, PM2, Docker, or another supervisor, use that supervisor instead of `pkill`/`nohup`.

## 8. Restart Angular

```bash
cd ~/u01/blockchain-integration/blockchain-test-ui

pkill -f "ng serve.*4200" 2>/dev/null || true
sleep 2

nohup npm start \
  > /tmp/kyc_storage_modes_angular.log 2>&1 &

echo $! > /tmp/blockchain_ui_kyc_storage_modes.pid
sleep 8

tail -n 100 /tmp/kyc_storage_modes_angular.log
curl -I http://127.0.0.1:4200/digital-kyc/blockchain-kyc
```

## 9. Run all three API tests and save outputs

These tests create real test records and Fabric wallets. Use an approved test organization and database.

```bash
cd ~/u01/blockchain-integration/kyc-storage-modes-patch

export API_BASE="http://127.0.0.1:3001"
# export KYC_API_KEY="..."  # only when the route requires it

./tests/curl_test_storage_modes.sh \
  | tee /tmp/kyc_storage_modes_curl_test.log
```

The script creates an uploadable archive and a `test_ids.env` file.

Expected HTTP result for each mode: `201`.

## 10. Validate PostgreSQL

```bash
source "$HOME/blockchain-audit-env.sh"
export PGHOST="${POSTGRES_HOST:-172.31.13.133}"
export PGPORT="${POSTGRES_PORT:-5444}"
export PGDATABASE="${POSTGRES_DATABASE:-${POSTGRES_DB:-vfds_dev}}"
export PGUSER="${POSTGRES_USER:-pgdata}"
export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is not loaded}"

cd ~/u01/blockchain-integration/kyc-storage-modes-patch

./tests/validate_postgres.sh \
  /absolute/path/to/kyc_storage_mode_test_YYYYMMDD_HHMMSS/test_ids.env
```

Expected:

- `POSTGRES_ONLY`: one KYC request, zero wallet rows.
- `BLOCKCHAIN_ONLY`: zero KYC requests, zero wallet rows.
- `POSTGRES_AND_BLOCKCHAIN`: one KYC request and one wallet row.
- The combined wallet password is stored as bcrypt in `blockchain.wallets.password_hash`.

## 11. Validate Fabric and CouchDB

```bash
cd ~/u01/blockchain-integration/kyc-storage-modes-patch

export API_BASE="http://127.0.0.1:3001"
export COUCHDB_URL="http://127.0.0.1:5984"
export COUCHDB_DATABASE="kycchannelnix1_kyc-wallet-chaincode-js"
# export COUCHDB_USER="..."
# export COUCHDB_PASSWORD="..."

./tests/validate_fabric_couchdb.sh \
  /absolute/path/to/kyc_storage_mode_test_YYYYMMDD_HHMMSS \
  "$HOME/u01/blockchain-integration"
```

Expected:

- Fabric transaction IDs exist for `BLOCKCHAIN_ONLY` and `POSTGRES_AND_BLOCKCHAIN`.
- CouchDB contains both wallet addresses.
- CouchDB does not contain either plain test password.
- PostgreSQL wallet API returns 404/not found for the blockchain-only wallet.
- PostgreSQL wallet API returns the combined wallet.

## 12. UI acceptance checks

Open:

`http://172.31.13.90:4200/digital-kyc/blockchain-kyc`

Verify:

1. Three storage cards are displayed.
2. Combined mode is selected by default.
3. Wallet details are hidden for PostgreSQL-only.
4. File inputs are hidden for blockchain-only.
5. Result screen shows independent PostgreSQL and blockchain statuses.
6. Blockchain-only displays the wallet-login limitation.
7. Combined mode still displays wallet address, password, Fabric transaction ID, channel, and chaincode.

## 13. Source rollback

Use the exact backup directory printed by the apply script:

```bash
cd ~/u01/blockchain-integration/kyc-storage-modes-patch

./scripts/rollback_source_files.sh \
  "$HOME/u01/blockchain-integration/backups/kyc-storage-modes-YYYYMMDD_HHMMSS" \
  "$HOME/u01/blockchain-integration"
```

Then rebuild and restart the backend and Angular applications.

## 14. Database rollback

The SQL rollback drops `full_name` and `storage_mode`; running it after new KYC records have been created loses those two values. Use it only for an immediate rollback before production use:

```bash
psql -X -v ON_ERROR_STOP=1 \
  -f ~/u01/blockchain-integration/kyc-storage-modes-patch/database/rollback_kyc_storage_modes.sql
```

For a rollback after data creation, retain the columns or restore the table from the `pg_dump` backup instead.
