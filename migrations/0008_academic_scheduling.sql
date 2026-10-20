-- Academic catalog and scheduling. No people, subjects or school policy are seeded.
CREATE TABLE subjects (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 academic_year_id TEXT NOT NULL, section_id TEXT NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name))>0), code TEXT, type TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 UNIQUE(school_id,id), UNIQUE(school_id,academic_year_id,section_id,name),
 FOREIGN KEY(school_id,academic_year_id) REFERENCES academic_years(school_id,id),
 FOREIGN KEY(section_id) REFERENCES sections(id)
);
CREATE TRIGGER subjects_scope_insert BEFORE INSERT ON subjects WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER subjects_scope_update BEFORE UPDATE ON subjects WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.section_id!=OLD.section_id BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE timetable_configuration (
 school_id TEXT PRIMARY KEY REFERENCES schools(id),
 days_json TEXT NOT NULL CHECK(json_valid(days_json) AND json_array_length(days_json) BETWEEN 1 AND 7),
 periods_per_day INTEGER NOT NULL CHECK(periods_per_day BETWEEN 1 AND 16),
 version INTEGER NOT NULL CHECK(version>0), updated_at INTEGER NOT NULL
);
ALTER TABLE teacher_assignments ADD COLUMN subject_id TEXT REFERENCES subjects(id);
ALTER TABLE teacher_assignments ADD COLUMN planned_periods INTEGER CHECK(planned_periods BETWEEN 1 AND 112);
ALTER TABLE teacher_assignments ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
CREATE UNIQUE INDEX assignments_subject_unique ON teacher_assignments(school_id,academic_year_id,teacher_user_id,section_id,subject_id) WHERE subject_id IS NOT NULL;
CREATE TRIGGER assignment_subject_insert BEFORE INSERT ON teacher_assignments WHEN NEW.subject_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM subjects WHERE id=NEW.subject_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id AND user_type='teacher' AND status='active')) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER assignment_subject_update BEFORE UPDATE ON teacher_assignments WHEN NEW.subject_id IS NOT NULL AND (NOT EXISTS(SELECT 1 FROM subjects WHERE id=NEW.subject_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id AND user_type='teacher' AND status='active')) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
ALTER TABLE timetables ADD COLUMN subject_id TEXT REFERENCES subjects(id);
ALTER TABLE timetables ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK(version>0);
CREATE UNIQUE INDEX timetable_room_unique ON timetables(school_id,academic_year_id,day,period_no,room_no) WHERE room_no IS NOT NULL AND length(trim(room_no))>0;
CREATE TRIGGER timetable_subject_insert BEFORE INSERT ON timetables WHEN NEW.subject_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM subjects WHERE id=NEW.subject_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER timetable_subject_update BEFORE UPDATE ON timetables WHEN NEW.subject_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM subjects WHERE id=NEW.subject_id AND school_id=NEW.school_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
-- Removal keeps a tenant-scoped recoverable original; restoring still checks conflicts and current permissions.
CREATE TABLE timetable_archives (
 school_id TEXT NOT NULL REFERENCES schools(id), id TEXT NOT NULL,
 payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 removed_by TEXT NOT NULL REFERENCES users(id), removed_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,id)
);
CREATE TRIGGER timetable_archive_scope BEFORE INSERT ON timetable_archives WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.removed_by AND school_id=NEW.school_id) OR json_extract(NEW.payload_json,'$.school_id')!=NEW.school_id BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
