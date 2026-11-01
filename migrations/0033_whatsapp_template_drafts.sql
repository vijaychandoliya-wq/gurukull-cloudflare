-- Draft text only: no provider registration, approval, or delivery is implied.
CREATE TABLE whatsapp_template_drafts (
 school_id TEXT NOT NULL REFERENCES schools(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder')),
 locale TEXT NOT NULL CHECK(length(locale) BETWEEN 2 AND 32),
 body TEXT NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 1024),
 version INTEGER NOT NULL CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,purpose,locale)
);
CREATE TABLE whatsapp_template_draft_versions (
 school_id TEXT NOT NULL REFERENCES schools(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder')),
 locale TEXT NOT NULL,
 body TEXT NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,purpose,locale,version)
);
CREATE TRIGGER whatsapp_template_drafts_tenant_insert BEFORE INSERT ON whatsapp_template_drafts
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_template_drafts_tenant_update BEFORE UPDATE ON whatsapp_template_drafts
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_template_versions_tenant_insert BEFORE INSERT ON whatsapp_template_draft_versions
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
