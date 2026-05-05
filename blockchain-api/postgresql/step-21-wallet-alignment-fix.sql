-- ============================================================
-- STEP 21 FIX
-- Wallet Creation API Fabric/PostgreSQL Wallet Address Alignment
-- ============================================================

BEGIN;


-- Fabric transaction IDs are hash strings, not UUIDs.
ALTER TABLE blockchain.transactions
ALTER COLUMN fabric_transaction_id TYPE VARCHAR(128)
USING fabric_transaction_id::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'blockchain'
      AND table_name = 'wallets'
      AND column_name = 'fabric_transaction_id'
  ) THEN
    ALTER TABLE blockchain.wallets
    ALTER COLUMN fabric_transaction_id TYPE VARCHAR(128)
    USING fabric_transaction_id::text;
  END IF;
END $$;

-- Ensure wallet address columns exist for transaction history.
ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS from_wallet_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS to_wallet_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_wallet_address VARCHAR(255),
ADD COLUMN IF NOT EXISTS receiver_wallet_address VARCHAR(255);

-- Ensure Fabric response storage exists.
ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS fabric_response JSONB;

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS fabric_response JSONB;

-- Backfill old transaction history columns.
UPDATE blockchain.transactions
SET
  from_wallet_address = COALESCE(from_wallet_address, sender_wallet_address),
  to_wallet_address = COALESCE(to_wallet_address, receiver_wallet_address),
  updated_at = NOW()
WHERE transaction_type = 'WALLET_TO_WALLET'
  AND (
    from_wallet_address IS NULL
    OR to_wallet_address IS NULL
  );

-- Align known tested wallets.
UPDATE blockchain.wallets
SET
  wallet_address = 'WALLET_BD5452FBC71AA73A28A2F16B9741F304EDB9AB24',
  currency = 'TOKEN',
  current_balance = 984,
  updated_at = NOW()
WHERE customer_id = 'CUST2017';

UPDATE blockchain.wallets
SET
  wallet_address = 'WALLET_380901774428773E96E8EBCA4B4D8C9FB920FB6A',
  currency = 'TOKEN',
  current_balance = 1016,
  updated_at = NOW()
WHERE customer_id = 'CUST2018';

CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_customer_id
ON blockchain.wallets(customer_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_wallet_address
ON blockchain.wallets(wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_from_wallet_address
ON blockchain.transactions(from_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_to_wallet_address
ON blockchain.transactions(to_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_sender_wallet_address
ON blockchain.transactions(sender_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_receiver_wallet_address
ON blockchain.transactions(receiver_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_request_id
ON blockchain.transactions(request_id);

CREATE INDEX IF NOT EXISTS idx_transactions_fabric_transaction_id
ON blockchain.transactions(fabric_transaction_id);

COMMIT;
