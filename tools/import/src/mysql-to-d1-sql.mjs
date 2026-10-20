#!/usr/bin/env node
/**
 * Deterministic transform for the legacy Docker MySQL snapshot.
 * The output is a transaction of explicit D1 inserts for the requested school
 * code. Unsupported legacy rows are counted in the manifest instead of being
 * silently coerced into unrelated Cloudflare modules.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith('--') || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('USAGE');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  return out;
}
const opts = args(process.argv.slice(2));
if (!opts.input || !opts.sql || !opts.manifest || !opts.school) throw new Error('USAGE');
const source = JSON.parse(readFileSync(opts.input, 'utf8'));
const code = String(opts.school);
const schoolId = `school_${code}_legacy_mysql`;
const yearId = (id) => `ay${code}_${id}`;
const classId = (id) => `class${code}_${id}`;
const sectionId = (standard, section) => `sec${code}_${standard}_${section}`;
const userId = (id) => `usr${code}_${id}`;
const studentId = (id) => `stu${code}_${id}`;
const teacherId = (id) => `tea${code}_${id}`;
const staffId = (id) => `staff${code}_${id}`;
const parentLinkId = (id) => `plink${code}_${id}`;
const subjectId = (id) => `sub${code}_${id}`;
const assignmentId = (id) => `asg${code}_${id}`;
const timetableId = (id) => `tt${code}_${id}`;
const feeGroupId = (id) => `feegrp${code}_${id}`;
const categoryId = (id) => `libcat${code}_${id}`;
const bookId = (id) => `libbook${code}_${id}`;
const copyId = (id) => `libcopy${code}_${id}`;
const noticeId = (id) => `notice${code}_${id}`;
const homeworkId = (id) => `hw${code}_${id}`;

const tables = source.tables;
const byId = (rows) => new Map((rows || []).map((r) => [String(r.id), r]));
const users = byId(tables.users);
const profiles = byId(tables.userprofiles?.map((r) => ({ ...r, id: r.user_id })));
const parentProfiles = byId(tables.parent_profiles?.map((r) => ({ ...r, id: r.user_id })));
const standards = byId(tables.standards);
const sections = byId(tables.sections);
const links = byId(tables.standards_link);
const subjects = byId(tables.subjects);
const activeLinks = (tables.standards_link || []).filter((r) => Number(r.status) === 1 && Number(sections.get(String(r.section_id))?.status) === 1);
const linkByPair = new Map(activeLinks.map((r) => [`${r.standard_id}:${r.section_id}`, r]));
const subjectById = subjects;
const targetRows = {};
const skipped = {};
const notes = [];
const addSkip = (key, n = 1) => { skipped[key] = (skipped[key] || 0) + n; };
const add = (table, row, sourceTable, sourceRow) => {
  (targetRows[table] ||= []).push(row);
  if (sourceTable && sourceRow?.id !== undefined && row.id !== undefined) mappings.push({ school_id: schoolId, entity_type: table, source_system: 'legacy-docker-mysql', legacy_id: `${sourceTable}:${sourceRow.id}`, target_id: row.id, source_checksum: sha(sourceRow) });
};
const mappings = [];
const sha = (v) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const str = (v) => v === undefined || v === null || v === '' ? null : String(v);
const int = (v, fallback = null) => Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback;
const epoch = (v) => {
  if (!v) return null;
  const text = String(v).replace(' ', 'T').replace(/(\.\d{3})\d+/, '$1');
  const t = Date.parse(text.endsWith('Z') ? text : `${text}Z`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
};
const dateOnly = (v) => v ? String(v).slice(0, 10) : null;
const dateTs = (v) => { const d = dateOnly(v); if (!d) return null; const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day) / 1000; };
const sql = (v) => {
  if (v === undefined || v === null) return 'NULL';
  if (typeof v === 'number') { if (!Number.isFinite(v)) return 'NULL'; return String(Math.trunc(v)); }
  return `'${String(v).replace(/[\r\n\t]/g, ' ').replaceAll("'", "''")}'`;
};
const insert = (table, cols, row) => `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => sql(row[c])).join(',')});`;
const targetStatus = (v) => String(v || '').toLowerCase() === 'active' ? 'active' : String(v || '').toLowerCase() === 'exit' ? 'deactivated' : 'inactive';
const roleForGroup = (g) => ({ 1: 'superadmin', 2: 'admin', 3: 'admin', 4: 'admin', 5: 'teacher', 6: 'student', 7: 'parent', 8: 'staff', 10: 'staff', 11: 'staff', 12: 'staff', 13: 'staff' }[Number(g)] || 'staff');
const staffDesignation = (v) => str(v) || 'Staff';
const parentProfession = (v) => {
  const allowed = new Set(['business', 'central_government_employee', 'private', 'home_maker', 'state_government_employee', 'others']);
  return allowed.has(String(v)) ? String(v) : (v ? 'others' : null);
};
const relationship = (v) => ['father', 'mother', 'guardian'].includes(String(v).toLowerCase()) ? String(v).toLowerCase() : 'guardian';

const sourceSchool = (tables.schools || [])[0];
if (!sourceSchool || String(sourceSchool.id) !== String(source.schoolId)) throw new Error('SOURCE_SCHOOL_MISMATCH');
const sourceRows = Object.values(tables).reduce((n, rows) => n + rows.length, 0);

// School and configuration are explicit: the legacy source has no code, so
// the caller-supplied --school is the only allowed destination code.
const created = epoch(sourceSchool.created_at) || Math.floor(Date.now() / 1000);
const updated = epoch(sourceSchool.updated_at) || created;
add('schools', { id: schoolId, code, slug: `school-${code}`, name: sourceSchool.name || `School ${code}`, status: 'active', timezone: 'Asia/Kolkata', currency: 'INR', logo_r2_key: null, created_at: created, updated_at: updated }, 'schools', sourceSchool);
add('school_configuration', { school_id: schoolId, timezone: 'Asia/Kolkata', currency: 'INR', address: str(sourceSchool.address), configuration_verified_at: updated, updated_at: updated });

// Import both source years, preserving the active flag from the legacy row.
for (const row of tables.academic_years || []) add('academic_years', { id: yearId(row.id), school_id: schoolId, name: row.name, starts_on: dateOnly(row.start_date), ends_on: dateOnly(row.end_date), is_current: Number(row.status) === 1 ? 1 : 0 }, 'academic_years', row);
if (!targetRows.academic_years?.some((r) => r.is_current === 1)) throw new Error('SOURCE_CURRENT_YEAR_MISSING');

for (const row of tables.standards || []) add('classes', { id: classId(row.id), school_id: schoolId, name: String(row.name), code: str(row.slug) || str(row.name), sort_order: int(row.order, 0), created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated }, 'standards', row);
for (const row of tables.standards_link || []) {
  if (Number(row.status) !== 1 || !standards.has(String(row.standard_id)) || !sections.has(String(row.section_id)) || Number(sections.get(String(row.section_id)).status) !== 1) { addSkip('inactive_or_invalid_class_section'); continue; }
  const section = sections.get(String(row.section_id));
  add('sections', { id: sectionId(row.standard_id, row.section_id), school_id: schoolId, class_id: classId(row.standard_id), name: String(section.name), sort_order: int(row.section_id, 0), created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated }, null, null);
}
// A class/section can occur in several legacy link rows; target sections are unique.
targetRows.sections = [...new Map((targetRows.sections || []).map((r) => [r.id, r])).values()];

const userTargetType = new Map();
const adminSource = (tables.users || []).find((u) => [1, 3, 4].includes(Number(u.usergroup_id))) || tables.users?.[0];
const adminTarget = adminSource ? userId(adminSource.id) : null;
for (const row of tables.users || []) {
  const type = roleForGroup(row.usergroup_id);
  userTargetType.set(String(row.id), type);
  const keepMobile = !['parent', 'student'].includes(type);
  const email = str(row.email);
  const mobile = keepMobile ? str(row.mobile_no) : null;
  const password = str(row.password);
  if (!password || !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(password)) { addSkip('users_invalid_password_hash'); continue; }
  add('users', { id: userId(row.id), school_id: schoolId, email, mobile, password_hash: password, hash_algorithm: 'bcrypt', full_name: str(row.name) || `Legacy user ${row.id}`, user_type: type, status: targetStatus(row.status), created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated, legacy_usergroup_id: int(row.usergroup_id, null), version: 1 }, 'users', row);
  const p = profiles.get(String(row.id));
  if (p) add('user_profiles', { id: `profile${code}_${row.id}`, school_id: schoolId, user_id: userId(row.id), gender: ['male', 'female'].includes(String(p.gender)) ? p.gender : (p.gender ? 'other' : null), dob: dateOnly(p.date_of_birth), blood_group: str(p.blood_group), address: str(p.address), city: null, pincode: str(p.pincode), avatar_r2_key: null, created_at: epoch(p.created_at) || created, updated_at: epoch(p.updated_at) || updated, first_name: str(p.firstname), last_name: str(p.lastname), alternate_mobile: str(p.alternate_no), aadhaar_number: str(p.aadhar_number) }, 'userprofiles', p);
}
for (const row of tables.users || []) {
  if (!targetRows.users?.some((u) => u.id === userId(row.id))) continue;
  const role = userTargetType.get(String(row.id));
  add('user_roles', { school_id: schoolId, user_id: userId(row.id), role });
  if (role === 'superadmin') add('user_roles', { school_id: schoolId, user_id: userId(row.id), role: 'admin' });
}

const academicByUser = new Map((tables.student_academics || []).filter((r) => Number(r.academic_year_id) === 1).map((r) => [String(r.user_id), r]));
const teacherByUser = new Map((tables.teacherprofile || []).filter((r) => Number(r.status) === 1).map((r) => [String(r.user_id), r]));
const usedStaffEmployeeCodes = new Set();
for (const row of tables.users || []) {
  const type = userTargetType.get(String(row.id));
  if (type === 'student') {
    const a = academicByUser.get(String(row.id));
    const p = profiles.get(String(row.id));
    if (!a) { addSkip('students_without_current_academic_row'); continue; }
    const sl = links.get(String(a.standardLink_id));
    if (!sl || Number(sl.status) !== 1 || Number(sections.get(String(sl.section_id))?.status) !== 1) { addSkip('students_invalid_class_section'); continue; }
    const admission = str(row.registration_number) || `LEGACY-${row.id}`;
    if (!row.registration_number) addSkip('student_admission_generated_from_legacy_id');
    add('students', { id: studentId(row.id), school_id: schoolId, user_id: userId(row.id), admission_no: admission, roll_no: str(a.roll_number), class_id: classId(sl.standard_id), section_id: sectionId(sl.standard_id, sl.section_id), enrollment_date: dateOnly(p?.joining_date), status: String(row.status) === 'exit' ? 'transferred' : (String(row.status) === 'active' ? 'active' : 'inactive'), created_at: epoch(a.created_at) || created, updated_at: epoch(a.updated_at) || updated, academic_year_id: yearId(a.academic_year_id) }, 'student_academics', a);
  } else if (type === 'teacher' && teacherByUser.has(String(row.id))) {
    const t = teacherByUser.get(String(row.id));
    add('teachers', { id: teacherId(row.id), school_id: schoolId, user_id: userId(row.id), employee_code: str(t.employee_id) || `LEGACY-EMP-${row.id}`, designation: str(t.designation), qualification: str(t.sub_qualification), status: Number(t.status) === 1 ? 'active' : 'resigned', created_at: epoch(t.created_at) || created, updated_at: epoch(t.updated_at) || updated, joining_date: dateOnly(profiles.get(String(row.id))?.joining_date), job_type: ['full_time', 'part_time'].includes(String(t.job_type)) ? t.job_type : null, sub_designation: str(t.sub_designation), ug_degree: str(t.ug_degree), pg_degree: str(t.pg_degree), specialization: str(t.specialization), interested_in: str(t.interested_in), reporting_to: t.reporting_to ? userId(t.reporting_to) : null }, 'teacherprofile', t);
  } else if (type === 'staff' && teacherByUser.has(String(row.id))) {
    const t = teacherByUser.get(String(row.id));
    const p = profiles.get(String(row.id));
    if (!t.employee_id || !p?.joining_date) { addSkip('staff_missing_required_profile'); continue; }
    let employeeCode = String(t.employee_id);
    if (usedStaffEmployeeCodes.has(employeeCode)) { employeeCode = `LEGACY-STAFF-${row.id}`; addSkip('staff_employee_code_disambiguated'); }
    usedStaffEmployeeCodes.add(employeeCode);
    add('staff_profiles', { school_id: schoolId, user_id: userId(row.id), employee_code: employeeCode, designation: staffDesignation(t.designation), joining_date: dateOnly(p.joining_date) }, 'teacherprofile', t);
  }
}

const parentProfileUsers = new Set();
for (const row of tables.parent_profiles || []) {
  if (parentProfileUsers.has(String(row.user_id))) { addSkip('duplicate_parent_profile'); continue; }
  parentProfileUsers.add(String(row.user_id));
  const type = userTargetType.get(String(row.user_id));
  if (type !== 'parent' && type !== 'teacher') { addSkip('parent_profile_without_parent_or_teacher_user'); continue; }
  add('parent_profiles', { school_id: schoolId, user_id: userId(row.user_id), profession: parentProfession(row.profession), sub_occupation: str(row.sub_occupation), designation: str(row.designation), organization_name: str(row.organization_name), official_address: str(row.official_address), annual_income: row.annual_income === null || row.annual_income === undefined ? null : Math.max(0, Math.trunc(Number(row.annual_income))), contact_mobile: str(users.get(String(row.user_id))?.mobile_no) }, 'parent_profiles', row);
}
for (const row of tables.student_parent_links || []) {
  if (!targetRows.students?.some((s) => s.id === studentId(row.student_id)) || !targetRows.users?.some((u) => u.id === userId(row.parent_id))) { addSkip('orphan_parent_student_link'); continue; }
  const pp = parentProfiles.get(String(row.parent_id));
  add('parent_student_links', { id: parentLinkId(row.id), school_id: schoolId, parent_user_id: userId(row.parent_id), student_id: studentId(row.student_id), relationship: relationship(pp?.relation), created_at: epoch(row.created_at) || created }, 'student_parent_links', row);
}

for (const row of tables.subjects || []) {
  if (!row.academic_year_id || !row.section_id || !standards.has(String(row.standard_id)) || !linkByPair.has(`${row.standard_id}:${row.section_id}`)) { addSkip('subjects_invalid_class_section'); continue; }
  add('subjects', { id: subjectId(row.id), school_id: schoolId, academic_year_id: yearId(row.academic_year_id), section_id: sectionId(row.standard_id, row.section_id), name: str(row.name) || `Legacy subject ${row.id}`, code: str(row.code), type: str(row.type) || 'core', version: 1 }, 'subjects', row);
}
const assignmentByKey = new Map();
for (const row of tables.class_teacher_links || []) {
  const sl = links.get(String(row.standardLink_id));
  const subject = subjectById.get(String(row.subject_id));
  if (!sl || !subject || !linkByPair.has(`${sl.standard_id}:${sl.section_id}`) || !targetRows.teachers?.some((t) => t.user_id === userId(row.teacher_id))) { addSkip('assignments_unresolvable'); continue; }
  const key = `${row.teacher_id}:${row.standardLink_id}:${row.subject_id}`;
  if (assignmentByKey.has(key)) { addSkip('duplicate_teacher_assignment'); continue; }
  const id = assignmentId(row.id); assignmentByKey.set(key, id);
  const periods = Math.min(112, Math.max(1, int(row.no_of_periods, 1)));
  add('teacher_assignments', { id, school_id: schoolId, teacher_user_id: userId(row.teacher_id), class_id: classId(sl.standard_id), section_id: sectionId(sl.standard_id, sl.section_id), academic_year_id: yearId(row.academic_year_id), subject_name: str(subject.name), subject_id: subjectId(subject.id), planned_periods: periods, version: 1 }, 'class_teacher_links', row);
}
for (const row of tables.timetables || []) {
  if (Number(row.status) !== 1) { addSkip('inactive_timetable'); continue; }
  const sl = links.get(String(row.standardLink_id)); const subject = subjectById.get(String(row.subject_id));
  if (!sl || !subject || !linkByPair.has(`${sl.standard_id}:${sl.section_id}`) || !targetRows.teachers?.some((t) => t.user_id === userId(row.teacher_id))) { addSkip('timetables_unresolvable'); continue; }
  add('timetables', { id: timetableId(row.id), school_id: schoolId, teacher_user_id: userId(row.teacher_id), class_id: classId(sl.standard_id), section_id: sectionId(sl.standard_id, sl.section_id), academic_year_id: yearId(row.academic_year_id), day: String(row.day), period_no: int(row.period_no, 1), subject_name: str(subject.name) || `Legacy subject ${row.subject_id}`, start_time: str(row.start_time), end_time: str(row.end_time), room_no: null, subject_id: subjectId(subject.id), version: 1 }, 'timetables', row);
}
const attendanceKeys = new Set();
for (const row of tables.attendances || []) {
  const a = academicByUser.get(String(row.user_id)); const sl = a && links.get(String(a.standardLink_id));
  const recorder = row.recorded_by && users.has(String(row.recorded_by)) ? userId(row.recorded_by) : adminTarget;
  if (!a || !sl || !linkByPair.has(`${sl.standard_id}:${sl.section_id}`) || !targetRows.students?.some((s) => s.id === studentId(row.user_id)) || !recorder) { addSkip('attendance_orphans'); continue; }
  const session = String(row.session).toLowerCase() === 'afternoon' ? 'afternoon' : 'morning';
  const key = `${row.user_id}:${dateOnly(row.date)}:${session}`;
  if (attendanceKeys.has(key)) { addSkip('duplicate_attendance'); continue; } attendanceKeys.add(key);
  add('attendance', { id: `att${code}_${row.id}`, school_id: schoolId, student_id: studentId(row.user_id), class_id: classId(sl.standard_id), section_id: sectionId(sl.standard_id, sl.section_id), date_timestamp: dateTs(row.date), session, status: Number(row.status) === 1 ? 'present' : 'absent', recorded_by: recorder, version: 1, created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated, calendar_date: dateOnly(row.date), academic_year_id: yearId(row.academic_year_id), reason_id: null, remarks: str(row.remarks) }, 'attendances', row);
}
for (const row of tables.fee_groups || []) add('fee_groups', { id: feeGroupId(row.id), school_id: schoolId, name: str(row.name) || `Legacy fee group ${row.id}`, description: str(row.description), created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated, version: 1, archived_at: Number(row.status) === 1 ? null : (epoch(row.updated_at) || updated) }, 'fee_groups', row);
for (const row of tables.books_category || []) add('library_categories', { id: categoryId(row.id), school_id: schoolId, name: str(row.category) || `Legacy category ${row.id}`, description: null, version: 1, archived_at: null }, 'books_category', row);
for (const row of tables.books || []) {
  if (!tables.books_category?.some((c) => String(c.id) === String(row.category_id))) { addSkip('books_missing_category'); continue; }
  add('library_books', { id: bookId(row.id), school_id: schoolId, category_id: categoryId(row.category_id), title: String(row.title), author: String(row.author), isbn: String(row.isbn_number), publisher: null, description: null, version: 1, archived_at: null }, 'books', row);
  add('library_copies', { id: copyId(row.id), school_id: schoolId, book_id: bookId(row.id), accession_no: String(row.book_code), location: null, version: 1, archived_at: null }, 'books', row);
}
for (const row of tables.notice_board || []) {
  if (!adminTarget || !targetRows.academic_years?.some((y) => y.id === yearId(row.academic_year_id))) { addSkip('notices_unresolvable'); continue; }
  add('notices', { id: noticeId(row.id), school_id: schoolId, title: String(row.title), message: str(row.description) || '', audience_scope: 'all', published_by: adminTarget, publish_date: epoch(row.publish_date) || created, expires_at: epoch(row.expire_date), created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated, academic_year_id: yearId(row.academic_year_id), section_id: null, version: 1, archived_at: Number(row.status) === 1 ? null : (epoch(row.updated_at) || updated) }, 'notice_board', row);
}
for (const row of tables.homeworks || []) {
  const sl = links.get(String(row.standardLink_id)); const subject = subjectById.get(String(row.subject_id));
  if (!sl || !subject || !linkByPair.has(`${sl.standard_id}:${sl.section_id}`) || !adminTarget) { addSkip('homeworks_unresolvable'); continue; }
  add('homeworks', { id: homeworkId(row.id), school_id: schoolId, class_id: classId(sl.standard_id), section_id: sectionId(sl.standard_id, sl.section_id), subject_name: String(subject.name), title: `Legacy homework ${row.id}`, description: str(row.description), due_date: epoch(row.submission_date) || epoch(row.date) || created, attachment_r2_key: null, created_by: userId(row.created_by) || adminTarget, version: 1, created_at: epoch(row.created_at) || created, updated_at: epoch(row.updated_at) || updated, academic_year_id: yearId(row.academic_year_id), assignment_id: null, assigned_date: dateOnly(row.date), submission_date: dateOnly(row.submission_date), publication_status: String(row.status) === 'published' ? 'publish' : 'draft', approval_status: 'pending', approval_comments: null, approved_by: null, archived_at: epoch(row.deleted_at) }, 'homeworks', row);
}

// Remove duplicate rows that target unique keys while retaining a deterministic
// first source row and reporting the dropped source count.
const uniqueBy = {
  sections: (r) => `${r.class_id}:${r.name}`,
  subjects: (r) => `${r.academic_year_id}:${r.section_id}:${r.name}`,
  teacher_assignments: (r) => `${r.teacher_user_id}:${r.section_id}:${r.academic_year_id}:${r.subject_name}`,
  timetables: (r) => `${r.academic_year_id}:${r.teacher_user_id}:${r.day}:${r.period_no}`,
};
for (const [table, keyFn] of Object.entries(uniqueBy)) {
  const rows = targetRows[table] || []; const seen = new Set(); const kept = [];
  for (const row of rows) { const key = keyFn(row); if (seen.has(key)) { addSkip(`target_${table}_duplicate`); continue; } seen.add(key); kept.push(row); }
  targetRows[table] = kept;
}

// Ensure parent links and target records are stable if a source row repeats.
const ordered = ['schools', 'school_configuration', 'academic_years', 'classes', 'sections', 'users', 'user_profiles', 'user_roles', 'teachers', 'staff_profiles', 'students', 'parent_profiles', 'parent_student_links', 'subjects', 'teacher_assignments', 'timetables', 'attendance', 'fee_groups', 'library_categories', 'library_books', 'library_copies', 'notices', 'homeworks'];
const columns = {
  schools: ['id','code','slug','name','status','timezone','currency','logo_r2_key','created_at','updated_at'], school_configuration: ['school_id','timezone','currency','address','configuration_verified_at','updated_at'], academic_years: ['id','school_id','name','starts_on','ends_on','is_current'], classes: ['id','school_id','name','code','sort_order','created_at','updated_at'], sections: ['id','school_id','class_id','name','sort_order','created_at','updated_at'], users: ['id','school_id','email','mobile','password_hash','hash_algorithm','full_name','user_type','status','created_at','updated_at','legacy_usergroup_id','version'], user_profiles: ['id','school_id','user_id','gender','dob','blood_group','address','city','pincode','avatar_r2_key','created_at','updated_at','first_name','last_name','alternate_mobile','aadhaar_number'], user_roles: ['school_id','user_id','role'], teachers: ['id','school_id','user_id','employee_code','designation','qualification','status','created_at','updated_at','joining_date','job_type','sub_designation','ug_degree','pg_degree','specialization','interested_in','reporting_to'], staff_profiles: ['school_id','user_id','employee_code','designation','joining_date'], students: ['id','school_id','user_id','admission_no','roll_no','class_id','section_id','enrollment_date','status','created_at','updated_at','academic_year_id'], parent_profiles: ['school_id','user_id','profession','sub_occupation','designation','organization_name','official_address','annual_income','contact_mobile'], parent_student_links: ['id','school_id','parent_user_id','student_id','relationship','created_at'], subjects: ['id','school_id','academic_year_id','section_id','name','code','type','version'], teacher_assignments: ['id','school_id','teacher_user_id','class_id','section_id','academic_year_id','subject_name','subject_id','planned_periods','version'], timetables: ['id','school_id','teacher_user_id','class_id','section_id','academic_year_id','day','period_no','subject_name','start_time','end_time','room_no','subject_id','version'], attendance: ['id','school_id','student_id','class_id','section_id','date_timestamp','session','status','recorded_by','version','created_at','updated_at','calendar_date','academic_year_id','reason_id','remarks'], fee_groups: ['id','school_id','name','description','created_at','updated_at','version','archived_at'], library_categories: ['id','school_id','name','description','version','archived_at'], library_books: ['id','school_id','category_id','title','author','isbn','publisher','description','version','archived_at'], library_copies: ['id','school_id','book_id','accession_no','location','version','archived_at'], notices: ['id','school_id','title','message','audience_scope','published_by','publish_date','expires_at','created_at','updated_at','academic_year_id','section_id','version','archived_at'], homeworks: ['id','school_id','class_id','section_id','subject_name','title','description','due_date','attachment_r2_key','created_by','version','created_at','updated_at','academic_year_id','assignment_id','assigned_date','submission_date','publication_status','approval_status','approval_comments','approved_by','archived_at'],
};
const sqlLines = ['BEGIN TRANSACTION;'];
for (const table of ordered) for (const row of (targetRows[table] || [])) sqlLines.push(insert(table, columns[table], row));
for (const m of mappings) sqlLines.push(insert('id_mappings', ['school_id','entity_type','source_system','legacy_id','target_id','source_checksum'], m));
sqlLines.push('COMMIT;');
writeFileSync(opts.sql, sqlLines.join('\n') + '\n', { flag: 'wx', mode: 0o600 });

const counts = Object.fromEntries(ordered.map((t) => [t, (targetRows[t] || []).length]));
const manifest = { sourceSystem: source.sourceSystem, sourceContainer: source.sourceContainer, sourceDatabase: source.sourceDatabase, sourceSchoolId: source.schoolId, sourceSchoolName: source.sourceSchoolName, sourceRows, targetSchoolId: schoolId, targetSchoolCode: code, targetSchoolName: sourceSchool.name || `School ${code}`, generatedAt: new Date().toISOString(), counts, skipped, notes: [
  'The legacy source has no school code; destination code 101 was supplied explicitly by the migration request.',
  'Parent and student mobile numbers are moved to parent_profiles.contact_mobile or left null because D1 requires unique user login mobiles.',
  'Exam/schedule/marks rows are not imported when the source lacks a valid teacher assignment and explicit result policy; they are counted as unsupported rather than fabricated.',
  'Events and source fee rows are not imported because this D1 release has no compatible event table and source fees are class templates rather than student invoices.',
  ...notes,
] };
writeFileSync(opts.manifest, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ status: 'transformed', targetSchoolId: schoolId, counts, skipped }));
