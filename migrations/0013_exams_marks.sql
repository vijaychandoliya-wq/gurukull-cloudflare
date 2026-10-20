-- Actual schedules, grading rules and result policy only; no example exams/grades.
CREATE TABLE exams (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 name TEXT NOT NULL, term TEXT, starts_on TEXT NOT NULL, ends_on TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','inactive')),
 absent_totals TEXT NOT NULL CHECK(absent_totals IN ('include_zero','exclude')),
 percentage_decimals INTEGER NOT NULL CHECK(percentage_decimals BETWEEN 0 AND 2),
 results_published_at INTEGER, archived_at INTEGER, version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 CHECK(starts_on<=ends_on), UNIQUE(school_id,id)
);
CREATE TABLE exam_schedules (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), exam_id TEXT NOT NULL,
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), assignment_id TEXT NOT NULL REFERENCES teacher_assignments(id),
 section_id TEXT NOT NULL REFERENCES sections(id), subject_id TEXT NOT NULL REFERENCES subjects(id),
 exam_date TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, portion TEXT,
 max_units INTEGER NOT NULL CHECK(typeof(max_units)='integer' AND max_units BETWEEN 1 AND 100000000),
 pass_units INTEGER NOT NULL CHECK(typeof(pass_units)='integer' AND pass_units BETWEEN 1 AND max_units),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 FOREIGN KEY(school_id,exam_id) REFERENCES exams(school_id,id),
 CHECK(starts_at<ends_at), UNIQUE(school_id,exam_id,section_id,subject_id), UNIQUE(school_id,id)
);
CREATE INDEX exam_schedule_class_date ON exam_schedules(school_id,section_id,exam_date,starts_at);
CREATE TABLE exam_marks (
 school_id TEXT NOT NULL REFERENCES schools(id), schedule_id TEXT NOT NULL, student_id TEXT NOT NULL REFERENCES students(id),
 obtained_units INTEGER CHECK(obtained_units IS NULL OR (typeof(obtained_units)='integer' AND obtained_units BETWEEN 0 AND 100000000)),
 is_absent INTEGER NOT NULL CHECK(is_absent IN (0,1)), remarks TEXT, updated_by TEXT NOT NULL REFERENCES users(id), updated_at INTEGER NOT NULL,
 FOREIGN KEY(school_id,schedule_id) REFERENCES exam_schedules(school_id,id),
 CHECK(is_absent=0 OR obtained_units IS NULL), PRIMARY KEY(school_id,schedule_id,student_id)
);
CREATE TABLE exam_grade_bands (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 name TEXT NOT NULL, min_percentage_units INTEGER NOT NULL CHECK(min_percentage_units BETWEEN 0 AND 10000),
 max_percentage_units INTEGER NOT NULL CHECK(max_percentage_units BETWEEN min_percentage_units AND 10000),
 grade_point_units INTEGER CHECK(grade_point_units BETWEEN 0 AND 1000), remarks TEXT,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), UNIQUE(school_id,academic_year_id,name)
);
CREATE TRIGGER exam_tenant_insert BEFORE INSERT ON exams
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE school_id=NEW.school_id AND id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.created_by AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER exam_schedule_tenant_insert BEFORE INSERT ON exam_schedules
WHEN NOT EXISTS(SELECT 1 FROM exams WHERE school_id=NEW.school_id AND id=NEW.exam_id AND academic_year_id=NEW.academic_year_id)
 OR EXISTS(SELECT 1 FROM exams WHERE school_id=NEW.school_id AND id=NEW.exam_id AND results_published_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE school_id=NEW.school_id AND id=NEW.assignment_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id AND subject_id=NEW.subject_id)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER exam_schedule_tenant_update BEFORE UPDATE ON exam_schedules
WHEN NEW.school_id!=OLD.school_id OR NEW.exam_id!=OLD.exam_id OR NEW.academic_year_id!=OLD.academic_year_id
 OR EXISTS(SELECT 1 FROM exams WHERE school_id=NEW.school_id AND id=NEW.exam_id AND results_published_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE school_id=NEW.school_id AND id=NEW.assignment_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id AND subject_id=NEW.subject_id)
 OR EXISTS(SELECT 1 FROM exam_marks WHERE school_id=NEW.school_id AND schedule_id=NEW.id AND obtained_units>NEW.max_units)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER exam_mark_insert_guard BEFORE INSERT ON exam_marks
WHEN NOT EXISTS(SELECT 1 FROM exam_schedules e JOIN students s ON s.school_id=e.school_id AND s.section_id=e.section_id AND s.academic_year_id=e.academic_year_id WHERE e.school_id=NEW.school_id AND e.id=NEW.schedule_id AND s.id=NEW.student_id AND (NEW.obtained_units IS NULL OR NEW.obtained_units<=e.max_units))
 OR EXISTS(SELECT 1 FROM exam_schedules sc JOIN exams e ON e.id=sc.exam_id AND e.school_id=sc.school_id WHERE sc.school_id=NEW.school_id AND sc.id=NEW.schedule_id AND e.results_published_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.updated_by AND user_type IN ('admin','teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER exam_mark_update_guard BEFORE UPDATE ON exam_marks
WHEN NEW.school_id!=OLD.school_id OR NEW.schedule_id!=OLD.schedule_id OR NEW.student_id!=OLD.student_id
 OR EXISTS(SELECT 1 FROM exam_schedules sc JOIN exams e ON e.id=sc.exam_id AND e.school_id=sc.school_id WHERE sc.school_id=NEW.school_id AND sc.id=NEW.schedule_id AND e.results_published_at IS NOT NULL)
 OR NOT EXISTS(SELECT 1 FROM exam_schedules e WHERE e.school_id=NEW.school_id AND e.id=NEW.schedule_id AND (NEW.obtained_units IS NULL OR NEW.obtained_units<=e.max_units))
 OR NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.updated_by AND user_type IN ('admin','teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER grade_band_insert_guard BEFORE INSERT ON exam_grade_bands
WHEN NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR EXISTS(SELECT 1 FROM exams WHERE school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND results_published_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM exam_grade_bands WHERE school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND min_percentage_units<=NEW.max_percentage_units AND max_percentage_units>=NEW.min_percentage_units)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER grade_band_update_guard BEFORE UPDATE ON exam_grade_bands
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id
 OR EXISTS(SELECT 1 FROM exams WHERE school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND results_published_at IS NOT NULL)
 OR EXISTS(SELECT 1 FROM exam_grade_bands WHERE school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND id!=NEW.id AND min_percentage_units<=NEW.max_percentage_units AND max_percentage_units>=NEW.min_percentage_units)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
