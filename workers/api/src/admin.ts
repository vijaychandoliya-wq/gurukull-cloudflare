import type { Hono } from 'hono';
import { db,requireAuth,requireRole,type AppEnv,type ApiContext } from './context.js';
import { fail } from './security.js';
import { adminFeatures } from '@gurukul/contracts';

// Read adapters for the actual portal directory envelopes. No example rows or guessed policies.
export function directoryInput(query:Record<string,string>) {
 const integer=(value:string|undefined,fallback:number,max:number)=>{
  if(value===undefined)return fallback;
  if(!/^[1-9][0-9]*$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>max)fail(422,'INVALID_PAGINATION');
  return Number(value);
 };
 const page=integer(query.page,1,100000),perPage=integer(query.per_page,20,100);
 if((page-1)*perPage>10000)fail(422,'DIRECTORY_PAGE_LIMIT');
 const status=query.status||'active';if(!['active','inactive','all'].includes(status))fail(422,'INVALID_STATUS_FILTER');
 const gender=query.gender;if(gender&&!['male','female','other'].includes(gender))fail(422,'INVALID_GENDER_FILTER');
 const q=(query.q||'').trim();if(q.length>160)fail(422,'SEARCH_TOO_LONG');
 const bloodGroup=query.blood_group;if(bloodGroup&&bloodGroup.length>8)fail(422,'INVALID_BLOOD_GROUP_FILTER');
 const jobType=query.job_type;if(jobType&&!['full_time','part_time'].includes(jobType))fail(422,'INVALID_JOB_TYPE_FILTER');
 return {page,perPage,offset:(page-1)*perPage,status,gender,q,bloodGroup,jobType};
}
export function directoryQuery(schoolId:string,kind:'students'|'teachers',input:ReturnType<typeof directoryInput>) {
 const predicates=['u.school_id=?','e.school_id=?','u.user_type=?'],values:unknown[]=[schoolId,schoolId,kind==='students'?'student':'teacher'];
 if(input.status!=='all'){predicates.push(input.status==='active'?"u.status='active' AND e.status='active'":"(u.status!='active' OR e.status!='active')");}
 if(input.jobType&&kind==='teachers'){predicates.push('e.job_type=?');values.push(input.jobType);}
 if(input.gender){predicates.push('p.gender=?');values.push(input.gender);}
 if(input.bloodGroup){predicates.push('p.blood_group=?');values.push(input.bloodGroup);}
 if(input.q){predicates.push(`(u.full_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR u.mobile LIKE ? ESCAPE '\\' OR e.${kind==='students'?'admission_no':'employee_code'} LIKE ? ESCAPE '\\')`);const q='%'+input.q.replace(/[\\%_]/g,'\\$&')+'%';values.push(q,q,q,q);}
 const join=`FROM ${kind} e JOIN users u ON u.id=e.user_id AND u.school_id=e.school_id LEFT JOIN user_profiles p ON p.user_id=u.id AND p.school_id=u.school_id`;
 const fields=kind==='students'?`e.admission_no AS registrationNumber,e.roll_no AS rollNo,e.section_id AS standardLinkId,cl.name||' - '||se.name AS className`:`e.employee_code AS employeeId,e.designation,e.job_type AS jobType,e.qualification`;
 const classes=kind==='students'?' LEFT JOIN classes cl ON cl.id=e.class_id AND cl.school_id=e.school_id LEFT JOIN sections se ON se.id=e.section_id AND se.class_id=e.class_id AND se.school_id=e.school_id':'';
 const from=join+classes+' WHERE '+predicates.join(' AND ');
 return {countSql:'SELECT COUNT(*) AS total '+from,listSql:`SELECT u.id,u.id AS name,u.full_name AS fullName,u.email,u.mobile,p.gender,p.avatar_r2_key AS avatarKey,u.status,p.city,${fields} ${from} ORDER BY u.full_name,u.id LIMIT ? OFFSET ?`,values};
}
async function directory(c:ApiContext,kind:'students'|'teachers') {
 const u=requireRole(c,'admin','superadmin'),input=directoryInput(c.req.query()),query=directoryQuery(u.school_id,kind,input);
 const results=await db(c).batch<Record<string,unknown>>([
  db(c).prepare(query.countSql).bind(...query.values),
  db(c).prepare(query.listSql).bind(...query.values,input.perPage,input.offset)
 ]);
 if(results.some(r=>!r.success))fail(503,'DIRECTORY_READ_FAILED');
 const total=Number((results[0].results[0] as {total:number}|undefined)?.total);if(!Number.isSafeInteger(total)||total<0)fail(503,'DIRECTORY_READ_FAILED');
 const rows=results[1].results;
 const label=(value:unknown)=>typeof value==='string'&&value?value.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '):null;
 return c.json({data:rows.map(row=>kind==='teachers'?({...row,designationLabel:label(row.designation),jobTypeLabel:label(row.jobType),avatar:row.avatarKey?`/api/admin/teachers/${row.id}/avatar`:null}):({...row,avatar:row.avatarKey?`/api/admin/students/${row.id}/avatar`:null})),meta:{currentPage:input.page,lastPage:Math.max(1,Math.ceil(total/input.perPage)),perPage:input.perPage,total,from:rows.length?input.offset+1:null,to:rows.length?input.offset+rows.length:null}});
}
export function registerAdmin(app:Hono<AppEnv>) {
 app.get('/api/admin/features',requireAuth,c=>{requireRole(c,'admin','superadmin');return c.json({data:adminFeatures,release:c.env?.APP_RELEASE||'unversioned',notice:'Implementation status is not proof of genuine feature acceptance.'});});
 app.get('/api/admin/dashboard',requireAuth,async c=>{
  const u=requireRole(c,'admin','superadmin'),s=c.get('school');
  const [counts,currentYear,configuration]=await Promise.all([
   db(c).batch<{total:number}>(['students','teachers','classes','sections','academic_years'].map(table=>db(c).prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE school_id=?`).bind(u.school_id))),
   db(c).prepare('SELECT id,name,starts_on AS startsOn,ends_on AS endsOn FROM academic_years WHERE school_id=? AND is_current=1').bind(u.school_id).first<{id:string;name:string;startsOn:string;endsOn:string}>(),
   db(c).prepare('SELECT timezone,currency,address,configuration_verified_at FROM school_configuration WHERE school_id=?').bind(u.school_id).first(),
  ]);
  if(counts.some(r=>!r.success))fail(503,'DASHBOARD_READ_FAILED');
  const values=counts.map(r=>r.results[0]?.total);
  if(values.some(v=>!Number.isSafeInteger(v)||Number(v)<0))fail(503,'DASHBOARD_READ_FAILED');

  // Every dashboard number is an aggregate over the authenticated tenant and
  // current academic year. Empty schools return zeroes, never invented rows.
  const operations=currentYear?await db(c).batch<any>([
   db(c).prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='present' THEN 1 ELSE 0 END),0) AS present,COALESCE(SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END),0) AS absent,COALESCE(SUM(CASE WHEN status='late' THEN 1 ELSE 0 END),0) AS late,COUNT(DISTINCT calendar_date) AS sessions,MAX(calendar_date) AS lastDate FROM attendance WHERE school_id=? AND academic_year_id=?`).bind(u.school_id,currentYear.id),
   db(c).prepare(`SELECT COUNT(*) AS invoices,COALESCE(SUM(CASE WHEN status!='cancelled' THEN amount_paise ELSE 0 END),0) AS billedMinor,COALESCE(SUM(CASE WHEN status!='cancelled' THEN paid_minor ELSE 0 END),0) AS paidMinor,COALESCE(SUM(CASE WHEN status!='cancelled' THEN concession_minor ELSE 0 END),0) AS concessionMinor,COALESCE(SUM(CASE WHEN status!='cancelled' AND due_on<date('now') AND paid_minor+concession_minor<amount_paise THEN 1 ELSE 0 END),0) AS overdueInvoices FROM fee_invoice_balances WHERE school_id=? AND academic_year_id=?`).bind(u.school_id,currentYear.id),
   db(c).prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN publication_status='publish' THEN 1 ELSE 0 END),0) AS published,MAX(updated_at) AS lastUpdated FROM homeworks WHERE school_id=? AND academic_year_id=?`).bind(u.school_id,currentYear.id),
   db(c).prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN results_published_at IS NOT NULL THEN 1 ELSE 0 END),0) AS published FROM exams WHERE school_id=? AND academic_year_id=?`).bind(u.school_id,currentYear.id),
   db(c).prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END),0) AS pending FROM staff_leaves WHERE school_id=? AND academic_year_id=?`).bind(u.school_id,currentYear.id),
  ]):[];
  if(operations.some(r=>!r.success))fail(503,'DASHBOARD_METRICS_READ_FAILED');
  const attendance=operations[0]?.results[0]||{total:0,present:0,absent:0,late:0,sessions:0,lastDate:null};
  const finance=operations[1]?.results[0]||{invoices:0,billedMinor:0,paidMinor:0,concessionMinor:0,overdueInvoices:0};
  const homework=operations[2]?.results[0]||{total:0,published:0,lastUpdated:null};
  const exams=operations[3]?.results[0]||{total:0,published:0};
  const leaves=operations[4]?.results[0]||{total:0,pending:0};
  const attendanceTotal=Number(attendance.total)||0;
  const paidMinor=Number(finance.paidMinor)||0;
  const concessionMinor=Number(finance.concessionMinor)||0;
  const billedMinor=Number(finance.billedMinor)||0;
  return c.json({data:{
   school:{name:s.name,code:s.code,status:s.status},
   counts:Object.fromEntries(['students','teachers','classes','sections','academicYears'].map((k,i)=>[k,values[i]])),
   configuration,currentYear,
   attendance:{total:attendanceTotal,present:Number(attendance.present)||0,absent:Number(attendance.absent)||0,late:Number(attendance.late)||0,sessions:Number(attendance.sessions)||0,lastDate:attendance.lastDate||null,rate:attendanceTotal?Math.round((Number(attendance.present)||0)*1000/attendanceTotal)/10:null},
   finance:{invoices:Number(finance.invoices)||0,billedMinor,paidMinor,concessionMinor,outstandingMinor:Math.max(0,billedMinor-paidMinor-concessionMinor),overdueInvoices:Number(finance.overdueInvoices)||0,collectionRate:billedMinor?Math.round(paidMinor*1000/billedMinor)/10:null},
   analytics:{homework:{total:Number(homework.total)||0,published:Number(homework.published)||0,lastUpdated:homework.lastUpdated||null},exams:{total:Number(exams.total)||0,published:Number(exams.published)||0},leaveRequests:{total:Number(leaves.total)||0,pending:Number(leaves.pending)||0}},
   setupNeeded:s.status!=='active'
  }});
 });
 app.get('/api/admin/students',requireAuth,c=>directory(c,'students'));
 app.get('/api/admin/teachers',requireAuth,c=>directory(c,'teachers'));
 app.get('/api/admin/profile',requireAuth,async c=>{
  const u=requireRole(c,'admin','superadmin','staff','teacher','parent','student');
  const row=await db(c).prepare(`SELECT u.id,u.full_name AS fullName,u.email,u.mobile,u.status,u.version,p.gender,p.dob AS dateOfBirth,p.blood_group AS bloodGroup,p.address,p.city,p.pincode FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id AND p.school_id=u.school_id WHERE u.id=? AND u.school_id=?`).bind(u.id,u.school_id).first();
  if(!row)fail(404,'PROFILE_NOT_FOUND');return c.json({data:{...row,name:(row as {fullName:string}).fullName,avatar:null,roles:[u.user_type==='admin'?'schooladmin':u.user_type]}});
 });
}
