CREATE SCHEMA IF NOT EXISTS blockchain;

CREATE TABLE IF NOT EXISTS blockchain.transaction_documents (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT NULL,
    transaction_reference TEXT NULL,
    resident_id TEXT NOT NULL,
    resident_name VARCHAR(255) NOT NULL,
    total_fees NUMERIC(18,3) NOT NULL DEFAULT 0,
    currency VARCHAR(10) NOT NULL DEFAULT 'GOV',
    document_type VARCHAR(100) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    expiry_date DATE NULL,
    original_file_name VARCHAR(255) NOT NULL,
    stored_file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    mime_type VARCHAR(150) NULL,
    file_size BIGINT NULL,
    document_hash VARCHAR(128) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Review',
    uploaded_by TEXT DEFAULT 'Officer',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE blockchain.transaction_documents
  ADD COLUMN IF NOT EXISTS transaction_id BIGINT,
  ADD COLUMN IF NOT EXISTS transaction_reference TEXT,
  ADD COLUMN IF NOT EXISTS resident_id TEXT,
  ADD COLUMN IF NOT EXISTS resident_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS total_fees NUMERIC(18,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'GOV',
  ADD COLUMN IF NOT EXISTS document_type VARCHAR(100),
  ADD COLUMN IF NOT EXISTS document_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS stored_file_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS file_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type VARCHAR(150),
  ADD COLUMN IF NOT EXISTS file_size BIGINT,
  ADD COLUMN IF NOT EXISTS document_hash VARCHAR(128),
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending Review',
  ADD COLUMN IF NOT EXISTS uploaded_by TEXT DEFAULT 'Officer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE blockchain.transaction_documents
  ALTER COLUMN transaction_id DROP NOT NULL;

ALTER TABLE blockchain.transaction_documents
  ALTER COLUMN resident_id TYPE TEXT USING resident_id::TEXT;

ALTER TABLE blockchain.transaction_documents
  ALTER COLUMN resident_id SET NOT NULL;

ALTER TABLE blockchain.transaction_documents
  ALTER COLUMN currency SET DEFAULT 'GOV';

ALTER TABLE blockchain.transaction_documents
  ALTER COLUMN status SET DEFAULT 'Pending Review';

CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_id
ON blockchain.transaction_documents(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_documents_transaction_reference
ON blockchain.transaction_documents(transaction_reference);

CREATE INDEX IF NOT EXISTS idx_transaction_documents_resident_id
ON blockchain.transaction_documents(resident_id);

CREATE INDEX IF NOT EXISTS idx_transaction_documents_hash
ON blockchain.transaction_documents(document_hash);

CREATE INDEX IF NOT EXISTS idx_transaction_documents_status
ON blockchain.transaction_documents(status);
