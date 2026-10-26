import {registerPasswordManagement} from './password-management.js';
import {registerPayrollManagement} from './payroll-management.js';
import {registerLiveClassManagement} from './live-class-management.js';
import {registerQuizManagement} from './quiz-management.js';
import {registerTransportManagement} from './transport-management.js';
import {registerStudentLifecycle} from './student-lifecycle.js';
import {registerCertificateManagement} from './certificate-management.js';
import {registerLibraryManagement} from './library-management.js';
import {registerDisciplineManagement} from './discipline-management.js';
import {registerExamManagement} from './exam-management.js';
import {registerInventoryManagement} from './inventory-management.js';
import {registerReceptionManagement} from './reception-management.js';
import {registerLeaveManagement} from './leave-management.js';
import {registerStudentWorkspace} from './student-workspace.js';
import {registerPortalAttendance} from './portal-attendance.js';
import {registerParentManagement} from './parent-management.js';
import {registerNoticeManagement,memberNotices} from './notice-management.js';
import {registerAcademicWork} from './academic-work.js';
import {registerAcademicManagement} from './academic-management.js';
import {registerProfileManagement} from './profile-management.js';
import {registerMemberWorkspace} from './member-workspace.js';
import {registerMemberAccess} from './member-access.js';
import {registerPeopleManagement} from './people-management.js';
import {registerSchoolManagement} from './school-management.js';
import {registerFeeManagement} from './fee-management.js';
import {registerFeeParityManagement} from './fee-parity-management.js';
import {registerIdCardManagement} from './idcard-management.js';
import {registerEmailDeliveryStatus, scheduledEmailDispatcher} from './email-delivery.js';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { DeviceRegisterRequestSchema } from '@gurukul/domain';
import { db, requireAuth, requireRole, schoolByCode, readBody, child, type AppEnv, type ApiContext } from './context.js';
import { login, logout } from './auth.js';
import { fail, money } from './security.js';
import { registerSync } from './sync.js';
import { registerStorage } from './storage/routes.js';
import { registerAvatarManagement } from './avatar-management.js';
import { registerAttendance } from './attendance.js';
import { registerEnrollment } from './enrollment.js';
import { registerAdmin } from './admin.js';
import { registerPlatform } from './platform.js';
export { signJwt, verifyJwt } from './security.js';
export type { Env } from './context.js';

