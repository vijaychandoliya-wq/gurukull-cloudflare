-- 0001_initial_schema.sql
-- Gurukul Edge-Native D1 Multi-Tenant Core Schema
-- Prepared: 2026-10-08
-- Mandate: Strict school_id scoping, integer paise currency, zero dummy seeds.

-- 1. Schools Registry Table
CREATE TABLE IF NOT EXISTS schools (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('requested', 'validated', 'reserved', 'configuration_needed', 'administrator_pending', 'active', 'suspended', 'archived')),
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    currency TEXT NOT NULL DEFAULT 'INR',
    logo_r2_key TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Index for rapid code & slug lookups
CREATE INDEX IF NOT EXISTS idx_schools_code ON schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_slug ON schools(slug);

-- 2. Domain & Hostname Mapping Table
CREATE TABLE IF NOT EXISTS domains (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    hostname TEXT NOT NULL UNIQUE,
    is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_verification', 'suspended')),
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_domains_hostname ON domains(hostname);
CREATE INDEX IF NOT EXISTS idx_domains_school_id ON domains(school_id);

-- 3. Users Table (Platform & School Identities)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    email TEXT,
    mobile TEXT,
    password_hash TEXT NOT NULL,
    hash_algorithm TEXT NOT NULL DEFAULT 'pbkdf2_sha256' CHECK (hash_algorithm IN ('bcrypt', 'pbkdf2_sha256', 'argon2id')),
    full_name TEXT NOT NULL,
    user_type TEXT NOT NULL CHECK (user_type IN ('superadmin', 'admin', 'teacher', 'parent', 'student', 'staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deactivated')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (school_id, mobile),
    UNIQUE (school_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_school_mobile ON users(school_id, mobile);
CREATE INDEX IF NOT EXISTS idx_users_school_email ON users(school_id, email);

-- 4. User Sessions Table (Stateless JWT Revocation / Refresh Store)
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_digest TEXT NOT NULL UNIQUE,
    device_id TEXT,
    platform TEXT CHECK (platform IN ('android', 'ios', 'web', 'unknown')),
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, school_id);
CREATE INDEX IF NOT EXISTS idx_sessions_digest ON sessions(token_digest);

-- 5. Outbox Table for Async Event Processing & Queue Guarantees (Phase 07)
CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    aggregate_id TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead_letter')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    scheduled_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status, scheduled_at);

-- 6. File Metadata Table for Private R2 Asset Scoping (Phase 07)
CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    uploaded_by TEXT NOT NULL REFERENCES users(id),
    r2_key TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    checksum_sha256 TEXT,
    access_scope TEXT NOT NULL CHECK (access_scope IN ('public', 'school_private', 'student_private', 'staff_private')),
    entity_type TEXT,
    entity_id TEXT,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_files_entity ON files(school_id, entity_type, entity_id);

-- 7. Rajesh School Clean Reservation Record (R00 - R02)
-- Status is set strictly to 'configuration_needed'. Zero dummy students, parents, attendance or marks.
INSERT OR IGNORE INTO schools (id, code, slug, name, status, timezone, currency, created_at, updated_at)
VALUES (
    'school_rajesh_res_001',
    'RAJESH',
    'rajesh',
    'Rajesh school',
    'configuration_needed',
    'Asia/Kolkata',
    'INR',
    1728367200,
    1728367200
);

INSERT OR IGNORE INTO domains (id, school_id, hostname, is_primary, status, created_at)
VALUES (
    'dom_rajesh_subdomain_001',
    'school_rajesh_res_001',
    'rajesh.gurukull.in',
    1,
    'active',
    1728367200
);
