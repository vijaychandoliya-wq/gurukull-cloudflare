-- Parent occupation and income are supplementary profile fields. Guardian name,
-- contact number, relationship, and linked children are sufficient to create a
-- real parent link when a school roster does not contain employment details.
DROP TRIGGER IF EXISTS parent_profile_insert;
DROP TRIGGER IF EXISTS parent_profile_update;
DROP INDEX IF EXISTS parent_profiles_contact_mobile;

CREATE TABLE parent_profiles_optional (
 school_id TEXT NOT NULL REFERENCES schools(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 profession TEXT CHECK(profession IS NULL OR profession IN ('business','central_government_employee','private','home_maker','state_government_employee','others')),
 sub_occupation TEXT,
 designation TEXT,
 organization_name TEXT,
 official_address TEXT,
 annual_income INTEGER CHECK(annual_income BETWEEN 0 AND 999999999),
 contact_mobile TEXT,
 PRIMARY KEY(school_id,user_id)
);

INSERT INTO parent_profiles_optional(school_id,user_id,profession,sub_occupation,designation,organization_name,official_address,annual_income,contact_mobile)
SELECT school_id,user_id,profession,sub_occupation,designation,organization_name,official_address,annual_income,contact_mobile
FROM parent_profiles;

DROP TABLE parent_profiles;
ALTER TABLE parent_profiles_optional RENAME TO parent_profiles;
CREATE INDEX parent_profiles_contact_mobile ON parent_profiles(school_id,contact_mobile);

CREATE TRIGGER parent_profile_insert BEFORE INSERT ON parent_profiles
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND (user_type='parent' OR user_type='teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER parent_profile_update BEFORE UPDATE ON parent_profiles
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND (user_type='parent' OR user_type='teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
