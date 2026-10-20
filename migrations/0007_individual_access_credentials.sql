-- Secure generated credentials for real school members; no users or credentials seeded.
CREATE TABLE user_access_credentials (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL REFERENCES users(id),
 credential_digest TEXT NOT NULL CHECK(length(credential_digest)=43), issued_by TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked_at INTEGER,
 UNIQUE(school_id,user_id), CHECK(expires_at>created_at)
);
CREATE TRIGGER user_access_tenant_insert BEFORE INSERT ON user_access_credentials WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type IN ('teacher','staff','student','parent')) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.issued_by AND school_id=NEW.school_id AND user_type='admin') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER user_access_tenant_update BEFORE UPDATE ON user_access_credentials WHEN NEW.user_id!=OLD.user_id OR NEW.school_id!=OLD.school_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.issued_by AND school_id=NEW.school_id AND user_type='admin') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
