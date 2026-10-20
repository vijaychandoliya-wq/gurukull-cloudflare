-- Catalog and individually identified physical copies; no generated accession/card numbers.
CREATE TABLE library_categories (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), name TEXT NOT NULL,
 description TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 UNIQUE(school_id,name), UNIQUE(school_id,id)
);
CREATE TABLE library_books (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), category_id TEXT NOT NULL,
 title TEXT NOT NULL, author TEXT NOT NULL, isbn TEXT NOT NULL, publisher TEXT, description TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 FOREIGN KEY(school_id,category_id) REFERENCES library_categories(school_id,id),
 UNIQUE(school_id,isbn), UNIQUE(school_id,id)
);
CREATE TABLE library_copies (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), book_id TEXT NOT NULL,
 accession_no TEXT NOT NULL, location TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 FOREIGN KEY(school_id,book_id) REFERENCES library_books(school_id,id),
 UNIQUE(school_id,accession_no), UNIQUE(school_id,id)
);
CREATE TABLE library_cards (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL REFERENCES users(id),
 card_no TEXT NOT NULL, issued_on TEXT NOT NULL, expires_on TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 UNIQUE(school_id,card_no), UNIQUE(school_id,user_id), UNIQUE(school_id,id),
 CHECK(expires_on IS NULL OR expires_on>=issued_on)
);
CREATE TRIGGER library_card_tenant_insert BEFORE INSERT ON library_cards
WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type IN ('student','teacher','staff','admin'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER library_card_tenant_update BEFORE UPDATE ON library_cards
WHEN NEW.school_id!=OLD.school_id OR NEW.user_id!=OLD.user_id
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TABLE library_loans (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 copy_id TEXT NOT NULL, card_id TEXT NOT NULL, issue_date TEXT NOT NULL, due_date TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('issued','returned','cancelled')),
 closed_date TEXT, remarks TEXT, closure_reason TEXT,
 created_by TEXT NOT NULL REFERENCES users(id), closed_by TEXT REFERENCES users(id),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 FOREIGN KEY(school_id,copy_id) REFERENCES library_copies(school_id,id),
 FOREIGN KEY(school_id,card_id) REFERENCES library_cards(school_id,id),
 CHECK(due_date>=issue_date), CHECK(closed_date IS NULL OR closed_date>=issue_date),
 CHECK((status='issued' AND closed_date IS NULL AND closed_by IS NULL AND closure_reason IS NULL) OR (status IN ('returned','cancelled') AND closed_date IS NOT NULL AND closed_by IS NOT NULL AND closure_reason IS NOT NULL)),
 UNIQUE(school_id,id)
);
CREATE UNIQUE INDEX library_one_outstanding_copy ON library_loans(school_id,copy_id) WHERE status='issued';
CREATE INDEX library_loan_directory ON library_loans(school_id,issue_date,status);
CREATE INDEX library_loan_borrower ON library_loans(school_id,card_id,status);
CREATE TRIGGER library_loan_tenant_insert BEFORE INSERT ON library_loans
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER library_loan_update BEFORE UPDATE ON library_loans
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.copy_id!=OLD.copy_id OR NEW.card_id!=OLD.card_id OR NEW.issue_date!=OLD.issue_date OR NEW.created_by!=OLD.created_by
 OR OLD.status!='issued' OR (NEW.closed_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.closed_by AND school_id=NEW.school_id AND user_type='admin'))
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LOAN_OR_TENANT_RELATIONSHIP'); END;
CREATE TRIGGER library_loan_no_delete BEFORE DELETE ON library_loans
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_LOAN_HISTORY'); END;

CREATE TRIGGER library_copy_identity_update BEFORE UPDATE ON library_copies
WHEN NEW.school_id!=OLD.school_id OR NEW.book_id!=OLD.book_id
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER library_card_issue_identity_update BEFORE UPDATE ON library_cards
WHEN NEW.issued_on!=OLD.issued_on
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
