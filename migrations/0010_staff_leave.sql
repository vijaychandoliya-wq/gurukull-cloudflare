-- Leave policies and requests. Allowances must be supplied by the school, never seeded.
CREATE TABLE leave_types (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),name TEXT NOT NULL,max_days INTEGER NOT NULL CHECK(max_days BETWEEN 1 AND 365),status TEXT NOT NULL CHECK(status IN ('active','inactive')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(school_id,academic_year_id,name)
);
CREATE TRIGGER leave_type_insert BEFORE INSERT ON leave_types WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER leave_type_update BEFORE UPDATE ON leave_types WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE staff_leaves (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),user_id TEXT NOT NULL REFERENCES users(id),leave_type_id TEXT NOT NULL REFERENCES leave_types(id),
 starts_on TEXT NOT NULL,ends_on TEXT NOT NULL CHECK(ends_on>=starts_on),session TEXT NOT NULL CHECK(session IN ('whole_day','morning','afternoon')),reason TEXT NOT NULL,remarks TEXT,
 status TEXT NOT NULL CHECK(status IN ('pending','approved','rejected','cancelled')),charge_units INTEGER CHECK(charge_units BETWEEN 0 AND 732),review_comments TEXT,reviewed_by TEXT REFERENCES users(id),reviewed_at INTEGER,
 created_by TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX leave_employee_dates ON staff_leaves(school_id,user_id,academic_year_id,starts_on,ends_on,status);
CREATE TRIGGER staff_leave_insert BEFORE INSERT ON staff_leaves WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type IN ('teacher','staff')) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM leave_types WHERE id=NEW.leave_type_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER staff_leave_update BEFORE UPDATE ON staff_leaves WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.user_id!=OLD.user_id OR NOT EXISTS(SELECT 1 FROM leave_types WHERE id=NEW.leave_type_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id) OR (NEW.reviewed_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.reviewed_by AND school_id=NEW.school_id AND user_type='admin' AND id!=NEW.user_id)) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
