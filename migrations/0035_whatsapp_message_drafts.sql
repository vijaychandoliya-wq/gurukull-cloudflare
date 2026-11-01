-- Drafts have no queue state, provider status or transmission capability.
CREATE TABLE whatsapp_message_drafts (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder')),
 locale TEXT NOT NULL,
 template_version INTEGER NOT NULL CHECK(template_version>0),
 created_by TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 FOREIGN KEY(school_id,purpose,locale,template_version) REFERENCES whatsapp_template_draft_versions(school_id,purpose,locale,version)
);
CREATE INDEX whatsapp_message_drafts_school_created ON whatsapp_message_drafts(school_id,created_at DESC,id);
CREATE TRIGGER whatsapp_message_drafts_tenant_insert BEFORE INSERT ON whatsapp_message_drafts
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
