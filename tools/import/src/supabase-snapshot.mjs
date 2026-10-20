#!/usr/bin/env node
/**
 * Read-only Supabase/Postgres extractor for the Cloudflare ETL contract.
 *
 * The extractor is deliberately source-ID strict: it refuses to substitute a
 * different school when the requested school is absent. The resulting JSON is
 * a private intermediate artifact for transform/load; it is never a seed.
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let pg;
try {
  pg = require('pg');
} catch {
  // The backend workspace already pins pg. This fallback keeps the extractor
  // usable without adding a second unreviewed database client dependency.
  pg = require(resolve(import.meta.dirname, '../../../../gurukul-backend-core/node_modules/pg'));
}

function usage() {
  console.error('Usage: node supabase-snapshot.mjs --school-id <id> --output <path> [--env <path>] [--max-rows <n>]');
  process.exitCode = 2;
}

function options(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key?.startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) return usage();
    out[key.slice(2)] = argv[i + 1];
  }
  return out;
}

function readEnv(path) {
  const result = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    result[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return result;
}

const opts = options(process.argv.slice(2));
if (!opts || !opts['school-id'] || !opts.output) {
  usage();
  process.exit(2);
}

const envPath = resolve(opts.env || resolve(import.meta.dirname, '../../../../supabase/.env'));
const env = readEnv(envPath);
const schoolId = String(opts['school-id']);
const maxRows = Number(opts['max-rows'] || 50000);
if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 500000) throw new Error('INVALID_MAX_ROWS');

const client = new pg.Client({
  host: '127.0.0.1', // local Supabase is exposed on localhost; never copy this into a deployment
  port: Number(env.POSTGRES_PORT || 5432),
  database: env.POSTGRES_DB || 'postgres',
  user: 'postgres',
  password: env.POSTGRES_PASSWORD,
  connectionTimeoutMillis: 5000,
});

try {
  await client.connect();
  const school = (await client.query(
    'SELECT * FROM public.schools WHERE id = $1 LIMIT 1',
    [schoolId],
  )).rows[0];
  if (!school) throw new Error('SOURCE_SCHOOL_NOT_FOUND');

  const tableRows = { schools: [school] };
  const columns = (await client.query(`
    SELECT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'school_id'
    ORDER BY table_name
  `)).rows;
  let total = 1;
  for (const { table_name: table } of columns) {
    if (table === 'schools') continue;
    const rows = (await client.query(`SELECT * FROM public."${table}" WHERE school_id = $1`, [schoolId])).rows;
    total += rows.length;
    if (total > maxRows) throw new Error('SOURCE_ROW_LIMIT_REQUIRES_PARTITION');
    tableRows[table] = rows;
  }

  const snapshot = {
    sourceSystem: 'supabase-postgres',
    sourceSchoolId: schoolId,
    schoolId,
    schoolCode: String(school.code || school.slug || school.id),
    cutoff: new Date().toISOString(),
    tables: tableRows,
  };
  writeFileSync(resolve(opts.output), JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: 'extracted', sourceSchoolId: schoolId, tables: Object.keys(tableRows).length, rows: total }));
} finally {
  await client.end().catch(() => {});
}
