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
 return {countSql:'SELECT COUNT(*) AS total '+from,listSql:`SELECT u.id,u.id AS name,u.full_name AS fullName,u.email,u.mobile,p.gender,u.status,p.city,${fields} ${from} ORDER BY u.full_name,u.id LIMIT ? OFFSET ?`,values};
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
 return c.json({data:rows.map(row=>kind==='teachers'?({...row,designationLabel:label(row.designation),jobTypeLabel:label(row.jobType),avatar:null}):({...row,avatar:null})),meta:{currentPage:input.page,lastPage:Math.max(1,Math.ceil(total/input.perPage)),perPage:input.perPage,total,from:rows.length?input.offset+1:null,to:rows.length?input.offset+rows.length:null}});
}
export function registerAdmin(app:Hono<AppEnv>) {
 app.get('/api/admin/features',requireAuth,c=>{requireRole(c,'admin','superadmin');return c.json({data:adminFeatures,release:c.env?.APP_RELEASE||'unversioned',notice:'Implementation status is not proof of genuine feature acceptance.'});});
 app.get('/api/admin/dashboard',requireAuth,async c=>{
  const u=requireRole(c,'admin','superadmin'),s=c.get('school');
  const counts=await db(c).batch<{total:number}>(['students','teachers','classes','sections','academic_years'].map(table=>db(c).prepare(`SELECT COUNT(*) AS total FROM ${table} WHERE school_id=?`).bind(u.school_id)));
  if(counts.some(r=>!r.success))fail(503,'DASHBOARD_READ_FAILED');
  const values=counts.map(r=>r.results[0]?.total);
  if(values.some(v=>!Number.isSafeInteger(v)||Number(v)<0))fail(503,'DASHBOARD_READ_FAILED');
  const configuration=await db(c).prepare('SELECT timezone,currency,address,configuration_verified_at FROM school_configuration WHERE school_id=?').bind(u.school_id).first();
  return c.json({data:{school:{name:s.name,code:s.code,status:s.status},counts:Object.fromEntries(['students','teachers','classes','sections','academicYears'].map((k,i)=>[k,values[i]])),configuration,setupNeeded:s.status!=='active',unavailableMetrics:['attendance','finance','leaveApprovals']}});
 });
 app.get('/api/admin/students',requireAuth,c=>directory(c,'students'));
 app.get('/api/admin/teachers',requireAuth,c=>directory(c,'teachers'));
 app.get('/api/admin/profile',requireAuth,async c=>{
  const u=requireRole(c,'admin','superadmin','staff','teacher','parent','student');
  const row=await db(c).prepare(`SELECT u.id,u.full_name AS fullName,u.email,u.mobile,u.status,u.version,p.gender,p.dob AS dateOfBirth,p.blood_group AS bloodGroup,p.address,p.city,p.pincode FROM users u LEFT JOIN user_profiles p ON p.user_id=u.id AND p.school_id=u.school_id WHERE u.id=? AND u.school_id=?`).bind(u.id,u.school_id).first();
  if(!row)fail(404,'PROFILE_NOT_FOUND');return c.json({data:{...row,name:(row as {fullName:string}).fullName,avatar:null,roles:[u.user_type==='admin'?'schooladmin':u.user_type]}});
 });
}
