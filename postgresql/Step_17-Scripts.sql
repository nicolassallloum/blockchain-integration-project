--12.2 Recommended Constraints
ALTER TABLE blockchain.wallets
ADD CONSTRAINT uq_wallets_wallet_address
UNIQUE (wallet_address);

ALTER TABLE blockchain.wallets
ADD CONSTRAINT uq_wallets_customer_org
UNIQUE (customer_id, organization_id);

ALTER TABLE blockchain.transactions
ADD CONSTRAINT uq_transactions_ledger_tx_id
UNIQUE (ledger_tx_id);

ALTER TABLE blockchain.transactions
ADD CONSTRAINT uq_transactions_transaction_id
UNIQUE (transaction_id);

ALTER TABLE blockchain.system_mappings
ADD CONSTRAINT uq_system_mapping_source
UNIQUE (source_system, source_entity_type, source_entity_id);


-- 12.3 Idempotent Insert Pattern
INSERT INTO blockchain.transactions (
    transaction_id,
    ledger_tx_id,
    from_wallet_address,
    to_wallet_address,
    transaction_type,
    amount,
    currency,
    transaction_status,
    ledger_block_number,
    ledger_timestamp,
    created_at,
    updated_at
)
VALUES (
    :transaction_id,
    :ledger_tx_id,
    :from_wallet_address,
    :to_wallet_address,
    :transaction_type,
    :amount,
    :currency,
    :transaction_status,
    :ledger_block_number,
    :ledger_timestamp,
    NOW(),
    NOW()
)
ON CONFLICT (ledger_tx_id)
DO UPDATE SET
    transaction_status = EXCLUDED.transaction_status,
    ledger_block_number = EXCLUDED.ledger_block_number,
    ledger_timestamp = EXCLUDED.ledger_timestamp,
    updated_at = NOW();

-- 14.1 Create Sync Events Table
CREATE TABLE IF NOT EXISTS blockchain.sync_events (
    sync_event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    ledger_tx_id VARCHAR(128) NOT NULL,
    ledger_block_number BIGINT,
    ledger_timestamp TIMESTAMPTZ,

    channel_name VARCHAR(100) NOT NULL,
    chaincode_name VARCHAR(150) NOT NULL,
    event_name VARCHAR(150) NOT NULL,
    event_type VARCHAR(100) NOT NULL,

    event_payload JSONB NOT NULL,

    sync_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retry_count INTEGER NOT NULL DEFAULT 5,

    last_retry_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,

    error_code VARCHAR(100),
    error_message TEXT,

    processed_at TIMESTAMPTZ,

    created_by VARCHAR(100) DEFAULT 'fabric-event-listener',
    updated_by VARCHAR(100) DEFAULT 'fabric-event-listener',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_sync_events_ledger_tx_event
        UNIQUE (ledger_tx_id, event_name),

    CONSTRAINT chk_sync_events_status
        CHECK (
            sync_status IN (
                'PENDING',
                'PROCESSING',
                'SUCCESS',
                'FAILED_RETRYABLE',
                'FAILED_PERMANENT',
                'SKIPPED_DUPLICATE',
                'RECONCILED'
            )
        )
);


-- 14.2 Sync Events Indexes
CREATE INDEX IF NOT EXISTS idx_sync_events_status
ON blockchain.sync_events (sync_status);

CREATE INDEX IF NOT EXISTS idx_sync_events_ledger_tx_id
ON blockchain.sync_events (ledger_tx_id);

CREATE INDEX IF NOT EXISTS idx_sync_events_event_type
ON blockchain.sync_events (event_type);

