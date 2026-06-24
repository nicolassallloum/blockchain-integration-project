# Transaction Generator FK Fix

## Problem

Generated transactions failed with:

insert or update on table "fin_transaction" violates foreign key constraint "fk_trnsctn_src_cust_id"
Key (src_customer_id) is not present in table "ref_customer".

## Fix

Updated `getActiveWallets()` in `generate-wallets-transactions-fast.js` so transaction generation only selects wallets that have matching customers in:

- `sdedba.ref_customer`

It also validates organization IDs against the real organization source table:

- `blockchain.blockchain_organization`

## Key Rule

Generated transactions must use:

- `src_customer_id` from `sdedba.ref_customer`
- `dst_customer_id` from `sdedba.ref_customer`

The generator must not invent transaction customer IDs and must not select blockchain wallets unless the wallet customer already exists in `sdedba.ref_customer`.

## Replace File

```bash
cd /home/nix/u01/blockchain-integration/blockchain-api

cp generate-wallets-transactions-fast.updated.js src/scripts/generate-wallets-transactions-fast.js
```

## Test

```bash
node src/scripts/generate-wallets-transactions-fast.js \
  --wallets 5 \
  --transactions 10 \
  --batchSize 5 \
  --logEvery 5
```

## Validation SQL

```sql
SELECT w.customer_id
FROM blockchain.wallets w
LEFT JOIN sdedba.ref_customer c
  ON c.customer_id::text = w.customer_id::text
WHERE c.customer_id IS NULL
LIMIT 20;
```
