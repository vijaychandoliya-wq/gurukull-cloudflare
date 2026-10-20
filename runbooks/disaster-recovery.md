# Tenant backup and restoration

Updated 8 October 2026. The tools now operate on explicitly named local SQLite snapshots and real file contents. They do not connect to live D1/MySQL/PostgreSQL automatically. There is no completed R2 file-byte archive or reverse mapping to the legacy writers.

From the Cloudflare workspace, use the supported Node runtime and the installed `tsx`:

```sh
node --import tsx tools/backup/src/backup.ts export --source-sqlite "$SOURCE_SQLITE" --school "$SCHOOL_CODE" --output "$BACKUP_PACKAGE"
node --import tsx tools/backup/src/backup.ts verify --input "$BACKUP_PACKAGE"
node --import tsx tools/backup/src/backup.ts restore --input "$BACKUP_PACKAGE" --target-sqlite "$RESTORE_SQLITE" --school "$SCHOOL_CODE"
```

Set these variables to genuine explicit source/target paths and a verified school code. The source must be a consistent read-only SQLite snapshot, including migrations. The target must already exist with the matching schema. Export creates a private mode-0600 file and refuses to overwrite an existing package.

Manifest v2 binds school identity, schema version, export time, table names/counts/digests and the overall metadata digest. All non-school rows must carry the same `school_id`. Checksums detect corruption; they do not authenticate against an attacker who can rewrite the package and recompute its checksums. Keep archives protected and implement the agreed encrypted/authenticated archival storage before operational recovery sign-off.

Restore inserts scoped rows in a transaction, preserves identical existing rows, rejects conflicting rows, verifies foreign keys, and rolls back on error. It never deletes or overwrites an active tenant ledger. Restoration into a separate schema-compatible target is the supported rehearsal. Replacement of an active school's data is a separate, owner-reviewed procedure and is not implemented here.

The 8 October local rehearsal restored only the requested empty Rajesh reservation: 36 tables compared identically and all business tables remained empty. This proves empty-schema recovery only. An authorized genuine source is required for ledger, cross-tenant, file, volume and post-write recovery tests.

The ETL CLI accepts explicit JSON snapshots with provenance, column mapping and school allowlists. `load` defaults to a rollback-only SQLite dry run; `--apply` explicitly commits to the named local target. It caps each input at 5,000 rows. Conflicting existing payloads fail rather than overwrite. Actual legacy ID/foreign-key transformations and partition/resume ownership remain to be mapped against the authoritative source.

```sh
node --import tsx tools/import/src/etl.ts diagnose --input "$SOURCE_SNAPSHOT"
node --import tsx tools/import/src/etl.ts transform --input "$SOURCE_SNAPSHOT" --mapping "$SOURCE_MAPPING" --output "$TRANSFORMED_SNAPSHOT"
node --import tsx tools/import/src/etl.ts load --input "$TRANSFORMED_SNAPSHOT" --target-sqlite "$TARGET_SQLITE" --school "$SCHOOL_CODE" --checkpoint "$CHECKPOINT_PATH"
node --import tsx tools/import/src/etl.ts reconcile --source "$TRANSFORMED_SNAPSHOT" --target "$ACTUAL_TARGET_SNAPSHOT"
```

Never pass invented totals as reconciliation evidence. `reconcile` compares supplied rows, not the live target database; capture an actual consistent target snapshot first. Exact decimal-to-paise conversion rejects fractional paise, overflow, negative amounts, exponent notation and trailing text.

After edge writes, reversing DNS alone loses data. Freeze writers, capture all deltas, apply independently tested reverse mappings, reconcile genuine records and restore exactly one writer. Those mappings and a genuine rollback rehearsal remain blocked; retain the legacy ERP.
