BEGIN;

-- =========================================================
-- STEP 26 — Transaction History & Search API Indexes
-- Target table: blockchain.blockchain_transaction
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_transaction_id
ON blockchain.blockchain_transaction (transaction_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_sender_wallet
ON blockchain.blockchain_transaction (sender_wallet_address);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_receiver_wallet
ON blockchain.blockchain_transaction (receiver_wallet_address);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_sender_customer
ON blockchain.blockchain_transaction (sender_customer_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_receiver_customer
ON blockchain.blockchain_transaction (receiver_customer_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_organization
ON blockchain.blockchain_transaction (organization_id);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_type
ON blockchain.blockchain_transaction (transaction_type);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_status
ON blockchain.blockchain_transaction (status);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_created_at
ON blockchain.blockchain_transaction (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_amount
ON blockchain.blockchain_transaction (amount);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_type_status_created
ON blockchain.blockchain_transaction (transaction_type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_org_status_created
ON blockchain.blockchain_transaction (organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_sender_wallet_created
ON blockchain.blockchain_transaction (sender_wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_receiver_wallet_created
ON blockchain.blockchain_transaction (receiver_wallet_address, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_sender_customer_created
ON blockchain.blockchain_transaction (sender_customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blockchain_transaction_receiver_customer_created
ON blockchain.blockchain_transaction (receiver_customer_id, created_at DESC);

COMMENT ON INDEX blockchain.idx_blockchain_transaction_transaction_id IS
'STEP 26: Supports direct lookup by transaction_id.';

COMMENT ON INDEX blockchain.idx_blockchain_transaction_sender_wallet IS
'STEP 26: Supports transaction search by sender wallet address.';

COMMENT ON INDEX blockchain.idx_blockchain_transaction_receiver_wallet IS
'STEP 26: Supports transaction search by receiver wallet address.';

COMMENT ON INDEX blockchain.idx_blockchain_transaction_created_at IS
'STEP 26: Supports date range filtering and sorting by created_at.';

COMMENT ON INDEX blockchain.idx_blockchain_transaction_type_status_created IS
'STEP 26: Supports combined filtering by transaction type, status, and transaction date.';

COMMIT;
