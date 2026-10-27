import {describe,it,expect} from 'vitest';
import {passwordChangeInput,normalizePasswordChange} from '../src/password-management.js';
import {createUserPasswordHash,verifyGeneratedPassword,generatedPasswordDigest} from '../src/security.js';
import app from '../src/index.js';

// Nonpersisting scalar boundaries only. No test people/schools are seeded.
const passphrase='A unique passphrase for school access';
const pepper='nonpersisting-password-test-secret-at-least-32-bytes';
describe('own password contract and compatibility',()=>{
 it('accepts canonical web and both released app contracts',()=>{
  const canonical={currentPassword:'current scalar',newPassword:passphrase,confirmPassword:passphrase};
  for(const body of [canonical,{current_password:canonical.currentPassword,password:passphrase,password_confirmation:passphrase},{oldpassword:canonical.currentPassword,newpassword:passphrase,confirmpassword:passphrase}])expect(passwordChangeInput.parse(normalizePasswordChange(body))).toEqual(canonical);
 });
 it('rejects target identity injection and contradictory legacy aliases',()=>{
  expect(()=>normalizePasswordChange({userId:'another-account'})).toThrow();
  expect(()=>normalizePasswordChange({currentPassword:'one',oldpassword:'another'})).toThrow();
 });
 it('requires confirmation, a distinct long password and bounded input without trimming secrets',()=>{
  const base={currentPassword:'current scalar',newPassword:passphrase,confirmPassword:passphrase};
  for(const v of [{...base,newPassword:'short',confirmPassword:'short'},{...base,confirmPassword:'different'},{...base,currentPassword:passphrase},{...base,newPassword:' '.repeat(20),confirmPassword:' '.repeat(20)},{...base,newPassword:'x'.repeat(129),confirmPassword:'x'.repeat(129)}])expect(passwordChangeInput.safeParse(v).success).toBe(false);
  expect(passwordChangeInput.parse({...base,currentPassword:' unchanged spaces '} ).currentPassword).toBe(' unchanged spaces ');
 });
 it('requires authenticated sessions on every canonical/legacy route',async()=>{
  for(const path of ['/api/portal/password/change','/api/teacher/change/password','/api/v2/password/change','/v2/password/change','/platform/v1/password']){
   const response=await app.fetch(new Request('https://app.gurukull.in'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'}),{} as any);
   expect(response.status).toBe(401);
  }
 });
});
describe('salted account password hashing',()=>{
 it('uses unique bcrypt salts and rejects wrong passwords, tenant and account',async()=>{
  const [a,b]=await Promise.all([createUserPasswordHash(passphrase,pepper,'scalar-school','scalar-user'),createUserPasswordHash(passphrase,pepper,'scalar-school','scalar-user')]);
  expect(a).toMatch(/^bcrypt-v1:\$2[ab]\$12\$/);expect(a).not.toBe(b);
  expect(await verifyGeneratedPassword(passphrase,a,pepper,'scalar-school','scalar-user')).toBe(true);
  expect(await verifyGeneratedPassword('wrong password',a,pepper,'scalar-school','scalar-user')).toBe(false);
  expect(await verifyGeneratedPassword(passphrase,a,pepper,'other-school','scalar-user')).toBe(false);
  expect(await verifyGeneratedPassword(passphrase,a,pepper,'scalar-school','other-user')).toBe(false);
 },15000);
 it('does not truncate long Unicode passphrases and keeps generated-password login compatible',async()=>{
  const long='安全な長いパスフレーズ'.repeat(7),hash=await createUserPasswordHash(long,pepper,'scalar-school','scalar-user');
  expect(await verifyGeneratedPassword(long,hash,pepper,'scalar-school','scalar-user')).toBe(true);
  expect(await verifyGeneratedPassword(long+'!',hash,pepper,'scalar-school','scalar-user')).toBe(false);
  const old=await generatedPasswordDigest(passphrase,pepper,'scalar-school','scalar-user');
  expect(await verifyGeneratedPassword(passphrase,old,pepper,'scalar-school','scalar-user')).toBe(true);
  expect(await verifyGeneratedPassword(passphrase,'bcrypt-v1:invalid',pepper,'scalar-school','scalar-user')).toBe(false);
 },10000);
});

import {Hono} from 'hono';
import {changeOwnPassword} from '../src/password-management.js';
import type {AppEnv} from '../src/context.js';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';

// Nonpersisting service harness: statement preparation uses an empty migrated
// SQLite schema; mocked read boundaries never seed fabricated people.
async function serviceHarness(current:string,{attempts=1,race=false}={}){
 const captured:{sql:string;values:unknown[]}[]=[];
 const oldHash=await generatedPasswordDigest('old scalar password',pepper,'scalar-school','scalar-user');
 const database={prepare:(sql:string)=>({bind:(...values:unknown[])=>({sql,values,first:async()=>sql.includes('RETURNING attempts')?{attempts}:sql.includes('FROM users WHERE')?{id:'scalar-user',school_id:'scalar-school',user_type:'teacher',version:7,password_hash:'!',hash_algorithm:'bcrypt',generated_password_hash:oldHash}:null})}),batch:async(writes:any[])=>{
  if(race)throw new Error('CHECK constraint failed: valid');
  const schema=new DatabaseSync(':memory:');try{const folder=new URL('../../../migrations/',import.meta.url);for(const name of readdirSync(folder).filter(n=>n.endsWith('.sql')).sort())schema.exec(readFileSync(new URL(name,folder),'utf8'));for(const statement of writes){schema.prepare(statement.sql);captured.push(statement);}}finally{schema.close();}
  return writes.map(()=>({success:true}));
 }};
 const service=new Hono<AppEnv>();service.post('/change',async c=>{c.set('user',{id:'scalar-user',school_id:'scalar-school',user_type:'teacher',full_name:'Scalar',email:null,mobile:null});c.set('claims',{sid:'scalar-session'} as any);return changeOwnPassword(c);});
 const response=await service.fetch(new Request('https://app.gurukull.in/change',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({currentPassword:current,newPassword:passphrase,confirmPassword:passphrase})}),{DB:database,SELF_SERVICE_PASSWORD_ENABLED:'true',GENERATED_PASSWORD_AUTH_ENABLED:'true',ADMIN_ACCESS_KEY_SECRET:pepper} as any);
 return {response,captured};
}
describe('own-password service orchestration',()=>{
 it('writes only a salted digest, revokes sessions/keys/devices and cancels queued credentials in one batch',async()=>{
  const {response,captured}=await serviceHarness('old scalar password');expect(response.status).toBe(200);
  const body=await response.json() as any;expect(body.sessionsRevoked).toBe(true);expect(body.password).toBeUndefined();
  const update=captured.find(s=>s.sql.startsWith('UPDATE users'))!;
  expect(update.values.slice(-3)).toEqual(['scalar-school','scalar-user',7]);expect(String(update.values[0])).toMatch(/^bcrypt-v1:/);
  for(const table of ['sessions','devices','admin_access_credentials','user_access_credentials','platform_password_credentials','outbox'])expect(captured.some(s=>s.sql.startsWith('UPDATE '+table))).toBe(true);
  const serialized=JSON.stringify(captured);expect(serialized).not.toContain(passphrase);expect(serialized).not.toContain('old scalar password');expect(serialized).not.toContain('mutation_commands');
  expect(captured[0].sql).toContain('version=?');expect(captured[0].sql).toContain('expires_at>unixepoch()');
 },10000);
 it('never mutates credentials for wrong current proof or rate-limited attempts',async()=>{
  const wrong=await serviceHarness('incorrect scalar');expect(wrong.response.status).toBe(422);expect(wrong.captured).toHaveLength(0);
  const limited=await serviceHarness('old scalar password',{attempts:11});expect(limited.response.status).toBe(429);expect(limited.captured).toHaveLength(0);
 });
 it('reports a concurrent reset without presenting success',async()=>{
  const {response,captured}=await serviceHarness('old scalar password',{race:true});expect(response.status).toBe(409);expect(captured).toHaveLength(0);
 },10000);
});
