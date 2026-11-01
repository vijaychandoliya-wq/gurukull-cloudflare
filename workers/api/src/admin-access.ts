import {hmacKey} from './hmac-key.js';
import { decode, encode, fail } from './security.js';

// These are owner-generated 256-bit credentials, never a fast hash of a chosen password.
// No HTTP endpoint accepts a caller-chosen key or creates a credential digest.
export function validAccessKey(value:unknown):value is string {
 if(typeof value!=='string'||!/^gka1_[A-Za-z0-9_-]{43}$/.test(value))return false;
 try{const bytes=decode(value.slice(5));return bytes.length===32&&encode(bytes)===value.slice(5);}catch{return false;}
}
async function key(secret:string) {
 if(new TextEncoder().encode(secret).length<32)fail(503,'ADMIN_ACCESS_NOT_CONFIGURED');
 return hmacKey(secret);
}
const message=(schoolId:string,userId:string,credential:string)=>new TextEncoder().encode(JSON.stringify(['gurukull-admin-access-v1',schoolId,userId,credential]));
export async function accessKeyDigest(credential:string,secret:string,schoolId:string,userId:string) {
 if(!validAccessKey(credential))throw new Error('ACCESS_KEY_MUST_BE_256_BIT_CANONICAL_TOKEN');
 return encode(new Uint8Array(await crypto.subtle.sign('HMAC',await key(secret),message(schoolId,userId,credential))));
}
export async function verifyAccessKey(credential:string,stored:string,secret:string,schoolId:string,userId:string) {
 if(!validAccessKey(credential))return false;
 const imported=await key(secret);
 try{return await crypto.subtle.verify('HMAC',imported,decode(stored),message(schoolId,userId,credential));}catch{return false;}
}
export const setupPaths = new Set(['/api/admin/dashboard','/api/admin/features','/api/admin/students','/api/admin/teachers','/api/admin/profile','/api/admin/school','/api/admin/setup','/api/admin/locale-settings','/api/portal/locale-preference','/api/v2/logout','/v2/logout','/api/v2/myinfo','/v2/myinfo','/api/v2/school/details','/v2/school/details']);
// Owner setup includes narrowly scoped configuration/roster management; never arbitrary platform or mobile writes.
export function setupRequestAllowed(method:string,path:string) {
 if(/^\/api\/admin\/(payroll|payroll-templates|payroll-structures)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(payroll\/[A-Za-z0-9_-]+\/(publish|void)|payroll-(templates|structures)\/[A-Za-z0-9_-]+\/archive|payroll\/[A-Za-z0-9_-]+\/payments(\/[A-Za-z0-9_-]+\/reverse)?)$/.test(path))return true;
 if(method==='GET'&&/^\/api\/admin\/payroll\/[A-Za-z0-9_-]+\/payments$/.test(path))return true;
 if(/^\/api\/admin\/live-classes(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/live-classes\/[A-Za-z0-9_-]+\/(archive|approval)$/.test(path))return true;
 if(method==='GET'&&path==='/api/portal/student-live-classes')return true;
 if(/^\/api\/admin\/quizzes(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(quizzes\/[A-Za-z0-9_-]+\/(state|approval)|quiz-attempts\/[A-Za-z0-9_-]+\/(review|finalize-expired))$/.test(path))return true;
 if(method==='GET'&&(/^\/api\/admin\/quizzes\/[A-Za-z0-9_-]+\/attempts$/.test(path)||path==='/api/portal/student-quizzes'||/^\/api\/portal\/quiz-attempts\/[A-Za-z0-9_-]+$/.test(path)))return true;
 if(/^\/api\/admin\/(transport|transport-vehicles|transport-routes|transport-stops)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(transport|transport-vehicles|transport-routes|transport-stops)\/[A-Za-z0-9_-]+\/archive$/.test(path))return true;
 if(method==='GET'&&path==='/api/portal/student-transport')return true;

 if(/^\/api\/admin\/(promotion|alumni|certificates|certificate-templates)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(promotion\/[A-Za-z0-9_-]+\/undo|alumni\/[A-Za-z0-9_-]+\/archive|certificates\/[A-Za-z0-9_-]+\/void|certificate-templates\/[A-Za-z0-9_-]+\/archive)$/.test(path))return true;
 if(method==='GET'&&/^\/api\/portal\/student-certificates(\/[A-Za-z0-9_-]+)?$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/academic-years\/[A-Za-z0-9_-]+\/current$/.test(path))return true;

 if(/^\/api\/admin\/(library|library-categories|library-books|library-copies|library-cards)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(library-categories|library-books|library-copies|library-cards)\/[A-Za-z0-9_-]+\/archive$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/library\/[A-Za-z0-9_-]+\/close$/.test(path))return true;
 if(method==='GET'&&path==='/api/portal/student-library')return true;
 if(/^\/api\/admin\/discipline(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/discipline\/[A-Za-z0-9_-]+\/archive$/.test(path))return true;
 if(method==='GET'&&path==='/api/portal/student-conduct')return true;
 if(/^\/api\/admin\/(exams|exam-schedules|exam-grades)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(exams|exam-schedules)\/[A-Za-z0-9_-]+\/archive$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/exams\/[A-Za-z0-9_-]+\/publish$/.test(path))return true;
 if(method==='GET'&&/^\/api\/admin\/exams\/[A-Za-z0-9_-]+\/results$/.test(path))return true;
 if(['GET','POST'].includes(method)&&/^\/api\/admin\/exam-schedules\/[A-Za-z0-9_-]+\/marks$/.test(path))return true;
 if(method==='GET'&&['/api/portal/student-exams','/api/portal/exam-results','/api/portal/student-fees'].includes(path))return true;
 if(method==='GET'&&['/api/admin/id-cards/options','/api/admin/id-cards/students','/api/admin/teacher-id-cards/students','/api/admin/staff-id-cards/students','/api/admin/fees/groups','/api/admin/fees/invoices','/api/admin/fees/policy','/api/admin/fees/form-options','/api/admin/fees/receipts'].includes(path))return true;
 if(method==='GET'&&/^\/api\/admin\/fees\/(receipts|invoices)\/[A-Za-z0-9_-]+$/.test(path))return true;
 if(method==='PUT'&&path==='/api/admin/fees/policy')return true;
 if(method==='POST'&&['/api/admin/fees/groups','/api/admin/fees/invoices','/api/admin/fees/payments'].includes(path))return true;
 if(method==='POST'&&/^\/api\/admin\/fees\/(invoices\/[A-Za-z0-9_-]+\/cancel|receipts\/[A-Za-z0-9_-]+\/reverse)$/.test(path))return true;
 if(/^\/api\/admin\/fees(\/(invoices|groups|payments))?$/.test(path))return ['GET','POST'].includes(method);
 if(/^\/api\/admin\/(id-cards|teacher-id-cards|staff-id-cards)(\/(options|students))?$/.test(path))return method==='GET';
 if(/^\/api\/admin\/(inventory|inventory-categories|inventory-suppliers|reception)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(inventory|reception)\/[A-Za-z0-9_-]+\/archive$/.test(path))return true;
 if(['GET','POST'].includes(method)&&/^\/api\/admin\/inventory\/[A-Za-z0-9_-]+\/transactions$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/inventory\/[A-Za-z0-9_-]+\/transactions\/[A-Za-z0-9_-]+\/reverse$/.test(path))return true;
 if(/^\/api\/admin\/(parents|notices|homework|lesson-plans)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/(notices|homework|lesson-plans)\/[A-Za-z0-9_-]+\/(archive|approval)$/.test(path))return true;
 if(method==='GET'&&/^\/api\/admin\/homework\/[A-Za-z0-9_-]+\/submissions$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/homework-submissions\/[A-Za-z0-9_-]+\/review$/.test(path))return true;
 if(method==='GET'&&['/api/portal/student-work','/api/portal/student-overview'].includes(path))return true;
 if(/^\/api\/admin\/(leaves|leave-types)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/leaves\/[A-Za-z0-9_-]+\/(cancel|review)$/.test(path))return true;
 if(method==='GET'&&['/api/admin/attendance','/api/admin/attendance/options'].includes(path))return true;
 if(method==='POST'&&['/api/admin/attendance','/api/admin/attendance/reasons'].includes(path))return true;
 if(method==='GET'&&setupPaths.has(path))return true;
 if(method==='POST'&&['/api/v2/logout','/v2/logout'].includes(path))return true;
 if(method==='POST'&&path==='/api/admin/school/activate')return true;
 if(method==='GET'&&path==='/api/admin/users')return true;
 if(method==='POST'&&/^\/api\/admin\/users\/[A-Za-z0-9_-]+\/(access-key|revoke-access)$/.test(path))return true;
 if(method==='POST'&&/^\/api\/admin\/users\/[A-Za-z0-9_-]+\/password$/.test(path))return true;
 if(method==='PUT'&&path==='/api/admin/profile')return true;
 if(method==='PUT'&&['/api/admin/locale-settings','/api/portal/locale-preference'].includes(path))return true;
 if(method==='PUT'&&path==='/api/admin/school/configuration')return true;
 if(method==='GET'&&['/api/admin/academic-options','/api/admin/subjects','/api/admin/teacher-assignments','/api/admin/timetable/options','/api/admin/timetable/removed'].includes(path))return true;
 if(method==='PUT'&&path==='/api/admin/timetable/configuration')return true;
 if(/^\/api\/admin\/(subjects|teacher-assignments)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['POST','PUT'].includes(method);
 if(/^\/api\/admin\/timetable(\/[A-Za-z0-9_-]+)?$/.test(path))return ['GET','POST','PUT','DELETE'].includes(method);
 if(method==='POST'&&/^\/api\/admin\/timetable\/[A-Za-z0-9_-]+\/restore$/.test(path))return true;
 if(/^\/api\/admin\/(academic-years|classes|sections)(\/[A-Za-z0-9_-]+)?$/.test(path))return ['POST','PUT'].includes(method);
 if(method==='GET'&&['/api/admin/roles','/api/admin/staff'].includes(path))return true;
 if(/^\/api\/admin\/(students|teachers|staff)(\/(form-options|[A-Za-z0-9_-]+))?$/.test(path))return ['GET','POST','PUT'].includes(method);
 return false;
}
