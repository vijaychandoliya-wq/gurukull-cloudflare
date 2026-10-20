#!/usr/bin/env node
/**
 * Read-only extractor for the legacy Docker MySQL database.
 * It intentionally requires an explicit source school id and emits a private
 * JSON snapshot for the migration transform; it never writes to MySQL or D1.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const tables = [
  'schools', 'academic_years', 'standards', 'sections', 'standards_link',
  'users', 'userprofiles', 'parent_profiles', 'student_academics',
  'student_parent_links', 'teacherprofile', 'subjects', 'class_teacher_links', 'attendances',
  'timetables', 'exams', 'exam_schedules', 'exam_marks', 'fee_groups',
  'books', 'events', 'notice_board', 'homeworks', 'assignments',
  'books_category', 'books_lending', 'library_card', 'roles', 'role_user',
];

function usage() {
  console.error('Usage: node mysql-snapshot.mjs --school-id <id> --output <path> [--container <name>] [--max-rows <n>]');
  process.exit(2);
}
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    if (!k?.startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) usage();
    out[k.slice(2)] = argv[i + 1];
  }
  return out;
}
const opts = parseArgs(process.argv.slice(2));
if (!opts['school-id'] || !opts.output) usage();
const schoolId = String(opts['school-id']);
const container = String(opts.container || 'gurukul_mysql_database');
const maxRows = Number(opts['max-rows'] || 100000);
if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > 500000) throw new Error('INVALID_MAX_ROWS');

function mysql(sql) {
  // --raw is required here: the JSON encoder already escaped quotes inside
  // long text fields (without it the mysql client escapes them a second time).
  const output = execFileSync('docker', ['exec', container, 'mysql', '-uroot', '-proot', 'school', '-N', '-B', '--raw', '-e', sql], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  return output.split(/\r?\n/).filter(Boolean);
}
function columns(table) {
  return mysql(`SELECT column_name FROM information_schema.columns WHERE table_schema='school' AND table_name='${table}' ORDER BY ordinal_position`);
}
function hasSchoolColumn(cols) { return cols.includes('school_id'); }
function extract(table) {
  const cols = columns(table);
  if (!cols.length) return [];
  const expr = cols.map((c) => `JSON_OBJECT(${JSON.stringify(c)},\`${c}\`)`).join(',');
  // JSON_MERGE_PRESERVE combines the individual column objects without
  // relying on a fixed schema, while preserving nulls and long text values.
  const where = hasSchoolColumn(cols) ? ` WHERE school_id=${JSON.stringify(schoolId)}` : '';
  const rows = mysql(`SELECT JSON_MERGE_PRESERVE(${expr}) FROM \`${table}\`${where}`);
  return rows.map((line) => JSON.parse(line));
}

const schoolRows = extract('schools');
if (schoolRows.length !== 1) throw new Error(`SOURCE_SCHOOL_ID_${schoolId}_NOT_UNIQUE`);
let total = 0;
const extracted = {};
for (const table of tables) {
  const rows = extract(table);
  total += rows.length;
  if (total > maxRows) throw new Error('SOURCE_ROW_LIMIT_REQUIRES_PARTITION');
  extracted[table] = rows;
}
const school = schoolRows[0];
const snapshot = {
  sourceSystem: 'legacy-docker-mysql',
  sourceContainer: container,
  sourceDatabase: 'school',
  sourceSchoolId: schoolId,
  schoolId,
  // The legacy source has no school code. The target mapping must therefore
  // provide the requested destination code explicitly; never infer it here.
  sourceSchoolCode: school.code || null,
  sourceSchoolName: school.name,
  cutoff: new Date().toISOString(),
  tables: extracted,
};
writeFileSync(opts.output, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: 'extracted', sourceSchoolId: schoolId, sourceSchoolName: school.name, tables: Object.keys(extracted).length, rows: total }));
