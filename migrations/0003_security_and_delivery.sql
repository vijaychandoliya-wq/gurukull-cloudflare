-- Additive infrastructure; no school users, classes or other business fixtures.
CREATE TABLE academic_years (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), name TEXT NOT NULL,
 starts_on TEXT NOT NULL, ends_on TEXT NOT NULL, is_current INTEGER NOT NULL CHECK(is_current IN (0,1)),
 UNIQUE(school_id,id), CHECK(starts_on <= ends_on)
);
CREATE UNIQUE INDEX academic_year_current ON academic_years(school_id) WHERE is_current=1;
CREATE TABLE teacher_assignments (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), teacher_user_id TEXT NOT NULL REFERENCES users(id),
 class_id TEXT NOT NULL REFERENCES classes(id), section_id TEXT NOT NULL REFERENCES sections(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), subject_name TEXT,
 UNIQUE(school_id,teacher_user_id,section_id,academic_year_id,subject_name)
);
CREATE INDEX assignments_teacher ON teacher_assignments(school_id,teacher_user_id,section_id);
CREATE TABLE timetables (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), teacher_user_id TEXT NOT NULL REFERENCES users(id),
 class_id TEXT NOT NULL REFERENCES classes(id), section_id TEXT NOT NULL REFERENCES sections(id),
 academic_year_id TEXT NOT NULL REFERENCES academic_years(id), day TEXT NOT NULL,
 period_no INTEGER NOT NULL CHECK(period_no>0), subject_name TEXT NOT NULL, start_time TEXT, end_time TEXT, room_no TEXT,
 UNIQUE(school_id,academic_year_id,teacher_user_id,day,period_no), UNIQUE(school_id,academic_year_id,section_id,day,period_no)
);
CREATE TABLE school_configuration (
 school_id TEXT PRIMARY KEY REFERENCES schools(id), timezone TEXT, currency TEXT, address TEXT,
 configuration_verified_at INTEGER, updated_at INTEGER NOT NULL
);
CREATE TABLE platform_operators (
 user_id TEXT PRIMARY KEY REFERENCES users(id), granted_at INTEGER NOT NULL, revoked_at INTEGER
);
ALTER TABLE users ADD COLUMN legacy_usergroup_id INTEGER;
CREATE TABLE user_roles (
 school_id TEXT NOT NULL REFERENCES schools(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL,
 PRIMARY KEY(school_id,user_id,role)
);
CREATE TRIGGER roles_tenant_insert BEFORE INSERT ON user_roles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER roles_tenant_update BEFORE UPDATE ON user_roles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TABLE id_mappings (
 school_id TEXT NOT NULL REFERENCES schools(id), entity_type TEXT NOT NULL, source_system TEXT NOT NULL,
 legacy_id TEXT NOT NULL, target_id TEXT NOT NULL, source_checksum TEXT NOT NULL,
 PRIMARY KEY(school_id,entity_type,source_system,legacy_id), UNIQUE(school_id,entity_type,target_id)
);
ALTER TABLE outbox ADD COLUMN lease_id TEXT;
ALTER TABLE outbox ADD COLUMN lease_until INTEGER;
CREATE TABLE delivery_outcomes (
 event_id TEXT NOT NULL REFERENCES outbox(id), device_id TEXT NOT NULL REFERENCES devices(id),
 school_id TEXT NOT NULL REFERENCES schools(id), status TEXT NOT NULL CHECK(status IN ('pending','sending','sent','invalid','failed','unknown')),
 attempts INTEGER NOT NULL DEFAULT 0, provider_message_id TEXT, last_error TEXT, updated_at INTEGER NOT NULL,
 PRIMARY KEY(event_id,device_id)
);
ALTER TABLE files ADD COLUMN state TEXT NOT NULL DEFAULT 'unverified' CHECK(state IN ('reserved','verified','unverified','orphan'));
CREATE TABLE storage_limits (
 scope TEXT PRIMARY KEY, max_bytes INTEGER NOT NULL CHECK(typeof(max_bytes)='integer' AND max_bytes>0),
 used_bytes INTEGER NOT NULL DEFAULT 0 CHECK(typeof(used_bytes)='integer' AND used_bytes>=0),
 reserved_bytes INTEGER NOT NULL DEFAULT 0 CHECK(typeof(reserved_bytes)='integer' AND reserved_bytes>=0),
 CHECK(used_bytes+reserved_bytes<=max_bytes)
);
CREATE TABLE upload_reservations (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), size_bytes INTEGER NOT NULL CHECK(size_bytes>=0),
 expires_at INTEGER NOT NULL, state TEXT NOT NULL CHECK(state IN ('reserved','committed','orphan','released'))
);
CREATE TABLE login_attempts (
 attempt_key TEXT PRIMARY KEY, window_start INTEGER NOT NULL, attempts INTEGER NOT NULL CHECK(attempts>=0)
);
ALTER TABLE attendance ADD COLUMN calendar_date TEXT;
ALTER TABLE attendance ADD COLUMN academic_year_id TEXT REFERENCES academic_years(id);
ALTER TABLE attendance ADD COLUMN reason_id TEXT;
ALTER TABLE attendance ADD COLUMN remarks TEXT;
CREATE TABLE absent_reasons (id TEXT PRIMARY KEY, school_id TEXT NOT NULL REFERENCES schools(id), name TEXT NOT NULL, status TEXT NOT NULL);
CREATE TABLE attendance_batches (
 school_id TEXT NOT NULL REFERENCES schools(id), section_id TEXT NOT NULL REFERENCES sections(id), calendar_date TEXT NOT NULL,
 session TEXT NOT NULL, version INTEGER NOT NULL, payload_hash TEXT NOT NULL, updated_at INTEGER NOT NULL,
 PRIMARY KEY(school_id,section_id,calendar_date,session)
);
CREATE TABLE command_guards (id TEXT PRIMARY KEY, valid INTEGER NOT NULL CHECK(valid=1));
CREATE TABLE provisioning_operations (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id), idempotency_key TEXT NOT NULL,
 payload_hash TEXT NOT NULL, school_id TEXT REFERENCES schools(id), created_at INTEGER NOT NULL,
 UNIQUE(actor_id,idempotency_key)
);
CREATE TRIGGER invoice_money_insert BEFORE INSERT ON fee_invoices WHEN typeof(NEW.amount_paise)!='integer' OR NEW.amount_paise<0
 BEGIN SELECT RAISE(ABORT,'INVALID_MONEY'); END;
