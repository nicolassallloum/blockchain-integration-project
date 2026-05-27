1. Create Governorates, Districts, Municipalities Tables
CREATE TABLE IF NOT EXISTS blockchain.governorates (
    governorate_id BIGSERIAL PRIMARY KEY,
    governorate_code VARCHAR(50) UNIQUE NOT NULL,
    governorate_name VARCHAR(150) NOT NULL,
    arabic_name VARCHAR(150),
    country_code VARCHAR(10) DEFAULT 'LB',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain.districts (
    district_id BIGSERIAL PRIMARY KEY,
    district_code VARCHAR(50) UNIQUE NOT NULL,
    district_name VARCHAR(150) NOT NULL,
    arabic_name VARCHAR(150),
    governorate_id BIGINT NOT NULL REFERENCES blockchain.governorates(governorate_id),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS blockchain.municipalities (
    municipality_id BIGSERIAL PRIMARY KEY,
    municipality_code VARCHAR(50) UNIQUE NOT NULL,
    municipality_name VARCHAR(150) NOT NULL,
    arabic_name VARCHAR(150),
    district_id BIGINT NOT NULL REFERENCES blockchain.districts(district_id),
    governorate_id BIGINT NOT NULL REFERENCES blockchain.governorates(governorate_id),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
2. Insert Lebanon Governorates
INSERT INTO blockchain.governorates
(governorate_code, governorate_name, arabic_name, country_code, sort_order)
VALUES
('BEIRUT', 'Beirut', 'بيروت', 'LB', 1),
('MOUNT_LEBANON', 'Mount Lebanon', 'جبل لبنان', 'LB', 2),
('NORTH_LEBANON', 'North Lebanon', 'الشمال', 'LB', 3),
('SOUTH_LEBANON', 'South Lebanon', 'الجنوب', 'LB', 4),
('BEKAA', 'Bekaa', 'البقاع', 'LB', 5),
('NABATIEH', 'Nabatieh', 'النبطية', 'LB', 6),
('BAALBEK_HERMEL', 'Baalbek-Hermel', 'بعلبك الهرمل', 'LB', 7),
('AKKAR', 'Akkar', 'عكار', 'LB', 8)
ON CONFLICT (governorate_code)
DO UPDATE SET
    governorate_name = EXCLUDED.governorate_name,
    arabic_name = EXCLUDED.arabic_name,
    country_code = EXCLUDED.country_code,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
3. Insert Districts Linked to Governorates
INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'BEIRUT', 'Beirut', 'بيروت', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'BEIRUT'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'BAABDA', 'Baabda', 'بعبدا', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'METN', 'Metn', 'المتن', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'KESERWAN', 'Keserwan', 'كسروان', governorate_id, 3
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'JBEIL', 'Jbeil', 'جبيل', governorate_id, 4
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'CHOUF', 'Chouf', 'الشوف', governorate_id, 5
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'ALEY', 'Aley', 'عاليه', governorate_id, 6
FROM blockchain.governorates
WHERE governorate_code = 'MOUNT_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'TRIPOLI', 'Tripoli', 'طرابلس', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'NORTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'ZGHARTA', 'Zgharta', 'زغرتا', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'NORTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'KOURA', 'Koura', 'الكورة', governorate_id, 3
FROM blockchain.governorates
WHERE governorate_code = 'NORTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'BATROUN', 'Batroun', 'البترون', governorate_id, 4
FROM blockchain.governorates
WHERE governorate_code = 'NORTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'ZAHLE', 'Zahle', 'زحلة', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'BEKAA'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'WEST_BEKAA', 'West Bekaa', 'البقاع الغربي', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'BEKAA'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'RASHAYA', 'Rashaya', 'راشيا', governorate_id, 3
FROM blockchain.governorates
WHERE governorate_code = 'BEKAA'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'SAIDA', 'Saida', 'صيدا', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'SOUTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'TYRE', 'Tyre', 'صور', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'SOUTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'JEZZINE', 'Jezzine', 'جزين', governorate_id, 3
FROM blockchain.governorates
WHERE governorate_code = 'SOUTH_LEBANON'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'NABATIEH', 'Nabatieh', 'النبطية', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'NABATIEH'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'BINT_JBEIL', 'Bint Jbeil', 'بنت جبيل', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'NABATIEH'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'MARJAYOUN', 'Marjayoun', 'مرجعيون', governorate_id, 3
FROM blockchain.governorates
WHERE governorate_code = 'NABATIEH'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'HASBAYA', 'Hasbaya', 'حاصبيا', governorate_id, 4
FROM blockchain.governorates
WHERE governorate_code = 'NABATIEH'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'BAALBEK', 'Baalbek', 'بعلبك', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'BAALBEK_HERMEL'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'HERMEL', 'Hermel', 'الهرمل', governorate_id, 2
FROM blockchain.governorates
WHERE governorate_code = 'BAALBEK_HERMEL'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.districts
(district_code, district_name, arabic_name, governorate_id, sort_order)
SELECT 'AKKAR', 'Akkar', 'عكار', governorate_id, 1
FROM blockchain.governorates
WHERE governorate_code = 'AKKAR'
ON CONFLICT (district_code) DO UPDATE SET
    district_name = EXCLUDED.district_name,
    arabic_name = EXCLUDED.arabic_name,
    governorate_id = EXCLUDED.governorate_id,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
4. Insert Main Municipalities Linked to Districts
INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BEIRUT_MUNICIPALITY', 'Beirut Municipality', 'بلدية بيروت', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'BEIRUT'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BAABDA_MUNICIPALITY', 'Baabda Municipality', 'بلدية بعبدا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'BAABDA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'JDEIDEH_MUNICIPALITY', 'Jdeideh Municipality', 'بلدية الجديدة', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'METN'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'JOUNIEH_MUNICIPALITY', 'Jounieh Municipality', 'بلدية جونية', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'KESERWAN'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'JBEIL_MUNICIPALITY', 'Jbeil Municipality', 'بلدية جبيل', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'JBEIL'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BEITEDDINE_MUNICIPALITY', 'Beiteddine Municipality', 'بلدية بيت الدين', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'CHOUF'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'ALEY_MUNICIPALITY', 'Aley Municipality', 'بلدية عاليه', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'ALEY'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'TRIPOLI_MUNICIPALITY', 'Tripoli Municipality', 'بلدية طرابلس', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'TRIPOLI'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'ZGHARTA_MUNICIPALITY', 'Zgharta Municipality', 'بلدية زغرتا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'ZGHARTA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'AMIYOUN_MUNICIPALITY', 'Amiyoun Municipality', 'بلدية أميون', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'KOURA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BATROUN_MUNICIPALITY', 'Batroun Municipality', 'بلدية البترون', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'BATROUN'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'ZAHLE_MUNICIPALITY', 'Zahle Municipality', 'بلدية زحلة', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'ZAHLE'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'JEB_JANNINE_MUNICIPALITY', 'Jeb Jennine Municipality', 'بلدية جب جنين', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'WEST_BEKAA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'RASHAYA_MUNICIPALITY', 'Rashaya Municipality', 'بلدية راشيا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'RASHAYA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'SAIDA_MUNICIPALITY', 'Saida Municipality', 'بلدية صيدا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'SAIDA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'TYRE_MUNICIPALITY', 'Tyre Municipality', 'بلدية صور', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'TYRE'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'JEZZINE_MUNICIPALITY', 'Jezzine Municipality', 'بلدية جزين', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'JEZZINE'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'NABATIEH_MUNICIPALITY', 'Nabatieh Municipality', 'بلدية النبطية', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'NABATIEH'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BINT_JBEIL_MUNICIPALITY', 'Bint Jbeil Municipality', 'بلدية بنت جبيل', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'BINT_JBEIL'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'MARJAYOUN_MUNICIPALITY', 'Marjayoun Municipality', 'بلدية مرجعيون', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'MARJAYOUN'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'HASBAYA_MUNICIPALITY', 'Hasbaya Municipality', 'بلدية حاصبيا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'HASBAYA'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'BAALBEK_MUNICIPALITY', 'Baalbek Municipality', 'بلدية بعلبك', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'BAALBEK'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'HERMEL_MUNICIPALITY', 'Hermel Municipality', 'بلدية الهرمل', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'HERMEL'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;

INSERT INTO blockchain.municipalities
(municipality_code, municipality_name, arabic_name, district_id, governorate_id, sort_order)
SELECT 'HALBA_MUNICIPALITY', 'Halba Municipality', 'بلدية حلبا', district_id, governorate_id, 1
FROM blockchain.districts WHERE district_code = 'AKKAR'
ON CONFLICT (municipality_code) DO UPDATE SET
    municipality_name = EXCLUDED.municipality_name,
    arabic_name = EXCLUDED.arabic_name,
    district_id = EXCLUDED.district_id,
    governorate_id = EXCLUDED.governorate_id,
    updated_at = CURRENT_TIMESTAMP;
5. Validation Queries
SELECT
    governorate_id,
    governorate_code,
    governorate_name,
    arabic_name
FROM blockchain.governorates
ORDER BY sort_order;
SELECT
    d.district_id,
    d.district_code,
    d.district_name,
    g.governorate_name
FROM blockchain.districts d
JOIN blockchain.governorates g
    ON g.governorate_id = d.governorate_id
ORDER BY g.sort_order, d.sort_order;
SELECT
    m.municipality_id,
    m.municipality_code,
    m.municipality_name,
    d.district_name,
    g.governorate_name
FROM blockchain.municipalities m
JOIN blockchain.districts d
    ON d.district_id = m.district_id
JOIN blockchain.governorates g
    ON g.governorate_id = m.governorate_id
ORDER BY g.sort_order, d.sort_order, m.sort_order;
6. Expected Counts

Run:

SELECT 'governorates' AS table_name, COUNT(*) FROM blockchain.governorates
UNION ALL
SELECT 'districts' AS table_name, COUNT(*) FROM blockchain.districts
UNION ALL
SELECT 'municipalities' AS table_name, COUNT(*) FROM blockchain.municipalities;

Expected:

governorates    | 8
districts       | 26
municipalities  | 26
7. Dropdown Source Queries
Governorate Dropdown
SELECT
    governorate_id AS id,
    governorate_code AS code,
    governorate_name AS name,
    arabic_name
FROM blockchain.governorates
WHERE is_active = TRUE
ORDER BY sort_order, governorate_name;
District Dropdown by Governorate
SELECT
    district_id AS id,
    district_code AS code,
    district_name AS name,
    arabic_name,
    governorate_id
FROM blockchain.districts
WHERE is_active = TRUE
  AND governorate_id = $1
ORDER BY sort_order, district_name;
Municipality Dropdown by District
SELECT
    municipality_id AS id,
    municipality_code AS code,
    municipality_name AS name,
    arabic_name,
    district_id,
    governorate_id
FROM blockchain.municipalities
WHERE is_active = TRUE
  AND district_id = $1
ORDER BY sort_order, municipality_name;

After this, send me the output of:

SELECT 'governorates' AS table_name, COUNT(*) FROM blockchain.governorates
UNION ALL
SELECT 'districts' AS table_name, COUNT(*) FROM blockchain.districts
UNION ALL
SELECT 'municipalities' AS table_name, COUNT(*) FROM blockchain.municipalities;

Then we continue to STEP 3 — Create KYC Status, Risk Category, and Employment Status reference tables.