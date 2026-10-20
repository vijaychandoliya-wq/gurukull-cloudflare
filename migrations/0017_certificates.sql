CREATE TABLE certificate_templates (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), name TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('transfer_certificate','character_certificate','merit_certificate','sports_certificate','conduct_certificate','bonafide','study','custom')),
 header_title TEXT NOT NULL, subheader TEXT, body_content TEXT NOT NULL, footer_left TEXT, footer_right TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 UNIQUE(school_id,id), UNIQUE(school_id,name)
);
CREATE TABLE certificate_issues (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), student_id TEXT NOT NULL REFERENCES students(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), template_id TEXT NOT NULL,
 certificate_no TEXT NOT NULL, issue_date TEXT NOT NULL, reason TEXT,
 snapshot_json TEXT NOT NULL CHECK(json_valid(snapshot_json)), issued_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('issued','void')), version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 void_reason TEXT, void_at INTEGER, void_by TEXT REFERENCES users(id),
 FOREIGN KEY(school_id,template_id) REFERENCES certificate_templates(school_id,id),
 UNIQUE(school_id,certificate_no), UNIQUE(school_id,id),
 CHECK((status='issued' AND void_reason IS NULL AND void_at IS NULL AND void_by IS NULL) OR (status='void' AND void_reason IS NOT NULL AND void_at IS NOT NULL AND void_by IS NOT NULL))
);
CREATE INDEX certificate_student ON certificate_issues(school_id,student_id,issue_date);
CREATE TRIGGER certificate_tenant_insert BEFORE INSERT ON certificate_issues
WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.issued_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER certificate_snapshot_immutable BEFORE UPDATE ON certificate_issues
WHEN NEW.id!=OLD.id OR NEW.school_id!=OLD.school_id OR NEW.student_id!=OLD.student_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.template_id!=OLD.template_id OR NEW.certificate_no!=OLD.certificate_no OR NEW.issue_date!=OLD.issue_date OR NEW.reason IS NOT OLD.reason OR NEW.snapshot_json!=OLD.snapshot_json OR NEW.issued_by!=OLD.issued_by OR NEW.created_at!=OLD.created_at OR OLD.status='void'
 OR NEW.status!='void' OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.void_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CERTIFICATE_SNAPSHOT'); END;
CREATE TRIGGER certificate_no_delete BEFORE DELETE ON certificate_issues
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_CERTIFICATE_HISTORY'); END;
