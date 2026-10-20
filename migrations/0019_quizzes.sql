CREATE UNIQUE INDEX teacher_assignment_school_id ON teacher_assignments(school_id,id);
CREATE TABLE school_quizzes (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),academic_year_id TEXT NOT NULL REFERENCES academic_years(id),assignment_id TEXT NOT NULL,section_id TEXT NOT NULL REFERENCES sections(id),
 title TEXT NOT NULL,description TEXT,opens_at INTEGER NOT NULL,closes_at INTEGER NOT NULL,duration_minutes INTEGER NOT NULL CHECK(duration_minutes BETWEEN 5 AND 300),max_attempts INTEGER NOT NULL CHECK(max_attempts BETWEEN 1 AND 10),pass_basis_points INTEGER NOT NULL CHECK(pass_basis_points BETWEEN 1000 AND 10000),case_sensitive INTEGER NOT NULL CHECK(case_sensitive IN (0,1)),
 questions_json TEXT NOT NULL CHECK(json_valid(questions_json)),total_units INTEGER NOT NULL CHECK(total_units>0),
 status TEXT NOT NULL CHECK(status IN ('draft','published','closed')),approval_status TEXT NOT NULL CHECK(approval_status IN ('pending','approved','rejected')),approval_comments TEXT,
 created_by TEXT NOT NULL REFERENCES users(id),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),archived_at INTEGER,
 CHECK(opens_at<closes_at),UNIQUE(school_id,id),FOREIGN KEY(school_id,assignment_id) REFERENCES teacher_assignments(school_id,id)
);
CREATE TABLE school_quiz_attempts (
 id TEXT PRIMARY KEY,school_id TEXT NOT NULL REFERENCES schools(id),quiz_id TEXT NOT NULL,student_id TEXT NOT NULL REFERENCES students(id),attempt_no INTEGER NOT NULL CHECK(attempt_no BETWEEN 1 AND 10),
 quiz_version INTEGER NOT NULL,questions_json TEXT NOT NULL CHECK(json_valid(questions_json)),pass_basis_points INTEGER NOT NULL,total_units INTEGER NOT NULL CHECK(total_units>0),case_sensitive INTEGER NOT NULL CHECK(case_sensitive IN (0,1)),
 started_at INTEGER NOT NULL,deadline_at INTEGER NOT NULL,submitted_at INTEGER,
 answers_json TEXT NOT NULL CHECK(json_valid(answers_json)),manual_scores_json TEXT CHECK(manual_scores_json IS NULL OR json_valid(manual_scores_json)),
 auto_units INTEGER CHECK(auto_units>=0),score_units INTEGER CHECK(score_units>=0 AND score_units<=total_units),
 status TEXT NOT NULL CHECK(status IN ('in_progress','pending_review','graded')),version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),review_comments TEXT,reviewed_by TEXT REFERENCES users(id),reviewed_at INTEGER,
 FOREIGN KEY(school_id,quiz_id) REFERENCES school_quizzes(school_id,id),UNIQUE(school_id,quiz_id,student_id,attempt_no),UNIQUE(school_id,id),CHECK(deadline_at>started_at),
 CHECK((status='in_progress' AND submitted_at IS NULL AND score_units IS NULL) OR (status='pending_review' AND submitted_at IS NOT NULL AND score_units IS NULL) OR (status='graded' AND submitted_at IS NOT NULL AND score_units IS NOT NULL))
);
CREATE INDEX quiz_roster ON school_quizzes(school_id,academic_year_id,section_id,status);
CREATE INDEX quiz_attempt_student ON school_quiz_attempts(school_id,student_id,started_at);
CREATE TRIGGER quiz_tenant_insert BEFORE INSERT ON school_quizzes
WHEN NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE school_id=NEW.school_id AND id=NEW.assignment_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id)
 OR NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.created_by AND user_type IN ('admin','teacher'))
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER quiz_content_locked BEFORE UPDATE ON school_quizzes
WHEN NEW.school_id!=OLD.school_id OR NEW.academic_year_id!=OLD.academic_year_id OR NEW.created_by!=OLD.created_by
 OR (EXISTS(SELECT 1 FROM school_quiz_attempts WHERE quiz_id=OLD.id AND school_id=OLD.school_id) AND (NEW.questions_json!=OLD.questions_json OR NEW.assignment_id!=OLD.assignment_id OR NEW.section_id!=OLD.section_id OR NEW.total_units!=OLD.total_units OR NEW.pass_basis_points!=OLD.pass_basis_points OR NEW.duration_minutes!=OLD.duration_minutes OR NEW.max_attempts!=OLD.max_attempts OR NEW.opens_at!=OLD.opens_at OR NEW.closes_at!=OLD.closes_at OR NEW.case_sensitive!=OLD.case_sensitive))
 OR NOT EXISTS(SELECT 1 FROM teacher_assignments WHERE school_id=NEW.school_id AND id=NEW.assignment_id AND academic_year_id=NEW.academic_year_id AND section_id=NEW.section_id)
