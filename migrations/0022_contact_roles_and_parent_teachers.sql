-- Keep the shared users table and its tenant triggers intact. Parent contact
-- numbers are stored on the parent profile so siblings/families can reuse a
-- household number without weakening teacher/admin login uniqueness.
ALTER TABLE parent_profiles ADD COLUMN contact_mobile TEXT;
CREATE INDEX parent_profiles_contact_mobile ON parent_profiles(school_id,contact_mobile);

-- A teacher may also be a parent in the same school. The second role is
-- represented in user_roles and uses the same secure account/access key.
DROP TRIGGER IF EXISTS parent_profile_insert;
DROP TRIGGER IF EXISTS parent_profile_update;
CREATE TRIGGER parent_profile_insert BEFORE INSERT ON parent_profiles
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND (user_type='parent' OR user_type='teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER parent_profile_update BEFORE UPDATE ON parent_profiles
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND (user_type='parent' OR user_type='teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

