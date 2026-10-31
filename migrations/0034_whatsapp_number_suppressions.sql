-- A block is scoped to a school, sender and recipient number, not a user ID.
-- Clearing a block requires a separate reviewed re-consent workflow.
CREATE TABLE whatsapp_number_suppressions (
 school_id TEXT NOT NULL REFERENCES schools(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,sender_phone,recipient_phone)
);
CREATE TABLE whatsapp_number_suppression_events (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 UNIQUE(school_id,sender_phone,recipient_phone,version)
);
CREATE TRIGGER whatsapp_number_suppression_tenant_insert BEFORE INSERT ON whatsapp_number_suppressions
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_number_suppression_tenant_update BEFORE UPDATE ON whatsapp_number_suppressions
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_number_suppression_event_tenant_insert BEFORE INSERT ON whatsapp_number_suppression_events
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
