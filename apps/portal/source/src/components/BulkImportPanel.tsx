import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, List, Space, Tag, Typography, Upload } from 'antd';
import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import { read, utils, writeFile } from 'xlsx';
import { apiClient } from '../services/api';
import { en } from '../i18n/en';

type Row = Record<string, string>;
type SheetRows = Record<string, Row[]>;
type Problem = { sheet: string; row: number; message: string };

const SHEETS = ['classes', 'sections', 'teachers', 'students', 'parents'] as const;
const HEADERS: Record<(typeof SHEETS)[number], string[]> = {
  classes: ['name', 'code', 'sortOrder'],
  sections: ['classCode', 'className', 'name', 'sortOrder'],
  teachers: ['name', 'firstName', 'lastName', 'email', 'mobile', 'employeeId', 'designation', 'jobType', 'joiningDate'],
  students: ['name', 'firstName', 'lastName', 'email', 'mobile', 'registrationNumber', 'rollNumber', 'className', 'sectionName', 'enrollmentDate'],
  parents: ['firstName', 'lastName', 'email', 'mobile', 'linkedStudentAdmissions', 'relationship', 'profession', 'annualIncome'],
};

const aliases: Record<string, string> = {
  classname: 'className', class_code: 'classCode', classcode: 'classCode', sectionname: 'sectionName',
  admissionnumber: 'registrationNumber', admissionno: 'registrationNumber', rollno: 'rollNumber',
  linkedstudents: 'linkedStudentAdmissions', linkedstudentadmissions: 'linkedStudentAdmissions',
  employeeid: 'employeeId', jobtype: 'jobType', joiningdate: 'joiningDate', enrollmentdate: 'enrollmentDate',
  sortorder: 'sortOrder', annualincome: 'annualIncome',
};

const keyOf = (value: string) => {
  const compact = value.trim().replace(/\s+/g, '').replace(/-/g, '_');
  return aliases[compact.toLowerCase()] || compact;
};
const pick = (row: Row, ...keys: string[]) => keys.map((key) => row[key] || '').find(Boolean) || '';
const idempotency = () => ({ 'Idempotency-Key': crypto.randomUUID() });

function normalizeRows(rows: unknown[]): Row[] {
  return rows.map((value) => Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, cell]) => [keyOf(key), String(cell ?? '').trim()])));
}

function workbookRows(file: ArrayBuffer): SheetRows {
  const workbook = read(file, { type: 'array', cellDates: false });
  return Object.fromEntries(SHEETS.map((name) => {
    const actual = workbook.SheetNames.find((sheet) => sheet.trim().toLowerCase() === name);
    return [name, actual ? normalizeRows(utils.sheet_to_json(workbook.Sheets[actual], { defval: '', raw: false })) : []];
  })) as SheetRows;
}

function validate(rows: SheetRows): Problem[] {
  const problems: Problem[] = [];
  const required: Record<string, string[]> = {
    classes: ['name'], sections: ['name'], teachers: ['name', 'email', 'mobile', 'employeeId', 'designation', 'joiningDate'],
    students: ['name', 'registrationNumber', 'rollNumber', 'className', 'sectionName', 'enrollmentDate'],
    parents: ['firstName', 'mobile', 'linkedStudentAdmissions', 'relationship'],
  };
  for (const sheet of SHEETS) rows[sheet].forEach((row, index) => {
    const rowNumber = index + 2;
    for (const field of required[sheet]) if (!row[field]) problems.push({ sheet, row: rowNumber, message: `${field} is required` });
    if (sheet === 'sections' && !pick(row, 'classCode', 'className')) problems.push({ sheet, row: rowNumber, message: 'classCode or className is required' });
    if (sheet === 'teachers' && row.jobType && !['full_time', 'part_time'].includes(row.jobType)) problems.push({ sheet, row: rowNumber, message: 'jobType must be full_time or part_time' });
    if (sheet === 'parents' && !['father', 'mother', 'guardian'].includes(row.relationship)) problems.push({ sheet, row: rowNumber, message: 'relationship must be father, mother or guardian' });
    if (sheet === 'parents' && row.profession && !['business', 'central_government_employee', 'private', 'home_maker', 'state_government_employee', 'others'].includes(row.profession)) problems.push({ sheet, row: rowNumber, message: 'profession must use the documented value' });
    if (sheet === 'parents' && row.annualIncome && !/^\d+$/.test(row.annualIncome)) problems.push({ sheet, row: rowNumber, message: 'annualIncome must be an integer' });
  });
  return problems;
}

