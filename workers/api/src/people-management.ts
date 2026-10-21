import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv,type ApiContext} from './context.js';
import {parse,requiredText,nullableText,dateInput,command,managementReady,guard,cleanupGuards,audit} from './management-common.js';
import {fail} from './security.js';
import {generatedPasswordDigest} from './security.js';
import {generateTemporaryPassword} from './member-access.js';
import {sendCredentialsEmail} from './email.js';
const nullableDate=z.preprocess(v=>v===''||v===undefined?null:v,dateInput.nullable());
const email=z.preprocess(v=>v===''||v===undefined?null:typeof v==='string'?v.trim().toLowerCase():v,z.string().email().max(254).nullable());
const phone=z.preprocess(v=>v===''||v===undefined?null:v,z.string().regex(/^\+?[0-9]{7,15}$/).nullable());
const friendlyLabel=(value:unknown)=>typeof value==='string'&&value?value.split('_').map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' '):null;
const basePerson={name:requiredText(),email,mobile:phone,firstName:nullableText(),lastName:nullableText(),gender:z.preprocess(v=>v===''||v===undefined?null:v,z.enum(['male','female','other']).nullable()),dateOfBirth:nullableDate,bloodGroup:z.preprocess(v=>v===''||v===undefined?null:v,z.enum(['A+','A-','B+','B-','O+','O-','AB+','AB-']).nullable()),address:nullableText(500),city:nullableText(100),pincode:nullableText(12),alternateMobile:phone,aadhaarNumber:z.preprocess(v=>v===''||v===undefined?null:v,z.string().regex(/^[0-9]{12}$/).nullable()),version:z.number().int().positive().optional()};
export const studentInput=z.object({...basePerson,registrationNumber:requiredText(50).regex(/^[A-Za-z0-9/_-]+$/),rollNumber:requiredText(50),sectionId:requiredText(100),enrollmentDate:dateInput}).strict();
export const teacherInput=z.object({...basePerson,employeeId:requiredText(30).regex(/^[A-Za-z0-9_-]+$/),designation:requiredText(80),jobType:z.enum(['full_time','part_time']),joiningDate:dateInput,subDesignation:nullableText(80),ugDegree:nullableText(150),pgDegree:nullableText(150),specialization:nullableText(255),interestedIn:nullableText(500),reportingTo:nullableText(100)}).strict().refine(v=>!!v.email&&!!v.mobile,{path:['email'],message:'Teacher email and mobile are required.'});
export const staffInput=z.object({...basePerson,employeeId:requiredText(30),designation:requiredText(80),joiningDate:dateInput}).strict().refine(v=>!!v.email||!!v.mobile,{path:['email'],message:'Provide a real email or mobile.'});
export type PersonKind='students'|'teachers'|'staff';
export async function personDetail(c:ApiContext,kind:PersonKind,id:string){
 const u=requireRole(c,'admin');
 const fields=kind==='students'?`e.admission_no AS registrationNumber,e.roll_no AS rollNumber,e.section_id AS sectionId,e.enrollment_date AS enrollmentDate,e.academic_year_id AS academicYearId,cl.name||' - '||s.name AS className,a.name AS academicYear`:
 kind==='teachers'?`e.employee_code AS employeeId,e.designation,e.qualification,e.joining_date AS joiningDate,e.job_type AS jobType,e.sub_designation AS subDesignation,e.ug_degree AS ugDegree,e.pg_degree AS pgDegree,e.specialization,e.interested_in AS interestedIn,e.reporting_to AS reportingTo`:`e.employee_code AS employeeId,e.designation,e.joining_date AS joiningDate`;
 const table=kind==='staff'?'staff_profiles':kind;
 const joins=kind==='students'?' LEFT JOIN classes cl ON cl.id=e.class_id AND cl.school_id=e.school_id LEFT JOIN sections s ON s.id=e.section_id AND s.school_id=e.school_id LEFT JOIN academic_years a ON a.id=e.academic_year_id AND a.school_id=e.school_id':'';
 const row=await db(c).prepare(`SELECT u.id,u.full_name AS name,u.full_name AS fullName,u.email,u.mobile,u.status,u.version,p.gender,p.dob AS dateOfBirth,p.blood_group AS bloodGroup,p.address,p.city,p.pincode,p.first_name AS firstName,p.last_name AS lastName,p.alternate_mobile AS alternateMobile,p.aadhaar_number AS aadhaarNumber,${fields} FROM users u JOIN ${table} e ON e.user_id=u.id AND e.school_id=u.school_id LEFT JOIN user_profiles p ON p.user_id=u.id AND p.school_id=u.school_id${joins} WHERE u.school_id=? AND u.id=? AND u.user_type=?`).bind(u.school_id,id,kind==='students'?'student':kind==='teachers'?'teacher':'staff').first<Record<string,unknown>>();
 if(!row)fail(404,'PERSON_NOT_FOUND');
 if(kind==='students'){
  const parents=await db(c).prepare(`SELECT u.id,u.full_name AS name,u.email,u.mobile,l.relationship AS relation FROM parent_student_links l JOIN students s ON s.id=l.student_id AND s.school_id=l.school_id JOIN users u ON u.id=l.parent_user_id AND u.school_id=l.school_id WHERE l.school_id=? AND s.user_id=?`).bind(u.school_id,id).all();row.parents=parents.results;
 }
 if(kind==='teachers')return {...row,designationLabel:friendlyLabel(row.designation),jobTypeLabel:friendlyLabel(row.jobType),subDesignationLabel:friendlyLabel(row.subDesignation),avatar:null};
 return {...row,avatar:null};
}
async function savePerson(c:ApiContext,kind:PersonKind){
 const u=requireRole(c,'admin'),body=await readBody(c);
 const input=kind==='students'?parse(studentInput,body):kind==='teachers'?parse(teacherInput,body):parse(staffInput,body);
 const {yearId}=await managementReady(c),id=c.req.param('id')||crypto.randomUUID(),editing=!!c.req.param('id'),role=kind==='students'?'student':kind==='teachers'?'teacher':'staff';
 const autoEmail=!!input.email&&!editing&&c.env.EMAIL&&c.env.GENERATED_PASSWORD_AUTH_ENABLED==='true'&&!!c.env.ADMIN_ACCESS_KEY_SECRET;
 const generatedPassword=autoEmail?generateTemporaryPassword():null;
 const generatedHash=generatedPassword?await generatedPasswordDigest(generatedPassword,c.env.ADMIN_ACCESS_KEY_SECRET!,u.school_id,id):'!';
 const nowDate=new Date().toISOString().slice(0,10);
 if(input.dateOfBirth&&input.dateOfBirth>nowDate)fail(422,'INVALID_BIRTH_DATE');
 if(('enrollmentDate' in input?input.enrollmentDate:input.joiningDate)>nowDate)fail(422,'INVALID_JOINING_DATE');
 if(editing&&(!input.version||!await db(c).prepare('SELECT id FROM users WHERE id=? AND school_id=? AND user_type=?').bind(id,u.school_id,role).first()))fail(input.version?404:422,input.version?'PERSON_NOT_FOUND':'VERSION_REQUIRED');
 let section:{class_id:string}|null=null;
 if('sectionId'in input){section=await db(c).prepare('SELECT class_id FROM sections WHERE id=? AND school_id=?').bind(input.sectionId,u.school_id).first();if(!section)fail(422,'INVALID_SECTION');}
 if('reportingTo'in input&&input.reportingTo===id)fail(422,'SELF_REPORTING_NOT_ALLOWED');
 const guardId=crypto.randomUUID();
 const response=await command(c,`${kind}.${editing?'update':'create'}`,{id:editing?id:null,...input},()=>{
  const statements:D1PreparedStatement[]=[guard(c,`EXISTS(SELECT 1 FROM academic_years a JOIN school_configuration cfg ON cfg.school_id=a.school_id WHERE a.id=? AND a.school_id=? AND a.is_current=1 AND cfg.configuration_verified_at IS NOT NULL)`,[yearId,u.school_id],guardId)];
  if(editing&&kind==='students')statements.push(guard(c,"EXISTS(SELECT 1 FROM students WHERE school_id=? AND user_id=? AND academic_year_id=? AND status='active')",[u.school_id,id,yearId],guardId+'-enrollment'));
  if(editing){statements.push(guard(c,'EXISTS(SELECT 1 FROM users WHERE id=? AND school_id=? AND user_type=? AND version=?)',[id,u.school_id,role,input.version],guardId+'-version'));
   statements.push(db(c).prepare('UPDATE users SET full_name=?,email=?,mobile=?,version=version+1,updated_at=unixepoch() WHERE id=? AND school_id=? AND user_type=? AND version=?').bind(input.name,input.email,kind==='students'?null:input.mobile,id,u.school_id,role,input.version));
  }else{
   statements.push(db(c).prepare('INSERT INTO users(id,school_id,email,mobile,password_hash,hash_algorithm,full_name,user_type,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,? ,\'active\',unixepoch(),unixepoch())').bind(id,u.school_id,input.email,kind==='students'?null:input.mobile,generatedHash,generatedPassword?'hmac-sha256-generated':'bcrypt',input.name,role));
   statements.push(db(c).prepare('INSERT INTO user_roles VALUES(?,?,?)').bind(u.school_id,id,role));
  }
  statements.push(db(c).prepare(`INSERT INTO user_profiles(id,school_id,user_id,gender,dob,blood_group,address,city,pincode,first_name,last_name,alternate_mobile,aadhaar_number,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()) ON CONFLICT(user_id) DO UPDATE SET gender=excluded.gender,dob=excluded.dob,blood_group=excluded.blood_group,address=excluded.address,city=excluded.city,pincode=excluded.pincode,first_name=excluded.first_name,last_name=excluded.last_name,alternate_mobile=excluded.alternate_mobile,aadhaar_number=excluded.aadhaar_number,updated_at=excluded.updated_at`).bind(crypto.randomUUID(),u.school_id,id,input.gender,input.dateOfBirth,input.bloodGroup,input.address,input.city,input.pincode,input.firstName,input.lastName,input.alternateMobile,input.aadhaarNumber));
  if('sectionId'in input){const values=[input.registrationNumber,input.rollNumber,section!.class_id,input.sectionId,input.enrollmentDate,yearId];
   statements.push(editing?db(c).prepare('UPDATE students SET admission_no=?,roll_no=?,class_id=?,section_id=?,enrollment_date=?,academic_year_id=?,updated_at=unixepoch() WHERE user_id=? AND school_id=?').bind(...values,id,u.school_id):db(c).prepare('INSERT INTO students(id,school_id,user_id,admission_no,roll_no,class_id,section_id,enrollment_date,academic_year_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch())').bind(crypto.randomUUID(),u.school_id,id,...values));
  }else if(kind==='teachers'){const teacher=parse(teacherInput,body);const values=[teacher.employeeId,teacher.designation,[teacher.ugDegree,teacher.pgDegree,teacher.specialization].filter(Boolean).join(', ')||null,teacher.joiningDate,teacher.jobType,teacher.subDesignation,teacher.ugDegree,teacher.pgDegree,teacher.specialization,teacher.interestedIn,teacher.reportingTo];
   statements.push(editing?db(c).prepare('UPDATE teachers SET employee_code=?,designation=?,qualification=?,joining_date=?,job_type=?,sub_designation=?,ug_degree=?,pg_degree=?,specialization=?,interested_in=?,reporting_to=?,updated_at=unixepoch() WHERE user_id=? AND school_id=?').bind(...values,id,u.school_id):db(c).prepare('INSERT INTO teachers(id,school_id,user_id,employee_code,designation,qualification,joining_date,job_type,sub_designation,ug_degree,pg_degree,specialization,interested_in,reporting_to,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch())').bind(crypto.randomUUID(),u.school_id,id,...values));
  }else{statements.push(db(c).prepare('INSERT INTO staff_profiles VALUES(?,?,?,?,?) ON CONFLICT(school_id,user_id) DO UPDATE SET employee_code=excluded.employee_code,designation=excluded.designation,joining_date=excluded.joining_date').bind(u.school_id,id,input.employeeId,input.designation,input.joiningDate));}
  statements.push(audit(c,editing?'update':'create',role,id),cleanupGuards(c,guardId));if(editing)statements.push(cleanupGuards(c,guardId+'-version'),cleanupGuards(c,guardId+'-enrollment'));
  return statements;
 },{message:editing?'Changes saved.':autoEmail?'Person added. Login details will be emailed shortly.':'Person added. Issue an individual credential from Roles and account access.',data:{id,version:editing?input.version!+1:1,emailDelivery:autoEmail?'queued':'not_sent'}});
 if(generatedPassword&&input.email){
  c.executionCtx.waitUntil(sendCredentialsEmail(c.env,{recipient:input.email,schoolName:c.get('school').name,schoolCode:c.get('school').code,fullName:input.name,role,identifier:input.email,password:generatedPassword,loginUrl:`https://${c.get('school').slug}.gurukull.in/login`}).catch(()=>undefined));
 }
 return c.json(response,editing?200:201);
}
export function registerPeopleManagement(app:Hono<AppEnv>){
 for(const kind of ['students','teachers','staff'] as const){
  app.get(`/api/admin/${kind}/form-options`,requireAuth,async c=>{
   const u=requireRole(c,'admin');const sections=await db(c).prepare('SELECT s.id AS value,c.name||\' - \'||s.name AS label FROM sections s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE s.school_id=? ORDER BY c.name,s.name').bind(u.school_id).all();
   const reporting=await db(c).prepare("SELECT id AS value,full_name AS label FROM users WHERE school_id=? AND user_type IN ('teacher','admin') AND status='active' ORDER BY full_name").bind(u.school_id).all();
   return c.json({data:{sections:sections.results,reportingTo:reporting.results,designations:['principal','vice_principal','head_of_the_department','senior_teacher','assistant_teacher','teacher','co_ordinator','physical_education_teacher','others'].map(value=>({value,label:friendlyLabel(value)})),jobTypes:['full_time','part_time'].map(value=>({value,label:friendlyLabel(value)})),genders:['male','female','other'].map(value=>({value,label:friendlyLabel(value)})),qualifications:[]}});
  });
  app.post(`/api/admin/${kind}`,requireAuth,c=>savePerson(c,kind));
  app.get(`/api/admin/${kind}/:id`,requireAuth,async c=>c.json({data:await personDetail(c,kind,c.req.param('id')!)}));
  app.put(`/api/admin/${kind}/:id`,requireAuth,c=>savePerson(c,kind));
 }
 app.get('/api/admin/staff',requireAuth,async c=>{
  const u=requireRole(c,'admin');const rows=await db(c).prepare('SELECT u.id,u.full_name AS fullName,u.email,u.mobile,u.status,u.version,s.employee_code AS employeeId,s.designation,s.joining_date AS joiningDate FROM staff_profiles s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id WHERE s.school_id=? ORDER BY u.full_name LIMIT 100').bind(u.school_id).all();return c.json({data:rows.results});
 });
 app.get('/api/admin/roles',requireAuth,c=>{requireRole(c,'admin');return c.json({data:[{role:'admin',permissions:['school_setup','people_manage','academic_manage','notice_manage','homework_approve','lesson_plan_approve','attendance_manage','leave_review']},{role:'teacher',permissions:['own_profile','assigned_classes','own_timetable','assigned_attendance','assigned_homework','assigned_lesson_plans','own_leave']},{role:'staff',permissions:['own_profile','own_leave']},{role:'parent',permissions:['own_profile','linked_children','linked_child_learning']},{role:'student',permissions:['own_profile','own_learning','own_homework_submission']}],notice:'Roles are server enforced. Arbitrary promotion to platform operator is not allowed.'});});
}
