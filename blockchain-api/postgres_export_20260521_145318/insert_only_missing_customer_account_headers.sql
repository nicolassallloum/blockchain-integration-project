-- ============================================================
-- Insert 2000 linked rows WITHOUT inserting into lookup/item tables
-- 
-- This script DOES NOT insert into:
--   sdedba.ref_item
--   sdedba.ref_lgcy_item_info
--   sdedba.ref_com_currency
--   ref_sysp71
--   sdedba.sts_status
--   findba.fin_account_item
--
-- It inserts ONLY into:
--   sdedba.ref_customer
--   sdedba.ref_customer_misc_info
--   findba.fin_account_info
--
-- Purpose:
--   Use existing findba.fin_account_item rows and create the missing
--   customer/account header data so your SELECT query returns rows.
-- ============================================================

BEGIN;

-- 1) Pick 2000 existing account_id values from fin_account_item
--    that do not already exist in fin_account_info.
DROP TABLE IF EXISTS tmp_seed_customer_accounts;

CREATE TEMP TABLE tmp_seed_customer_accounts AS
WITH base_customer AS (
    SELECT COALESCE(MAX(customer_id), 0)::BIGINT AS max_customer_id
    FROM sdedba.ref_customer
),
candidate_accounts AS (
    SELECT
        fai.account_id,
        MIN(fai.itm_id) AS itm_id,
        ROW_NUMBER() OVER (ORDER BY fai.account_id) AS rn
    FROM findba.fin_account_item fai
    WHERE fai.account_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM findba.fin_account_info a
          WHERE a.account_id = fai.account_id
      )
    GROUP BY fai.account_id
    ORDER BY fai.account_id
    LIMIT 2000
),
defaults AS (
    SELECT
        COALESCE(
            (
                SELECT cur_id
                FROM sdedba.ref_com_currency
                WHERE cur_name ILIKE '%Lebanese%'
                   OR cur_name ILIKE '%Pound%'
                ORDER BY cur_id
                LIMIT 1
            ),
            (
                SELECT cur_id
                FROM sdedba.ref_com_currency
                ORDER BY cur_id
                LIMIT 1
            )
        ) AS cur_id,

        (
            SELECT lin_code
            FROM ref_sysp71
            ORDER BY lin_code
            LIMIT 1
        ) AS account_reason_code
)
SELECT
    (bc.max_customer_id + ca.rn)::NUMERIC(10,0) AS customer_id,
    ca.account_id,
    ca.itm_id,
    d.cur_id,
    d.account_reason_code,
    'RIM-' || LPAD((bc.max_customer_id + ca.rn)::TEXT, 6, '0') AS tech_account_no,
    'LB' || LPAD(ca.account_id::TEXT, 26, '0') AS iban_number
FROM candidate_accounts ca
CROSS JOIN base_customer bc
CROSS JOIN defaults d;

-- Check how many rows will be inserted.
-- If this returns 0, it means all account_id values from fin_account_item
-- already exist in fin_account_info.
SELECT COUNT(*) AS rows_prepared_for_insert
FROM tmp_seed_customer_accounts;

-- 2) Insert customers
INSERT INTO sdedba.ref_customer (
    customer_id
)
SELECT
    t.customer_id
FROM tmp_seed_customer_accounts t
WHERE NOT EXISTS (
    SELECT 1
    FROM sdedba.ref_customer c
    WHERE c.customer_id = t.customer_id
);

-- 3) Insert customer misc info
INSERT INTO sdedba.ref_customer_misc_info (
    customer_id,
    tech_account_no
)
SELECT
    t.customer_id,
    t.tech_account_no
FROM tmp_seed_customer_accounts t
WHERE NOT EXISTS (
    SELECT 1
    FROM sdedba.ref_customer_misc_info mi
    WHERE mi.customer_id = t.customer_id
);

-- 4) Insert account info / account header
--    This links existing fin_account_item.account_id to the new customer.
INSERT INTO findba.fin_account_info (
    account_id,
    customer_id,
    cur_id,
    account_reason_code,
    iban_number,
    creation_date
)
SELECT
    t.account_id,
    t.customer_id,
    t.cur_id,
    t.account_reason_code,
    t.iban_number,
    CURRENT_DATE
FROM tmp_seed_customer_accounts t
WHERE NOT EXISTS (
    SELECT 1
    FROM findba.fin_account_info a
    WHERE a.account_id = t.account_id
);

