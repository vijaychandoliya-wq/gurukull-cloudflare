-- Additive operations schemas; no default categories, suppliers or visitors.
CREATE TABLE inventory_categories (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 name TEXT NOT NULL, code TEXT NOT NULL, description TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(school_id,code), UNIQUE(school_id,id)
);
CREATE TABLE inventory_suppliers (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 name TEXT NOT NULL, contact_person TEXT NOT NULL, mobile TEXT NOT NULL,
 email TEXT, address TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(school_id,id)
);
CREATE TABLE inventory_items (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 category_id TEXT NOT NULL, supplier_id TEXT, name TEXT NOT NULL,
 item_code TEXT NOT NULL, unit TEXT NOT NULL, currency TEXT NOT NULL,
 unit_price_minor INTEGER NOT NULL CHECK(typeof(unit_price_minor)='integer' AND unit_price_minor BETWEEN 0 AND 1000000000),
 quantity INTEGER NOT NULL CHECK(typeof(quantity)='integer' AND quantity BETWEEN 0 AND 1000000),
 reorder_level INTEGER NOT NULL CHECK(typeof(reorder_level)='integer' AND reorder_level BETWEEN 0 AND 1000000),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 FOREIGN KEY(school_id,category_id) REFERENCES inventory_categories(school_id,id),
 FOREIGN KEY(school_id,supplier_id) REFERENCES inventory_suppliers(school_id,id),
 UNIQUE(school_id,item_code), UNIQUE(school_id,id)
);
CREATE TABLE inventory_transactions (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), item_id TEXT NOT NULL,
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 type TEXT NOT NULL CHECK(type IN ('opening','stock_in','stock_out','damaged','return','reversal')),
 quantity_delta INTEGER NOT NULL CHECK(typeof(quantity_delta)='integer' AND quantity_delta BETWEEN -1000000 AND 1000000),
 quantity_after INTEGER NOT NULL CHECK(quantity_after BETWEEN 0 AND 1000000),
 unit_price_minor INTEGER NOT NULL CHECK(unit_price_minor BETWEEN 0 AND 1000000000), currency TEXT NOT NULL,
 issued_to TEXT, remarks TEXT, transaction_date TEXT NOT NULL,
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 reverses_id TEXT REFERENCES inventory_transactions(id),
 FOREIGN KEY(school_id,item_id) REFERENCES inventory_items(school_id,id),
 UNIQUE(school_id,reverses_id), UNIQUE(school_id,id)
);
CREATE INDEX inventory_transactions_item ON inventory_transactions(school_id,item_id,created_at);
CREATE TRIGGER inventory_transaction_tenant BEFORE INSERT ON inventory_transactions
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
 OR (NEW.reverses_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM inventory_transactions WHERE id=NEW.reverses_id AND school_id=NEW.school_id AND item_id=NEW.item_id AND type!='reversal'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER inventory_transaction_immutable_update BEFORE UPDATE ON inventory_transactions
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_STOCK_LEDGER'); END;
CREATE TRIGGER inventory_transaction_immutable_delete BEFORE DELETE ON inventory_transactions
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_STOCK_LEDGER'); END;
CREATE TABLE visitor_logs (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 relation TEXT NOT NULL CHECK(relation IN ('parent','other')), student_id TEXT REFERENCES students(id),
 student_relation TEXT CHECK(student_relation IN ('father','mother','guardian','others')), relation_name TEXT,
 name TEXT NOT NULL, contact_number TEXT NOT NULL, email TEXT, company_name TEXT, address TEXT,
 purpose TEXT NOT NULL CHECK(purpose IN ('admission','business','complaint','enquiry','fee_payment','parents_meeting','transfer_certificate')),
 visitor_count INTEGER NOT NULL CHECK(visitor_count BETWEEN 1 AND 20), employee_id TEXT NOT NULL REFERENCES users(id),
 visit_date TEXT NOT NULL, entry_time TEXT NOT NULL, exit_time TEXT, remarks TEXT,
 created_by TEXT NOT NULL REFERENCES users(id), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 CHECK(exit_time IS NULL OR exit_time>entry_time),
 CHECK((relation='parent' AND student_id IS NOT NULL AND student_relation IS NOT NULL) OR (relation='other' AND student_id IS NULL AND student_relation IS NULL)),
 CHECK(student_relation IS NOT 'others' OR relation_name IS NOT NULL),
 CHECK(purpose!='business' OR company_name IS NOT NULL)
);
CREATE INDEX visitor_logs_directory ON visitor_logs(school_id,academic_year_id,visit_date,entry_time);
CREATE TRIGGER visitor_tenant_insert BEFORE INSERT ON visitor_logs
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.employee_id AND school_id=NEW.school_id AND user_type IN ('teacher','staff','admin'))
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
 OR (NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER visitor_tenant_update BEFORE UPDATE ON visitor_logs
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.created_by!=OLD.created_by
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.employee_id AND school_id=NEW.school_id AND user_type IN ('teacher','staff','admin'))
 OR (NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
