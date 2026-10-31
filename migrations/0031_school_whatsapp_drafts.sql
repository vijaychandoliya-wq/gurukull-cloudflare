-- School-owned sender draft only. No provider connection or secrets are created.
CREATE TABLE school_whatsapp_drafts (
  school_id TEXT PRIMARY KEY REFERENCES schools(id) ON DELETE CASCADE,
  phone_e164 TEXT NOT NULL CHECK(length(phone_e164) BETWEEN 9 AND 16 AND substr(phone_e164,1,1)='+'),
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 100),
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  updated_by TEXT NOT NULL REFERENCES users(id),
  updated_at INTEGER NOT NULL
);
CREATE TRIGGER school_whatsapp_drafts_tenant_insert BEFORE INSERT ON school_whatsapp_drafts
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER school_whatsapp_drafts_tenant_update BEFORE UPDATE ON school_whatsapp_drafts
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
