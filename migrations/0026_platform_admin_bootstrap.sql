-- Atomic, owner-reviewed platform administrator bootstrap.
-- The request row is deleted by the trigger after all related records are
-- created, so no password material is retained beyond the HMAC credential.
CREATE TABLE IF NOT EXISTS platform_admin_bootstrap_requests (
  id TEXT PRIMARY KEY,
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL CHECK(length(password_hash)=43),
  created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS platform_admin_bootstrap_create
AFTER INSERT ON platform_admin_bootstrap_requests
BEGIN
  SELECT RAISE(ABORT,'PLATFORM_SCHOOL_NOT_ACTIVE')
    WHERE NOT EXISTS(SELECT 1 FROM schools WHERE id=NEW.school_id AND status='active');
  SELECT RAISE(ABORT,'PLATFORM_ADMIN_EMAIL_EXISTS')
    WHERE EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND lower(email)=lower(NEW.email));
  INSERT INTO users(id,school_id,email,mobile,password_hash,hash_algorithm,full_name,user_type,status,created_at,updated_at)
    VALUES(NEW.user_id,NEW.school_id,lower(NEW.email),NULL,'!','bcrypt',NEW.full_name,'admin','active',NEW.created_at,NEW.created_at);
  INSERT INTO user_roles(school_id,user_id,role) VALUES(NEW.school_id,NEW.user_id,'superadmin');
  INSERT INTO platform_operators(user_id,granted_at,revoked_at) VALUES(NEW.user_id,NEW.created_at,NULL);
  INSERT INTO platform_password_credentials(school_id,user_id,password_hash,hash_algorithm,created_at,updated_at,revoked_at)
    VALUES(NEW.school_id,NEW.user_id,NEW.password_hash,'hmac-sha256-generated',NEW.created_at,NEW.created_at,NULL);
  DELETE FROM platform_admin_bootstrap_requests WHERE id=NEW.id;
END;
