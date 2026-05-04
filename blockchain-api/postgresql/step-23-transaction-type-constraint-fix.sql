
BEGIN;

ALTER TABLE blockchain.transactions
DROP CONSTRAINT IF EXISTS chk_blockchain_transactions_type;

ALTER TABLE blockchain.transactions
ADD CONSTRAINT chk_blockchain_transactions_type
CHECK (
  transaction_type IN (
    'WALLET_TO_WALLET',
    'WALLET_TO_ORGANIZATION',
    'ORGANIZATION_TO_WALLET',
    'ORGANIZATION_TO_ORGANIZATION',
    'TRANSFER',
    'DEBIT',
    'CREDIT',
    'PAYMENT',
    'REFUND',
    'ADJUSTMENT'
  )
);

COMMIT;
