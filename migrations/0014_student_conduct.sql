-- Actual conduct records only. Visibility does not imply push delivery.
CREATE TABLE student_conduct (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id),
 student_id TEXT NOT NULL REFERENCES students(id), section_id TEXT NOT NULL REFERENCES sections(id),
 teacher_user_id TEXT NOT NULL REFERENCES users(id),
 type TEXT NOT NULL CHECK(type IN ('discipline','performance','others')),
 incident_date TEXT NOT NULL, incident_time TEXT NOT NULL,
 incident_detail TEXT NOT NULL CHECK(length(incident_detail) BETWEEN 1 AND 3000),
 response TEXT CHECK(response IS NULL OR length(response)<=255),
 action_taken INTEGER NOT NULL CHECK(action_taken IN (0,1)),
 visible_to_parents INTEGER NOT NULL CHECK(visible_to_parents IN (0,1)),
 created_by TEXT NOT NULL REFERENCES users(id),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), archived_at INTEGER,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(school_id,id)
);
CREATE INDEX conduct_directory ON student_conduct(school_id,academic_year_id,incident_date,incident_time);
CREATE INDEX conduct_student ON student_conduct(school_id,student_id,visible_to_parents,archived_at);
CREATE TRIGGER conduct_tenant_insert BEFORE INSERT ON student_conduct
WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id AND section_id=NEW.section_id AND academic_year_id=NEW.academic_year_id)
 OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id AND user_type='teacher')
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id AND user_type='admin')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER conduct_tenant_update BEFORE UPDATE ON student_conduct
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.created_by!=OLD.created_by
 OR NEW.student_id!=OLD.student_id OR NEW.section_id!=OLD.section_id
 OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id AND user_type='teacher')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TABLE conduct_parent_reads (
 school_id TEXT NOT NULL REFERENCES schools(id), conduct_id TEXT NOT NULL,
 parent_user_id TEXT NOT NULL REFERENCES users(id), seen_version INTEGER NOT NULL CHECK(seen_version>0), seen_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,conduct_id,parent_user_id),
 FOREIGN KEY(school_id,conduct_id) REFERENCES student_conduct(school_id,id)
);
CREATE TRIGGER conduct_parent_read_insert BEFORE INSERT ON conduct_parent_reads
WHEN NOT EXISTS(SELECT 1 FROM student_conduct d JOIN parent_student_links l ON l.school_id=d.school_id AND l.student_id=d.student_id WHERE d.school_id=NEW.school_id AND d.id=NEW.conduct_id AND l.parent_user_id=NEW.parent_user_id AND d.visible_to_parents=1 AND d.archived_at IS NULL AND d.version=NEW.seen_version)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER conduct_parent_read_update BEFORE UPDATE ON conduct_parent_reads
WHEN NEW.school_id!=OLD.school_id OR NEW.conduct_id!=OLD.conduct_id OR NEW.parent_user_id!=OLD.parent_user_id
 OR NOT EXISTS(SELECT 1 FROM student_conduct d JOIN parent_student_links l ON l.school_id=d.school_id AND l.student_id=d.student_id WHERE d.school_id=NEW.school_id AND d.id=NEW.conduct_id AND l.parent_user_id=NEW.parent_user_id AND d.visible_to_parents=1 AND d.archived_at IS NULL AND d.version=NEW.seen_version)
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
