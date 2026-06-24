GENERATOR ENTERPRISE SYNC FIX V2 - ORGANIZATION FK FIX

Problem fixed:
- Wallet generation was syncing to enterprise tables successfully.
- Transaction generation failed with:
  fk_blockchain_transactions_organization
  Key (organization_id) is not present in blockchain.organizations.

Root cause:
- The generator preferred blockchain.blockchain_organization before blockchain.organizations.
- blockchain.transactions.organization_id references blockchain.organizations, so transactions using IDs from blockchain_organization fail.

Changes included:
1. generate-wallets-transactions-fast.js
   - Prefer blockchain.organizations for generated wallet organization_id.
   - When loading active wallets for generated transactions, invalid organization IDs are converted to NULL.

2. generate-wallets-transactions.js
   - Same fix for the non-fast generator.

3. enterprise-persistence.repository.js
   - Added a defensive FK validation before inserting blockchain.transactions.
   - If transactionData.organizationId is not found in blockchain.organizations, organization_id and organization_code are saved as NULL instead of failing.

Files to replace:
- blockchain-api/src/scripts/generate-wallets-transactions-fast.js
- blockchain-api/src/scripts/generate-wallets-transactions.js
- blockchain-api/src/repositories/enterprise-persistence.repository.js

Recommended test:
cd /home/nix/u01/blockchain-integration/blockchain-api
node src/scripts/generate-wallets-transactions-fast.js --wallets 5 --transactions 10 --batchSize 5 --logEvery 5

Optional cleanup check:
SELECT w.wallet_address, w.customer_id, w.organization_id
FROM blockchain.wallets w
LEFT JOIN blockchain.organizations o ON o.organization_id::text = w.organization_id::text
WHERE w.organization_id IS NOT NULL
  AND o.organization_id IS NULL
ORDER BY w.created_at DESC
LIMIT 20;
