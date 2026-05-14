--To Check Custoemr Wallets and Customer Details
SELECT customer_id, wallet_address, full_name, currency_code, status
FROM blockchain.wallets
WHERE customer_id = '900002';

SELECT customer_id, customer_name, customer_sname, customer_internal_code, cur_id, status_code
FROM sdedba.ref_customer
WHERE customer_id = 900002;

SELECT customer_def_id, object_id, object_pk_value, customer_id, object_content
FROM sdedba.cfg_customer_def
WHERE customer_id = 900002;


--To Check Transaction Details
SELECT transaction_id, from_wallet_address, to_wallet_address, amount, currency_code, transaction_date, status
FROM blockchain.transactions
WHERE from_wallet_address = '0x1234567890abcdef' OR to_wallet_address = '0x1234567890abcdef';

--To Check Active Wallets
SELECT COUNT(*) AS active_wallets
FROM blockchain.wallets
WHERE status = 'ACTIVE';

--To Check Total Transactions
SELECT COUNT(*) AS total_transactions
FROM blockchain.transactions;

-- To Check Customer Wallets with Pagination
SELECT customer_id, wallet_address, full_name, currency_code, status
FROM blockchain.wallets
WHERE customer_id = '900002'
ORDER BY wallet_address
LIMIT 10 OFFSET 0; -- Change OFFSET for pagination (e.g., OFFSET 10 for the next page)

-- To Check Transactions with Pagination
SELECT transaction_id, from_wallet_address, to_wallet_address, amount, currency_code, transaction_date
FROM blockchain.transactions
WHERE from_wallet_address = '0x1234567890abcdef' OR to_wallet_address = '0x1234567890abcdef'
ORDER BY transaction_date DESC
LIMIT 10 OFFSET 0; -- Change OFFSET for pagination (e.g., OFFSET 10 for the next page)


