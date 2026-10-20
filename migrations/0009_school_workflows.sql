-- School communications and academic work. No business records are seeded.
ALTER TABLE notices ADD COLUMN academic_year_id TEXT REFERENCES academic_years(id);
ALTER TABLE notices ADD COLUMN section_id TEXT REFERENCES sections(id);
ALTER TABLE notices ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
ALTER TABLE notices ADD COLUMN archived_at INTEGER;
CREATE TRIGGER notice_academic_insert BEFORE INSERT ON notices WHEN (NEW.academic_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM academic_years WHERE school_id=NEW.school_id AND id=NEW.academic_year_id)) OR (NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sections WHERE school_id=NEW.school_id AND id=NEW.section_id)) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER notice_academic_update BEFORE UPDATE ON notices WHEN (NEW.academic_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM academic_years WHERE school_id=NEW.school_id AND id=NEW.academic_year_id)) OR (NEW.section_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sections WHERE school_id=NEW.school_id AND id=NEW.section_id)) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
ALTER TABLE homeworks ADD COLUMN academic_year_id TEXT REFERENCES academic_years(id);
ALTER TABLE homeworks ADD COLUMN assignment_id TEXT REFERENCES teacher_assignments(id);
ALTER TABLE homeworks ADD COLUMN assigned_date TEXT;
ALTER TABLE homeworks ADD COLUMN submission_date TEXT;
ALTER TABLE homeworks ADD COLUMN publication_status TEXT NOT NULL DEFAULT 'draft' CHECK(publication_status IN ('draft','publish'));
ALTER TABLE homeworks ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected'));
ALTER TABLE homeworks ADD COLUMN approval_comments TEXT;
ALTER TABLE homeworks ADD COLUMN approved_by TEXT REFERENCES users(id);
ALTER TABLE homeworks ADD COLUMN archived_at INTEGER;
CREATE TRIGGER homework_assignment_insert BEFORE INSERT ON homeworks WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE id=NEW.assignment_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND class_id=NEW.class_id AND section_id=NEW.section_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER homework_assignment_update BEFORE UPDATE ON homeworks WHEN NEW.assignment_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE id=NEW.assignment_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND class_id=NEW.class_id AND section_id=NEW.section_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE homework_submissions (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),homework_id TEXT NOT NULL REFERENCES homeworks(id),student_id TEXT NOT NULL REFERENCES students(id),
 submitted_by TEXT NOT NULL REFERENCES users(id),answer TEXT NOT NULL CHECK(length(trim(answer))>0),submitted_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','checked','returned')),comments TEXT,checked_by TEXT REFERENCES users(id),checked_at INTEGER,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),UNIQUE(school_id,homework_id,student_id)
);
CREATE TRIGGER submission_scope_insert BEFORE INSERT ON homework_submissions WHEN NOT EXISTS(SELECT 1 FROM homeworks h JOIN students s ON s.school_id=h.school_id AND s.section_id=h.section_id AND s.class_id=h.class_id AND s.academic_year_id=h.academic_year_id WHERE h.id=NEW.homework_id AND h.school_id=NEW.school_id AND s.id=NEW.student_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.submitted_by AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER submission_scope_update BEFORE UPDATE ON homework_submissions WHEN NEW.school_id!=OLD.school_id OR NEW.homework_id!=OLD.homework_id OR NEW.student_id!=OLD.student_id OR (NEW.checked_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.checked_by AND user_type IN ('admin','teacher'))) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE lesson_plans (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),assignment_id TEXT NOT NULL REFERENCES teacher_assignments(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 unit_no INTEGER NOT NULL CHECK(unit_no>0),unit_name TEXT NOT NULL,title TEXT NOT NULL,duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 1 AND 1440),
 description TEXT NOT NULL,objective TEXT,materials_required TEXT,assessment TEXT,introduction TEXT,procedure_text TEXT,conclusion TEXT,modification TEXT,notes TEXT,
 publication_status TEXT NOT NULL CHECK(publication_status IN ('draft','publish')),approval_status TEXT NOT NULL CHECK(approval_status IN ('pending','approved','rejected')),
 approval_comments TEXT,approved_by TEXT REFERENCES users(id),created_by TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),archived_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL
);
CREATE INDEX lesson_plan_school_year ON lesson_plans(school_id,academic_year_id,updated_at);
CREATE TRIGGER lesson_scope_insert BEFORE INSERT ON lesson_plans WHEN NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE id=NEW.assignment_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER lesson_scope_update BEFORE UPDATE ON lesson_plans WHEN NEW.school_id!=OLD.school_id OR NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE id=NEW.assignment_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id) OR (NEW.approved_by IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.approved_by AND school_id=NEW.school_id AND user_type='admin')) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE parent_profiles (
 school_id TEXT NOT NULL REFERENCES schools(id),user_id TEXT NOT NULL REFERENCES users(id),profession TEXT NOT NULL CHECK(profession IN ('business','central_government_employee','private','home_maker','state_government_employee','others')),
 sub_occupation TEXT,designation TEXT,organization_name TEXT,official_address TEXT,annual_income INTEGER CHECK(annual_income BETWEEN 0 AND 999999999),
 PRIMARY KEY(school_id,user_id)
);
CREATE TRIGGER parent_profile_insert BEFORE INSERT ON parent_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='parent') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER parent_profile_update BEFORE UPDATE ON parent_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='parent') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
