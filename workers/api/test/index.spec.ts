import { describe, it, expect, vi } from 'vitest';
import app from '../src/index.js';
import { signJwt, verifyJwt, verifyPassword, generatedPasswordDigest, verifyGeneratedPassword, money } from '../src/security.js';

// These identities exist only as nonpersisting boundary inputs. They are not ERP fixtures.
const secret='boundary-secret-with-at-least-32-bytes';
function claims(overrides:Record<string,unknown>={}) {
 const now=Math.floor(Date.now()/1000);
 return {sub:'boundary-user',sid:'boundary-session',schoolId:'boundary-school',schoolCode:'BOUNDARY',userType:'parent',fullName:'Boundary input',iat:now,exp:now+3600,iss:'gurukull-edge',aud:'gurukull-clients',...overrides};
}
function database(options:{session?:boolean;status?:string;role?:string;failWrites?:boolean;failReads?:boolean}={}) {
 const writes=vi.fn(async()=>{if(options.failWrites)throw new Error('write failed');return [{results:[]},{results:[{id:'boundary-device'}]}];});
 const first=vi.fn(async(sql:string)=>{
  if(options.failReads)throw new Error('read failed');
  if(sql==='SELECT * FROM schools WHERE code = ?')return {id:'boundary-school',code:'BOUNDARY',status:options.status||'active',name:'Boundary input'};
  if(sql.includes('FROM sessions ss'))return options.session===false?null:{id:'boundary-user',school_id:'boundary-school',user_type:options.role||'parent',full_name:'Boundary input'};
  if(sql.includes('SELECT 1 FROM sessions'))return {exists:1};
  return null;
 });
 const DB={prepare:(sql:string)=>{const statement={bind:(..._values:unknown[])=>statement,first:()=>first(sql),all:async()=>({results:[]}),run:async()=>{throw new Error('Unexpected write');}};return statement;},batch:writes};
 return {DB:DB as unknown as D1Database,writes,first};
}
const request=(path:string,token:string,init:RequestInit={},env:Record<string,unknown>={})=>app.request(`https://api.gurukull.in${path}`,{...init,headers:{Authorization:`Bearer ${token}`,...init.headers}}, {JWT_SECRET:secret,...env} as any);

