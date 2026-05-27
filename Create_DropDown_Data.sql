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


STEP 3 — Create KYC Status, Risk Category, and Employment Status Reference Tables

Run PostgreSQL:

psql -h 172.31.13.133 -p 5444 -U pgdata -d vfds_dev

Then execute this full SQL script.

1. Create KYC Status Table
CREATE TABLE IF NOT EXISTS blockchain.kyc_statuses (
    kyc_status_id BIGSERIAL PRIMARY KEY,
    status_code VARCHAR(50) UNIQUE NOT NULL,
    status_name VARCHAR(100) NOT NULL,
    arabic_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Insert KYC Status Data
INSERT INTO blockchain.kyc_statuses
(status_code, status_name, arabic_name, description, sort_order)
VALUES
('DRAFT', 'Draft', 'مسودة', 'Resident account is saved as draft and not submitted for review.', 1),
('PENDING_REVIEW', 'Pending Review', 'قيد المراجعة', 'Resident KYC was submitted and is waiting for compliance review.', 2),
('VERIFIED', 'Verified', 'تم التحقق', 'Resident KYC was reviewed and verified successfully.', 3),
('REJECTED', 'Rejected', 'مرفوض', 'Resident KYC was reviewed and rejected.', 4)
ON CONFLICT (status_code)
DO UPDATE SET
    status_name = EXCLUDED.status_name,
    arabic_name = EXCLUDED.arabic_name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
2. Create Risk Category Table
CREATE TABLE IF NOT EXISTS blockchain.risk_categories (
    risk_category_id BIGSERIAL PRIMARY KEY,
    risk_code VARCHAR(50) UNIQUE NOT NULL,
    risk_name VARCHAR(100) NOT NULL,
    arabic_name VARCHAR(100),
    risk_score_min INTEGER,
    risk_score_max INTEGER,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Insert Risk Category Data
INSERT INTO blockchain.risk_categories
(risk_code, risk_name, arabic_name, risk_score_min, risk_score_max, description, sort_order)
VALUES
('LOW', 'Low Risk', 'مخاطر منخفضة', 0, 30, 'Resident has low KYC and AML risk indicators.', 1),
('MEDIUM', 'Medium Risk', 'مخاطر متوسطة', 31, 70, 'Resident has medium KYC or AML risk indicators and may require additional review.', 2),
('HIGH', 'High Risk', 'مخاطر عالية', 71, 100, 'Resident has high KYC or AML risk indicators and requires enhanced due diligence.', 3)
ON CONFLICT (risk_code)
DO UPDATE SET
    risk_name = EXCLUDED.risk_name,
    arabic_name = EXCLUDED.arabic_name,
    risk_score_min = EXCLUDED.risk_score_min,
    risk_score_max = EXCLUDED.risk_score_max,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
3. Create Employment Status Table
CREATE TABLE IF NOT EXISTS blockchain.employment_statuses (
    employment_status_id BIGSERIAL PRIMARY KEY,
    status_code VARCHAR(50) UNIQUE NOT NULL,
    status_name VARCHAR(100) NOT NULL,
    arabic_name VARCHAR(100),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
Insert Employment Status Data
INSERT INTO blockchain.employment_statuses
(status_code, status_name, arabic_name, description, sort_order)
VALUES
('EMPLOYED', 'Employed', 'موظف', 'Resident is currently employed.', 1),
('SELF_EMPLOYED', 'Self-Employed', 'عامل لحسابه الخاص', 'Resident works independently or owns a business.', 2),
('UNEMPLOYED', 'Unemployed', 'عاطل عن العمل', 'Resident is currently unemployed.', 3),
('STUDENT', 'Student', 'طالب', 'Resident is currently a student.', 4),
('RETIRED', 'Retired', 'متقاعد', 'Resident is retired.', 5)
ON CONFLICT (status_code)
DO UPDATE SET
    status_name = EXCLUDED.status_name,
    arabic_name = EXCLUDED.arabic_name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    updated_at = CURRENT_TIMESTAMP;
4. Source Queries for Dropdowns
KYC Status Dropdown
SELECT
    status_code AS id,
    status_code AS code,
    status_name AS name,
    arabic_name,
    description
FROM blockchain.kyc_statuses
WHERE is_active = TRUE
ORDER BY sort_order, status_name;
Risk Category Dropdown
SELECT
    risk_code AS id,
    risk_code AS code,
    risk_name AS name,
    arabic_name,
    risk_score_min,
    risk_score_max,
    description
FROM blockchain.risk_categories
WHERE is_active = TRUE
ORDER BY sort_order, risk_name;
Employment Status Dropdown
SELECT
    status_code AS id,
    status_code AS code,
    status_name AS name,
    arabic_name,
    description
FROM blockchain.employment_statuses
WHERE is_active = TRUE
ORDER BY sort_order, status_name;
5. Validation Queries

Run:

SELECT
    status_code,
    status_name,
    arabic_name,
    sort_order,
    is_active
FROM blockchain.kyc_statuses
ORDER BY sort_order;
SELECT
    risk_code,
    risk_name,
    arabic_name,
    risk_score_min,
    risk_score_max,
    sort_order,
    is_active
FROM blockchain.risk_categories
ORDER BY sort_order;
SELECT
    status_code,
    status_name,
    arabic_name,
    sort_order,
    is_active
FROM blockchain.employment_statuses
ORDER BY sort_order;
6. Expected Counts
SELECT 'kyc_statuses' AS table_name, COUNT(*) FROM blockchain.kyc_statuses
UNION ALL
SELECT 'risk_categories' AS table_name, COUNT(*) FROM blockchain.risk_categories
UNION ALL
SELECT 'employment_statuses' AS table_name, COUNT(*) FROM blockchain.employment_statuses;

Expected:

kyc_statuses          | 4
risk_categories       | 3
employment_statuses   | 5
7. Final Check for All Dropdown Tables
SELECT 'governorates' AS table_name, COUNT(*) FROM blockchain.governorates
UNION ALL
SELECT 'districts' AS table_name, COUNT(*) FROM blockchain.districts
UNION ALL
SELECT 'municipalities' AS table_name, COUNT(*) FROM blockchain.municipalities
UNION ALL
SELECT 'kyc_statuses' AS table_name, COUNT(*) FROM blockchain.kyc_statuses
UNION ALL
SELECT 'risk_categories' AS table_name, COUNT(*) FROM blockchain.risk_categories
UNION ALL
SELECT 'employment_statuses' AS table_name, COUNT(*) FROM blockchain.employment_statuses;

After this, we continue to STEP 4 — Create Reference API Endpoints for Resident ID and Dropdowns.



CREATE TABLE IF NOT EXISTS blockchain.districts (
    district_id BIGSERIAL PRIMARY KEY,
    district_code VARCHAR(50) UNIQUE NOT NULL,
    district_name VARCHAR(150) NOT NULL,
    district_name_ar VARCHAR(150),
    governorate_code VARCHAR(50) NOT NULL,
    display_order INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE blockchain.municipalities
ADD COLUMN IF NOT EXISTS district_code VARCHAR(50);

INSERT INTO blockchain.districts
(district_code, district_name, district_name_ar, governorate_code, display_order)
VALUES
('BEIRUT', 'Beirut', 'بيروت', 'BEIRUT', 1),

('BAABDA', 'Baabda', 'بعبدا', 'MOUNT_LEBANON', 1),
('METN', 'Metn', 'المتن', 'MOUNT_LEBANON', 2),
('KESERWAN', 'Keserwan', 'كسروان', 'MOUNT_LEBANON', 3),
('JBEIL', 'Jbeil', 'جبيل', 'MOUNT_LEBANON', 4),
('ALEY', 'Aley', 'عاليه', 'MOUNT_LEBANON', 5),
('CHOUF', 'Chouf', 'الشوف', 'MOUNT_LEBANON', 6),

('TRIPOLI', 'Tripoli', 'طرابلس', 'NORTH_LEBANON', 1),
('ZGHARTA', 'Zgharta', 'زغرتا', 'NORTH_LEBANON', 2),
('KOURA', 'Koura', 'الكورة', 'NORTH_LEBANON', 3),
('BATROUN', 'Batroun', 'البترون', 'NORTH_LEBANON', 4),

('SAIDA', 'Saida', 'صيدا', 'SOUTH_LEBANON', 1),
('TYRE', 'Tyre', 'صور', 'SOUTH_LEBANON', 2),
('JEZZINE', 'Jezzine', 'جزين', 'SOUTH_LEBANON', 3),

('ZAHLE', 'Zahle', 'زحلة', 'BEKAA', 1),
('WEST_BEKAA', 'West Bekaa', 'البقاع الغربي', 'BEKAA', 2),
('RASHAYA', 'Rashaya', 'راشيا', 'BEKAA', 3),

('NABATIEH', 'Nabatieh', 'النبطية', 'NABATIEH', 1),
('BINT_JBEIL', 'Bint Jbeil', 'بنت جبيل', 'NABATIEH', 2),
('MARJAYOUN', 'Marjayoun', 'مرجعيون', 'NABATIEH', 3),
('HASBAYA', 'Hasbaya', 'حاصبيا', 'NABATIEH', 4),

('BAALBEK', 'Baalbek', 'بعلبك', 'BAALBEK_HERMEL', 1),
('HERMEL', 'Hermel', 'الهرمل', 'BAALBEK_HERMEL', 2),

('AKKAR', 'Akkar', 'عكار', 'AKKAR', 1)
ON CONFLICT (district_code)
DO UPDATE SET
    district_name = EXCLUDED.district_name,
    district_name_ar = EXCLUDED.district_name_ar,
    governorate_code = EXCLUDED.governorate_code,
    display_order = EXCLUDED.display_order,
    updated_at = CURRENT_TIMESTAMP;

UPDATE blockchain.municipalities
SET district_code = CASE
    WHEN municipality_code = 'BEIRUT_MUNICIPALITY' THEN 'BEIRUT'
    WHEN municipality_code = 'BAABDA_MUNICIPALITY' THEN 'BAABDA'
    WHEN municipality_code IN ('DEKWANEH_MUNICIPALITY', 'SIN_EL_FIL_MUNICIPALITY', 'BOURJ_HAMMOUD_MUNICIPALITY') THEN 'METN'
    WHEN municipality_code = 'JOUNIEH_MUNICIPALITY' THEN 'KESERWAN'
    WHEN municipality_code = 'BYBLOS_MUNICIPALITY' THEN 'JBEIL'
    WHEN municipality_code IN ('ALEY_MUNICIPALITY', 'CHOUEIFAT_MUNICIPALITY') THEN 'ALEY'
    WHEN municipality_code = 'TRIPOLI_MUNICIPALITY' THEN 'TRIPOLI'
    WHEN municipality_code = 'ZGHARTA_MUNICIPALITY' THEN 'ZGHARTA'
    WHEN municipality_code = 'AMIYOUN_MUNICIPALITY' THEN 'KOURA'
    WHEN municipality_code = 'BATROUN_MUNICIPALITY' THEN 'BATROUN'
    WHEN municipality_code = 'SAIDA_MUNICIPALITY' THEN 'SAIDA'
    WHEN municipality_code = 'TYRE_MUNICIPALITY' THEN 'TYRE'
    WHEN municipality_code = 'JEZZINE_MUNICIPALITY' THEN 'JEZZINE'
    WHEN municipality_code = 'ZAHLE_MUNICIPALITY' THEN 'ZAHLE'
    WHEN municipality_code = 'NABATIEH_MUNICIPALITY' THEN 'NABATIEH'
    WHEN municipality_code = 'BAALBEK_MUNICIPALITY' THEN 'BAALBEK'
    WHEN municipality_code = 'HERMEL_MUNICIPALITY' THEN 'HERMEL'
    WHEN municipality_code = 'HALBA_MUNICIPALITY' THEN 'AKKAR'
    ELSE district_code
END
WHERE district_code IS NULL;