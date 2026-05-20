/* ============================================================
   Government Blockchain Dropdown Reference Tables
   Schema: blockchain
   Tables:
   - countries
   - governorates
   - wallet_types
   - wallet_statuses
   ============================================================ */



// /* ============================================================
//    1. Countries Table
//    ============================================================ */

// CREATE TABLE IF NOT EXISTS blockchain.countries (
//     country_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

//     country_code VARCHAR(10) NOT NULL UNIQUE,
//     country_name VARCHAR(150) NOT NULL,
//     country_name_ar VARCHAR(150),

//     phone_code VARCHAR(10),
//     currency_code VARCHAR(10),

//     is_active BOOLEAN NOT NULL DEFAULT TRUE,

//     created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
//     updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
// );

// COMMENT ON TABLE blockchain.countries IS
// 'Reference table for countries used by government blockchain forms.';


/* ============================================================
   2. Governorates Table
   Linked To Country
   ============================================================ */

CREATE TABLE IF NOT EXISTS blockchain.governorates (
    governorate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    country_id UUID NOT NULL,

    governorate_code VARCHAR(50) NOT NULL,
    governorate_name VARCHAR(150) NOT NULL,
    governorate_name_ar VARCHAR(150),

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_governorates_country
        FOREIGN KEY (country_id)
        REFERENCES blockchain.countries(country_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT uq_governorate_country_code
        UNIQUE (country_id, governorate_code),

    CONSTRAINT uq_governorate_country_name
        UNIQUE (country_id, governorate_name)
);

COMMENT ON TABLE blockchain.governorates IS
'Reference table for governorates linked to countries.';


/* ============================================================
   3. Wallet Types Table
   ============================================================ */

CREATE TABLE IF NOT EXISTS blockchain.wallet_types (
    wallet_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_type_code VARCHAR(80) NOT NULL UNIQUE,
    wallet_type_name VARCHAR(150) NOT NULL,
    wallet_type_description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE blockchain.wallet_types IS
'Reference table for wallet types used by government blockchain wallets.';


/* ============================================================
   4. Wallet Statuses Table
   ============================================================ */

CREATE TABLE IF NOT EXISTS blockchain.wallet_statuses (
    wallet_status_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    wallet_status_code VARCHAR(80) NOT NULL UNIQUE,
    wallet_status_name VARCHAR(150) NOT NULL,
    wallet_status_description TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE blockchain.wallet_statuses IS
'Reference table for wallet statuses used by government blockchain wallets.';


/* ============================================================
   Indexes
   ============================================================ */

CREATE INDEX IF NOT EXISTS idx_countries_active
ON blockchain.countries(is_active);

CREATE INDEX IF NOT EXISTS idx_governorates_country_id
ON blockchain.governorates(country_id);

CREATE INDEX IF NOT EXISTS idx_governorates_active
ON blockchain.governorates(is_active);

CREATE INDEX IF NOT EXISTS idx_wallet_types_active
ON blockchain.wallet_types(is_active);

CREATE INDEX IF NOT EXISTS idx_wallet_statuses_active
ON blockchain.wallet_statuses(is_active);


/* ============================================================
   Seed Countries
   ============================================================ */


/* ============================================================
   Seed Lebanon Governorates
   ============================================================ */

INSERT INTO blockchain.governorates (
    country_id,
    governorate_code,
    governorate_name,
    governorate_name_ar,
    is_active
)
SELECT
    c.country_id,
    v.governorate_code,
    v.governorate_name,
    v.governorate_name_ar,
    TRUE
FROM blockchain.countries c
CROSS JOIN (
    VALUES
        ('BEIRUT', 'Beirut', 'بيروت'),
        ('MOUNT_LEBANON', 'Mount Lebanon', 'جبل لبنان'),
        ('NORTH_LEBANON', 'North Lebanon', 'الشمال'),
        ('SOUTH_LEBANON', 'South Lebanon', 'الجنوب'),
        ('BEKAA', 'Bekaa', 'البقاع'),
        ('BAALBEK_HERMEL', 'Baalbek-Hermel', 'بعلبك الهرمل'),
        ('NABATIEH', 'Nabatieh', 'النبطية'),
        ('AKKAR', 'Akkar', 'عكار')
) AS v(governorate_code, governorate_name, governorate_name_ar)
WHERE c.country_code = 'LB'
ON CONFLICT (country_id, governorate_code) DO UPDATE
SET
    governorate_name = EXCLUDED.governorate_name,
    governorate_name_ar = EXCLUDED.governorate_name_ar,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;


/* ============================================================
   Seed UAE Governorates / Emirates
   ============================================================ */

INSERT INTO blockchain.governorates (
    country_id,
    governorate_code,
    governorate_name,
    governorate_name_ar,
    is_active
)
SELECT
    c.country_id,
    v.governorate_code,
    v.governorate_name,
    v.governorate_name_ar,
    TRUE
FROM blockchain.countries c
CROSS JOIN (
    VALUES
        ('ABU_DHABI', 'Abu Dhabi', 'أبوظبي'),
        ('DUBAI', 'Dubai', 'دبي'),
        ('SHARJAH', 'Sharjah', 'الشارقة'),
        ('AJMAN', 'Ajman', 'عجمان'),
        ('UMM_AL_QUWAIN', 'Umm Al Quwain', 'أم القيوين'),
        ('RAS_AL_KHAIMAH', 'Ras Al Khaimah', 'رأس الخيمة'),
        ('FUJAIRAH', 'Fujairah', 'الفجيرة')
) AS v(governorate_code, governorate_name, governorate_name_ar)
WHERE c.country_code = 'AE'
ON CONFLICT (country_id, governorate_code) DO UPDATE
SET
    governorate_name = EXCLUDED.governorate_name,
    governorate_name_ar = EXCLUDED.governorate_name_ar,
    is_active = TRUE,
    updated_at = CURRENT_TIMESTAMP;


/* ============================================================
   Seed Wallet Types
   ============================================================ */

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


/* ============================================================
   Seed Wallet Statuses
   ============================================================ */

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


/* ============================================================
   Validation Output
   ============================================================ */

DO $$
BEGIN
    RAISE NOTICE 'Government dropdown reference tables created and seeded successfully.';
END $$;