const app=new Hono<AppEnv>();
app.use('*',async(c,next)=>{
  c.set('requestId',crypto.randomUUID());c.header('x-request-id',c.get('requestId'));c.header('X-Content-Type-Options','nosniff');
  c.header('Cache-Control','no-store');
  const origin=c.req.header('origin');
  const allowed=(c.env?.ALLOWED_ORIGINS||'https://gurukull.in,https://www.gurukull.in,https://app.gurukull.in').split(',');
  if (origin) {
    if (!allowed.includes(origin)) fail(403,'ORIGIN_FORBIDDEN');
    c.header('Access-Control-Allow-Origin',origin);c.header('Vary','Origin');
    c.header('Access-Control-Allow-Methods','GET,POST,PUT,PATCH,DELETE,OPTIONS');
    c.header('Access-Control-Allow-Headers','Content-Type,Authorization,x-school-code,x-request-id,x-file-name,x-access-scope,x-entity-id,x-entity-type,Idempotency-Key');
    c.header('Access-Control-Expose-Headers','x-request-id');
  }
  if(c.req.method==='OPTIONS')return c.body(null,204);
  await next();
});
app.get('/health',c=>c.json({status:'healthy',runtime:'cloudflare-workers',release:c.env?.APP_RELEASE||'unversioned',sourceSha:c.env?.SOURCE_SHA||'local',requestId:c.get('requestId')}));
app.get('/api/platform/readiness',requireAuth,async c=>{
  requireRole(c,'superadmin');
  const operator=await db(c).prepare('SELECT 1 FROM platform_operators WHERE user_id=? AND revoked_at IS NULL').bind(c.get('user').id).first();
  if(!operator)fail(403,'PLATFORM_PERMISSION_REQUIRED');
  try{
    await db(c).prepare('SELECT generated_password_hash FROM users LIMIT 0').all();
    await db(c).prepare('SELECT provider_message_id FROM outbox LIMIT 0').all();
    await db(c).prepare('SELECT * FROM fee_invoice_balances LIMIT 0').all();
    await c.env.R2_MEDIA.head('__readiness__');
    const backlog=await db(c).prepare("SELECT COUNT(*) AS pending,MIN(created_at) AS oldest FROM outbox WHERE status='pending'").first();
    return c.json({status:'ready',release:c.env.APP_RELEASE,sourceSha:c.env.SOURCE_SHA,backlog});
  }catch{return c.json({status:'not_ready',requestId:c.get('requestId')},503);}
});
app.get('/api/v3/discovery/:schoolCode',async c=>{
  const school=await schoolByCode(c,c.req.param('schoolCode').toUpperCase());
  return c.json({code:school.code,name:school.name,status:school.status,setupPolicy:school.status==='active'?'configured':'administrator_pending',logo:null});
});
app.post('/api/teacher/login',c=>login(c,'teacher'));
app.post('/api/parent/login',c=>login(c,'parent'));
app.post('/parent/login',c=>login(c,'parent'));
app.post('/api/portal/login',c=>login(c,'portal'));
app.on('POST',['/api/teacher/logout','/api/v2/logout','/v2/logout'],requireAuth,logout);
app.on('GET',['/api/teacher/myinfo','/api/v2/myinfo','/v2/myinfo'],requireAuth,async c=>{
  if(c.req.path.includes('/teacher/'))requireRole(c,'teacher','admin');
  const u=c.get('user');
  const profile=await db(c).prepare('SELECT * FROM user_profiles WHERE school_id=? AND user_id=?').bind(u.school_id,u.id).first();
  const roles=await db(c).prepare('SELECT role FROM user_roles WHERE school_id=? AND user_id=?').bind(u.school_id,u.id).all<{role:string}>();
  return c.json({status:'success',data:{id:u.id,userId:u.id,name:u.full_name,fullName:u.full_name,email:u.email,mobile:u.mobile,schoolId:u.school_id,schoolCode:c.get('school').code,userType:u.user_type,profile:profile||null,roles:roles.results.map(r=>r.role)}});
});
app.on('GET',['/api/teacher/school/details','/api/v2/school/details','/v2/school/details','/api/admin/school'],requireAuth,async c=>{
  if(c.req.path.includes('/admin/'))requireRole(c,'admin','superadmin');
  if(c.req.path.includes('/teacher/'))requireRole(c,'teacher','admin');
  const s=c.get('school');const config=await db(c).prepare('SELECT * FROM school_configuration WHERE school_id=?').bind(s.id).first();
  return c.json({status:'success',data:{id:s.id,name:s.name,code:s.code,status:s.status,configuration:config}});
});
registerPlatform(app);
registerPasswordManagement(app);
app.post('/api/v3/devices/register',requireAuth,async c=>{
  const u=c.get('user'),parsed=DeviceRegisterRequestSchema.safeParse(await readBody(c));if(!parsed.success)fail(422,'INVALID_DEVICE');
  const d=parsed.data,now=Math.floor(Date.now()/1000);
  if(!await db(c).prepare(`SELECT 1 FROM sessions WHERE id=? AND school_id=? AND user_id=? AND device_id=?`).bind(c.get('claims').sid,u.school_id,u.id,d.installation_id).first())fail(403,'DEVICE_SESSION_MISMATCH');
  const result=await db(c).batch([
    db(c).prepare(`UPDATE devices SET status='revoked',updated_at=? WHERE installation_id=? AND (school_id!=? OR user_id!=?)`).bind(now,d.installation_id,u.school_id,u.id),
    db(c).prepare(`INSERT INTO devices(id,school_id,user_id,installation_id,platform,app_version,fcm_token,status,last_seen_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'active',?,?,?) ON CONFLICT(school_id,user_id,installation_id) DO UPDATE SET fcm_token=excluded.fcm_token,app_version=excluded.app_version,platform=excluded.platform,status='active',last_seen_at=excluded.last_seen_at,updated_at=excluded.updated_at RETURNING id`).bind(crypto.randomUUID(),u.school_id,u.id,d.installation_id,d.platform,d.app_version,d.fcm_token,now,now,now),
  ]);
  const id=(result[1].results[0] as {id:string}|undefined)?.id;if(!id)fail(503,'DEVICE_WRITE_FAILED');return c.json({status:'success',deviceId:id,registeredAt:now});
});
app.on('GET',['/api/v2/my-children','/api/v2/students','/v2/my-children'],requireAuth,async c=>{
  const u=requireRole(c,'parent');
  const rows=await db(c).prepare(`SELECT s.id,s.user_id AS student_id,s.user_id,u.full_name AS name,u.full_name AS FullName,s.admission_no,s.roll_no,s.class_id,s.section_id,s.section_id AS standardLink_id,cl.name AS standard,se.name AS section FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN parent_student_links p ON p.student_id=s.id AND p.school_id=s.school_id JOIN classes cl ON cl.id=s.class_id AND cl.school_id=s.school_id JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=? AND p.parent_user_id=? AND s.status='active' AND u.status='active' ORDER BY s.roll_no,u.full_name`).bind(u.school_id,u.id).all();
  return c.json({status:'success',data:rows.results});
});
app.on('GET',['/api/v2/my-children/:studentId/details','/v2/my-children/:studentId/details'],requireAuth,async c=>c.json({status:'success',data:await child(c,c.req.param('studentId'))}));
app.on('GET',['/api/v2/attendance/:studentId','/v2/attendance/:studentId'],requireAuth,async c=>{
  const s=await child(c,c.req.param('studentId')!);
  const rows=await db(c).prepare(`SELECT date_timestamp,session,status FROM attendance WHERE school_id=? AND student_id=? ORDER BY date_timestamp DESC LIMIT 365`).bind(c.get('user').school_id,s.id).all<{date_timestamp:number;session:string;status:string}>();
  const present=rows.results.filter(r=>r.status==='present').length;
  return c.json({status:'success',attendancePercentage:rows.results.length?`${(present*100/rows.results.length).toFixed(1)}%`:null,data:rows.results});
});
const fees=async(c:ApiContext)=>{
  const s=await child(c,c.req.param('studentId')!);
  const invoices=await db(c).prepare(`SELECT i.*,i.paid_minor AS paid_paise FROM fee_invoice_balances i WHERE i.school_id=? AND i.student_id=? ORDER BY due_date`).bind(c.get('user').school_id,s.id).all<Record<string,unknown>>();
  let totalDuePaise=0,totalPaidPaise=0;
  for(const inv of invoices.results){const amount=money(inv.amount_paise)-money(inv.concession_minor),paid=money(inv.paid_paise);if(paid>amount)fail(500,'LEDGER_RECONCILIATION_REQUIRED');totalPaidPaise+=paid;if(inv.status!=='cancelled')totalDuePaise+=amount-paid;}
  money(totalDuePaise);money(totalPaidPaise);
  const filter=c.req.path.includes('/paid/')?'paid':c.req.path.includes('/unpaid/')?'unpaid':null;
  return c.json({status:'success',data:filter?invoices.results.filter(i=>filter==='paid'?money(i.paid_paise)>0:i.status!=='cancelled'&&money(i.amount_paise)-money(i.concession_minor)>money(i.paid_paise)):{invoices:invoices.results,totalDuePaise,totalPaidPaise}});
};
app.on('GET',['/api/v2/fees/:studentId','/api/v2/fees/paid/:studentId','/api/v2/fees/unpaid/:studentId','/v2/fees/paid/:studentId','/v2/fees/unpaid/:studentId'],requireAuth,fees);
app.on('GET',['/api/v2/notices','/api/v2/my-school/notices','/v2/my-school/notices','/api/teacher/my-school/notices','/api/portal/notices'],requireAuth,c=>{if(c.req.path.includes('/teacher/'))requireRole(c,'teacher','admin');return memberNotices(c);});
registerPayrollManagement(app);registerLiveClassManagement(app);registerQuizManagement(app);registerTransportManagement(app);registerStudentLifecycle(app);registerCertificateManagement(app);registerLibraryManagement(app);registerDisciplineManagement(app);registerExamManagement(app);registerInventoryManagement(app);registerReceptionManagement(app);registerLeaveManagement(app);registerStudentWorkspace(app);registerPortalAttendance(app);registerParentManagement(app);registerNoticeManagement(app);registerAcademicWork(app);
registerAcademicManagement(app);registerProfileManagement(app);registerMemberWorkspace(app);registerMemberAccess(app);registerPeopleManagement(app);registerAvatarManagement(app);registerSchoolManagement(app);registerAdmin(app);registerEnrollment(app);registerAttendance(app);registerSync(app);registerStorage(app);registerFeeManagement(app);registerFeeParityManagement(app);registerIdCardManagement(app);
registerEmailDeliveryStatus(app);
app.notFound(async (c) => {
  const assets = (c.env as any)?.ASSETS;
  if (assets && !c.req.path.startsWith('/api/') && !c.req.path.startsWith('/v2/')) {
    return await assets.fetch(c.req.raw);
  }
  return c.json({ error: 'ROUTE_NOT_FOUND', requestId: c.get('requestId') }, 404);
});
app.onError((err,c)=>{
  if(err instanceof HTTPException){
    const response=err.getResponse();
    return c.newResponse(response.body,response);
  }
  console.error(JSON.stringify({event:'api_failure',requestId:c.get('requestId'),category:'DATABASE_OR_RUNTIME_FAILURE'}));
  return c.json({error:'SERVICE_UNAVAILABLE',requestId:c.get('requestId')},503);
});
// Keep Hono as the fetch handler and add the scheduled outbox drain for Workers.
export default Object.assign(app, {scheduled: scheduledEmailDispatcher});
