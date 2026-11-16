-- P0-1 fee reminders: extend the existing fee_reminders table so batches can
-- be traced, retried, deduplicated and dispatched. Additive only; no
-- business records are created.
--
-- SQLite cannot add a status value to an existing CHECK constraint, so the
-- table is rebuilt (copy, drop, rename) keeping every row. The status set
-- gains 'processing' (claimed by a dispatch lease) and 'skipped' (queue
-- time refusal: no recipient, no consent, no school sender, duplicate).
-- 'detail' carries the human reason in both directions. lease_id/lease_until
-- mirror the outbox claim pattern so a crashed dispatch can never hold a row.
CREATE TABLE fee_reminders_new (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email','sms')),
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued','processing','sent','provider_not_configured','skipped','failed')),
    detail TEXT,
    batch_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    lease_id TEXT,
    lease_until INTEGER,
    provider_message_id TEXT,
    sent_at INTEGER,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    UNIQUE(school_id,invoice_id,channel,created_at)
);
INSERT INTO fee_reminders_new SELECT id,school_id,invoice_id,student_id,channel,recipient,message,
  CASE WHEN status='provider_not_configured' THEN 'skipped' ELSE status END,
  CASE WHEN status='provider_not_configured' THEN 'provider_not_configured' ELSE NULL END,
  NULL,0,NULL,NULL,provider_message_id,sent_at,created_by,created_at FROM fee_reminders;
DROP TABLE fee_reminders;
ALTER TABLE fee_reminders_new RENAME TO fee_reminders;
-- Re-attach the tenant guard that DROP TABLE removed (original from 0029).
CREATE TRIGGER fee_reminders_tenant_insert BEFORE INSERT ON fee_reminders
WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id AND student_id=NEW.student_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE INDEX IF NOT EXISTS fee_reminders_open ON fee_reminders(school_id,channel,status,created_at);
CREATE INDEX IF NOT EXISTS fee_reminders_batch ON fee_reminders(school_id,batch_id);
CREATE INDEX IF NOT EXISTS fee_reminders_due ON fee_reminders(status,created_at,attempts);
