import {describe,it,expect,vi} from 'vitest';
import {accessKeyDigest,verifyAccessKey,validAccessKey,setupRequestAllowed} from '../src/admin-access.js';
import {encode,signJwt} from '../src/security.js';
import app from '../src/index.js';
const credential='gka1_'+encode(new Uint8Array(32).fill(9)),secret='nonpersisting-access-secret-at-least-32-bytes';
describe('Administrator generated access-key security',()=>{
 it('accepts only canonical 32-byte token encoding, never an ordinary password',()=>{
  expect(validAccessKey(credential)).toBe(true);
  for(const value of ['ordinary-strong-password','gka1_'+'A'.repeat(42),'gka1_'+'A'.repeat(42)+'B',credential+'=',null])expect(validAccessKey(value)).toBe(false);
 });
 it('cryptographically binds credentials to school, identity and secret',async()=>{
  const tag=await accessKeyDigest(credential,secret,'nonpersisting-school','nonpersisting-user');
  expect(await verifyAccessKey(credential,tag,secret,'nonpersisting-school','nonpersisting-user')).toBe(true);
  expect(await verifyAccessKey(credential,tag,secret,'foreign-school','nonpersisting-user')).toBe(false);
  expect(await verifyAccessKey(credential,tag,secret,'nonpersisting-school','foreign-user')).toBe(false);
  expect(await verifyAccessKey(credential,tag,secret+'changed','nonpersisting-school','nonpersisting-user')).toBe(false);
  expect(await verifyAccessKey('gka1_'+encode(new Uint8Array(32).fill(8)),tag,secret,'nonpersisting-school','nonpersisting-user')).toBe(false);
  expect(await verifyAccessKey(credential,'malformed',secret,'nonpersisting-school','nonpersisting-user')).toBe(false);
 });
 it('requires a strong owner secret and does not issue hashes of chosen passwords',async()=>{
  await expect(accessKeyDigest(credential,'short','school','user')).rejects.toThrow();
  await expect(accessKeyDigest('chosen-password',secret,'school','user')).rejects.toThrow();
 });
 it('restricts unconfigured sessions to owner setup management and logout',()=>{
  expect(setupRequestAllowed('GET','/api/admin/dashboard')).toBe(true);
  expect(setupRequestAllowed('POST','/api/v2/logout')).toBe(true);
  for(const [method,path] of [['GET','/api/v3/sync/bootstrap'],['POST','/api/v3/storage/upload'],['GET','/platform/v1/schools/x'],['DELETE','/api/admin/students/x']])expect(setupRequestAllowed(method,path)).toBe(false);
 });
 it('never turns an access key into a bearer session',async()=>{expect((await app.request('/api/admin/profile',{headers:{Authorization:'Bearer '+credential}},{JWT_SECRET:secret} as any)).status).toBe(401);});
 it.each(['/api/admin/dashboard','/api/admin/features'])('denies anonymous administrator reads %s',async path=>{expect((await app.request(path)).status).toBe(401);});
 it('revoked credentials invalidate an otherwise current session before dashboard reads',async()=>{
  const now=Math.floor(Date.now()/1000),token=await signJwt({sub:'nonpersisting-user',sid:'nonpersisting-session',schoolId:'nonpersisting-school',schoolCode:'BOUNDARY',userType:'admin',fullName:'Nonpersisting boundary',iat:now,exp:now+7200,iss:'gurukull-edge',aud:'gurukull-clients',purpose:'school_setup',authMethod:'admin_access_key',credentialId:'revoked-credential'},secret);
  const batch=vi.fn();
  const DB={prepare:(sql:string)=>{const stmt={bind:()=>stmt,first:async()=>sql.includes('FROM schools')?{id:'nonpersisting-school',code:'BOUNDARY',status:'configuration_needed'}:sql.includes('FROM sessions ss')?{id:'nonpersisting-user',school_id:'nonpersisting-school',user_type:'admin'}:null};return stmt;},batch};
  const response=await app.request('https://api.gurukull.in/api/admin/dashboard',{headers:{Authorization:'Bearer '+token}},{JWT_SECRET:secret,DB} as any);
  expect(response.status).toBe(401);expect(batch).not.toHaveBeenCalled();
 });
 it('issues an explicitly restricted setup session only after genuine key verification (nonpersisting DB boundary stub)',async()=>{
  const tag=await accessKeyDigest(credential,secret,'nonpersisting-school','nonpersisting-user');
  const writes=vi.fn(async()=>({success:true}));
  const DB={prepare:(sql:string)=>{const stmt={bind:()=>stmt,first:async()=>{
   if(sql.includes('FROM schools'))return {id:'nonpersisting-school',code:'BOUNDARY',status:'configuration_needed',name:'Boundary input'};
   if(sql.includes('RETURNING attempts'))return {attempts:1};
   if(sql.includes('FROM users WHERE school_id'))return {id:'nonpersisting-user',school_id:'nonpersisting-school',full_name:'Nonpersisting boundary',user_type:'admin',email:'boundary@example.invalid',mobile:null};
   if(sql.includes('FROM admin_access_credentials'))return {id:'nonpersisting-credential',credential_digest:tag,expires_at:Math.floor(Date.now()/1000)+3600};
   return null;
  },all:async()=>({results:[{role:'admin'}]}),run:writes};return stmt;},batch:async()=>[{success:true,results:[{attempts:1}]},{success:true,results:[{attempts:1}]}]};
  const response=await app.request('https://api.gurukull.in/api/portal/login',{method:'POST',headers:{'Content-Type':'application/json','x-school-code':'BOUNDARY'},body:JSON.stringify({email:'boundary@example.invalid',password:credential})},{JWT_SECRET:secret,ADMIN_ACCESS_KEY_SECRET:secret,ADMIN_ACCESS_KEY_CPU_VERIFIED:'true',DB} as any);
  expect(response.status).toBe(200);const data=await response.json() as any;
  expect(data.sessionPurpose).toBe('school_setup');expect(data.user.roles).toEqual(['schooladmin']);expect(writes).toHaveBeenCalledOnce();
  const denied=await app.request('https://api.gurukull.in/api/v3/storage/upload',{method:'POST',headers:{Authorization:'Bearer '+data.token}},{JWT_SECRET:secret,DB} as any);
  expect(denied.status).toBe(401); // Stub has no persisted session: scalar login is not real acceptance.
 });
});