CREATE INDEX IF NOT EXISTS idx_sync_events_next_retry_at
ON blockchain.sync_events (next_retry_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_created_at
ON blockchain.sync_events (created_at);

CREATE INDEX IF NOT EXISTS idx_sync_events_payload_gin
ON blockchain.sync_events USING GIN (event_payload);



-- 14.3 Table Comment
COMMENT ON TABLE blockchain.sync_events IS
'Tracks Hyperledger Fabric events synchronized into PostgreSQL, including retry state, error handling, idempotency, and reconciliation status.';

-- 15. SQL Reconciliation Queries
-- 15.1 Find Transactions Without Ledger Transaction ID
SELECT
    transaction_id,
    from_wallet_address,
    to_wallet_address,
    amount,
    transaction_status,
    created_at
FROM blockchain.transactions
WHERE ledger_tx_id IS NULL
ORDER BY created_at DESC;

-- 15.2 Find Duplicate Ledger Transactions
SELECT
    ledger_tx_id,
    COUNT(*) AS duplicate_count
FROM blockchain.transactions
WHERE ledger_tx_id IS NOT NULL
GROUP BY ledger_tx_id
HAVING COUNT(*) > 1;

-- 15.3 Find Failed Sync Events
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    sync_status,
    retry_count,
    error_message,
    created_at,
    updated_at
FROM blockchain.sync_events
WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
ORDER BY updated_at DESC;


-- 15.4 Find Retryable Sync Events
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    retry_count,
    next_retry_at
FROM blockchain.sync_events
WHERE sync_status = 'FAILED_RETRYABLE'
  AND retry_count < max_retry_count
  AND next_retry_at <= NOW()
ORDER BY next_retry_at ASC;


-- 15.5 Find Events Stuck in Processing
SELECT
    sync_event_id,
    ledger_tx_id,
    event_type,
    sync_status,
    updated_at
FROM blockchain.sync_events
WHERE sync_status = 'PROCESSING'
  AND updated_at < NOW() - INTERVAL '10 minutes'
ORDER BY updated_at ASC;


-- 15.6 Find Wallets Without Ledger Reference
SELECT
    wallet_id,
    wallet_address,
    customer_id,
    organization_id,
    wallet_status,
    created_at
FROM blockchain.wallets
WHERE ledger_tx_id IS NULL
ORDER BY created_at DESC;

-- 15.7 Find Transactions Missing Audit Logs
SELECT
    t.transaction_id,
    t.ledger_tx_id,
    t.transaction_type,
    t.transaction_status,
    t.created_at
FROM blockchain.transactions t
LEFT JOIN blockchain.audit_logs a
    ON a.ledger_tx_id = t.ledger_tx_id
WHERE a.audit_id IS NULL
ORDER BY t.created_at DESC;


-- 15.8 Daily Sync Summary
SELECT
    DATE(created_at) AS sync_date,
    event_type,
    sync_status,
    COUNT(*) AS total_events
FROM blockchain.sync_events
GROUP BY
    DATE(created_at),
    event_type,
    sync_status
ORDER BY
    sync_date DESC,
    event_type,
    sync_status;


-- 15.9 Failed Event Percentage by Day
SELECT
    DATE(created_at) AS sync_date,
    COUNT(*) AS total_events,
    COUNT(*) FILTER (
        WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
    ) AS failed_events,
    ROUND(
        (
            COUNT(*) FILTER (
                WHERE sync_status IN ('FAILED_RETRYABLE', 'FAILED_PERMANENT')
            )::NUMERIC
            / NULLIF(COUNT(*), 0)
        ) * 100,
        2
    ) AS failure_percentage
FROM blockchain.sync_events
GROUP BY DATE(created_at)
ORDER BY sync_date DESC;



-- 15.10 Wallet Balance Reconciliation Placeholder Query
WITH calculated_balances AS (
    SELECT
        wallet_address,
        SUM(balance_delta) AS calculated_balance
    FROM (
        SELECT
            from_wallet_address AS wallet_address,
            -amount AS balance_delta
        FROM blockchain.transactions
        WHERE transaction_status = 'COMPLETED'

        UNION ALL

        SELECT
            to_wallet_address AS wallet_address,
            amount AS balance_delta
        FROM blockchain.transactions
        WHERE transaction_status = 'COMPLETED'
    ) x
    GROUP BY wallet_address
)
SELECT
    w.wallet_address,
    w.current_balance AS postgres_wallet_balance,
    COALESCE(c.calculated_balance, 0) AS calculated_transaction_balance,
    w.current_balance - COALESCE(c.calculated_balance, 0) AS difference
FROM blockchain.wallets w
LEFT JOIN calculated_balances c
    ON c.wallet_address = w.wallet_address
WHERE w.current_balance <> COALESCE(c.calculated_balance, 0)
ORDER BY ABS(w.current_balance - COALESCE(c.calculated_balance, 0)) DESC;


-- 16. Event Listener Pseudocode
async function processFabricEvent(event) {
  const client = await postgresPool.connect();

  try {
    const payload = JSON.parse(event.payload.toString());

    await client.query('BEGIN');

    const existingEvent = await client.query(
      `
      SELECT sync_event_id, sync_status
      FROM blockchain.sync_events
      WHERE ledger_tx_id = $1
        AND event_name = $2
      `,
      [payload.ledgerTxId, event.eventName]
    );

    if (existingEvent.rowCount > 0) {
      await client.query(
        `
        UPDATE blockchain.sync_events
        SET sync_status = 'SKIPPED_DUPLICATE',
            updated_at = NOW()
        WHERE ledger_tx_id = $1
          AND event_name = $2
        `,
        [payload.ledgerTxId, event.eventName]
      );

      await client.query('COMMIT');
      return;
    }

    await client.query(
      `
      INSERT INTO blockchain.sync_events (
          ledger_tx_id,
          ledger_block_number,
          ledger_timestamp,
          channel_name,
          chaincode_name,
          event_name,
          event_type,
          event_payload,
          sync_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING')
      `,
      [
        payload.ledgerTxId,
        payload.blockNumber,
        payload.ledgerTimestamp,
        payload.channelName,
        payload.chaincodeName,
        event.eventName,
        payload.eventType,
        payload
      ]
    );

    if (payload.eventType === 'WalletCreated') {
      await syncWalletCreated(client, payload);
    }

    if (payload.eventType === 'WalletTransferCompleted') {
      await syncTransactionCompleted(client, payload);
    }

    await client.query(
      `
      UPDATE blockchain.sync_events
      SET sync_status = 'SUCCESS',
          processed_at = NOW(),
          updated_at = NOW()
      WHERE ledger_tx_id = $1
        AND event_name = $2
      `,
      [payload.ledgerTxId, event.eventName]
    );

    await client.query('COMMIT');

  } catch (error) {
    await client.query('ROLLBACK');

    await markSyncEventFailed(event, error);

  } finally {
    client.release();
  }
}



-- 20.2 PostgreSQL Role Recommendation
CREATE ROLE blockchain_sync_user LOGIN PASSWORD 'change_this_password';

GRANT USAGE ON SCHEMA blockchain TO blockchain_sync_user;

GRANT SELECT, INSERT, UPDATE
ON ALL TABLES IN SCHEMA blockchain
TO blockchain_sync_user;

GRANT USAGE, SELECT
ON ALL SEQUENCES IN SCHEMA blockchain
TO blockchain_sync_user;