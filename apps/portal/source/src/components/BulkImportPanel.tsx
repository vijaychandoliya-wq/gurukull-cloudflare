import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, List, Space, Tag, Typography, Upload,Steps,Table,Progress,Checkbox,Select,Flex } from 'antd';
import { DownloadOutlined, FileExcelOutlined, UploadOutlined } from '@ant-design/icons';
import { read, utils, writeFile } from 'xlsx';
import { apiClient } from '../services/api';
import {useAuth} from '../context/AuthContext';
import {humanize} from '../ux/format';
import {validateImport,importIdentity} from '../ux/importModel';
import {useDirtyForm} from './portal/UX';
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

const validate=validateImport;

function downloadTemplate() {
  const workbook = utils.book_new();
  for (const sheet of SHEETS) utils.book_append_sheet(workbook, utils.aoa_to_sheet([HEADERS[sheet]]), sheet);
  writeFile(workbook, 'gurukull-school-import-template.xlsx');
}

export const BulkImportPanel: React.FC<{ onImported?: () => void }> = ({ onImported }) => {
  const {schoolCode,academicYear}=useAuth();
  const [stage,setStage]=useState(0),[sourceRows,setSourceRows]=useState<SheetRows>({}),[mapping,setMapping]=useState<Record<string,string>>({}),[outcomes,setOutcomes]=useState<{sheet:string;row:number;status:string;message:string}[]>([]),[done,setDone]=useState(0),[validOnly,setValidOnly]=useState(false);
  const [rows, setRows] = useState<SheetRows>({ classes: [], sections: [], teachers: [], students: [], parents: [] });
  const [problems, setProblems] = useState<Problem[]>([]);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string>();
  const [saveErrors, setSaveErrors] = useState<Problem[]>([]);
  const totalRows = useMemo(() => SHEETS.reduce((sum, sheet) => sum + rows[sheet].length, 0), [rows]);

  useDirtyForm(saving);
  const chooseFile = async (file: File) => {
    setResult(undefined); setSaveErrors([]);setOutcomes([]);setDone(0);setStage(1);setValidOnly(false); setFileName(file.name);
    try {
      const parsed = workbookRows(await file.arrayBuffer()); setRows(parsed);setSourceRows(parsed);setMapping({}); setProblems(validate(parsed));
    } catch { setRows({ classes: [], sections: [], teachers: [], students: [], parents: [] }); setProblems([{ sheet: 'workbook', row: 1, message: 'The workbook could not be read. Use the downloaded .xlsx template.' }]); }
    return false;
  };

  const importRows = async () => {
    if ((problems.length&&!validOnly)||!totalRows||saving) return;
    setSaving(true);setStage(4);setDone(0);setOutcomes([]); setSaveErrors([]); setResult(undefined);
    const errors: Problem[] = [];
    let importScope=`${schoolCode}:${academicYear}`;
    const results:{sheet:string;row:number;status:string;message:string}[]=[];
    const add=(item:typeof results[number])=>{results.push(item);setOutcomes([...results]);setDone(results.length);};
    const rowHeaders=async(sheet:string,row:Row)=>{const buffer=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(importIdentity(importScope,sheet,row)));return {'Idempotency-Key':'import-'+Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('')};};
    const save = async (sheet:string,row:number,action:()=>Promise<unknown>)=>{
      const invalid=problems.filter(p=>p.sheet===sheet&&p.row===row);
      if(invalid.length){add({sheet,row,status:'Skipped',message:invalid.map(p=>p.message).join(' ')});return;}
      try{const response:any=await action();add({sheet,row,status:response==='existing'?'Existing':'Saved',message:response==='existing'?'Existing record retained.':'Record saved or previous command safely replayed.'});}
      catch(error:any){const message=error.response?.data?.message||error.message||'Could not confirm this row. Retry failed rows with the same command.';errors.push({sheet,row,message});add({sheet,row,status:'Failed',message});}
    };
    try {
      let setup = (await apiClient.get('/api/admin/setup')).data.data;
      const currentYear=setup.academicYears?.find((year:any)=>year.isCurrent);if(!currentYear)throw new Error('Configure a current academic year before importing.');importScope=`${schoolCode}:${currentYear.id}`;
      const classId = new Map<string, string>();
      for (const item of setup.classes || []) { classId.set(`name:${item.name.toLowerCase()}`, item.id); if (item.code) classId.set(`code:${item.code.toLowerCase()}`, item.id); }
      for (const [index, row] of rows.classes.entries()) await save('classes', index + 2, async () => {
        const existing = classId.get(`code:${row.code?.toLowerCase()}`) || classId.get(`name:${row.name.toLowerCase()}`);
        if (existing) { classId.set(`name:${row.name.toLowerCase()}`, existing); if (row.code) classId.set(`code:${row.code.toLowerCase()}`, existing); return 'existing'; }
        const response = await apiClient.post('/api/admin/classes', { name: row.name, code: row.code || null, sortOrder: Number(row.sortOrder || 0) }, { headers: await rowHeaders('classes',row) });
        const id = response.data.data.id; classId.set(`name:${row.name.toLowerCase()}`, id); if (row.code) classId.set(`code:${row.code.toLowerCase()}`, id);
      });
      setup = (await apiClient.get('/api/admin/setup')).data.data;
      const sectionId = new Map<string, string>();
      for (const item of setup.sections || []) sectionId.set(`${item.className.toLowerCase()}::${item.name.toLowerCase()}`, item.id);
      for (const [index, row] of rows.sections.entries()) await save('sections', index + 2, async () => {
        const classKey = pick(row, 'classCode', 'className'); const classValue = classId.get(`${row.classCode ? 'code' : 'name'}:${classKey.toLowerCase()}`);
        if (!classValue) throw new Error('Class could not be matched');
        const key = `${row.className?.toLowerCase() || classKey.toLowerCase()}::${row.name.toLowerCase()}`;
        if (sectionId.has(key)) return 'existing';
        const response = await apiClient.post('/api/admin/sections', { classId: classValue, name: row.name, sortOrder: Number(row.sortOrder || 0) }, { headers: await rowHeaders('sections',row) });
        sectionId.set(key, response.data.data.id);
      });
      setup = (await apiClient.get('/api/admin/setup')).data.data;
      for (const [index, row] of rows.teachers.entries()) await save('teachers', index + 2, async () => apiClient.post('/api/admin/teachers', { name: row.name, firstName: row.firstName || null, lastName: row.lastName || null, email: row.email, mobile: row.mobile, employeeId: row.employeeId || null, designation: row.designation, jobType: row.jobType, joiningDate: row.joiningDate, alternateMobile: null, gender: null, dateOfBirth: null, bloodGroup: null, aadhaarNumber: null, address: null, city: null, pincode: null, subDesignation: null, ugDegree: null, pgDegree: null, specialization: null, interestedIn: null, reportingTo: null }, { headers: await rowHeaders('teachers',row) }));
      const currentSections = new Map<string, string>((setup.sections || []).map((item: any) => [`${item.className.toLowerCase()}::${item.name.toLowerCase()}`, item.id]));
      for (const [index, row] of rows.students.entries()) await save('students', index + 2, async () => {
        const section = currentSections.get(`${row.className.toLowerCase()}::${row.sectionName.toLowerCase()}`); if (!section) throw new Error('Class and section could not be matched');
        return apiClient.post('/api/admin/students', { name: row.name, firstName: row.firstName || null, lastName: row.lastName || null, email: row.email || null, mobile: row.mobile || null, registrationNumber: row.registrationNumber, rollNumber: row.rollNumber, sectionId: section, enrollmentDate: row.enrollmentDate, alternateMobile: null, gender: null, dateOfBirth: null, bloodGroup: null, aadhaarNumber: null, address: null, city: null, pincode: null }, { headers: await rowHeaders('students',row) });
      });
      for (const [index, row] of rows.parents.entries()) await save('parents', index + 2, async () => {
        const admissions = row.linkedStudentAdmissions.split(/[;,]/).map((value) => value.trim()).filter(Boolean); const ids: string[] = [];
        for (const admission of admissions) { const response = await apiClient.get('/api/admin/parents/form-options', { params: { q: admission } }); const match = (response.data.data.students || []).find((item: any) => item.label.includes(`(${admission},`)); if (!match) throw new Error(`Student admission ${admission} could not be matched`); ids.push(match.value); }
        return apiClient.post('/api/admin/parents', { firstName: row.firstName, lastName: row.lastName || null, email: row.email || null, mobile: row.mobile, alternateMobile: null, studentIds: ids, relationship: row.relationship, profession: row.profession || null, annualIncome: row.annualIncome ? Number(row.annualIncome) : null, subOccupation: null, designation: null, organizationName: null, officialAddress: null }, { headers: await rowHeaders('parents',row) });
      });
    } catch(e:any){errors.push({sheet:'workbook',row:0,message:e.response?.data?.message||e.message||'Import interrupted. Completed rows are listed below.'});} finally { setSaving(false);setStage(5); }
    setSaveErrors(errors); setResult(errors.length ? 'Import finished with row errors.' : en.import.complete); onImported?.();
  };

  const applyMapping=(next:Record<string,string>)=>{setMapping(next);const mapped=Object.fromEntries(SHEETS.map(sheet=>[sheet,(sourceRows[sheet]||[]).map(row=>Object.fromEntries(HEADERS[sheet].map(field=>[field,row[next[`${sheet}:${field}`]||field]||''])))]));setRows(mapped);setProblems(validate(mapped));};
  const downloadReport=()=>{const workbook=utils.book_new();utils.book_append_sheet(workbook,utils.json_to_sheet(outcomes.length?outcomes:problems),'Import results');writeFile(workbook,'gurukull-import-results.xlsx');};
  const errorRows=new Set(problems.map(p=>`${p.sheet}:${p.row}`)),validRows=totalRows-errorRows.size;
  return <Card title={<Space><FileExcelOutlined/>{en.import.title}</Space>} extra={<Button icon={<DownloadOutlined/>} onClick={downloadTemplate}>Download template</Button>}>
   <Steps size="small" current={stage} items={['Upload','Columns','Validate','Review','Import','Results'].map(title=>({title}))}/>
   <Typography.Paragraph style={{marginTop:20}}>{schoolCode&&<>School <strong>{schoolCode}</strong> · {academicYear||'No current academic year'} · </>}Import records from the template sheets: classes, sections, teachers, students and parents. Existing classes/sections are retained. Person updates require a separate review; no records are overwritten by this import.</Typography.Paragraph>
   {stage<=1&&<><Upload disabled={saving} beforeUpload={chooseFile} showUploadList={false} accept=".xlsx,.xls"><Button icon={<UploadOutlined/>}>Choose workbook</Button></Upload>{fileName&&<Typography.Paragraph>{fileName} · {totalRows} rows</Typography.Paragraph>}{!totalRows&&<Alert type="info" message="Use the downloaded template with at least one supported sheet containing data."/>}
    {SHEETS.filter(sheet=>sourceRows[sheet]?.length).map(sheet=><Card key={sheet} size="small" title={humanize(sheet)} style={{marginTop:16}}><Table rowKey="field" size="small" pagination={false} columns={[{title:'Portal field',dataIndex:'field',render:humanize},{title:'Workbook column',render:(_:unknown,r:any)=><Select style={{width:'100%'}} allowClear value={mapping[`${sheet}:${r.field}`]||r.field} options={Object.keys(sourceRows[sheet][0]||{}).map(v=>({value:v,label:v}))} onChange={value=>applyMapping({...mapping,[`${sheet}:${r.field}`]:value||''})}/> }]} dataSource={HEADERS[sheet].map(field=>({field}))}/></Card>)}</>}
   {stage===2&&<><Alert type={problems.length?'warning':'success'} message={`${validRows} valid rows · ${errorRows.size} rows need correction`} style={{marginTop:16}}/>{!!problems.length&&<><Table rowKey={r=>`${r.sheet}-${r.row}-${r.message}`} dataSource={problems} pagination={{pageSize:10}} columns={[{title:'Sheet',dataIndex:'sheet'},{title:'Row',dataIndex:'row'},{title:'How to fix',dataIndex:'message'}]}/><Checkbox checked={validOnly} onChange={e=>setValidOnly(e.target.checked)}>Skip invalid rows and import only the {validRows} valid rows</Checkbox></>}<Table rowKey="key" scroll={{x:true}} dataSource={SHEETS.flatMap(sheet=>rows[sheet].map((row,i)=>({key:`${sheet}:${i}`,sheet,row:i+2,...row})))} pagination={{pageSize:10}} columns={[{title:'Sheet',dataIndex:'sheet'},{title:'Row',dataIndex:'row'},{title:'Name',render:(_:unknown,r:any)=>r.name||[r.firstName,r.lastName].filter(Boolean).join(' ')},{title:'Email',dataIndex:'email'},{title:'Mobile',dataIndex:'mobile'},{title:'Admission / employee ID',render:(_:unknown,r:any)=>r.employeeId||r.registrationNumber||'Generate if supported'}]}/></>}
   {stage===3&&<Alert style={{marginTop:16}} type="warning" showIcon message={`Ready to process ${totalRows} rows for school ${schoolCode}?`} description={`${validOnly?errorRows.size:0} invalid rows will be skipped. Valid rows are submitted individually. Teacher/student creation can queue account emails when configured. Successful rows remain saved if a later row fails. Review the results before retrying.`}/>}
   {stage===4&&<Progress percent={totalRows?Math.round(done*100/totalRows):0} format={()=>`${done} / ${totalRows} rows`}/>}
   {stage===5&&<><Alert showIcon type={saveErrors.length?'warning':'success'} message={saveErrors.length?'Import completed with errors':'Import processing complete'} description={<Space wrap>{['Saved','Existing','Skipped','Failed'].map(status=><Tag key={status}>{status}: {outcomes.filter(o=>o.status===status).length}</Tag>)}</Space>} style={{marginTop:16}}/><Button style={{marginTop:12}} onClick={downloadReport}>Download full results</Button><Table rowKey={r=>`${r.sheet}-${r.row}`} pagination={{pageSize:10}} dataSource={outcomes} columns={[{title:'Sheet',dataIndex:'sheet'},{title:'Row',dataIndex:'row'},{title:'Result',dataIndex:'status'},{title:'Details',dataIndex:'message'}]}/>{saveErrors.filter(e=>e.sheet==='workbook').map(e=><Alert key={e.message} type="error" message={e.message}/>)}</>}
   <Flex wrap gap={12} style={{marginTop:20}}>{stage>1&&stage<4&&<Button onClick={()=>setStage(stage-1)}>Back</Button>}{stage<=1&&<Button type="primary" disabled={!totalRows} onClick={()=>setStage(2)}>Validate and preview</Button>}{stage===2&&<Button type="primary" disabled={!validRows||!!problems.length&&!validOnly} onClick={()=>setStage(3)}>Review import</Button>}{stage===3&&<Button type="primary" loading={saving} onClick={importRows}>Confirm import</Button>}{stage===5&&<Button onClick={()=>setStage(1)}>Review workbook again</Button>}</Flex>
  </Card>;
};
