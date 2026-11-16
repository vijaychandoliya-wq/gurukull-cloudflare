-- P0-3 fee payment links (gateway, opt-in per school).
--
-- The module stays fully inert until a school stores real gateway
-- credentials and enables them; no default paid integration, no seeded
-- gateways. Two CHECK sets cannot be extended in place in SQLite, so both
-- table pairs are rebuilt (copy, drop, rename) keeping every row, mirroring
-- 0038. New intents add 'processing' plus lease columns so a capture is
-- claimed before ledger writes and a crashed worker can never hold an
-- intent (same claim pattern as outbox / record_exports / fee_reminders).

-- 1. Per-school gateway configuration. The provider secret is stored but
--    never logged; only the school's own admin rows read it, masked.
-- site_key is the provider's PUBLIC key (shown to the pay page for its
-- checkout script); merchant_key and webhook_secret are secret and are never
-- returned by any API, admin view included.
CREATE TABLE fee_payment_gateways (
 school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 provider TEXT NOT NULL DEFAULT 'razorpay' CHECK(provider IN ('razorpay')),
 merchant_id TEXT NOT NULL,
 site_key TEXT NOT NULL DEFAULT '',
 merchant_key TEXT NOT NULL,
 webhook_secret TEXT NOT NULL,
 currency TEXT NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT REFERENCES users(id),
 updated_at INTEGER,
 PRIMARY KEY(school_id, provider),
 UNIQUE(school_id, merchant_id)
);
CREATE TRIGGER fee_payment_gateways_tenant_insert BEFORE INSERT ON fee_payment_gateways
WHEN NOT EXISTS(SELECT 1 FROM schools WHERE id=NEW.school_id)
 OR (NEW.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER fee_payment_gateways_tenant_update BEFORE UPDATE ON fee_payment_gateways
WHEN NEW.school_id!=OLD.school_id OR (NEW.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

-- 2. One self-service collection attempt per link, all-or-nothing at capture.
CREATE TABLE fee_payment_intents (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
 student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
 gateway TEXT NOT NULL CHECK(gateway IN ('razorpay')),
 provider_ref TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','paid','failed','expired','cancelled')),
 amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise>0 AND amount_paise<=1000000000000),
 currency TEXT NOT NULL,
 expires_at INTEGER NOT NULL,
 paid_at INTEGER,
 receipt_no TEXT,
 last_error TEXT,
 lease_id TEXT,
 lease_until INTEGER,
 created_by TEXT REFERENCES users(id),
 created_at INTEGER NOT NULL,
 CHECK((status IN ('pending','processing') AND paid_at IS NULL) OR status IN ('paid','failed','expired','cancelled'))
);
CREATE INDEX fee_payment_intents_student ON fee_payment_intents(school_id, student_id, created_at);
CREATE INDEX fee_payment_intents_lookup ON fee_payment_intents(provider_ref);
CREATE INDEX fee_payment_intents_work ON fee_payment_intents(status, lease_until, expires_at);
CREATE TRIGGER fee_payment_intents_tenant_insert BEFORE INSERT ON fee_payment_intents
WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id)
 OR (NEW.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER fee_payment_intents_tenant_update BEFORE UPDATE ON fee_payment_intents
WHEN NEW.school_id!=OLD.school_id OR NEW.student_id!=OLD.student_id
 OR (NEW.created_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

-- 3. Which open invoices this link settles.
CREATE TABLE fee_payment_intent_invoices (
 intent_id TEXT NOT NULL REFERENCES fee_payment_intents(id) ON DELETE CASCADE,
 invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
 PRIMARY KEY(intent_id, invoice_id)
);
CREATE TRIGGER fee_payment_intent_invoices_tenant_insert BEFORE INSERT ON fee_payment_intent_invoices
WHEN NOT EXISTS(SELECT 1 FROM fee_payment_intents i WHERE i.id=NEW.intent_id AND i.school_id=(SELECT school_id FROM fee_invoices WHERE id=NEW.invoice_id))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

-- 4. Ledger: the gateway adds 'auto_debit' to payment_mode. CHECK values
--    cannot be ALTERed, so rebuild (copy, drop, rename) and re-attach the
--    0012 indexes and triggers exactly.
CREATE TABLE fee_ledger_entries_new (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 invoice_id TEXT NOT NULL REFERENCES fee_invoices(id), student_id TEXT NOT NULL REFERENCES students(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), currency TEXT NOT NULL,
 receipt_no TEXT NOT NULL, entry_type TEXT NOT NULL CHECK(entry_type IN ('collection','reversal')),
 amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND abs(amount_minor) BETWEEN 1 AND 1000000000000),
 concession_minor INTEGER NOT NULL CHECK(typeof(concession_minor)='integer' AND abs(concession_minor)<=1000000000000),
 payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash','cheque','bank_transfer','upi','card','auto_debit')),
 transaction_ref TEXT, paid_on TEXT NOT NULL, remarks TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 reverses_id TEXT REFERENCES fee_ledger_entries(id),
 CHECK((entry_type='collection' AND amount_minor>0 AND concession_minor>=0 AND reverses_id IS NULL) OR (entry_type='reversal' AND amount_minor<0 AND concession_minor<=0 AND reverses_id IS NOT NULL)),
 UNIQUE(school_id,receipt_no), UNIQUE(school_id,reverses_id)
);
-- The 0012 view reads this table; it must be gone before the DROP and is
-- re-created byte-identical after the rename.
DROP VIEW fee_invoice_balances;
INSERT INTO fee_ledger_entries_new SELECT id,school_id,invoice_id,student_id,academic_year_id,currency,receipt_no,entry_type,amount_minor,concession_minor,payment_mode,transaction_ref,paid_on,remarks,created_by,created_at,reverses_id FROM fee_ledger_entries;
DROP TABLE fee_ledger_entries;
ALTER TABLE fee_ledger_entries_new RENAME TO fee_ledger_entries;
CREATE UNIQUE INDEX fee_ledger_external_reference ON fee_ledger_entries(school_id,payment_mode,transaction_ref) WHERE transaction_ref IS NOT NULL AND entry_type='collection';
CREATE INDEX fee_ledger_invoice ON fee_ledger_entries(school_id,invoice_id,created_at);
CREATE VIEW fee_invoice_balances AS
 SELECT i.*,
 COALESCE((SELECT SUM(amount_paid_paise) FROM fee_payments p WHERE p.school_id=i.school_id AND p.invoice_id=i.id),0)+COALESCE((SELECT SUM(amount_minor) FROM fee_ledger_entries l WHERE l.school_id=i.school_id AND l.invoice_id=i.id),0) AS paid_minor,
 COALESCE((SELECT SUM(concession_minor) FROM fee_ledger_entries l WHERE l.school_id=i.school_id AND l.invoice_id=i.id),0) AS concession_minor
 FROM fee_invoices i;
CREATE TRIGGER fee_ledger_insert_guard BEFORE INSERT ON fee_ledger_entries
WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id AND student_id=NEW.student_id AND academic_year_id=NEW.academic_year_id AND currency=NEW.currency AND status!='cancelled')
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
 OR (NEW.entry_type='reversal' AND NOT EXISTS(SELECT 1 FROM fee_ledger_entries o WHERE o.id=NEW.reverses_id AND o.school_id=NEW.school_id AND o.invoice_id=NEW.invoice_id AND o.entry_type='collection' AND o.amount_minor=-NEW.amount_minor AND o.concession_minor=-NEW.concession_minor AND o.currency=NEW.currency AND o.paid_on<=NEW.paid_on))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER fee_ledger_immutable_update BEFORE UPDATE ON fee_ledger_entries
BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE TRIGGER fee_ledger_immutable_delete BEFORE DELETE ON fee_ledger_entries
BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE TRIGGER fee_ledger_balance_guard AFTER INSERT ON fee_ledger_entries
WHEN EXISTS(SELECT 1 FROM fee_invoice_balances WHERE school_id=NEW.school_id AND id=NEW.invoice_id AND (paid_minor<0 OR concession_minor<0 OR paid_minor+concession_minor>amount_paise))
BEGIN SELECT RAISE(ABORT,'LEDGER_BALANCE_INVALID'); END;

-- 5. Consent: a gateway receipt is a new fee purpose, added by rebuild so
--    both consent tables keep one purpose CHECK (0032 original).
CREATE TABLE whatsapp_consent_records_new (
 school_id TEXT NOT NULL REFERENCES schools(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder','fee_receipt')),
 state TEXT NOT NULL CHECK(state IN ('granted','withdrawn')),
 source TEXT NOT NULL CHECK(source IN ('written','verbal','portal')),
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 updated_by TEXT NOT NULL REFERENCES users(id),
 updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,recipient_id,sender_phone,recipient_phone,purpose)
);
INSERT INTO whatsapp_consent_records_new SELECT * FROM whatsapp_consent_records;
DROP TABLE whatsapp_consent_records;
ALTER TABLE whatsapp_consent_records_new RENAME TO whatsapp_consent_records;
CREATE INDEX whatsapp_consent_records_recipient ON whatsapp_consent_records(school_id,recipient_id,updated_at);
CREATE TRIGGER whatsapp_consent_records_tenant_insert BEFORE INSERT ON whatsapp_consent_records
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER whatsapp_consent_records_tenant_update BEFORE UPDATE ON whatsapp_consent_records
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE whatsapp_consent_events_new (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 recipient_id TEXT NOT NULL REFERENCES users(id),
 sender_phone TEXT NOT NULL,
 recipient_phone TEXT NOT NULL,
 purpose TEXT NOT NULL CHECK(purpose IN ('school_notice','fee_reminder','fee_receipt')),
 state TEXT NOT NULL CHECK(state IN ('granted','withdrawn')),
 source TEXT NOT NULL CHECK(source IN ('written','verbal','portal')),
 evidence TEXT NOT NULL CHECK(length(trim(evidence)) BETWEEN 1 AND 250),
 version INTEGER NOT NULL CHECK(version>0),
 actor_id TEXT NOT NULL REFERENCES users(id),
 created_at INTEGER NOT NULL,
 UNIQUE(school_id,recipient_id,sender_phone,recipient_phone,purpose,version)
);
INSERT INTO whatsapp_consent_events_new SELECT * FROM whatsapp_consent_events;
DROP TABLE whatsapp_consent_events;
ALTER TABLE whatsapp_consent_events_new RENAME TO whatsapp_consent_events;
CREATE TRIGGER whatsapp_consent_events_tenant_insert BEFORE INSERT ON whatsapp_consent_events
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recipient_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
