CREATE TABLE record_exports (
 id TEXT PRIMARY KEY,
 school_id TEXT NOT NULL REFERENCES schools(id),
 actor_id TEXT NOT NULL,
 source_json TEXT NOT NULL,
 authorization TEXT NOT NULL,
 format TEXT NOT NULL CHECK(format IN ('csv','pdf','xlsx')),
 title TEXT NOT NULL,
 school_name TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('capturing','queued','processing','ready','failed','expired')),
 rows_total INTEGER NOT NULL DEFAULT 0,
 rows_done INTEGER NOT NULL DEFAULT 0,
 parts_json TEXT NOT NULL DEFAULT '[]',
 lease_id TEXT,
 lease_until INTEGER,
 attempts INTEGER NOT NULL DEFAULT 0,
 error TEXT,
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 command_id TEXT NOT NULL,
 request_hash TEXT NOT NULL,
 UNIQUE(school_id,actor_id,command_id)
);
CREATE INDEX record_exports_owner ON record_exports(school_id,actor_id,created_at);
CREATE INDEX record_exports_work ON record_exports(status,lease_until,expires_at);
