--APIs
--1--Create Digital Stamp 
POST "http://172.31.13.90:3001/api/v1/government-blockchain/payments-digital-stamps/issue" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "residentId": 44,
    "serviceId": 1,
    "stampStatus": "Issued"
  }'



--Queries
--1--Total Payments
SELECT COUNT(*) AS "Total Payments"
FROM BLOCKCHAIN.DIGITAL_STAMP_PAYMENTS;

--2--Total Amount
SELECT SUM(AMOUNT) AS "Total Amount"
FROM BLOCKCHAIN.DIGITAL_STAMP_PAYMENTS;

--3--Digital Stamps
SELECT COUNT(*)
FROM BLOCKCHAIN.DIGITAL_STAMP_PAYMENTS
WHERE PAYMENT_STATUS <> 'Failed';

--4--Redeemed
SELECT COUNT(*)
FROM BLOCKCHAIN.DIGITAL_STAMP_PAYMENTS
WHERE STAMP_STATUS = 'Redeemed';

--5--Payment & Stamp Records
SELECT PAYMENT_REF AS "payment Code",
	RESIDENT_NAME AS "Resident",
	SERVICE_NAME AS "Service",
	STAMP_ID AS "Stamp ID",
	AMOUNT AS "Fees",
	PAYMENT_STATUS AS "Payment Status",
	STAMP_STATUS AS "Stamp Status"
FROM BLOCKCHAIN.DIGITAL_STAMP_PAYMENTS