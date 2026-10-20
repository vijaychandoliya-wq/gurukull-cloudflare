/**
 * Gurukul Mobile Offline SQLite & Sync Architecture Contracts
 * Governs OP-SQLite (React Native) & Room (Android) local databases.
 * Phase 05: Tasks M02 - M07
 */

export const MOBILE_SQLITE_SCHEMA_VERSION = 1;

export const MOBILE_SQLITE_DDL = `
-- 1. Encrypted Entity Cache (UI Primary Data Source)
CREATE TABLE IF NOT EXISTS entity_cache (
    school_id TEXT NOT NULL,
    actor_scope TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    server_version INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
    last_synced_at INTEGER NOT NULL,
    PRIMARY KEY (school_id, actor_scope, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_cache_lookup 
ON entity_cache(school_id, actor_scope, entity_type);

-- 2. Durable Mobile Outbox (Mutations created offline)
CREATE TABLE IF NOT EXISTS outbox (
    command_id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('ATTENDANCE_RECORD', 'MARK_ENTRY', 'HOMEWORK_DRAFT', 'NOTICE_DRAFT', 'FILE_ATTACH')),
    entity_id TEXT,
    base_version INTEGER DEFAULT 0,
    payload_json TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'in_flight', 'acknowledged', 'conflict', 'rejected')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL,
    retry_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outbox_state 
ON outbox(school_id, actor_id, state, retry_at);

-- 3. Sync State Watermark per Collection
CREATE TABLE IF NOT EXISTS sync_state (
    school_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    collection TEXT NOT NULL,
    opaque_cursor TEXT,
    snapshot_version INTEGER NOT NULL DEFAULT 0,
    last_success_at INTEGER NOT NULL,
    PRIMARY KEY (school_id, actor_id, collection)
);

-- 4. Bounded Local File Upload Queue
CREATE TABLE IF NOT EXISTS file_queue (
    local_id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    local_path TEXT NOT NULL,
    checksum_sha256 TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    server_file_id TEXT,
    upload_state TEXT NOT NULL DEFAULT 'queued' CHECK (upload_state IN ('queued', 'uploading', 'verified', 'failed')),
    error_reason TEXT,
    created_at INTEGER NOT NULL
);
`;

export interface CachedEntity<T = any> {
  school_id: string;
  actor_scope: string;
  entity_type: string;
  entity_id: string;
  server_version: number;
  payload: T;
  is_deleted: boolean;
  last_synced_at: number;
}

export interface OutboxCommandRecord {
  command_id: string;
  school_id: string;
  actor_id: string;
  kind: 'ATTENDANCE_RECORD' | 'MARK_ENTRY' | 'HOMEWORK_DRAFT' | 'NOTICE_DRAFT' | 'FILE_ATTACH';
  entity_id?: string;
  base_version?: number;
  payload_json: string;
  payload_hash: string;
  state: 'pending' | 'in_flight' | 'acknowledged' | 'conflict' | 'rejected';
  attempts: number;
  last_error?: string;
  created_at: number;
  retry_at: number;
}

export interface SyncStateRecord {
  school_id: string;
  actor_id: string;
  collection: string;
  opaque_cursor: string | null;
  snapshot_version: number;
  last_success_at: number;
}

/**
 * Deterministic JSON stringifier to ensure consistent payload hashes
 */
export function canonicalJsonStringify(obj: any): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonStringify).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `${JSON.stringify(k)}:${canonicalJsonStringify(obj[k])}`).join(',') + '}';
}

/**
 * WebCrypto / Node compatible SHA-256 payload hasher
 */
export async function computePayloadHash(payload: any): Promise<string> {
  const json = canonicalJsonStringify(payload);
  const data = new TextEncoder().encode(json);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
