import {hmacKey} from './hmac-key.js';
import type {Hono} from 'hono';
import {z} from 'zod';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {decode,encode,fail,generatedPasswordDigest} from './security.js';
import {audit,parse} from './management-common.js';
import {sendWhatsAppPassword} from './whatsapp.js';
import {credentialEmailStatement, encryptCredentialEnvelope} from './email-delivery.js';
export function validMemberKey(v:unknown):v is string{if(typeof v!=='string'||!/^gku1_[A-Za-z0-9_-]{43}$/.test(v))return false;try{const raw=decode(v.slice(5));return raw.length===32&&encode(raw)===v.slice(5);}catch{return false;}}
async function cryptoKey(secret:string){if(new TextEncoder().encode(secret).length<32)fail(503,'MEMBER_ACCESS_NOT_CONFIGURED');return hmacKey(secret);}
const boundMessage=(key:string,school:string,user:string)=>new TextEncoder().encode(JSON.stringify(['gurukull-member-access-v1',school,user,key]));
const passwordAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
export function generateTemporaryPassword(length=20){
 if(!Number.isInteger(length)||length<16||length>48)throw new Error('INVALID_PASSWORD_LENGTH');
 const bytes=crypto.getRandomValues(new Uint8Array(length));
 const required=['ABCDEFGHJKLMNPQRSTUVWXYZ','abcdefghijkmnopqrstuvwxyz','23456789','!@#$%'];
 const chars=required.map((set,i)=>set[bytes[i]%set.length]);
 chars.push(...Array.from(bytes.slice(4),b=>passwordAlphabet[b%passwordAlphabet.length]));
 return chars.slice(0,length).join('');
}
export async function memberKeyDigest(key:string,secret:string,school:string,user:string){if(!validMemberKey(key))throw new Error('GENERATED_256_BIT_KEY_REQUIRED');return encode(new Uint8Array(await crypto.subtle.sign('HMAC',await cryptoKey(secret),boundMessage(key,school,user))));}
export async function verifyMemberKey(key:string,stored:string,secret:string,school:string,user:string){if(!validMemberKey(key))return false;const imported=await cryptoKey(secret);try{return await crypto.subtle.verify('HMAC',imported,decode(stored),boundMessage(key,school,user));}catch{return false;}}
export function registerMemberAccess(app:Hono<AppEnv>){
 app.get('/api/admin/users',requireAuth,async c=>{const u=requireRole(c,'admin');const result=await db(c).prepare(`SELECT u.id,u.full_name AS name,u.email,COALESCE(pp.contact_mobile,u.mobile) AS mobile,u.user_type AS role,u.status,u.version,a.expires_at AS keyExpiresAt,a.revoked_at AS keyRevokedAt,CASE WHEN a.id IS NULL THEN 0 ELSE 1 END AS keyIssued,CASE WHEN (u.generated_password_hash IS NOT NULL OR (u.password_hash IS NOT NULL AND u.password_hash!='!')) THEN 1 ELSE 0 END AS passwordSet,(SELECT MAX(created_at) FROM audit_events x WHERE x.school_id=u.school_id AND x.entity_type='user' AND x.entity_id=u.id AND x.action IN ('generate_password','generate_password_whatsapp','generate_password_email','change_own_password')) AS passwordIssuedAt,(SELECT x.action FROM audit_events x WHERE x.school_id=u.school_id AND x.entity_type='user' AND x.entity_id=u.id AND x.action IN ('generate_password','generate_password_whatsapp','generate_password_email','change_own_password') ORDER BY x.created_at DESC,x.id DESC LIMIT 1) AS passwordLastAction FROM users u LEFT JOIN parent_profiles pp ON pp.user_id=u.id AND pp.school_id=u.school_id LEFT JOIN user_access_credentials a ON a.user_id=u.id AND a.school_id=u.school_id WHERE u.school_id=? ORDER BY u.user_type,u.full_name LIMIT 500`).bind(u.school_id).all();return c.json({data:result.results});});
 app.post('/api/admin/users/:id/access-key',requireAuth,async c=>{
  const u=requireRole(c,'admin'),target=c.req.param('id');parse(z.object({action:z.literal('issue')}).strict(),await readBody(c));
  const user=await db(c).prepare("SELECT u.id,u.email,COALESCE(pp.contact_mobile,u.mobile) AS mobile,u.user_type FROM users u LEFT JOIN parent_profiles pp ON pp.user_id=u.id AND pp.school_id=u.school_id WHERE u.id=? AND u.school_id=? AND u.user_type IN ('teacher','staff','parent','student') AND u.status='active'").bind(target,u.school_id).first<{id:string;email:string|null;mobile:string|null;user_type:string}>();if(!user)fail(404,'MEMBER_NOT_FOUND');if(!user.email&&!user.mobile)fail(409,'MEMBER_CONTACT_REQUIRED');
  if(c.env.ADMIN_ACCESS_KEY_CPU_VERIFIED!=='true')fail(503,'ACCESS_CPU_VERIFICATION_REQUIRED');
  if(!c.env.ADMIN_ACCESS_KEY_SECRET)fail(503,'MEMBER_ACCESS_NOT_CONFIGURED');
  const accessKey='gku1_'+encode(crypto.getRandomValues(new Uint8Array(32))),tag=await memberKeyDigest(accessKey,c.env.ADMIN_ACCESS_KEY_SECRET,u.school_id,user.id),id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),expires=now+7776000;
  const result=await db(c).batch([
   db(c).prepare('INSERT INTO user_access_credentials VALUES(?,?,?,?,?,?,?,NULL) ON CONFLICT(school_id,user_id) DO UPDATE SET id=excluded.id,credential_digest=excluded.credential_digest,issued_by=excluded.issued_by,created_at=excluded.created_at,expires_at=excluded.expires_at,revoked_at=NULL').bind(id,u.school_id,user.id,tag,u.id,now,expires),
   db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,u.school_id,user.id),audit(c,'issue_access_key','user',user.id)
  ]);if(result.some(r=>!r.success))fail(503,'CREDENTIAL_WRITE_FAILED');
  return c.json({data:{accessKey,identifier:user.email||user.mobile,schoolCode:c.get('school').code,expiresAt:new Date(expires*1000).toISOString()},message:'Copy this generated access key to a password manager and hand it to this person privately. It is displayed once; issuing again replaces it and revokes existing sessions.'});
 });
 app.post('/api/admin/users/:id/revoke-access',requireAuth,async c=>{const u=requireRole(c,'admin'),target=c.req.param('id');parse(z.object({action:z.literal('revoke')}).strict(),await readBody(c));if(!await db(c).prepare("SELECT id FROM users WHERE id=? AND school_id=? AND user_type IN ('teacher','staff','parent','student')").bind(target,u.school_id).first())fail(404,'MEMBER_NOT_FOUND');const now=Math.floor(Date.now()/1000);const results=await db(c).batch([db(c).prepare('UPDATE user_access_credentials SET revoked_at=? WHERE school_id=? AND user_id=?').bind(now,u.school_id,target),db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=?').bind(now,u.school_id,target),audit(c,'revoke_access','user',target)]);if(results.some(r=>!r.success))fail(503,'CREDENTIAL_REVOCATION_FAILED');return c.json({message:'Access key and all current sessions revoked.'});});
 app.post('/api/admin/users/:id/password',requireAuth,async c=>{
  const u=requireRole(c,'admin'),target=c.req.param('id');
  const input=parse(z.object({action:z.enum(['generate','generate_and_send','generate_and_email']),version:z.number().int().positive()}).strict(),await readBody(c));
  if(c.env.GENERATED_PASSWORD_AUTH_ENABLED!=='true'||!c.env.ADMIN_ACCESS_KEY_SECRET)fail(503,'PASSWORD_AUTH_NOT_CONFIGURED','Generated passwords are disabled until the Free-compatible password secret is configured.');
  const user=await db(c).prepare("SELECT u.id,u.full_name,u.user_type,u.version,u.status,u.email,COALESCE(pp.contact_mobile,u.mobile) AS mobile FROM users u LEFT JOIN parent_profiles pp ON pp.school_id=u.school_id AND pp.user_id=u.id WHERE u.id=? AND u.school_id=? AND u.user_type IN ('teacher','staff','parent','student')").bind(target,u.school_id).first<{id:string;full_name:string;user_type:string;version:number;status:string;email:string|null;mobile:string|null}>();
  if(!user)fail(404,'MEMBER_NOT_FOUND');
  if(input.action==='generate_and_send'&&!['teacher','parent'].includes(user.user_type))fail(422,'WHATSAPP_PASSWORD_ROLE_NOT_SUPPORTED','WhatsApp password delivery is available for teachers and parents.');
  if(input.action==='generate_and_email'&&!user.email)fail(409,'MEMBER_EMAIL_REQUIRED','This account has no email address. Add an email before sending login details.');
  if(user.status!=='active')fail(409,'MEMBER_NOT_ACTIVE');
  if(user.version!==input.version)fail(409,'RECORD_CHANGED','Reload this account before generating a password.');
  if(input.action==='generate_and_send'&&!user.mobile)fail(409,'MEMBER_CONTACT_REQUIRED','This teacher or parent has no mobile number.');
  const password=generateTemporaryPassword(),hash=await generatedPasswordDigest(password,c.env.ADMIN_ACCESS_KEY_SECRET,u.school_id,user.id),now=Math.floor(Date.now()/1000);
  if(input.action==='generate_and_send')await sendWhatsAppPassword(c.env,{schoolName:c.get('school').name,schoolCode:c.get('school').code,mobile:user.mobile!,password,loginUrl:`https://${c.get('school').slug}.gurukull.in/login`});
  const emailEventId=input.action==='generate_and_email'?crypto.randomUUID():null;
  const encryptedEmailPayload=emailEventId?await encryptCredentialEnvelope(c.env,{eventId:emailEventId,aggregateId:user.id,schoolId:u.school_id,recipient:user.email!,schoolName:c.get('school').name,schoolCode:c.get('school').code,fullName:user.full_name,role:user.user_type,identifier:user.email!,password,loginUrl:`https://${c.get('school').slug}.gurukull.in/login`}):null;
  const writes=[
   db(c).prepare("UPDATE users SET generated_password_hash=?,version=version+1,updated_at=? WHERE id=? AND school_id=? AND user_type IN ('teacher','staff','parent','student') AND status='active' AND version=?").bind(hash,now,target,u.school_id,input.version),
   db(c).prepare('UPDATE user_access_credentials SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,u.school_id,target),
   db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now,u.school_id,target),
   audit(c,input.action==='generate_and_send'?'generate_password_whatsapp':input.action==='generate_and_email'?'generate_password_email':'generate_password','user',target),
  ];
  if(emailEventId&&encryptedEmailPayload)writes.push(credentialEmailStatement(db(c),{eventId:emailEventId,aggregateId:user.id,schoolId:u.school_id,recipient:user.email!,schoolName:c.get('school').name,schoolCode:c.get('school').code,fullName:user.full_name,role:user.user_type,identifier:user.email!,password,loginUrl:`https://${c.get('school').slug}.gurukull.in/login`},encryptedEmailPayload));
  const results=await db(c).batch(writes);
  if(results.some(r=>!r.success))fail(503,'PASSWORD_WRITE_FAILED');
  const identifier=['teacher','parent'].includes(user.user_type)?user.mobile:user.email||user.mobile;
  return c.json({data:input.action==='generate'?{password,identifier,version:input.version+1}:input.action==='generate_and_email'?{identifier,version:input.version+1,email:{status:'queued'}}:{identifier,version:input.version+1,whatsapp:{status:'sent'}},message:input.action==='generate'?'Generated password shown once. Existing access keys and sessions were revoked.':input.action==='generate_and_email'?'Generated password and queued it for email delivery. Existing access keys and sessions were revoked.':'Generated password and sent it to the registered mobile by WhatsApp. Existing access keys and sessions were revoked.'});
 });
}
