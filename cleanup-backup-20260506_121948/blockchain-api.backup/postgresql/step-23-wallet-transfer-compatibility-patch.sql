BEGIN;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(50);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS sender_wallet_id UUID;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS sender_wallet_address VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS sender_customer_id VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS receiver_wallet_id UUID;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS receiver_wallet_address VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS receiver_customer_id VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS amount NUMERIC(20, 6) DEFAULT 0;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'USD';

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS transaction_purpose TEXT;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS transaction_description TEXT;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS transaction_status VARCHAR(30) DEFAULT 'PENDING';

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS risk_level VARCHAR(30) DEFAULT 'LOW';

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS fabric_tx_id VARCHAR(150);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS fabric_status VARCHAR(30) DEFAULT 'PENDING';

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS request_id VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS created_by VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

ALTER TABLE blockchain.transactions
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS current_balance NUMERIC(20, 6) DEFAULT 0;

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS wallet_status VARCHAR(30) DEFAULT 'ACTIVE';

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE blockchain.wallets
ADD COLUMN IF NOT EXISTS updated_by VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS response_payload JSONB DEFAULT '{}'::jsonb;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE blockchain.integration_requests
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_id
ON blockchain.transactions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transactions_sender_wallet
ON blockchain.transactions(sender_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_receiver_wallet
ON blockchain.transactions(receiver_wallet_address);

CREATE INDEX IF NOT EXISTS idx_transactions_status
ON blockchain.transactions(transaction_status);

CREATE INDEX IF NOT EXISTS idx_transactions_request_id
ON blockchain.transactions(request_id);

CREATE INDEX IF NOT EXISTS idx_wallets_wallet_address
ON blockchain.wallets(wallet_address);

COMMIT;