CREATE TRIGGER invoice_money_update BEFORE UPDATE ON fee_invoices WHEN typeof(NEW.amount_paise)!='integer' OR NEW.amount_paise<0
 BEGIN SELECT RAISE(ABORT,'INVALID_MONEY'); END;
CREATE TRIGGER payment_money_insert BEFORE INSERT ON fee_payments WHEN typeof(NEW.amount_paid_paise)!='integer' OR NEW.amount_paid_paise<=0
 BEGIN SELECT RAISE(ABORT,'INVALID_MONEY'); END;
CREATE TRIGGER payment_immutable_update BEFORE UPDATE ON fee_payments BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;
CREATE TRIGGER payment_immutable_delete BEFORE DELETE ON fee_payments BEGIN SELECT RAISE(ABORT,'PAYMENT_IMMUTABLE'); END;

CREATE TRIGGER sessions_tenant_insert BEFORE INSERT ON sessions WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER sessions_tenant_update BEFORE UPDATE ON sessions WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER devices_tenant_insert BEFORE INSERT ON devices WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER devices_tenant_update BEFORE UPDATE ON devices WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER user_profiles_tenant_insert BEFORE INSERT ON user_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER user_profiles_tenant_update BEFORE UPDATE ON user_profiles WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER sections_tenant_insert BEFORE INSERT ON sections WHEN NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER sections_tenant_update BEFORE UPDATE ON sections WHEN NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER students_tenant_insert BEFORE INSERT ON students WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER students_tenant_update BEFORE UPDATE ON students WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER teachers_tenant_insert BEFORE INSERT ON teachers WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER teachers_tenant_update BEFORE UPDATE ON teachers WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER parent_student_links_tenant_insert BEFORE INSERT ON parent_student_links WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.parent_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER parent_student_links_tenant_update BEFORE UPDATE ON parent_student_links WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.parent_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER attendance_tenant_insert BEFORE INSERT ON attendance WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recorded_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER attendance_tenant_update BEFORE UPDATE ON attendance WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.recorded_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER homeworks_tenant_insert BEFORE INSERT ON homeworks WHEN NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER homeworks_tenant_update BEFORE UPDATE ON homeworks WHEN NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER fee_invoices_tenant_insert BEFORE INSERT ON fee_invoices WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM fee_groups WHERE id=NEW.fee_group_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER fee_invoices_tenant_update BEFORE UPDATE ON fee_invoices WHEN NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM fee_groups WHERE id=NEW.fee_group_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER fee_payments_tenant_insert BEFORE INSERT ON fee_payments WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.collected_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER fee_payments_tenant_update BEFORE UPDATE ON fee_payments WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM students WHERE id=NEW.student_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.collected_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER files_tenant_insert BEFORE INSERT ON files WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.uploaded_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER files_tenant_update BEFORE UPDATE ON files WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.uploaded_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER notices_tenant_insert BEFORE INSERT ON notices WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.published_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER notices_tenant_update BEFORE UPDATE ON notices WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.published_by AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER command_idempotency_tenant_insert BEFORE INSERT ON command_idempotency WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER command_idempotency_tenant_update BEFORE UPDATE ON command_idempotency WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.actor_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER teacher_assignments_tenant_insert BEFORE INSERT ON teacher_assignments WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER teacher_assignments_tenant_update BEFORE UPDATE ON teacher_assignments WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER timetables_tenant_insert BEFORE INSERT ON timetables WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER timetables_tenant_update BEFORE UPDATE ON timetables WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.teacher_user_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM classes WHERE id=NEW.class_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM academic_years WHERE id=NEW.academic_year_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER delivery_outcomes_tenant_insert BEFORE INSERT ON delivery_outcomes WHEN NOT EXISTS(SELECT 1 FROM outbox WHERE id=NEW.event_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM devices WHERE id=NEW.device_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;

CREATE TRIGGER delivery_outcomes_tenant_update BEFORE UPDATE ON delivery_outcomes WHEN NOT EXISTS(SELECT 1 FROM outbox WHERE id=NEW.event_id AND school_id=NEW.school_id) OR NOT EXISTS(SELECT 1 FROM devices WHERE id=NEW.device_id AND school_id=NEW.school_id)
 BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP_MISMATCH'); END;
CREATE TRIGGER students_section_insert BEFORE INSERT ON students WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER students_section_update BEFORE UPDATE ON students WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER attendance_section_insert BEFORE INSERT ON attendance WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER attendance_section_update BEFORE UPDATE ON attendance WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER homeworks_section_insert BEFORE INSERT ON homeworks WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER homeworks_section_update BEFORE UPDATE ON homeworks WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER teacher_assignments_section_insert BEFORE INSERT ON teacher_assignments WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER teacher_assignments_section_update BEFORE UPDATE ON teacher_assignments WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER timetables_section_insert BEFORE INSERT ON timetables WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER timetables_section_update BEFORE UPDATE ON timetables WHEN NOT EXISTS(SELECT 1 FROM sections WHERE id=NEW.section_id AND class_id=NEW.class_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'SECTION_CLASS_MISMATCH'); END;
CREATE TRIGGER payment_student_insert BEFORE INSERT ON fee_payments WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND student_id=NEW.student_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'INVOICE_STUDENT_MISMATCH'); END;
CREATE TRIGGER payment_student_update BEFORE UPDATE ON fee_payments WHEN NOT EXISTS(SELECT 1 FROM fee_invoices WHERE id=NEW.invoice_id AND student_id=NEW.student_id AND school_id=NEW.school_id) BEGIN SELECT RAISE(ABORT,'INVOICE_STUDENT_MISMATCH'); END;
