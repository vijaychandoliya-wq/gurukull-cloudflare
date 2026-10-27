-- Legacy fee-structure parity: fee heads, scoped structures, bulk assignment and reminders.
-- No rows are seeded; administrators explicitly create the school's actual fee heads.
CREATE TABLE IF NOT EXISTS fee_structures (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
    fee_group_id TEXT NOT NULL REFERENCES fee_groups(id),
    class_id TEXT REFERENCES classes(id),
    section_id TEXT REFERENCES sections(id),
    name TEXT NOT NULL,
    term TEXT,
    amount_paise INTEGER NOT NULL CHECK(typeof(amount_paise)='integer' AND amount_paise>0),
    starts_on TEXT NOT NULL,
    due_on TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
    version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
    archived_at INTEGER,
    created_by TEXT NOT NULL REFERENCES users(id),
    updated_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    CHECK(due_on>=starts_on)
);

ALTER TABLE fee_invoices ADD COLUMN structure_id TEXT REFERENCES fee_structures(id);

CREATE INDEX IF NOT EXISTS fee_structures_scope ON fee_structures(school_id,academic_year_id,status,archived_at);
CREATE INDEX IF NOT EXISTS fee_structures_class ON fee_structures(school_id,class_id,section_id);
CREATE INDEX IF NOT EXISTS fee_invoices_structure ON fee_invoices(school_id,structure_id,student_id);
CREATE UNIQUE INDEX IF NOT EXISTS fee_invoice_structure_student ON fee_invoices(school_id,structure_id,student_id) WHERE structure_id IS NOT NULL AND status!='cancelled';

CREATE TRIGGER fee_structures_tenant_insert BEFORE INSERT ON fee_structures
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM fee_groups WHERE id=NEW.fee_group_id AND school_id=NEW.school_id AND archived_at IS NULL)
 OR (NEW.class_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id))
 OR (NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id AND (NEW.class_id IS NULL OR class_id=NEW.class_id)))
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.updated_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

CREATE TRIGGER fee_structures_tenant_update BEFORE UPDATE ON fee_structures
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id
 OR NOT EXISTS(SELECT 1 FROM fee_groups WHERE id=NEW.fee_group_id AND school_id=NEW.school_id)
 OR (NEW.class_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id))
 OR (NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id AND (NEW.class_id IS NULL OR class_id=NEW.class_id)))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

CREATE TRIGGER fee_invoice_structure_tenant_insert BEFORE INSERT ON fee_invoices
WHEN NEW.structure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fee_structures f WHERE f.id=NEW.structure_id AND f.school_id=NEW.school_id AND f.academic_year_id=NEW.academic_year_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

CREATE TRIGGER fee_invoice_structure_tenant_update BEFORE UPDATE ON fee_invoices
WHEN NEW.structure_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM fee_structures f WHERE f.id=NEW.structure_id AND f.school_id=NEW.school_id AND f.academic_year_id=NEW.academic_year_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

CREATE TABLE IF NOT EXISTS fee_reminders (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK(channel IN ('whatsapp','email','sms')),
    recipient TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued','sent','provider_not_configured','failed')),
    provider_message_id TEXT,
    sent_at INTEGER,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    UNIQUE(school_id,invoice_id,channel,created_at)
);
CREATE INDEX IF NOT EXISTS fee_reminders_invoice ON fee_reminders(school_id,invoice_id,created_at);
CREATE TRIGGER fee_reminders_tenant_insert BEFORE INSERT ON fee_reminders
WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id AND student_id=NEW.student_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
