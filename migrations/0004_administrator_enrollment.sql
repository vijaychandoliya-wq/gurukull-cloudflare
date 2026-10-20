-- Owner-controlled enrollment infrastructure only. No users or invitations seeded.
CREATE TABLE admin_invitations (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 token_digest TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+86400),
 consumed_at INTEGER,
 revoked_at INTEGER,
 redemption_id TEXT,
 CHECK((consumed_at IS NULL AND redemption_id IS NULL) OR (consumed_at IS NOT NULL AND redemption_id IS NOT NULL))
);
CREATE UNIQUE INDEX admin_invitation_pending ON admin_invitations(school_id,user_id) WHERE consumed_at IS NULL AND revoked_at IS NULL;
CREATE TRIGGER admin_invitation_tenant_insert BEFORE INSERT ON admin_invitations WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='admin') BEGIN SELECT RAISE(ABORT,'ENROLLMENT_TENANT_MISMATCH'); END;
CREATE TRIGGER admin_invitation_tenant_update BEFORE UPDATE ON admin_invitations WHEN NEW.school_id!=OLD.school_id OR NEW.user_id!=OLD.user_id OR NEW.token_digest!=OLD.token_digest BEGIN SELECT RAISE(ABORT,'ENROLLMENT_IDENTITY_IMMUTABLE'); END;
CREATE TABLE admin_enrollment_guards(id TEXT PRIMARY KEY,valid INTEGER NOT NULL CHECK(valid=1));
-- A single owner-issued INSERT creates the pending user and invite atomically.
-- No public API writes this table. Authenticated D1 owner tooling is the initial bootstrap authority.
CREATE TABLE admin_enrollment_requests (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 user_id TEXT NOT NULL UNIQUE,
 invitation_id TEXT NOT NULL UNIQUE,
 token_digest TEXT NOT NULL UNIQUE,
 full_name TEXT NOT NULL CHECK(length(trim(full_name)) BETWEEN 1 AND 160),
 email TEXT,
 mobile TEXT,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL CHECK(expires_at>created_at AND expires_at<=created_at+86400),
 CHECK(email IS NOT NULL OR mobile IS NOT NULL)
);
CREATE TRIGGER admin_enrollment_request_create AFTER INSERT ON admin_enrollment_requests BEGIN SELECT RAISE(ABORT,'SCHOOL_NOT_ENROLLABLE') WHERE NOT EXISTS(SELECT 1 FROM schools WHERE id=NEW.school_id AND status IN ('configuration_needed','administrator_pending','active'));
 SELECT RAISE(ABORT,'ADMINISTRATOR_CONTACT_EXISTS') WHERE EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND (lower(email)=lower(NEW.email) OR mobile=NEW.mobile));
 INSERT INTO users(id,school_id,email,mobile,password_hash,hash_algorithm,full_name,user_type,status,created_at,updated_at) VALUES(NEW.user_id,NEW.school_id,NEW.email,NEW.mobile,'!','bcrypt',NEW.full_name,'admin','invited',NEW.created_at,NEW.created_at);
 INSERT INTO admin_invitations(id,school_id,user_id,token_digest,created_at,expires_at) VALUES(NEW.invitation_id,NEW.school_id,NEW.user_id,NEW.token_digest,NEW.created_at,NEW.expires_at);
END;
