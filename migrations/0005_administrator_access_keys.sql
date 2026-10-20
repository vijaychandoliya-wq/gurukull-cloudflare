-- Owner-controlled, generated 256-bit administrator credentials. No seeds.
CREATE TABLE admin_access_credentials (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL REFERENCES users(id),
 credential_digest TEXT NOT NULL CHECK(length(credential_digest)=43), created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+7776000), revoked_at INTEGER,
 UNIQUE(school_id,user_id)
);
CREATE TRIGGER admin_access_tenant_insert BEFORE INSERT ON admin_access_credentials WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='admin') BEGIN SELECT RAISE(ABORT,'ADMIN_ACCESS_TENANT_MISMATCH'); END;
CREATE TRIGGER admin_access_identity_update BEFORE UPDATE ON admin_access_credentials WHEN NEW.school_id!=OLD.school_id OR NEW.user_id!=OLD.user_id BEGIN SELECT RAISE(ABORT,'ADMIN_ACCESS_IDENTITY_IMMUTABLE'); END;
CREATE TABLE owner_admin_access_requests (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL UNIQUE,
 credential_id TEXT NOT NULL UNIQUE, credential_digest TEXT NOT NULL CHECK(length(credential_digest)=43),
 full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 160), email TEXT, mobile TEXT,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+7776000),
 CHECK(email IS NOT NULL OR mobile IS NOT NULL)
);
-- One owner-issued insert creates the genuine admin, membership and credential atomically.
CREATE TRIGGER owner_admin_access_create AFTER INSERT ON owner_admin_access_requests BEGIN SELECT RAISE(ABORT,'SCHOOL_NOT_ENROLLABLE') WHERE NOT EXISTS(SELECT 1 FROM schools WHERE id=NEW.school_id AND status IN ('configuration_needed','administrator_pending','active')); SELECT RAISE(ABORT,'ADMINISTRATOR_CONTACT_EXISTS') WHERE EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND (lower(email)=lower(NEW.email) OR mobile=NEW.mobile)); INSERT INTO users(id,school_id,email,mobile,password_hash,hash_algorithm,full_name,user_type,status,created_at,updated_at) VALUES(NEW.user_id,NEW.school_id,NEW.email,NEW.mobile,'!','bcrypt',NEW.full_name,'admin','active',NEW.created_at,NEW.created_at); INSERT INTO user_roles(school_id,user_id,role) VALUES(NEW.school_id,NEW.user_id,'admin'); INSERT INTO admin_access_credentials(id,school_id,user_id,credential_digest,created_at,expires_at) VALUES(NEW.credential_id,NEW.school_id,NEW.user_id,NEW.credential_digest,NEW.created_at,NEW.expires_at); END;
