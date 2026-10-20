-- Additive administrator management schema. No business seeds and no school activation.
ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_profiles ADD COLUMN first_name TEXT;
ALTER TABLE user_profiles ADD COLUMN last_name TEXT;
ALTER TABLE user_profiles ADD COLUMN alternate_mobile TEXT;
ALTER TABLE user_profiles ADD COLUMN aadhaar_number TEXT;
ALTER TABLE teachers ADD COLUMN joining_date TEXT;
ALTER TABLE teachers ADD COLUMN job_type TEXT CHECK(job_type IN ('full_time','part_time'));
ALTER TABLE teachers ADD COLUMN sub_designation TEXT;
ALTER TABLE teachers ADD COLUMN ug_degree TEXT;
ALTER TABLE teachers ADD COLUMN pg_degree TEXT;
ALTER TABLE teachers ADD COLUMN specialization TEXT;
ALTER TABLE teachers ADD COLUMN interested_in TEXT;
ALTER TABLE teachers ADD COLUMN reporting_to TEXT REFERENCES users(id);
ALTER TABLE students ADD COLUMN academic_year_id TEXT REFERENCES academic_years(id);
CREATE UNIQUE INDEX users_school_email_normalized ON users(school_id,lower(email)) WHERE email IS NOT NULL;
CREATE TABLE mutation_commands (
 school_id TEXT NOT NULL REFERENCES schools(id), actor_id TEXT NOT NULL REFERENCES users(id),
 command_id TEXT NOT NULL, request_hash TEXT NOT NULL, response_json TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,actor_id,command_id)
);
CREATE TABLE audit_events (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), actor_id TEXT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX audit_events_school_time ON audit_events(school_id,created_at);
CREATE TABLE staff_profiles (
 school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL REFERENCES users(id),
 employee_code TEXT NOT NULL, designation TEXT NOT NULL, joining_date TEXT NOT NULL,
 PRIMARY KEY(school_id,user_id), UNIQUE(school_id,employee_code)
);
CREATE TRIGGER staff_tenant_insert BEFORE INSERT ON staff_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='staff') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER staff_tenant_update BEFORE UPDATE ON staff_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id AND user_type='staff') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER student_academic_insert BEFORE INSERT ON students WHEN NEW.academic_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER student_academic_update BEFORE UPDATE ON students WHEN NEW.academic_year_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER teacher_manager_insert BEFORE INSERT ON teachers WHEN NEW.reporting_to IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.reporting_to AND school_id=NEW.school_id AND user_type IN ('teacher','admin') AND status='active') BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER teacher_manager_update BEFORE UPDATE ON teachers WHEN NEW.reporting_to IS NOT NULL AND (NEW.reporting_to=NEW.user_id OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.reporting_to AND school_id=NEW.school_id AND user_type IN ('teacher','admin') AND status='active')) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
