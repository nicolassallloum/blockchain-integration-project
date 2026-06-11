--1--Pending Queue
SELECT COUNT(*) AS pending_queue
FROM blockchain.government_transactions
WHERE UPPER(COALESCE(transaction_status, blockchain_status, '')) IN (
  'PENDING_REVIEW','PENDING'
);

--2--Pending Review
SELECT COUNT(*) AS pending_review
FROM blockchain.government_transactions
WHERE UPPER(COALESCE(transaction_status, blockchain_status, '')) = 'PENDING_REVIEW';


--3--Approving Now
SELECT COUNT(*) AS approving_now
FROM blockchain.government_transactions
WHERE UPPER(COALESCE(transaction_status, blockchain_status, '')) IN (
  'APPROVING',
  'PROCESSING',
  'BLOCKCHAIN_SUBMITTING'
);

--4--Blockchain Failed
SELECT COUNT(*) AS blockchain_failed
FROM blockchain.government_transactions
WHERE UPPER(COALESCE(blockchain_status, '')) IN (
  'FAILED',
  'ERROR',
  'BLOCKCHAIN_FAILED'
);


--5--Approve Button
UPDATE blockchain.government_transactions
SET
    transaction_status = 'APPROVED',
    approved_by = COALESCE(:approved_by, 'SYSTEM_OFFICER'),
    approved_at = NOW(),
    updated_at = NOW(),
	updated_by =  NOW(),
    blockchain_status = 'PENDING'
WHERE transaction_id = :transaction_id
  AND UPPER(COALESCE(transaction_status, '')) = 'PENDING_REVIEW'

--6--Reject Button
UPDATE blockchain.government_transactions
SET
    transaction_status = 'REJECTED',
    rejected_by = COALESCE(:rejected_by, 'SYSTEM_OFFICER'),
    rejected_at = NOW(),
    rejection_reason = COALESCE(:rejection_reason, 'Rejected from approval queue'),
    updated_at = NOW()
WHERE transaction_id = :transaction_id
  AND UPPER(COALESCE(transaction_status, '')) = 'PENDING_REVIEW'
RETURNING *;

--7--View Details
Select 
Transaction_id as "Transaction ID",
Resident_full_name as "Residemt Name",
service_name as "Service Name",
total_fee as "Total Fees",
payment_method as "Payment Method",
created_at as "Submitted Date",
transaction_status as "Status",
blockchain_status as "Blockchain Status"
from blockchain.Government_transactions
where Transaction_id = 8

--8--Payment Method
select distinct(payment_method) from blockchain.government_transactions
where transaction_status = 'PENDING_REVIEW'

--9--Grid Data 
Select 
Transaction_id as "Transaction ID",
Resident_full_name as "Residemt Name",
service_name as "Service Name",
total_fee as "Total Fees",
currency as "Currency",
payment_method as "Payment Method",
created_at as "Submitted Date",
transaction_status as "Status",
blockchain_status as "Status"
from blockchain.Government_transactions
where transaction_status = 'PENDING_REVIEW'
