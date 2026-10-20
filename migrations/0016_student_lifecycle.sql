-- Actual enrollment changes preserve snapshots and never invent next-year classes.
CREATE TABLE student_lifecycle (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), student_id TEXT NOT NULL REFERENCES students(id),
 action TEXT NOT NULL CHECK(action IN ('promote','retain','graduate')),
 effective_date TEXT NOT NULL, reason TEXT NOT NULL,
 source_year_id TEXT NOT NULL REFERENCES academic_years(id), target_year_id TEXT REFERENCES academic_years(id),
 before_json TEXT NOT NULL CHECK(json_valid(before_json)), after_json TEXT NOT NULL CHECK(json_valid(after_json)),
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), undone_at INTEGER, undone_by TEXT REFERENCES users(id), undo_reason TEXT,
 UNIQUE(school_id,id), CHECK((action='graduate' AND target_year_id IS NULL) OR (action!='graduate' AND target_year_id IS NOT NULL))
);
CREATE INDEX lifecycle_student ON student_lifecycle(school_id,student_id,created_at);
CREATE TRIGGER lifecycle_tenant BEFORE INSERT ON student_lifecycle
WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.source_year_id AND school_id=NEW.school_id)
 OR (NEW.target_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.target_year_id AND school_id=NEW.school_id))
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER lifecycle_immutable BEFORE UPDATE ON student_lifecycle
WHEN NEW.id!=OLD.id OR NEW.school_id!=OLD.school_id OR NEW.student_id!=OLD.student_id OR NEW.action!=OLD.action OR NEW.effective_date!=OLD.effective_date OR NEW.reason!=OLD.reason OR NEW.source_year_id!=OLD.source_year_id OR NEW.target_year_id IS NOT OLD.target_year_id OR NEW.before_json!=OLD.before_json OR NEW.after_json!=OLD.after_json OR NEW.created_by!=OLD.created_by OR NEW.created_at!=OLD.created_at OR OLD.undone_at IS NOT NULL
 OR NEW.undone_at IS NULL OR NEW.undo_reason IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.undone_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ENROLLMENT_HISTORY'); END;
CREATE TRIGGER lifecycle_no_delete BEFORE DELETE ON student_lifecycle
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ENROLLMENT_HISTORY'); END;
CREATE TABLE alumni_profiles (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), student_id TEXT REFERENCES students(id),
 name TEXT NOT NULL, email TEXT, phone TEXT, graduation_year INTEGER NOT NULL CHECK(graduation_year BETWEEN 1900 AND 2200), graduation_date TEXT,
 profession TEXT, company TEXT, city TEXT, notes TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 UNIQUE(school_id,id), UNIQUE(school_id,student_id)
);
CREATE INDEX alumni_directory ON alumni_profiles(school_id,graduation_year,name);
CREATE TRIGGER alumni_tenant_insert BEFORE INSERT ON alumni_profiles
WHEN NEW.student_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER alumni_tenant_update BEFORE UPDATE ON alumni_profiles
WHEN NEW.school_id!=OLD.school_id OR NEW.student_id IS NOT OLD.student_id
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;

CREATE UNIQUE INDEX academic_year_one_current ON academic_years(school_id) WHERE is_current=1;
CREATE UNIQUE INDEX current_student_roll_unique ON students(school_id,academic_year_id,section_id,roll_no) WHERE status='active' AND roll_no IS NOT NULL;
