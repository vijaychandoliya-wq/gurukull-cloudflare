-- Platform administrator password credentials.
-- Kept separate from the legacy users.password_hash CHECK constraint so the
-- Free-compatible HMAC password path can be used without a bcrypt CPU cost.
CREATE TABLE IF NOT EXISTS platform_password_credentials (
  school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL CHECK(length(password_hash)=43),
  hash_algorithm TEXT NOT NULL CHECK(hash_algorithm='hmac-sha256-generated'),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY(school_id,user_id)
);
CREATE TRIGGER IF NOT EXISTS platform_password_tenant_insert
BEFORE INSERT ON platform_password_credentials
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'PLATFORM_PASSWORD_TENANT_MISMATCH'); END;
CREATE TRIGGER IF NOT EXISTS platform_password_tenant_update
BEFORE UPDATE ON platform_password_credentials
WHEN NEW.school_id!=OLD.school_id OR NEW.user_id!=OLD.user_id
BEGIN SELECT RAISE(ABORT,'PLATFORM_PASSWORD_IDENTITY_IMMUTABLE'); END;
