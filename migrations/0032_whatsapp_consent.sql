-- Captured permissions are evidence only; they do not enable delivery.
CREATE TABLE whatsapp_consent_records (
 school_id TEXT NOT NULL REFERENCES schools(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder')),
 state TEXT NOT NULL CHECK(state IN ('granted','withdrawn')),
 source TEXT NOT NULL CHECK(source IN ('written','verbal','portal')),
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,recipient_id,sender_phone,recipient_phone,purpose)
);
CREATE TABLE whatsapp_consent_events (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder')),
 state TEXT NOT NULL CHECK(state IN ('granted','withdrawn')),
 source TEXT NOT NULL CHECK(source IN ('written','verbal','portal')),
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 UNIQUE(school_id,recipient_id,sender_phone,recipient_phone,purpose,version)
);
CREATE INDEX whatsapp_consent_records_recipient ON whatsapp_consent_records(school_id,recipient_id,updated_at);
CREATE TRIGGER whatsapp_consent_records_tenant_insert BEFORE INSERT ON whatsapp_consent_records
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_consent_records_tenant_update BEFORE UPDATE ON whatsapp_consent_records
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_consent_events_tenant_insert BEFORE INSERT ON whatsapp_consent_events
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