describe('Authentication and API failure boundaries',()=>{
 it('retains no-store, request tracking and allowed CORS headers on denied requests',async()=>{
  const response=await app.request('https://api.gurukull.in/api/v2/myinfo',{headers:{Origin:'https://app.gurukull.in'}});
  expect(response.status).toBe(401);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(response.headers.get('x-request-id')).toBeTruthy();
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.gurukull.in');
 });
 it('reports shallow health without claiming dependency readiness',async()=>{
  const response=await app.request('/health');expect(response.status).toBe(200);expect((await response.json() as {runtime:string}).runtime).toBe('cloudflare-workers');
 });
 it('requires a real database for school discovery',async()=>{expect((await app.request('/api/v3/discovery/RAJESH')).status).toBe(503);});
 it('does not accept the former public fallback secret without configuration',async()=>{
  const token=await signJwt(claims(),'gurukul_edge_default_secret_key_2026');
  expect((await app.request('/api/teacher/myinfo',{headers:{Authorization:`Bearer ${token}`}})).status).toBe(503);
 });
 it('rejects forged signatures even with a database present',async()=>{
  const token=await signJwt(claims(),'gurukul_edge_default_secret_key_2026');const d=database();
  expect((await request('/api/v2/myinfo',token,{},d)).status).toBe(401);expect(d.first).not.toHaveBeenCalled();
 });
 it.each([{exp:undefined},{sid:undefined},{aud:'other-client'},{iss:'other-issuer'},{exp:1},{userType:'invented-role'}])('rejects incomplete or invalid claims %j',async override=>{
  expect(await verifyJwt(await signJwt(claims(override),secret),secret)).toBeNull();
 });
 it.each(['a.b.c','%.$.invalid','', 'abc..xyz'])('rejects malformed tokens without throwing %s',async token=>{expect(await verifyJwt(token,secret)).toBeNull();});
 it('retains Unicode identity through signing and validation',async()=>{const token=await signJwt(claims({fullName:'विद्यालय'}),secret);expect((await verifyJwt(token,secret))?.fullName).toBe('विद्यालय');});
 it('verifies an unchanged bcrypt cost-10 vector from the legacy 2.4.3 library',async()=>{
  // Pure interoperability vector; never a database user or login credential.
  const hash='$2a$10$Wfy.WzIE8m6d.WNHDtFbSu9q0Cev9CEZMB55yD3Y9pfE3A.5N2Lw6';
  expect(await verifyPassword('nonpersisting-bcrypt-boundary',hash,'bcrypt')).toBe(true);
  expect(await verifyPassword('different-boundary',hash,'bcrypt')).toBe(false);
  expect(await verifyPassword('nonpersisting-bcrypt-boundary',hash.replace('$2a$','$2y$'),'bcrypt')).toBe(true);
 });
 it('never silently upgrades acceptance of unsupported or weakened password hashes',async()=>{
  await expect(verifyPassword('boundary','unsupported','pbkdf2')).rejects.toThrow();
  await expect(verifyPassword('boundary','$2a$09$Wfy.WzIE8m6d.WNHDtFbSu9q0Cev9CEZMB55yD3Y9pfE3A.5N2Lw6','bcrypt')).rejects.toThrow();
 });
 it('verifies only school-and-user-bound generated passwords',async()=>{
  const password='Boundary-Generated-Password-8Q!'; const secret='boundary-generated-password-secret-more-than-32-bytes';
  const hash=await generatedPasswordDigest(password,secret,'school','user');
  expect(await verifyGeneratedPassword(password,hash,secret,'school','user')).toBe(true);
  expect(await verifyGeneratedPassword('wrong',hash,secret,'school','user')).toBe(false);
  expect(await verifyGeneratedPassword(password,hash,secret,'other-school','user')).toBe(false);
  expect(await verifyGeneratedPassword(password,hash,secret,'school','other-user')).toBe(false);
 });
 it('rejects revoked or absent sessions',async()=>{const d=database({session:false});expect((await request('/api/v2/myinfo',await signJwt(claims(),secret),{},d)).status).toBe(401);});
 it('rejects a role changed since token issuance',async()=>{const d=database({role:'teacher'});expect((await request('/api/v2/myinfo',await signJwt(claims(),secret),{},d)).status).toBe(401);});
 it('rejects mismatched header and token schools before business reads',async()=>{
  const d=database();expect((await request('/api/v2/myinfo',await signJwt(claims(),secret),{headers:{'x-school-code':'OTHER'}},d)).status).toBe(400);expect(d.first).not.toHaveBeenCalled();
 });
 it('rejects an unregistered school hostname',async()=>{
  const d=database();const token=await signJwt(claims(),secret);
  expect((await app.request('https://unknown.gurukull.in/api/v2/myinfo',{headers:{Authorization:`Bearer ${token}`}},{JWT_SECRET:secret,...d} as any)).status).toBe(404);
 });
 it('does not give a reserved school an authenticated empty ERP',async()=>{
  expect((await request('/api/v3/sync/bootstrap',await signJwt(claims(),secret),{},database({status:'configuration_needed'}))).status).toBe(403);
 });
 it('denies parent access to teacher and administrative endpoints',async()=>{
  for(const path of ['/api/teacher/myinfo','/api/admin/school','/api/admin/students','/api/admin/teachers','/platform/v1/schools/boundary-school'])expect((await request(path,await signJwt(claims(),secret),{},database())).status).toBe(403);
 });
 it('does not convert a failed device transaction into success',async()=>{
  const d=database({failWrites:true});const response=await request('/api/v3/devices/register',await signJwt(claims(),secret),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({installation_id:'boundary-installation',platform:'android',app_version:'1.0',fcm_token:'boundary-token-with-required-length-1234567890'})},d);
  expect(d.writes).toHaveBeenCalledOnce();expect(response.status).toBe(503);expect((await response.json() as {error:string}).error).toBe('SERVICE_UNAVAILABLE');
 });
 it('fails bootstrap explicitly until a complete authorized snapshot is implemented',async()=>{
  const response=await request('/api/v3/sync/bootstrap',await signJwt(claims(),secret),{},database());expect(response.status).toBe(503);expect((await response.json() as {error:string}).error).toBe('SYNC_SNAPSHOT_NOT_IMPLEMENTED');
 });
 it('rejects a foreign signed sync cursor',async()=>{
  const cursor=await signJwt(claims({sub:'other-user',cursor:true,seq:0}),secret);
  expect((await request(`/api/v3/sync/pull?cursor=${cursor}`,await signJwt(claims(),secret),{},database())).status).toBe(400);
 });
 it('rejects fractional, negative and unsafe stored money',()=>{for(const value of [0.5,-1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'100'])expect(()=>money(value)).toThrow();expect(money(100)).toBe(100);});
 it('never exposes unauthenticated provisioning statistics',async()=>{expect((await app.request('/platform/v1/schools/reservation')).status).toBe(401);});
});