BEGIN SELECT RAISE(ABORT,'LOCKED_QUIZ_OR_TENANT_RELATIONSHIP'); END;
CREATE TRIGGER quiz_attempt_tenant BEFORE INSERT ON school_quiz_attempts
WHEN NOT EXISTS(SELECT 1 FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id WHERE s.school_id=NEW.school_id AND s.id=NEW.student_id AND s.status='active' AND u.status='active')
BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER quiz_attempt_snapshot_locked BEFORE UPDATE ON school_quiz_attempts
WHEN NEW.school_id!=OLD.school_id OR NEW.quiz_id!=OLD.quiz_id OR NEW.student_id!=OLD.student_id OR NEW.attempt_no!=OLD.attempt_no OR NEW.quiz_version!=OLD.quiz_version OR NEW.questions_json!=OLD.questions_json OR NEW.pass_basis_points!=OLD.pass_basis_points OR NEW.total_units!=OLD.total_units OR NEW.case_sensitive!=OLD.case_sensitive OR NEW.started_at!=OLD.started_at OR NEW.deadline_at!=OLD.deadline_at OR (OLD.status!='in_progress' AND NEW.answers_json!=OLD.answers_json) OR (OLD.submitted_at IS NOT NULL AND NEW.submitted_at IS NOT OLD.submitted_at)
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ATTEMPT_SNAPSHOT'); END;
CREATE TRIGGER quiz_attempt_no_delete BEFORE DELETE ON school_quiz_attempts
BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ATTEMPT_HISTORY'); END;
CREATE TABLE quiz_review_history(id TEXT PRIMARY KEY,school_id TEXT NOT NULL,attempt_id TEXT NOT NULL,reviewer_id TEXT NOT NULL REFERENCES users(id),before_json TEXT NOT NULL CHECK(json_valid(before_json)),after_json TEXT NOT NULL CHECK(json_valid(after_json)),reviewed_at INTEGER NOT NULL DEFAULT(unixepoch()),FOREIGN KEY(school_id,attempt_id) REFERENCES school_quiz_attempts(school_id,id));
CREATE TRIGGER quiz_review_tenant BEFORE INSERT ON quiz_review_history WHEN NOT EXISTS(SELECT 1 FROM users WHERE school_id=NEW.school_id AND id=NEW.reviewer_id AND user_type IN ('admin','teacher')) BEGIN SELECT RAISE(ABORT,'TENANT_RELATIONSHIP'); END;
CREATE TRIGGER quiz_review_no_update BEFORE UPDATE ON quiz_review_history BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVIEW_HISTORY'); END;
CREATE TRIGGER quiz_review_no_delete BEFORE DELETE ON quiz_review_history BEGIN SELECT RAISE(ABORT,'IMMUTABLE_REVIEW_HISTORY'); END;
