import {validMemberKey,verifyMemberKey} from './member-access.js';
import { digest, fail, signJwt, verifyGeneratedPassword, verifyPassword } from './security.js';
import { db, readBody, resolveSchool, type ApiContext, type User } from './context.js';
import { validAccessKey,verifyAccessKey } from './admin-access.js';

export async function login(c: ApiContext, kind: 'teacher' | 'parent' | 'portal') {
  const body = await readBody(c);
  const school = await resolveSchool(c, typeof body.schoolCode === 'string' ? body.schoolCode : undefined);
  const adminKey=kind==='portal'&&validAccessKey(body.password),memberKey=validMemberKey(body.password),accessLogin=adminKey||memberKey;
  if (school.status !== 'active'&&!(adminKey&&['configuration_needed','administrator_pending'].includes(school.status))) fail(403,'SCHOOL_CONFIGURATION_NEEDED');
  if (!c.env.JWT_SECRET || new TextEncoder().encode(c.env.JWT_SECRET).length < 32) fail(503,'AUTH_NOT_CONFIGURED');
  if (accessLogin ? c.env.ADMIN_ACCESS_KEY_CPU_VERIFIED!=='true' : c.env.AUTH_CPU_VERIFIED !== 'true' && c.env.GENERATED_PASSWORD_AUTH_ENABLED!=='true') fail(503,accessLogin?'ADMIN_ACCESS_CPU_VERIFICATION_REQUIRED':'FREE_AUTH_CPU_VERIFICATION_REQUIRED');
  const identifier = String(body.email || body.mobile || '').trim();
  if (!identifier || identifier.length>254 || typeof body.password !== 'string' || !body.password || body.password.length>256) fail(422,'INVALID_CREDENTIAL_INPUT');
  const now=Math.floor(Date.now()/1000);
  const identities=[`${school.id}:${identifier.toLowerCase()}`, `ip:${c.req.header('cf-connecting-ip') || 'local'}`];
  const attemptKeys=await Promise.all(identities.map(value=>digest(value)));
  const attempts=await db(c).batch<{attempts:number}>(attemptKeys.map(attemptKey=>db(c).prepare(`INSERT INTO login_attempts(attempt_key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN window_start<=?-900 THEN 1 ELSE attempts+1 END, window_start=CASE WHEN window_start<=?-900 THEN excluded.window_start ELSE window_start END RETURNING attempts`).bind(attemptKey,now,now,now)));
  if(attempts.length!==2||attempts.some(r=>!r.success))fail(503,'LOGIN_THROTTLE_UNAVAILABLE');
  for(let i=0;i<attempts.length;i++){const attempt=attempts[i].results[0];if(!attempt||!Number.isSafeInteger(attempt.attempts)||attempt.attempts>(i===0?10:60))fail(429,'LOGIN_RATE_LIMITED');}
  const rolePredicate=kind==='parent'?`AND EXISTS(SELECT 1 FROM user_roles rr WHERE rr.school_id=users.school_id AND rr.user_id=users.id AND rr.role='parent')`:kind==='teacher'?`AND EXISTS(SELECT 1 FROM user_roles rr WHERE rr.school_id=users.school_id AND rr.user_id=users.id AND rr.role='teacher')`:adminKey?`AND EXISTS(SELECT 1 FROM user_roles rr WHERE rr.school_id=users.school_id AND rr.user_id=users.id AND rr.role='admin')`:'';
  const user=await db(c).prepare(`SELECT users.*,COALESCE((SELECT json_group_array(r.role) FROM user_roles r WHERE r.school_id=users.school_id AND r.user_id=users.id),'[]') AS role_json FROM users WHERE school_id=? AND (lower(email)=lower(?) OR mobile=? OR EXISTS(SELECT 1 FROM parent_profiles pp WHERE pp.school_id=users.school_id AND pp.user_id=users.id AND pp.contact_mobile=?)) AND status='active' ${rolePredicate} ORDER BY CASE user_type WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 WHEN 'parent' THEN 2 ELSE 3 END LIMIT 1`).bind(school.id,identifier,identifier,identifier).first<User & {password_hash:string;hash_algorithm:string;legacy_usergroup_id:number|null;role_json:string}>();
  const roles=(()=>{try{return JSON.parse(user?.role_json || '[]') as string[];}catch{return [] as string[];}})();
  const allowed=kind==='parent'?['parent']:kind==='teacher'?['teacher']:memberKey?['teacher','parent','student','staff']:['admin','superadmin','staff'];
  if (!user || (!allowed.includes(user.user_type) && !allowed.some(role=>roles.includes(role)))) fail(401,'CREDENTIAL_REJECTED');
  let accessCredential:{id:string;credential_digest:string;expires_at:number}|null=null;
  if(accessLogin){
   if(adminKey&&user.user_type!=='admin')fail(401,'CREDENTIAL_REJECTED');
   if(memberKey&&!['teacher','parent','student','staff'].includes(user.user_type)&&!roles.some(role=>['teacher','parent','student','staff'].includes(role)))fail(401,'CREDENTIAL_REJECTED');
   if(!c.env.ADMIN_ACCESS_KEY_SECRET)fail(503,'ADMIN_ACCESS_NOT_CONFIGURED');
   accessCredential=adminKey?await db(c).prepare(`SELECT a.id,a.credential_digest,a.expires_at FROM admin_access_credentials a JOIN user_roles r ON r.school_id=a.school_id AND r.user_id=a.user_id AND r.role='admin' WHERE a.school_id=? AND a.user_id=? AND a.revoked_at IS NULL AND a.expires_at>unixepoch()`).bind(school.id,user.id).first():await db(c).prepare(`SELECT a.id,a.credential_digest,a.expires_at FROM user_access_credentials a JOIN user_roles r ON r.user_id=a.user_id AND r.school_id=a.school_id AND r.role=? WHERE a.school_id=? AND a.user_id=? AND a.revoked_at IS NULL AND a.expires_at>unixepoch()`).bind(user.user_type,school.id,user.id).first();
   if(!accessCredential||!(adminKey?await verifyAccessKey(body.password as string,accessCredential.credential_digest,c.env.ADMIN_ACCESS_KEY_SECRET,school.id,user.id):await verifyMemberKey(body.password as string,accessCredential.credential_digest,c.env.ADMIN_ACCESS_KEY_SECRET,school.id,user.id)))fail(401,'CREDENTIAL_REJECTED');
  }else {
   if(user.hash_algorithm==='hmac-sha256-generated'){
    if(c.env.GENERATED_PASSWORD_AUTH_ENABLED!=='true'||!c.env.ADMIN_ACCESS_KEY_SECRET||!await verifyGeneratedPassword(body.password,user.password_hash,c.env.ADMIN_ACCESS_KEY_SECRET,school.id,user.id))fail(401,'CREDENTIAL_REJECTED');
   }else{
    if(c.env.AUTH_CPU_VERIFIED!=='true')fail(503,'FREE_AUTH_CPU_VERIFICATION_REQUIRED');
    if(!await verifyPassword(body.password,user.password_hash,user.hash_algorithm)) fail(401,'CREDENTIAL_REJECTED');
   }
  }
  const sid=crypto.randomUUID(),exp=now+7200;
  const token=await signJwt({sub:user.id,sid,schoolId:school.id,schoolCode:school.code,userType:user.user_type,fullName:user.full_name,iat:now,exp,iss:'gurukull-edge',aud:'gurukull-clients',...(school.status!=='active'?{purpose:'school_setup'}:{}),...(accessCredential?{authMethod:adminKey?'admin_access_key':'member_access_key',credentialId:accessCredential.id}:{})},c.env.JWT_SECRET);
  const deviceId=typeof body.device_id==='string' && body.device_id.length<=128?body.device_id:null;
  const roleRows=await db(c).prepare('SELECT role FROM user_roles WHERE school_id=? AND user_id=?').bind(school.id,user.id).all<{role:string}>();
  const result=await db(c).prepare(`INSERT INTO sessions(id,school_id,user_id,token_digest,device_id,platform,expires_at,created_at) VALUES(?,?,?,?,?,'unknown',?,?)`).bind(sid,school.id,user.id,await digest(token),deviceId,exp,now).run();
  if (!result.success) fail(503,'SESSION_WRITE_FAILED');
  const permissions=roleRows.results.map(r=>r.role);
  const profile={id:user.id,name:user.full_name,email:user.email,mobile:user.mobile,usergroupId:user.legacy_usergroup_id,designation:null,roles:permissions.map(r=>r==='admin'?'schooladmin':r==='staff'?'nonteaching':r)};
  return c.json({status:'success',token,id:user.id,parent_id:user.id,user_email:user.email||'',user_name:user.full_name,permissions,user:profile,school:{name:school.name,status:school.status,code:school.code},sessionPurpose:school.status==='active'?'school':'school_setup'});
}
export async function logout(c: ApiContext) {
  const user=c.get('user'),claims=c.get('claims'),now=Math.floor(Date.now()/1000);
  const result=await db(c).batch([
    db(c).prepare(`UPDATE devices SET status='revoked',updated_at=? WHERE school_id=? AND user_id=? AND installation_id IN (SELECT device_id FROM sessions WHERE id=? AND school_id=? AND user_id=?)`).bind(now,user.school_id,user.id,claims.sid,user.school_id,user.id),
    db(c).prepare(`UPDATE sessions SET revoked_at=? WHERE id=? AND school_id=? AND user_id=? AND token_digest=?`).bind(now,claims.sid,user.school_id,user.id,c.get('tokenDigest')),
  ]);
  if (result.some(r=>!r.success)) fail(503,'SESSION_REVOCATION_FAILED');
  return c.json({status:'success',message:'Signed out successfully.'});
}
