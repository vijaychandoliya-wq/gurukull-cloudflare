import bcrypt from 'bcryptjs';
import type { Hono } from 'hono';
import { db,readBody,resolveSchool,type AppEnv,type ApiContext } from './context.js';
import { digest,fail } from './security.js';

export function validateEnrollment(body:Record<string,unknown>):{token:string;password:string} {
 if(typeof body.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(body.token))fail(422,'INVALID_ENROLLMENT_INPUT');
 if(typeof body.password!=='string'||body.password.length<12||new TextEncoder().encode(body.password).length>72)fail(422,'PASSWORD_POLICY_REQUIRED','Choose a password of at least 12 characters and at most 72 UTF-8 bytes.');
 return {token:body.token,password:body.password};
}
export function enrollmentTransaction(c:ApiContext,invite:{id:string;user_id:string;school_id:string},passwordHash:string,redemptionId:string) {
 const D=db(c),now=Math.floor(Date.now()/1000);
 return [
  D.prepare(`INSERT INTO admin_enrollment_guards(id,valid) SELECT ?,CASE WHEN EXISTS(SELECT 1 FROM admin_invitations i JOIN users u ON u.id=i.user_id AND u.school_id=i.school_id JOIN schools s ON s.id=i.school_id WHERE i.id=? AND i.school_id=? AND i.user_id=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>unixepoch() AND u.user_type='admin' AND u.status='invited' AND s.status IN ('configuration_needed','administrator_pending','active')) THEN 1 ELSE 0 END`).bind(redemptionId,invite.id,invite.school_id,invite.user_id),
  D.prepare(`UPDATE admin_invitations SET consumed_at=?,redemption_id=? WHERE id=? AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>unixepoch()`).bind(now,redemptionId,invite.id),
  D.prepare(`UPDATE users SET password_hash=?,hash_algorithm='bcrypt',status='active',updated_at=? WHERE id=? AND school_id=? AND status='invited' AND user_type='admin' AND EXISTS(SELECT 1 FROM admin_invitations WHERE id=? AND redemption_id=? AND consumed_at IS NOT NULL)`).bind(passwordHash,now,invite.user_id,invite.school_id,invite.id,redemptionId),
  D.prepare(`INSERT INTO user_roles(school_id,user_id,role) SELECT ?,?,'admin' WHERE EXISTS(SELECT 1 FROM users WHERE id=? AND school_id=? AND user_type='admin' AND status='active') ON CONFLICT DO NOTHING`).bind(invite.school_id,invite.user_id,invite.user_id,invite.school_id),
  D.prepare(`UPDATE admin_enrollment_guards SET valid=CASE WHEN EXISTS(SELECT 1 FROM users u JOIN admin_invitations i ON i.user_id=u.id AND i.school_id=u.school_id WHERE i.id=? AND i.redemption_id=? AND i.consumed_at IS NOT NULL AND u.id=? AND u.school_id=? AND u.password_hash=? AND u.hash_algorithm='bcrypt' AND u.status='active') THEN 1 ELSE 0 END WHERE id=?`).bind(invite.id,redemptionId,invite.user_id,invite.school_id,passwordHash,redemptionId),
  D.prepare('DELETE FROM admin_enrollment_guards WHERE id=?').bind(redemptionId)
 ];
}
export function registerEnrollment(app:Hono<AppEnv>) {
 app.post('/api/portal/enrollment/accept',async c=>{
  const body=await readBody(c),input=validateEnrollment(body),school=await resolveSchool(c,typeof body.schoolCode==='string'?body.schoolCode:undefined);
  const invite=await db(c).prepare(`SELECT i.id,i.user_id,i.school_id FROM admin_invitations i JOIN users u ON u.id=i.user_id AND u.school_id=i.school_id WHERE i.token_digest=? AND i.school_id=? AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>unixepoch() AND u.user_type='admin' AND u.status='invited'`).bind(await digest(input.token),school.id).first<{id:string;user_id:string;school_id:string}>();
  if(!invite)fail(403,'ENROLLMENT_INVALID_OR_EXPIRED');
  // New enrollment hashes have their own measured creation gate. Login measurements alone do not authorize bcrypt.hash.
  if(c.env.AUTH_CPU_VERIFIED!=='true'||c.env.ENROLLMENT_CPU_VERIFIED!=='true')fail(503,'FREE_ENROLLMENT_CPU_VERIFICATION_REQUIRED');
  const passwordHash=await bcrypt.hash(input.password,12),redemptionId=crypto.randomUUID();
  try {
   const results=await db(c).batch(enrollmentTransaction(c,invite,passwordHash,redemptionId));
   if(results.some(r=>!r.success))fail(503,'ENROLLMENT_WRITE_FAILED');
  }catch(error){
   const code=String(error);
   if(code.includes('CHECK constraint failed'))fail(409,'ENROLLMENT_ALREADY_USED_OR_CHANGED');
   throw error;
  }
  return c.json({status:'enrolled',schoolCode:school.code,schoolStatus:school.status,loginAvailable:school.status==='active',message:school.status==='active'?'Administrator enrolled. Sign in with your own password.':'Administrator enrolled. Confirm school configuration before activation.'},201);
 });
}
