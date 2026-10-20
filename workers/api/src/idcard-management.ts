import type { Hono } from 'hono';
import { db, requireAuth, requireRole, type AppEnv } from './context.js';
import { fail } from './security.js';

export function registerIdCardManagement(app: Hono<AppEnv>) {
  // 1. ID Card Options (School info, classes with student counts)
  app.get('/api/admin/id-cards/options', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const s = c.get('school');
    const schoolId = u.school_id;

    const [configRes, classesRes, yearRes] = await db(c).batch([
      db(c).prepare(`
        SELECT address
        FROM school_configuration
        WHERE school_id = ?
      `).bind(schoolId),
      db(c).prepare(`
        SELECT cl.id, cl.name, COUNT(st.id) AS studentCount
        FROM classes cl
        LEFT JOIN students st ON st.class_id = cl.id AND st.school_id = cl.school_id AND st.status='active' AND EXISTS(SELECT 1 FROM academic_years y WHERE y.school_id=st.school_id AND y.id=st.academic_year_id AND y.is_current=1)
        WHERE cl.school_id = ?
        GROUP BY cl.id
        ORDER BY cl.name ASC
      `).bind(schoolId),
      db(c).prepare(`
        SELECT name
        FROM academic_years
        WHERE school_id = ? AND is_current = 1
        LIMIT 1
      `).bind(schoolId)
    ]);

    if (!configRes.success || !classesRes.success) fail(503, 'OPTIONS_READ_FAILED');

    const config = configRes.results[0] as { address?: string; board?: string; logo_url?: string } | undefined;
    const year = (yearRes.results[0] as { name?: string } | undefined)?.name || null;

    const classes = (classesRes.results || []).map((row: any) => ({
      value: row.id,
      label: row.name,
      studentCount: Number(row.studentCount || 0)
    }));

    return c.json({
      status: 'success',
      data: {
        school: {
          name: s.name,
          logo: null,
          address: config?.address || null,
          board: null,
          academicYear: year
        },
        classes
      }
    });
  });

  // 2. Student ID Cards Directory
  app.get('/api/admin/id-cards/students', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const schoolId = u.school_id;
    const standard = c.req.query('standard');
    const qParam = c.req.query('q');if(qParam&&qParam.length>160)fail(422,'SEARCH_TOO_LONG');

    const predicates = ['s.school_id = ?', "u.status = 'active' AND s.status='active' AND EXISTS(SELECT 1 FROM academic_years y WHERE y.school_id=s.school_id AND y.id=s.academic_year_id AND y.is_current=1)"];
    const values: unknown[] = [schoolId];

    if (standard) {
      predicates.push('s.class_id = ?');
      values.push(standard);
    }
    if (qParam) {
      predicates.push('(u.full_name LIKE ? ESCAPE \'\\\' OR s.admission_no LIKE ? ESCAPE \'\\\')');
      const q = '%' + qParam.replace(/[\\%_]/g, '\\$&') + '%';
      values.push(q, q);
    }

    const sql = `
      SELECT
        s.id,
        u.full_name AS fullName,
        s.admission_no AS registrationNumber,
        s.roll_no AS rollNumber,
        cl.name || ' - ' || sec.name AS className,
        p.dob AS dateOfBirth,
        p.blood_group AS bloodGroup,
        p.address,
        u.mobile AS contactNumber, NULL AS guardianContact
      FROM students s
      JOIN users u ON u.id = s.user_id AND u.school_id = s.school_id
      LEFT JOIN classes cl ON cl.id = s.class_id AND cl.school_id = s.school_id
      LEFT JOIN sections sec ON sec.id = s.section_id AND sec.school_id = s.school_id
      LEFT JOIN user_profiles p ON p.user_id = u.id AND p.school_id = u.school_id
      WHERE ${predicates.join(' AND ')}
      ORDER BY cl.name, s.roll_no, u.full_name
      LIMIT 500
    `;

    const res = await db(c).prepare(sql).bind(...values).all();
    if (!res.success) fail(503, 'STUDENTS_READ_FAILED');

    const students = (res.results || []).map((row: any) => {
      const missingFields: string[] = [];
      if (!row.rollNumber) missingFields.push('rollNumber');
      if (!row.registrationNumber) missingFields.push('registrationNumber');
      if (!row.bloodGroup) missingFields.push('bloodGroup');
      if (!row.dateOfBirth) missingFields.push('dateOfBirth');

      return {
        id: row.id,
        fullName: row.fullName,
        avatar: null,
        className: row.className || null,
        rollNumber: row.rollNumber || null,
        registrationNumber: row.registrationNumber || null,
        dateOfBirth: row.dateOfBirth || null,
        bloodGroup: row.bloodGroup || null,
        address: row.address || null,
        guardianContact: row.guardianContact || null, contactNumber: row.contactNumber || null,
        readyToPrint: missingFields.length === 0,
        missingFields
      };
    });

    return c.json({ status: 'success', data: students });
  });

  // 3. Teacher ID Cards Directory
  app.get('/api/admin/teacher-id-cards/students', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const schoolId = u.school_id;
    const qParam = c.req.query('q');if(qParam&&qParam.length>160)fail(422,'SEARCH_TOO_LONG');

    const predicates = ['t.school_id = ?', "u.status = 'active' AND t.status='active'"];
    const values: unknown[] = [schoolId];

    if (qParam) {
      predicates.push('(u.full_name LIKE ? ESCAPE \'\\\' OR t.employee_code LIKE ? ESCAPE \'\\\')');
      const q = '%' + qParam.replace(/[\\%_]/g, '\\$&') + '%';
      values.push(q, q);
    }

    const sql = `
      SELECT
        t.id,
        u.full_name AS fullName,
        t.employee_code AS registrationNumber,
        t.designation AS className,
        p.dob AS dateOfBirth,
        p.blood_group AS bloodGroup,
        p.address,
        u.mobile AS contactNumber, NULL AS guardianContact
      FROM teachers t
      JOIN users u ON u.id = t.user_id AND u.school_id = t.school_id
      LEFT JOIN user_profiles p ON p.user_id = u.id AND p.school_id = u.school_id
      WHERE ${predicates.join(' AND ')}
      ORDER BY u.full_name
      LIMIT 500
    `;

    const res = await db(c).prepare(sql).bind(...values).all();
    if (!res.success) fail(503, 'TEACHERS_READ_FAILED');

    const teachers = (res.results || []).map((row: any) => ({
      id: row.id,
      fullName: row.fullName,
      avatar: null,
      className: row.className || null,
      rollNumber: null,
      registrationNumber: row.registrationNumber || null,
      dateOfBirth: row.dateOfBirth || null,
      bloodGroup: row.bloodGroup || null,
      address: row.address || null,
      guardianContact: row.guardianContact || null, contactNumber: row.contactNumber || null,
      readyToPrint: !!row.registrationNumber && !!row.fullName,
      missingFields: [!row.registrationNumber?'registrationNumber':null,!row.fullName?'fullName':null].filter(Boolean)
    }));

    return c.json({ status: 'success', data: teachers });
  });

  // 4. Staff ID Cards Directory
  app.get('/api/admin/staff-id-cards/students', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const schoolId = u.school_id;

    const sql = `
      SELECT
        u.id,
        u.full_name AS fullName,
        sp.designation AS className,sp.employee_code AS registrationNumber,p.dob AS dateOfBirth,
        u.mobile AS contactNumber, NULL AS guardianContact,
        p.blood_group AS bloodGroup,
        p.address
      FROM users u
      JOIN staff_profiles sp ON sp.user_id=u.id AND sp.school_id=u.school_id
      LEFT JOIN user_profiles p ON p.user_id = u.id AND p.school_id = u.school_id
      WHERE u.school_id = ? AND u.status = 'active' AND u.user_type='staff'
      ORDER BY u.full_name
      LIMIT 200
    `;

    const res = await db(c).prepare(sql).bind(schoolId).all();
    if (!res.success) fail(503, 'STAFF_READ_FAILED');

    const staffList = (res.results || []).map((row: any) => ({
      id: row.id,
      fullName: row.fullName,
      avatar: null,
      className: row.className || null,
      rollNumber: null,
      registrationNumber: row.registrationNumber || null,
      dateOfBirth: row.dateOfBirth || null,
      bloodGroup: row.bloodGroup || null,
      address: row.address || null,
      guardianContact: row.guardianContact || null, contactNumber: row.contactNumber || null,
      readyToPrint: !!row.registrationNumber && !!row.fullName,
      missingFields: [!row.registrationNumber?'registrationNumber':null,!row.fullName?'fullName':null].filter(Boolean)
    }));

    return c.json({ status: 'success', data: staffList });
  });
}