COMMIT;

-- ============================================================
-- Verification 1: Check inserted customer/account links
-- ============================================================
SELECT
    COUNT(*) AS inserted_account_headers
FROM findba.fin_account_info a
JOIN tmp_seed_customer_accounts t
    ON t.account_id = a.account_id;

-- ============================================================
-- Verification 2: Your query should now return rows
-- ============================================================
SELECT
    COUNT(*) AS query_returned_rows
FROM
(
    SELECT
        mi.tech_account_no        AS rimno,
        ai.itm_id                 AS productid,
        ai.tech_lgcy_item_code    AS productclientcode,
        ai.account_itm_reference  AS productcode,

        (
            SELECT i.itm_name
            FROM sdedba.ref_item i
            WHERE i.itm_id = ai.itm_id
            LIMIT 1
        ) AS productname,

        a.cur_id AS currencyid,

        (
            SELECT cc.cur_name
            FROM sdedba.ref_com_currency cc
            WHERE cc.cur_id = a.cur_id
            LIMIT 1
        ) AS currencyname,

        ai.origination_date AS opendate,
        ai.lgcy_expiry_date AS enddate,

        (
            SELECT p.lin_name
            FROM ref_sysp71 p
            WHERE p.lin_code = a.account_reason_code
            LIMIT 1
        ) AS reasontoopenaccount,

        ai.status_code AS statuscode,

        (
            SELECT s.status_name
            FROM sdedba.sts_status s
            WHERE s.status_id = ai.status_code
            LIMIT 1
        ) AS statusname,

        a.iban_number   AS ibannumber,
        a.creation_date AS insertiondate,

        CASE
            WHEN (
                SELECT COUNT(1)
                FROM sdedba.ref_item m
                JOIN sdedba.ref_lgcy_item_info f
                    ON m.itm_id = f.itm_id
                WHERE m.itm_id = ai.itm_id
                  AND m.kty_code = 200
            ) = 0 THEN 0
            ELSE 1
        END AS services

    FROM sdedba.ref_customer c
    JOIN sdedba.ref_customer_misc_info mi
        ON c.customer_id = mi.customer_id
    LEFT JOIN findba.fin_account_info a
        ON c.customer_id = a.customer_id
    JOIN findba.fin_account_item ai
        ON a.account_id = ai.account_id
) tb
WHERE rimno LIKE 'RIM-%';

-- ============================================================
-- Sample result
-- ============================================================
SELECT
    *
FROM
(
    SELECT
        mi.tech_account_no        AS rimno,
        ai.itm_id                 AS productid,
        ai.tech_lgcy_item_code    AS productclientcode,
        ai.account_itm_reference  AS productcode,

        (
            SELECT i.itm_name
            FROM sdedba.ref_item i
            WHERE i.itm_id = ai.itm_id
            LIMIT 1
        ) AS productname,

        a.cur_id AS currencyid,

        (
            SELECT cc.cur_name
            FROM sdedba.ref_com_currency cc
            WHERE cc.cur_id = a.cur_id
            LIMIT 1
        ) AS currencyname,

        ai.origination_date AS opendate,
        ai.lgcy_expiry_date AS enddate,

        (
            SELECT p.lin_name
            FROM ref_sysp71 p
            WHERE p.lin_code = a.account_reason_code
            LIMIT 1
        ) AS reasontoopenaccount,

        ai.status_code AS statuscode,

        (
            SELECT s.status_name
            FROM sdedba.sts_status s
            WHERE s.status_id = ai.status_code
            LIMIT 1
        ) AS statusname,

        a.iban_number   AS ibannumber,
        a.creation_date AS insertiondate,

        CASE
            WHEN (
                SELECT COUNT(1)
                FROM sdedba.ref_item m
                JOIN sdedba.ref_lgcy_item_info f
                    ON m.itm_id = f.itm_id
                WHERE m.itm_id = ai.itm_id
                  AND m.kty_code = 200
            ) = 0 THEN 0
            ELSE 1
        END AS services

    FROM sdedba.ref_customer c
    JOIN sdedba.ref_customer_misc_info mi
        ON c.customer_id = mi.customer_id
    LEFT JOIN findba.fin_account_info a
        ON c.customer_id = a.customer_id
    JOIN findba.fin_account_item ai
        ON a.account_id = ai.account_id
) tb
WHERE rimno LIKE 'RIM-%'
ORDER BY rimno
LIMIT 20;
