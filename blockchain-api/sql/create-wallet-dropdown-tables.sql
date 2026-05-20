CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS blockchain.wallet_types (
    wallet_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_type_code VARCHAR(80) NOT NULL UNIQUE,
    wallet_type_name VARCHAR(150) NOT NULL,
    wallet_type_description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain.wallet_statuses (
    wallet_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_status_code VARCHAR(80) NOT NULL UNIQUE,
    wallet_status_name VARCHAR(150) NOT NULL,
    wallet_status_description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_types_active
ON blockchain.wallet_types(is_active);

CREATE INDEX IF NOT EXISTS idx_wallet_statuses_active
ON blockchain.wallet_statuses(is_active);

INSERT INTO blockchain.wallet_types (
    wallet_type_code,
    wallet_type_name,
    wallet_type_description,
    is_active
)
VALUES
    (
        'MINISTRY_WALLET',
        'Ministry Wallet',
        'Main blockchain wallet assigned to a government ministry.',
        TRUE
    ),
    (
        'TREASURY_WALLET',
        'Treasury Wallet',
        'Wallet used for treasury, collections, and government financial settlement.',
        TRUE
    ),
    (
        'SERVICE_COLLECTION_WALLET',
        'Service Collection Wallet',
        'Wallet used to collect government service fees, stamps, and payments.',
        TRUE
    )
ON CONFLICT (wallet_type_code) DO UPDATE
SET
    wallet_type_name = EXCLUDED.wallet_type_name,
    wallet_type_description = EXCLUDED.wallet_type_description,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.wallet_statuses (
    wallet_status_code,
    wallet_status_name,
    wallet_status_description,
    is_active
)
VALUES
    (
        'ACTIVE',
        'Active',
        'Wallet is active and can be used for transactions.',
        TRUE
    ),
    (
        'INACTIVE',
        'Inactive',
        'Wallet is inactive and cannot process transactions.',
        TRUE
    ),
    (
        'PENDING',
        'Pending',
        'Wallet is created or requested but not yet activated.',
        TRUE
    ),
    (
        'SUSPENDED',
        'Suspended',
        'Wallet is suspended due to compliance, security, or administrative action.',
        TRUE
    )
ON CONFLICT (wallet_status_code) DO UPDATE
SET
    wallet_status_name = EXCLUDED.wallet_status_name,
    wallet_status_description = EXCLUDED.wallet_status_description,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;

DO $$
BEGIN
    RAISE NOTICE 'Wallet dropdown tables created and seeded successfully.';
END $$;
