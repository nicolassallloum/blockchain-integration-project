# Generator FK Fix - blockchain.blockchain_organization

## Problem
Generated transactions failed with:

`fk_blockchain_transactions_organization`

because the generator selected `organization_id` values from `blockchain.blockchain_organization`, while the current FK on `blockchain.transactions.organization_id` still validates against `blockchain.organizations`.

## Fix Applied

1. `generate-wallets-transactions-fast.js`
   - Now prefers `blockchain.blockchain_organization` as the organization source.
   - Active wallet transaction selection now validates organization IDs against the resolved organization source table.

2. `generate-wallets-transactions.js`
   - Same organization source fix as the fast generator.

3. `enterprise-persistence.repository.js`
   - `resolveValidBlockchainOrganization()` now reads first from `blockchain.blockchain_organization`.
   - If the legacy table `blockchain.organizations` exists and the transaction FK still points to it, the repository mirrors a minimal organization record into `blockchain.organizations` using `ON CONFLICT DO NOTHING` before inserting the transaction.

## Files to Replace

```bash
cp generate-wallets-transactions-fast.js /home/nix/u01/blockchain-integration/blockchain-api/src/scripts/generate-wallets-transactions-fast.js
cp generate-wallets-transactions.js /home/nix/u01/blockchain-integration/blockchain-api/src/scripts/generate-wallets-transactions.js
cp enterprise-persistence.repository.js /home/nix/u01/blockchain-integration/blockchain-api/src/repositories/enterprise-persistence.repository.js
```

## Test

```bash
cd /home/nix/u01/blockchain-integration/blockchain-api

node src/scripts/generate-wallets-transactions-fast.js   --wallets 5   --transactions 10   --batchSize 5   --logEvery 5
```

## Optional DB Cleanup / Validation

```sql
SELECT COUNT(*) FROM blockchain.blockchain_organization;
SELECT COUNT(*) FROM blockchain.organizations;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname = 'fk_blockchain_transactions_organization';
```