function downloadTemplate() {
  const workbook = utils.book_new();
  for (const sheet of SHEETS) utils.book_append_sheet(workbook, utils.aoa_to_sheet([HEADERS[sheet]]), sheet);
  writeFile(workbook, 'gurukull-school-import-template.xlsx');
}

export const BulkImportPanel: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const [rows, setRows] = useState<SheetRows>({ classes: [], sections: [], teachers: [], students: [], parents: [] });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>();
  const [saveErrors, setSaveErrors] = useState<Problem[]>([]);
  const totalRows = useMemo(() => SHEETS.reduce((sum, sheet) => sum + rows[sheet].length, 0), [rows]);

  const chooseFile = async (file: File) => {
    setResult(undefined); setSaveErrors([]); setFileName(file.name);
    try {
      const parsed = workbookRows(await file.arrayBuffer()); setRows(parsed); setProblems(validate(parsed));
    } catch { setRows({ classes: [], sections: [], teachers: [], students: [], parents: [] }); setProblems([{ sheet: 'workbook', row: 1, message: 'The workbook could not be read. Use the downloaded .xlsx template.' }]); }
    return false;
  };

  const importRows = async () => {
    if (problems.length || !totalRows) return;
    setSaving(true); setSaveErrors([]); setResult(undefined);
    const errors: Problem[] = [];
    const save = async (sheet: string, row: number, action: () => Promise<unknown>) => { try { await action(); } catch (error: any) { errors.push({ sheet, row, message: error.response?.data?.message || 'The record was rejected by the server.' }); } };
    try {
      let setup = (await apiClient.get('/api/admin/setup')).data.data;
      const classId = new Map<string, string>();
      for (const item of setup.classes || []) { classId.set(`name:${item.name.toLowerCase()}`, item.id); if (item.code) classId.set(`code:${item.code.toLowerCase()}`, item.id); }
      for (const [index, row] of rows.classes.entries()) await save('classes', index + 2, async () => {
        const existing = classId.get(`code:${row.code?.toLowerCase()}`) || classId.get(`name:${row.name.toLowerCase()}`);
        if (existing) { classId.set(`name:${row.name.toLowerCase()}`, existing); if (row.code) classId.set(`code:${row.code.toLowerCase()}`, existing); return; }
        const response = await apiClient.post('/api/admin/classes', { name: row.name, code: row.code || null, sortOrder: Number(row.sortOrder || 0) }, { headers: idempotency() });
        const id = response.data.data.id; classId.set(`name:${row.name.toLowerCase()}`, id); if (row.code) classId.set(`code:${row.code.toLowerCase()}`, id);
      });
      setup = (await apiClient.get('/api/admin/setup')).data.data;
      const sectionId = new Map<string, string>();
      for (const item of setup.sections || []) sectionId.set(`${item.className.toLowerCase()}::${item.name.toLowerCase()}`, item.id);
      for (const [index, row] of rows.sections.entries()) await save('sections', index + 2, async () => {
        const classKey = pick(row, 'classCode', 'className'); const classValue = classId.get(`${row.classCode ? 'code' : 'name'}:${classKey.toLowerCase()}`);
        if (!classValue) throw new Error('Class could not be matched');
        const key = `${row.className?.toLowerCase() || classKey.toLowerCase()}::${row.name.toLowerCase()}`;
        if (sectionId.has(key)) return;
        const response = await apiClient.post('/api/admin/sections', { classId: classValue, name: row.name, sortOrder: Number(row.sortOrder || 0) }, { headers: idempotency() });
        sectionId.set(key, response.data.data.id);
      });
      setup = (await apiClient.get('/api/admin/setup')).data.data;
      for (const [index, row] of rows.teachers.entries()) await save('teachers', index + 2, () => apiClient.post('/api/admin/teachers', { name: row.name, firstName: row.firstName || null, lastName: row.lastName || null, email: row.email, mobile: row.mobile, employeeId: row.employeeId, designation: row.designation, jobType: row.jobType || 'full_time', joiningDate: row.joiningDate, alternateMobile: null, gender: null, dateOfBirth: null, bloodGroup: null, aadhaarNumber: null, address: null, city: null, pincode: null, subDesignation: null, ugDegree: null, pgDegree: null, specialization: null, interestedIn: null, reportingTo: null }, { headers: idempotency() }));
      const currentSections = new Map<string, string>((setup.sections || []).map((item: any) => [`${item.className.toLowerCase()}::${item.name.toLowerCase()}`, item.id]));
      for (const [index, row] of rows.students.entries()) await save('students', index + 2, () => {
        const section = currentSections.get(`${row.className.toLowerCase()}::${row.sectionName.toLowerCase()}`); if (!section) throw new Error('Class and section could not be matched');
        return apiClient.post('/api/admin/students', { name: row.name, firstName: row.firstName || null, lastName: row.lastName || null, email: row.email || null, mobile: row.mobile || null, registrationNumber: row.registrationNumber, rollNumber: row.rollNumber, sectionId: section, enrollmentDate: row.enrollmentDate, alternateMobile: null, gender: null, dateOfBirth: null, bloodGroup: null, aadhaarNumber: null, address: null, city: null, pincode: null }, { headers: idempotency() });
      });
      for (const [index, row] of rows.parents.entries()) await save('parents', index + 2, async () => {
        const admissions = row.linkedStudentAdmissions.split(/[;,]/).map((value) => value.trim()).filter(Boolean); const ids: string[] = [];
        for (const admission of admissions) { const response = await apiClient.get('/api/admin/parents/form-options', { params: { q: admission } }); const match = (response.data.data.students || []).find((item: any) => item.label.includes(`(${admission},`)); if (!match) throw new Error(`Student admission ${admission} could not be matched`); ids.push(match.value); }
        return apiClient.post('/api/admin/parents', { firstName: row.firstName, lastName: row.lastName || null, email: row.email || null, mobile: row.mobile, alternateMobile: null, studentIds: ids, relationship: row.relationship, profession: row.profession || null, annualIncome: row.annualIncome ? Number(row.annualIncome) : null, subOccupation: null, designation: null, organizationName: null, officialAddress: null }, { headers: idempotency() });
      });
    } finally { setSaving(false); }
    setSaveErrors(errors); setResult(errors.length ? 'Import finished with row errors.' : en.import.complete); if (!errors.length) onImported?.();
  };

  return <Card title={<Space><FileExcelOutlined />{en.import.title}</Space>} extra={<Button icon={<DownloadOutlined />} onClick={downloadTemplate}>{en.common.downloadTemplate}</Button>}>
    <Typography.Paragraph>{en.import.description} {en.import.sheets}</Typography.Paragraph>
    <Upload beforeUpload={chooseFile} showUploadList={false} accept=".xlsx,.xls,.csv"><Button icon={<UploadOutlined />}>{en.common.importWorkbook}</Button></Upload>
    {fileName && <Typography.Text type="secondary" style={{ marginLeft: 12 }}>{fileName} · {totalRows} row(s)</Typography.Text>}
    {!totalRows && <Alert style={{ marginTop: 16 }} type="info" message={en.import.noData} />}
    {!!problems.length && <Alert style={{ marginTop: 16 }} type="error" message={en.import.validationFailed} description={<List size="small" dataSource={problems.slice(0, 8)} renderItem={(problem) => <List.Item><Tag color="red">{problem.sheet} row {problem.row}</Tag>{problem.message}</List.Item>} />} />}
    {result && <Alert style={{ marginTop: 16 }} type={saveErrors.length ? 'warning' : 'success'} message={result} description={saveErrors.length ? <List size="small" dataSource={saveErrors.slice(0, 8)} renderItem={(problem) => <List.Item><Tag color="orange">{problem.sheet} row {problem.row}</Tag>{problem.message}</List.Item>} /> : undefined} />}
    <Button style={{ marginTop: 16 }} type="primary" disabled={!totalRows || !!problems.length} loading={saving} onClick={importRows}>Validate and import</Button>
  </Card>;
};
