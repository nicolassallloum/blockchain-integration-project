# VALOORES License Wallet Creation Screen

This bundle creates the application screen that generates the 12 recovery words in the Angular browser rather than on the server.

## Installed functionality

- Angular route: `/government-blockchain/license-wallet-create`
- Sidebar item: **Create License Wallet**
- Browser-side 12-word wallet generation
- Browser-side encrypted JSON wallet creation
- Recovery-word confirmation using words 3 and 9
- Backend endpoint to list unprovisioned licenses
- Backend endpoint to store the production wallet mapping
- The backend rejects mnemonic, recovery words, recovery phrase, private key, and encryption password
- Corrects the recovery DTO from `sourceLicenseId` to `licenseId`

## Install

```bash
unzip license_wallet_screen_bundle.zip
cd license_wallet_screen_bundle

bash install.sh "$HOME/u01/blockchain-integration"
```

## Restart backend

```bash
cd ~/u01/blockchain-integration/blockchain-api

pkill -f "node.*src/server.js" || true

nohup node src/server.js \
  > blockchain-api.log \
  2>&1 &

sleep 5

grep -E \
  "license-wallets|license-recovery|ROUTE ERROR" \
  blockchain-api.log
```

Expected:

```text
[ROUTE MOUNTED] /api/license-wallets
[ROUTE MOUNTED] /api/license-recovery
```

## Test API

```bash
curl -sS \
  http://127.0.0.1:3001/api/license-wallets/available-licenses |
jq
```

## Open screen

```text
http://172.31.13.90:4200/government-blockchain/license-wallet-create
```

## Current Fabric status

This bundle creates the Angular screen and the PostgreSQL production wallet mapping. It intentionally reports `PENDING_CHAINCODE_DEPLOYMENT` until dedicated application-license chaincode methods are added and deployed.
