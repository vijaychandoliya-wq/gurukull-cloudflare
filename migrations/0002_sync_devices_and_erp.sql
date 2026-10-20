-- 0002_sync_devices_and_erp.sql
-- Gurukul Edge-Native D1 Sync, Devices, and Core ERP Domain Tables
-- Prepared: 2026-10-08
-- Mandate: Strict school_id scoping, integer paise currency, zero dummy seeds.

-- 1. Devices Registry for FCM Push & Session Targeting (Phase 05 M04 / Phase 06 B02)
CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installation_id TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
    app_version TEXT NOT NULL,
    fcm_token TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),
    last_seen_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(school_id, user_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_token ON devices(fcm_token);

-- 2. Changelog for Delta Sync Stream (Phase 05 M04)
CREATE TABLE IF NOT EXISTS changelog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_scope TEXT NOT NULL, -- e.g. 'all', 'teacher:USR_123', 'parent:USR_456'
    entity_type TEXT NOT NULL, -- e.g. 'attendance', 'homework', 'notice', 'marks', 'fee'
    entity_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
    payload_json TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_changelog_cursor ON changelog(school_id, id);
CREATE INDEX IF NOT EXISTS idx_changelog_actor ON changelog(school_id, actor_scope, id);

-- 3. Command Idempotency Ledger for Sync Outbox Push (Phase 05 M04)
CREATE TABLE IF NOT EXISTS command_idempotency (
    id TEXT PRIMARY KEY, -- Hash or unique identifier
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    command_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected', 'conflict')),
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (school_id, actor_id, command_id)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_lookup ON command_idempotency(school_id, actor_id, command_id);

-- 4. User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    dob TEXT,
    blood_group TEXT,
    address TEXT,
    city TEXT,
    pincode TEXT,
    avatar_r2_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_school ON user_profiles(school_id);

-- 5. Classes & Sections
CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS sections (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, class_id, name)
);

CREATE INDEX IF NOT EXISTS idx_sections_class ON sections(school_id, class_id);

-- 6. Students Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    admission_no TEXT NOT NULL,
    roll_no TEXT,
    class_id TEXT NOT NULL REFERENCES classes(id),
    section_id TEXT NOT NULL REFERENCES sections(id),
    enrollment_date TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'alumni', 'transferred')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, admission_no)
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(school_id, class_id, section_id);

-- 7. Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    employee_code TEXT NOT NULL,
    designation TEXT,
    qualification TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resigned', 'on_leave')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, employee_code)
);

-- 8. Parent-Student Linkage (Multi-child support)
CREATE TABLE IF NOT EXISTS parent_student_links (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    parent_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    relationship TEXT NOT NULL CHECK (relationship IN ('father', 'mother', 'guardian')),
    created_at INTEGER NOT NULL,
    UNIQUE (school_id, parent_user_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_student_links(school_id, parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_student ON parent_student_links(school_id, student_id);

-- 9. Attendance Table (Roll call)
CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id),
    section_id TEXT NOT NULL REFERENCES sections(id),
    date_timestamp INTEGER NOT NULL, -- Unix timestamp at 00:00:00 of the day
    session TEXT NOT NULL CHECK (session IN ('whole_day', 'morning', 'afternoon')),
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'half_day', 'excused')),
    recorded_by TEXT NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, student_id, date_timestamp, session)
);

CREATE INDEX IF NOT EXISTS idx_attendance_lookup ON attendance(school_id, class_id, section_id, date_timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(school_id, student_id, date_timestamp);

-- 10. Homeworks & Submissions
CREATE TABLE IF NOT EXISTS homeworks (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id TEXT NOT NULL REFERENCES classes(id),
    section_id TEXT NOT NULL REFERENCES sections(id),
    subject_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    due_date INTEGER NOT NULL,
    attachment_r2_key TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    version INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_homeworks_class ON homeworks(school_id, class_id, section_id, due_date);

-- 11. Fees: Groups, Invoices, Payments (Stored strictly in integer paise)
CREATE TABLE IF NOT EXISTS fee_groups (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS fee_invoices (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    fee_group_id TEXT NOT NULL REFERENCES fee_groups(id),
    invoice_no TEXT NOT NULL,
    amount_paise INTEGER NOT NULL, -- Exact paise: amount * 100
    due_date INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partially_paid', 'paid', 'cancelled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_invoices_student ON fee_invoices(school_id, student_id, status);

CREATE TABLE IF NOT EXISTS fee_payments (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    invoice_id TEXT NOT NULL REFERENCES fee_invoices(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    receipt_no TEXT NOT NULL,
    amount_paid_paise INTEGER NOT NULL, -- Exact paise: amount * 100
    payment_mode TEXT NOT NULL CHECK (payment_mode IN ('cash', 'cheque', 'bank_transfer', 'online_gateway')),
    transaction_ref TEXT,
    collected_by TEXT NOT NULL REFERENCES users(id),
    payment_date INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (school_id, receipt_no)
);

CREATE INDEX IF NOT EXISTS idx_payments_student ON fee_payments(school_id, student_id);

-- 12. Notices & Communications
CREATE TABLE IF NOT EXISTS notices (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    audience_scope TEXT NOT NULL CHECK (audience_scope IN ('all', 'teachers', 'parents', 'students')),
    published_by TEXT NOT NULL REFERENCES users(id),
    publish_date INTEGER NOT NULL,
    expires_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notices_school ON notices(school_id, publish_date);
