Dashboard Summary
curl -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/dashboard/summary" \
  -H "Content-Type: application/json"
  

curl -s -X GET "http://172.31.13.90:3001/api/v1/government-blockchain/dashboard/health" \
  -H "Content-Type: application/json" | jq
 
 

--1--Total Residents
SELECT COUNT(*)::int AS total_residents
FROM blockchain.residents;

--2--Total Ministries
SELECT COUNT(*)::int AS total_ministries
FROM blockchain.government_ministries;

--3--Total Public Administrations
SELECT COUNT(*)::int AS total_public_administrations
FROM blockchain.public_administrations;

--4--Total Wallets
WITH wallet_counts AS (
    SELECT COUNT(*)::int AS total_count
    FROM blockchain.resident_wallets

    UNION ALL

    SELECT COUNT(*)::int AS total_count
    FROM blockchain.government_ministry_wallets
	
	UNION ALL 
	
    SELECT COUNT(*)::int AS total_count
    FROM blockchain.wallets	
)
SELECT COALESCE(SUM(total_count), 0)::int AS total_wallets
FROM wallet_counts;

--5--Total Transactions
SELECT COUNT(*)::int AS total_transactions
FROM blockchain.transactions

--6--Governement Transactions
SELECT COUNT(*)::int AS total_transactions
FROM blockchain.government_transactions

--7--Total Successful Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'success',
    'successful',
    'completed',
    'confirmed',
    'approved'
);

--8--Total Pending Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'pending',
    'in_progress',
    'processing',
    'submitted'
);

--9--Total Failed Transactions
SELECT COUNT(*)::int AS total_successful_transactions
FROM blockchain.transactions
WHERE LOWER(status) IN (
    'failed',
    'failure',
    'rejected',
    'error'
);

--10--Total Payments
SELECT COUNT(*)::int AS total_payments
FROM blockchain.digital_stamp_payments;

--11--Total Payment Amount
SELECT COALESCE(SUM(amount), 0)::numeric(18,2) AS total_payment_amount
FROM blockchain.digital_stamp_payments;


--12--Total Digital Stamps
SELECT COUNT(*)::int AS total_digital_stamps
FROM blockchain.digital_stamp_payments;

--13--Total KYC Documents
SELECT COUNT(*)::int AS total_documents
FROM blockchain.kyc_documents;

--14--Total Transaction Documents
SELECT COUNT(*)::int AS total_documents
FROM blockchain.transaction_documents;


--15--Total Documents
SELECT COUNT(*)::int+(SELECT COUNT(*)::int AS total_documents
FROM blockchain.transaction_documents) AS total_documents
FROM blockchain.kyc_documents


--17--Total AML Alerts
SELECT COUNT(*)::int AS total_aml_alerts
FROM blockchain.aml_alerts;



--19--Transactions by Status
SELECT
    status AS status,
    COUNT(*)::int AS total
FROM blockchain.transactions
GROUP BY status
ORDER BY total DESC;

--20--Transactions by Ministry
SELECT
    COALESCE(m.ministry_name, bt.ministry_name, 'Unknown Ministry') AS ministry_name,
    COUNT(*)::int AS total_transactions
FROM blockchain.government_transactions bt
LEFT JOIN blockchain.government_ministries m
    ON m.ministry_id::text = bt.ministry_id
GROUP BY COALESCE(m.ministry_name, bt.ministry_name, 'Unknown Ministry')
ORDER BY total_transactions DESC
LIMIT 10;


--21--Transactions by Service
SELECT
    COALESCE(service_name, service_code, transaction_type, 'Unknown Service') AS service_name,
    COUNT(*)::int AS total_transactions
FROM blockchain.government_transactions
GROUP BY COALESCE(service_name, service_code, transaction_type, 'Unknown Service')
ORDER BY total_transactions DESC
LIMIT 10;

--22--Payments Timeline
SELECT
    DATE_TRUNC('day',  created_at)::date AS payment_day,
    COUNT(*)::int AS total_payments,
    COALESCE(SUM(amount), 0)::numeric(18,2) AS total_amount
FROM blockchain.digital_stamp_payments
GROUP BY DATE_TRUNC('day', created_at)::date
ORDER BY payment_day ASC;


--23--Wallet Growth
WITH wallets AS (
    SELECT created_at::date AS created_day
    FROM blockchain.resident_wallets
    WHERE created_at IS NOT NULL

    UNION ALL

    SELECT created_at::date AS created_day
    FROM blockchain.government_ministry_wallets
    WHERE created_at IS NOT NULL
	
	UNION ALL
	
    SELECT created_at::date AS created_day
    FROM blockchain.wallets
    WHERE created_at IS NOT NULL	
),
daily_wallets AS (
    SELECT
        created_day,
        COUNT(*)::int AS daily_total
    FROM wallets
    GROUP BY created_day
)
SELECT
    created_day,
    daily_total,
    SUM(daily_total) OVER (ORDER BY created_day)::int AS cumulative_total
FROM daily_wallets
ORDER BY created_day ASC;

--24--Blockchain Submission Status
SELECT
     status AS blockchain_status,
    COUNT(*)::int AS total
FROM blockchain.transactions
GROUP BY status
ORDER BY total DESC;

--25--AML Alerts by Severity
SELECT
    severity AS severity,
    COUNT(*)::int AS total
FROM blockchain.aml_alerts
GROUP BY severity
ORDER BY total DESC;




--27--Latest Transactions
SELECT
    transaction_id,
    transaction_reference,
    COALESCE(transaction_type, service_name, service_code) AS transaction_type,
    COALESCE(transaction_status, blockchain_status) AS status,
    amount,
    blockchain_tx_id,
    created_at
FROM blockchain.government_transactions
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

--28--Latest AML Alerts
SELECT
    alert_id,
    transaction_id,
     rule_code AS alert_type,
    severity AS severity,
     alert_status AS status,
    created_at
FROM blockchain.aml_alerts
ORDER BY created_at DESC NULLS LAST
LIMIT 10;

--29--Latest Audit Logs
SELECT
    audit_log_id,
    correlation_id,
    entity_type,
    entity_id,
    action,
    action_category,
    actor_type,
    actor_name,
    status,
    severity,
    COALESCE(event_at, created_at) AS event_at
FROM blockchain.audit_logs
ORDER BY COALESCE(event_at, created_at) DESC NULLS LAST
LIMIT 10;


--30--PostgreSQL Health
SELECT 
    'UP' AS status,
    NOW() AS checked_at,
    CURRENT_DATABASE() AS database_name,
    'Blockchain' AS current_schema;

--31--Last Blockchain Transaction
SELECT
    transaction_id,
    transaction_description,
    fabric_block_number,
    fabric_status AS blockchain_status,
    created_at
FROM blockchain.transactions
WHERE fabric_block_number IS NOT NULL
   OR fabric_status IS NOT NULL
ORDER BY created_at DESC NULLS LAST
LIMIT 1;

