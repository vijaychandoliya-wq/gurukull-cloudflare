-- No business policy or accounting seeds. Existing positive payments remain immutable.
ALTER TABLE fee_groups ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fee_groups ADD COLUMN archived_at INTEGER;
ALTER TABLE fee_invoices ADD COLUMN academic_year_id TEXT REFERENCES academic_years(id);
ALTER TABLE fee_invoices ADD COLUMN currency TEXT;
ALTER TABLE fee_invoices ADD COLUMN due_on TEXT;
ALTER TABLE fee_invoices ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE fee_invoices ADD COLUMN cancellation_reason TEXT;
ALTER TABLE fee_invoices ADD COLUMN cancelled_by TEXT REFERENCES users(id);
ALTER TABLE fee_invoices ADD COLUMN cancelled_at INTEGER;
CREATE TABLE finance_policy (
 school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 currency TEXT NOT NULL, invoice_prefix TEXT NOT NULL, receipt_prefix TEXT NOT NULL,
 number_width INTEGER NOT NULL CHECK(number_width BETWEEN 1 AND 12),
 next_invoice_number INTEGER NOT NULL CHECK(next_invoice_number BETWEEN 1 AND 999999999999),
 next_receipt_number INTEGER NOT NULL CHECK(next_receipt_number BETWEEN 1 AND 999999999999),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 PRIMARY KEY(school_id,academic_year_id)
);
CREATE TABLE fee_ledger_entries (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 invoice_id TEXT NOT NULL REFERENCES fee_invoices(id), student_id TEXT NOT NULL REFERENCES students(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), currency TEXT NOT NULL,
 receipt_no TEXT NOT NULL, entry_type TEXT NOT NULL CHECK(entry_type IN ('collection','reversal')),
 amount_minor INTEGER NOT NULL CHECK(typeof(amount_minor)='integer' AND abs(amount_minor) BETWEEN 1 AND 1000000000000),
 concession_minor INTEGER NOT NULL CHECK(typeof(concession_minor)='integer' AND abs(concession_minor)<=1000000000000),
 payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash','cheque','bank_transfer','upi','card')),
 transaction_ref TEXT, paid_on TEXT NOT NULL, remarks TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 reverses_id TEXT REFERENCES fee_ledger_entries(id),
 CHECK((entry_type='collection' AND amount_minor>0 AND concession_minor>=0 AND reverses_id IS NULL) OR (entry_type='reversal' AND amount_minor<0 AND concession_minor<=0 AND reverses_id IS NOT NULL)),
 UNIQUE(school_id,receipt_no), UNIQUE(school_id,reverses_id)
);
CREATE UNIQUE INDEX fee_collection_external_reference ON fee_ledger_entries(school_id,payment_mode,transaction_ref) WHERE transaction_ref IS NOT NULL AND entry_type='collection';
CREATE INDEX fee_ledger_invoice ON fee_ledger_entries(school_id,invoice_id,created_at);
CREATE TRIGGER finance_policy_tenant_insert BEFORE INSERT ON finance_policy
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE school_id=NEW.school_id AND id=NEW.academic_year_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER fee_ledger_insert_guard BEFORE INSERT ON fee_ledger_entries
WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id AND student_id=NEW.student_id AND academic_year_id=NEW.academic_year_id AND currency=NEW.currency AND status!='cancelled')
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
 OR (NEW.entry_type='reversal' AND NOT EXISTS(SELECT 1 FROM fee_ledger_entries o WHERE o.id=NEW.reverses_id AND o.school_id=NEW.school_id AND o.invoice_id=NEW.invoice_id AND o.entry_type='collection' AND o.amount_minor=-NEW.amount_minor AND o.concession_minor=-NEW.concession_minor AND o.currency=NEW.currency AND o.paid_on<=NEW.paid_on))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER fee_ledger_immutable_update BEFORE UPDATE ON fee_ledger_entries
BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE TRIGGER fee_ledger_immutable_delete BEFORE DELETE ON fee_ledger_entries
BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE VIEW fee_invoice_balances AS
 SELECT i.*,
 COALESCE((SELECT SUM(amount_paid_paise) FROM fee_payments p WHERE p.school_id=i.school_id AND p.invoice_id=i.id),0)+COALESCE((SELECT SUM(amount_minor) FROM fee_ledger_entries l WHERE l.school_id=i.school_id AND l.invoice_id=i.id),0) AS paid_minor,
 COALESCE((SELECT SUM(concession_minor) FROM fee_ledger_entries l WHERE l.school_id=i.school_id AND l.invoice_id=i.id),0) AS concession_minor
 FROM fee_invoices i;
CREATE TRIGGER fee_ledger_balance_guard AFTER INSERT ON fee_ledger_entries
WHEN EXISTS(SELECT 1 FROM fee_invoice_balances WHERE school_id=NEW.school_id AND id=NEW.invoice_id AND (paid_minor<0 OR concession_minor<0 OR paid_minor+concession_minor>amount_paise))
BEGIN SELECT RAISE(ABORT,'LEDGER_BALANCE_INVALID'); END;
