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

--Query 4 -- Wallet Create -- Organization Types
SELECT DISTINCT ORGANIZATION_TYPE_ID AS ID,
	ORGANIZATION_TYPE AS NAME
FROM BLOCKCHAIN.BLOCKCHAIN_ORGANIZATION
ORDER BY ORGANIZATION_TYPE_ID

--Query 5 -- Wallet Create -- Organizations by Type
SELECT ORGANIZATION_CODE AS ID,
	ORGANIZATION_NAME AS NAME
FROM BLOCKCHAIN.BLOCKCHAIN_ORGANIZATION
WHERE ORGANIZATION_TYPE_ID =[PARAMETER]

--Query 6 -- Wallet Create -- Currencies
SELECT CUR_ID AS ID,
	ISO_CUR_CODE AS NAME
FROM SDEDBA.REF_COM_CURRENCY
WHERE ISO_CUR_CODE IN ('USD','LBP','EUR')

--Query 7 -- Wallet Create -- Countries
SELECT COU_ID AS ID,
	COU_NAME AS NAME
FROM SDEDBA.REF_COM_COUNTRY

--Query 8 -- Wallet Create -- Countries_Code
SELECT COU_ID
FROM SDEDBA.REF_COM_COUNTRY
WHERE COU_NAME = [PARAMETER]

--Query 9 -- Wallet Create -- Generate Customer ID
SELECT NEXTVAL('sdedba.s_customer')::numeric AS CUSTOMER_ID	

--Query 10 -- Wallet Query -- Search Type
SELECT 1 AS ID,
	'Customer ID' AS NAME
UNION ALL
SELECT 2 AS ID,
	'Wallet Address'

--Query 11 -- Wallet Query -- Search Results
SELECT 
    A.wallet_address AS "Wallet Address / Login ID",
    A.customer_id AS "CUSTOMER_ID",
    A.full_name AS "CUSTOMER_NAME / FULL_NAME",
    B.organization_id AS "ORGANIZATION_ID",
    B.organization_name AS "ORGANIZATION_NAME",
    C.cou_id AS "COUNTRY_ID / NATIONAL_ID_HASH",
    C.cou_name AS "COUNTRY_NAME / COU_NAME",
    A.email_hash AS "EMAIL_ADDRESS / EMAIL_HASH",
    A.mobile_hash AS "MOBILE_PHONE / MOBILE_HASH",
    A.current_balance AS "BALANCE / CURRENT_BALANCE",
    A.currency_code AS "CURRENCY / CURRENCY_CODE",
    A.created_at AS "CREATION_DATE_TIME / CREATED_AT"
FROM blockchain.wallets A
JOIN blockchain.blockchain_organization B
    ON A.organization_code = B.organization_code
JOIN sdedba.ref_com_country C
    ON A.national_id_hash = CAST(C.cou_id AS TEXT)
WHERE
    (
        [SEARCH_TYPE_ID] = 1
        AND A.customer_id = [SEARCH_VALUE]
    )
    OR
    (
        [SEARCH_TYPE_ID] = 2
        AND A.wallet_address = [SEARCH_VALUE]
    );

--Query 12 -- Source Query for current balance
SELECT CURRENT_BALANCE
FROM BLOCKCHAIN.WALLETS
WHERE CUSTOMER_ID = '3273944238'

--Query 13 -- Source Query for organization_id
SELECT ORGANIZATION_ID
FROM BLOCKCHAIN.WALLETS
WHERE CUSTOMER_ID = '3273944238'


--Query 14 -- Source Query for transaction history (all)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS

--Query 15 -- Source Query for transaction history (by wallet address)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE WALLET_ADDRESS = '0x1234567890abcdef1234567890abcdef12345678' --PARAMETER

--Query 16 -- Source Query for transaction history (by date range)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE CREATED_AT >= '2024-01-01' --PARAMETER
AND CREATED_AT < '2024-02-01' --PARAMETER

--Query 17 -- Source Query for transaction history (by organization)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE ORGANIZATION_ID = '5c4beb22-cfcd-4473-996-3e8ddcd7a304' --PARAMETER

--Query 18 -- Source Query for transaction history (by transaction type)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE TRANSACTION_TYPE = 'ORGANIZATION_TRANSFER' --PARAMETER

--Query 19 -- Source Query for transaction history (by transaction status)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE TRANSACTION_STATUS = 'COMPLETED' --PARAMETER



--Query 20 -- Source Query for transaction history (by Status)
SELECT TRANSACTION_ID,
	REQUEST_ID,
	TRANSACTION_TYPE,
	FROM_WALLET_ADDRESS AS "Sender Wallet",
	TO_WALLET_ADDRESS AS "Receiver Wallet",
	ORGANIZATION_ID AS "Organization ID",
	AMOUNT AS "Amount",
	CURRENCY_CODE AS "Currency",
	TRANSACTION_STATUS AS "Status",
	CREATED_AT AS "Created Date",
	REQUEST_SOURCE AS "Source"
FROM BLOCKCHAIN.TRANSACTIONS
WHERE TRANSACTION_STATUS = 'FAILED' --PARAMETER


--Query 21 -- Source Query For Transaction Type
SELECT TRANSACTION_TYPE_ID AS ID,
		TRANSACTION_TYPE_NAME AS NAME
FROM FINDBA.FIN_TRANSCTION_TYPE
WHERE TRANSACTION_TYPE_NAME ='TRANSFER';