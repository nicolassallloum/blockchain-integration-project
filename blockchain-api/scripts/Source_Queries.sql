--Query 1 -- Dashboard -- Total Wallets
SELECT COUNT(*)
FROM BLOCKCHAIN.WALLETS 

--Query 2 -- Dashboard -- Active Wallets
SELECT COUNT(*)
FROM BLOCKCHAIN.WALLETS
WHERE STATUS = 'ACTIVE' 

--Query 3 -- Dashboard -- Wallet Records
SELECT CUSTOMER_ID AS "Customer ID",
	WALLET_ADDRESS AS "Wallet Address",
	FULL_NAME AS "Full Name",
	ORGANIZATION_CODE AS "Organization",
	CURRENT_BALANCE AS "Balance",
	STATUS AS "Status",
	CREATED_AT AS "Created At"
FROM BLOCKCHAIN.WALLETS
