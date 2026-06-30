/*
Phase 5 — Source View 7
View: blockchain.valoores_sanction_list

Confirmed active source model:
- sdedba.ref_com_sanction_list

Expected source count:
- 7,131,707 records based on Phase 5 source discovery.

Purpose:
Prepare normalized sanction list source records for stable blockchain proof generation.

Rules:
- Do not expose party/person names directly.
- Do not expose DOB, passport, national ID, identification numbers, phone, address, comments, wallets, or URLs directly.
- Use deterministic fingerprints for sensitive values.
- Normalize text.
- Standardize dates.
- Standardize nulls.
- Produce deterministic unique source_record_id.
- Produce deterministic hash_input.
*/

BEGIN;

CREATE SCHEMA IF NOT EXISTS blockchain;

DROP VIEW IF EXISTS blockchain.valoores_sanction_list;

CREATE VIEW blockchain.valoores_sanction_list AS
WITH source_data AS (
    SELECT
        sanction_list_id,
        sanction_list_source_code,
        party_type_code,
        party_no,
        sdn_type,
        sanction_program,
        creation_date,
        update_date,
        sanction_list_category,
        sanction_list_level,
        is_party_excluded,
        entity_type_code,
        sanction_list_source_type,
        cou_id,
        entity_source_id,
        economic_sector_code,
        legal_status_id,
        party_activity_sector_id,
        party_registration_cou_id,
        party_birth_cou_id,
        country_region_id,
        session_id,
        sanction_list_state,
        entry_date,
        sanction_list_category_code,
        customer_id,
        tech_entity_source_id,
        pep_status_code,
        sanction_list_update_date,
        pep_object_status_code,
        nationality_id,

        /*
          Sensitive fields used only inside fingerprints.
          They are not exposed directly in the final view.
        */
        party_name,
        party_lname,
        party_fname,
        party_middle_name,
        father_name,
        mother_name,
        mother_maiden_name,
        mother_full_name,
        original_party_name,
        original_party_name_tmp,
        party_gender,
        party_title,
        party_designation,
        party_dob,
        party_multiple_dob,
        party_death_date,
        party_birth_place,
        party_aka,
        party_good_quality_aka,
        party_low_quality_aka,
        party_fka,
        party_nationality,
        party_national_ident_no,
        party_birth_ident_no,
        party_passport_no,
        party_social_security_no,
        party_identification_no,
        party_listing_date,
        party_reg_official_jrnl_no,
        official_journal_language,
        sdn_call_sign,
        official_journal_path,
        party_picture_file_path,
        registration_no,
        party_phone_no,
        party_registration_cou_name,
        party_cou_name,
        activity_sector_desc,
        adr_desc,
        country_region_name,
        customer_internal_code,
        registration_place_name,
        customer_reference,
        imo_code,
        imo_formely_name,
        pep_role_desc,
        sanction_list_extrnl_src_url,
        sanction_lst_update_categ_name,
        company_organization_name,
        integration_log_id,
        comments,
        comments_tmp,
        wallets,
        cou_name,
        tech_party_name,
        tech_party_name_soundex_value,
        tech_updated_party_name,
        tech_updt_prty_nam_soundex_val,
        tech_substr_party_nm_sndx_val,
        tech_sbstr_up_prty_nm_sndx_val,
        tech_updated_party_lname,
        tech_updated_party_fname,
        tech_party_fname_soundex_value,
        tech_party_lname_soundex_value,
        created_by,
        updated_by
    FROM sdedba.ref_com_sanction_list
),
sequenced AS (
    SELECT
        s.*,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(s.sanction_list_id::text, 'NO_SANCTION_ID')
            ORDER BY
                s.creation_date NULLS LAST,
                s.update_date NULLS LAST,
                COALESCE(s.sanction_list_source_code::text, ''),
                COALESCE(s.party_type_code::text, ''),
                COALESCE(s.party_no::text, ''),
                MD5(COALESCE(s.party_name::text, '')),
                MD5(COALESCE(s.original_party_name::text, '')),
                MD5(COALESCE(s.comments::text, ''))
        ) AS duplicate_sequence
    FROM source_data s
),
normalized AS (
    SELECT
        'SANCTION_LIST'::text AS source_module,

        CONCAT(
            COALESCE(sanction_list_id::text, 'NO_SANCTION_ID'),
            ':',
            LPAD(duplicate_sequence::text, 6, '0')
        ) AS source_record_id,

        COALESCE(sanction_list_id::text, 'NA') AS sanction_list_id,
        COALESCE(duplicate_sequence::text, 'NA') AS duplicate_sequence,

        COALESCE(sanction_list_source_code::text, 'NA') AS sanction_list_source_code,
        COALESCE(party_type_code::text, 'NA') AS party_type_code,
        COALESCE(party_no::text, 'NA') AS party_no,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(sdn_type::text, '\s+', ' ', 'g'))),
            ''
        ) AS sdn_type_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(sanction_program::text, '\s+', ' ', 'g'))),
            ''
        ) AS sanction_program_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(sanction_list_category::text, '\s+', ' ', 'g'))),
            ''
        ) AS sanction_category_normalized,

        COALESCE(
            LOWER(BTRIM(REGEXP_REPLACE(sanction_list_level::text, '\s+', ' ', 'g'))),
            ''
        ) AS sanction_level_normalized,

        COALESCE(LOWER(BTRIM(is_party_excluded::text)), '') AS is_party_excluded_flag,

        COALESCE(entity_type_code::text, 'NA') AS entity_type_code,
        COALESCE(sanction_list_source_type::text, 'NA') AS sanction_list_source_type,
        COALESCE(cou_id::text, 'NA') AS country_id,
        COALESCE(entity_source_id::text, 'NA') AS entity_source_id,
        COALESCE(economic_sector_code::text, 'NA') AS economic_sector_code,
        COALESCE(legal_status_id::text, 'NA') AS legal_status_id,
        COALESCE(party_activity_sector_id::text, 'NA') AS party_activity_sector_id,
        COALESCE(party_registration_cou_id::text, 'NA') AS party_registration_country_id,
        COALESCE(party_birth_cou_id::text, 'NA') AS party_birth_country_id,
        COALESCE(country_region_id::text, 'NA') AS country_region_id,
        COALESCE(session_id::text, 'NA') AS session_id,
        COALESCE(sanction_list_state::text, 'NA') AS sanction_list_state_code,
        COALESCE(sanction_list_category_code::text, 'NA') AS sanction_list_category_code,
        COALESCE(customer_id::text, 'NA') AS customer_id,
        COALESCE(tech_entity_source_id::text, 'NA') AS tech_entity_source_id,
        COALESCE(pep_status_code::text, 'NA') AS pep_status_code,
        COALESCE(pep_object_status_code::text, 'NA') AS pep_object_status_code,
        COALESCE(nationality_id::text, 'NA') AS nationality_id,

        COALESCE(TO_CHAR(creation_date::date, 'YYYY-MM-DD'), '') AS creation_date,
        COALESCE(TO_CHAR(update_date::date, 'YYYY-MM-DD'), '') AS update_date,
        COALESCE(TO_CHAR(entry_date::date, 'YYYY-MM-DD'), '') AS entry_date,
        COALESCE(TO_CHAR(sanction_list_update_date::date, 'YYYY-MM-DD'), '') AS sanction_list_update_date,

        /*
          Sensitive party/person/profile fingerprint.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_lname::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_fname::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_middle_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(father_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(mother_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(mother_maiden_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(mother_full_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(original_party_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(original_party_name_tmp::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_gender::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_title::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_designation::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_dob::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_multiple_dob::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_death_date::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_birth_place::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_aka::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_good_quality_aka::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_low_quality_aka::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_fka::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_nationality::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(company_organization_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(pep_role_desc::text, '\s+', ' ', 'g'))), '')
            )
        ) AS party_profile_fingerprint,

        /*
          Sensitive ID/contact/location fingerprint.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_national_ident_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_birth_ident_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_passport_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_social_security_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_identification_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(registration_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_phone_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(adr_desc::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_registration_cou_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_cou_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(activity_sector_desc::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(country_region_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(registration_place_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_reference::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(customer_internal_code::text, '\s+', ' ', 'g'))), '')
            )
        ) AS identity_location_fingerprint,

        /*
          Sensitive source/file/comment/wallet fingerprint.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_listing_date::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_reg_official_jrnl_no::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(official_journal_language::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(sdn_call_sign::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(official_journal_path::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(party_picture_file_path::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(sanction_list_extrnl_src_url::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(sanction_lst_update_categ_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(integration_log_id::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(comments::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(comments_tmp::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(wallets::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(cou_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(imo_code::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(imo_formely_name::text, '\s+', ' ', 'g'))), '')
            )
        ) AS sanction_content_fingerprint,

        /*
          Technical normalization fingerprint.
        */
        MD5(
            CONCAT_WS(
                '|',
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_party_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_party_name_soundex_value::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_updated_party_name::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_updt_prty_nam_soundex_val::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_substr_party_nm_sndx_val::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_sbstr_up_prty_nm_sndx_val::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_updated_party_lname::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_updated_party_fname::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_party_fname_soundex_value::text, '\s+', ' ', 'g'))), ''),
                COALESCE(LOWER(BTRIM(REGEXP_REPLACE(tech_party_lname_soundex_value::text, '\s+', ' ', 'g'))), ''),
                COALESCE(created_by::text, ''),
                COALESCE(updated_by::text, '')
            )
        ) AS technical_values_fingerprint
    FROM sequenced
),
hash_ready AS (
    SELECT
        *,
        CONCAT_WS(
            '|',
            source_module,
            source_record_id,
            sanction_list_id,
            duplicate_sequence,
            sanction_list_source_code,
            party_type_code,
            party_no,
            sdn_type_normalized,
            sanction_program_normalized,
            sanction_category_normalized,
            sanction_level_normalized,
            is_party_excluded_flag,
            entity_type_code,
            sanction_list_source_type,
            country_id,
            entity_source_id,
            economic_sector_code,
            legal_status_id,
            party_activity_sector_id,
            party_registration_country_id,
            party_birth_country_id,
            country_region_id,
            session_id,
            sanction_list_state_code,
            sanction_list_category_code,
            customer_id,
            tech_entity_source_id,
            pep_status_code,
            pep_object_status_code,
            nationality_id,
            creation_date,
            update_date,
            entry_date,
            sanction_list_update_date,
            party_profile_fingerprint,
            identity_location_fingerprint,
            sanction_content_fingerprint,
            technical_values_fingerprint
        ) AS hash_input
    FROM normalized
)
SELECT
    source_module,
    source_record_id,
    sanction_list_id,
    duplicate_sequence,
    sanction_list_source_code,
    party_type_code,
    party_no,
    sdn_type_normalized,
    sanction_program_normalized,
    sanction_category_normalized,
    sanction_level_normalized,
    is_party_excluded_flag,
    entity_type_code,
    sanction_list_source_type,
    country_id,
    entity_source_id,
    economic_sector_code,
    legal_status_id,
    party_activity_sector_id,
    party_registration_country_id,
    party_birth_country_id,
    country_region_id,
    session_id,
    sanction_list_state_code,
    sanction_list_category_code,
    customer_id,
    tech_entity_source_id,
    pep_status_code,
    pep_object_status_code,
    nationality_id,
    creation_date,
    update_date,
    entry_date,
    sanction_list_update_date,
    party_profile_fingerprint,
    identity_location_fingerprint,
    sanction_content_fingerprint,
    technical_values_fingerprint,
    hash_input,
    MD5(hash_input) AS hash_md5
FROM hash_ready;

COMMENT ON VIEW blockchain.valoores_sanction_list IS
'Phase 5 normalized sanction list source view for blockchain proof hash generation. Source: sdedba.ref_com_sanction_list. Sensitive names, IDs, addresses, comments, wallets, and technical values are exposed only as deterministic fingerprints.';

COMMIT;
