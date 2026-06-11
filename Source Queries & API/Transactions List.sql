--1--Total Transactions
SELECT COUNT(*)::int AS TOTAL_TRANSACTIONS
FROM BLOCKCHAIN.TRANSACTIONS

--2--Governement Transactions
SELECT COUNT(*)::int AS total_transactions
FROM blockchain.government_transactions

--3--Total Successful Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'success',
    'successful',
    'completed',
    'confirmed',
    'approved'
);

--4--Total Pending Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'pending',
    'in_progress',
    'processing',
    'submitted'
);

--5--Total Failed Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'failed',
    'failure',
    'rejected',
    'error'
);

--6--Payment Method
SELECT PAYMENT_METHOD_ID AS ID,
	METHOD_NAME AS NAME
FROM BLOCKCHAIN.PAYMENT_METHOD

--7--Status
SELECT STATUS_ID AS ID,
	STATUS_NAME AS NAME
FROM BLOCKCHAIN.TRANSACTION_STATUS

--8--blockchain status
SELECT BLOCKCHAIN_STATUS_ID AS ID,
	BLOCKCHAIN_STATUS_NAME AS NAME
FROM BLOCKCHAIN.REF_BLOCKCHAIN_STATUSES

--Transaction Details
SELECT TRANSACTION_ID AS "TRANSACTION ID",
	RESIDENT_FULL_NAME AS "RESIDENT NAME",
	SERVICE_NAME AS "SERVICE NAME",
	NULL AS "ADMINISTRATION NAME",
	TOTAL_FEE AS "TOTAL FEES",
	PAYMENT_METHOD AS "PAYMENT METHOD",
	TRANSACTION_STATUS AS "TRANASCTION STATUS",
	BLOCKCHAIN_STATUS AS "BLOCKCHAIN STATUS",
	BLOCKCHAIN_TX_ID AS "BLOCKCHAIN TX ID",
	CREATED_AT AS "CREATED DATE",
	NOTES AS "NOTES"
FROM BLOCKCHAIN.GOVERNMENT_TRANSACTIONS
WHERE TRANSACTION_REFERENCE = 'GOV-TXN-1781098277640'




--APIs

--1. Get all transactions
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions?page=1&limit=100" \
  -H "Accept: application/json"

--2. Get first page only
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions" \
  -H "Accept: application/json"
  
--3. Get transaction statuses dropdown
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions/reference/transaction-status" \
  -H "Accept: application/json"
  
--4. Get payment methods dropdown
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions/reference/payment-methods" \
  -H "Accept: application/json"

--5. Get residents dropdown
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions/residents-dropdown" \
  -H "Accept: application/json"

--6. Get services dropdown
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions/services" \
  -H "Accept: application/json"

--7. Get ministries dropdown
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/transactions/ministries-dropdown" \
  -H "Accept: application/json"
