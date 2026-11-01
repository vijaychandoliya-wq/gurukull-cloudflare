import type {Hono} from 'hono';
import {z} from 'zod';
import {db,readBody,requireAuth,requireRole,type ApiContext,type AppEnv} from './context.js';
import {parse,guard,cleanupGuards,audit} from './management-common.js';
import {digest,fail,verifyGeneratedPassword,verifyPassword,createUserPasswordHash} from './security.js';
import {validAccessKey,verifyAccessKey} from './admin-access.js';
import {validMemberKey,verifyMemberKey} from './member-access.js';

export const passwordChangeInput=z.object({
 currentPassword:z.string().min(1,'Enter your current password or access key.').max(256),
 newPassword:z.string().min(15,'Use at least 15 characters.').max(128,'Use no more than 128 characters.').refine(v=>v.trim().length>=15,'Use at least 15 non-padding characters.').refine(v=>!/^gk[au]1_/.test(v),'Choose a password rather than an access key.'),
 confirmPassword:z.string().max(128),
}).strict().superRefine((v,c)=>{
 if(v.newPassword!==v.confirmPassword)c.addIssue({code:'custom',path:['confirmPassword'],message:'The new passwords do not match.'});
 if(v.newPassword===v.currentPassword)c.addIssue({code:'custom',path:['newPassword'],message:'Choose a password different from your current password.'});
});
// Keep the released mobile contracts, but reject contradictory aliases and
// identity fields: the target always comes from the authenticated session.
export function normalizePasswordChange(body:Record<string,unknown>){
 const aliases={currentPassword:['currentPassword','current_password','old_password','oldpassword'],newPassword:['newPassword','password','new_password','newpassword'],confirmPassword:['confirmPassword','password_confirmation','confirmpassword']};
 const permitted=new Set(Object.values(aliases).flat());
 if(Object.keys(body).some(k=>!permitted.has(k)))fail(422,'INVALID_PASSWORD_FIELDS','Only current password, new password and confirmation are accepted.');
 const normalized:Record<string,unknown>={};
 for(const [name,keys] of Object.entries(aliases)){
  const values=keys.filter(k=>body[k]!==undefined).map(k=>body[k]);
  if(new Set(values).size>1)fail(422,'CONFLICTING_PASSWORD_FIELDS','The password fields contain conflicting values. Reload the form and try again.');
  normalized[name]=values[0];
 }
 return normalized;
}
type PasswordUser={id:string;school_id:string;user_type:string;version:number;password_hash:string;hash_algorithm:string;generated_password_hash:string|null};
async function matchesCurrent(c:ApiContext,user:PasswordUser,secret:string,platform:boolean){
 const pepper=c.env.ADMIN_ACCESS_KEY_SECRET!;
 if(validAccessKey(secret)&&user.user_type==='admin'){
  const row=await db(c).prepare('SELECT credential_digest FROM admin_access_credentials WHERE school_id=? AND user_id=? AND revoked_at IS NULL AND expires_at>unixepoch()').bind(user.school_id,user.id).first<{credential_digest:string}>();
  return !!row&&verifyAccessKey(secret,row.credential_digest,pepper,user.school_id,user.id);
 }
 if(validMemberKey(secret)){
  const row=await db(c).prepare('SELECT credential_digest FROM user_access_credentials WHERE school_id=? AND user_id=? AND revoked_at IS NULL AND expires_at>unixepoch()').bind(user.school_id,user.id).first<{credential_digest:string}>();
  return !!row&&verifyMemberKey(secret,row.credential_digest,pepper,user.school_id,user.id);
 }
 if(user.generated_password_hash&&(!platform||user.generated_password_hash.startsWith('bcrypt-v1:')))return verifyGeneratedPassword(secret,user.generated_password_hash,pepper,user.school_id,user.id);
 if(platform){
  const row=await db(c).prepare("SELECT password_hash FROM platform_password_credentials WHERE school_id=? AND user_id=? AND revoked_at IS NULL AND hash_algorithm='hmac-sha256-generated'").bind(user.school_id,user.id).first<{password_hash:string}>();
  return !!row&&verifyGeneratedPassword(secret,row.password_hash,c.env.PLATFORM_PASSWORD_SECRET||pepper,user.school_id,user.id);
 }
 if(user.password_hash==='!')return false;
 return verifyPassword(secret,user.password_hash,user.hash_algorithm);
}
export async function changeOwnPassword(c:ApiContext,platform=false){
 const actor=c.get('user');
 if(c.env.SELF_SERVICE_PASSWORD_ENABLED!=='true'||c.env.GENERATED_PASSWORD_AUTH_ENABLED!=='true'||!c.env.ADMIN_ACCESS_KEY_SECRET)fail(503,'PASSWORD_CHANGE_UNAVAILABLE','Password changes are temporarily unavailable. Contact your administrator.');
 if(platform)requireRole(c,'superadmin');
 if(platform&&!await db(c).prepare('SELECT 1 FROM platform_operators WHERE user_id=? AND revoked_at IS NULL').bind(actor.id).first())fail(403,'PLATFORM_PERMISSION_REQUIRED');
 const values=parse(passwordChangeInput,normalizePasswordChange(await readBody(c)));
 const attemptKey=await digest(JSON.stringify(['password-change',actor.school_id,actor.id])),now=Math.floor(Date.now()/1000);
 const attempt=await db(c).prepare(`INSERT INTO login_attempts(attempt_key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN window_start<=?-900 THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<=?-900 THEN excluded.window_start ELSE window_start END RETURNING attempts`).bind(attemptKey,now,now,now).first<{attempts:number}>();
 if(!attempt||attempt.attempts>10)fail(429,'PASSWORD_CHANGE_RATE_LIMITED','Too many password-change attempts. Wait 15 minutes before trying again.');
 const user=await db(c).prepare("SELECT id,school_id,user_type,version,password_hash,hash_algorithm,generated_password_hash FROM users WHERE school_id=? AND id=? AND status='active'").bind(actor.school_id,actor.id).first<PasswordUser>();
 if(!user)fail(401,'SESSION_REVOKED','Sign in again before changing your password.');
 if(!await matchesCurrent(c,user,values.currentPassword,platform))fail(422,'CURRENT_PASSWORD_INCORRECT','Your current password or access key is incorrect. No changes were saved.');
 const hash=await createUserPasswordHash(values.newPassword,c.env.ADMIN_ACCESS_KEY_SECRET,actor.school_id,actor.id),g=crypto.randomUUID();
 // One D1 transaction prevents a concurrent reset from being overwritten and
 // revokes every session/key atomically. Never persist request passwords or a
 // fast digest of them in the generic idempotency store.
 try{
  const writes=[guard(c,"EXISTS(SELECT 1 FROM users WHERE school_id=? AND id=? AND version=? AND status='active') AND EXISTS(SELECT 1 FROM sessions WHERE school_id=? AND user_id=? AND id=? AND revoked_at IS NULL AND expires_at>unixepoch())",[actor.school_id,actor.id,user.version,actor.school_id,actor.id,c.get('claims').sid],g),
   db(c).prepare('UPDATE users SET generated_password_hash=?,version=version+1,updated_at=? WHERE school_id=? AND id=? AND version=?').bind(hash,now,actor.school_id,actor.id,user.version),
   db(c).prepare('UPDATE admin_access_credentials SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,actor.school_id,actor.id),
   db(c).prepare('UPDATE user_access_credentials SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,actor.school_id,actor.id),
   db(c).prepare('UPDATE platform_password_credentials SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,actor.school_id,actor.id),
   db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,actor.school_id,actor.id),
   db(c).prepare("UPDATE devices SET status='revoked',updated_at=? WHERE school_id=? AND user_id=? AND status='active'").bind(now,actor.school_id,actor.id),
   db(c).prepare("UPDATE outbox SET status='dead_letter',last_error='Credential replaced by account owner',payload_json='{}',lease_id=NULL,lease_until=NULL WHERE school_id=? AND aggregate_id=? AND event_type='email_credentials' AND status IN ('pending','processing','failed')").bind(actor.school_id,actor.id),
   audit(c,'change_own_password','user',actor.id),cleanupGuards(c,g)];
  const results=await db(c).batch(writes);if(results.some(r=>!r.success))fail(503,'PASSWORD_CHANGE_FAILED','Password could not be changed. Try signing in before retrying.');
 }catch(e){if(String(e).includes('CHECK constraint'))fail(409,'PASSWORD_CHANGE_CONFLICT','Your account changed during this request. Sign in again before retrying.');throw e;}
 c.header('Cache-Control','no-store');
 return c.json({status:'success',success:true,message:'Password changed. Sign in again with your new password on all devices.',sessionsRevoked:true});
}
export function registerPasswordManagement(app:Hono<AppEnv>){
 app.on('POST',['/api/portal/password/change','/api/teacher/change/password','/api/v2/password/change','/v2/password/change'],requireAuth,c=>changeOwnPassword(c));
 app.post('/platform/v1/password',requireAuth,c=>changeOwnPassword(c,true));
}
