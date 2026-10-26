import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import app from '../src/index.js';
import {resolveSchool} from '../src/context.js';
describe('operational and tenant release boundaries',()=>{
 it('publishes source provenance without claiming dependency readiness',async()=>{
  const r=await app.request('/health',{}, {APP_RELEASE:'boundary-release',SOURCE_SHA:'boundary-sha'} as any);
  expect(await r.json()).toMatchObject({release:'boundary-release',sourceSha:'boundary-sha',status:'healthy'});
 });
 it('does not expose schema or queue readiness to anonymous callers',async()=>{
  expect((await app.request('/api/platform/readiness')).status).toBe(401);
 });
 it('school-branded SMVDIC host cannot select a different school',async()=>{
  const c:any={req:{url:'https://smvdic.gurukull.in/api/portal/login',header:()=>undefined},env:{TRUSTED_SHARED_HOSTS:'app.gurukull.in',DB:{prepare:()=>({bind:()=>({first:async()=>({id:'boundary-school',code:'051296'})})})}},set:()=>{}};
  await expect(resolveSchool(c,'108')).rejects.toMatchObject({status:400});
 });
 it('deploy configuration never classifies a school hostname as a shared API',()=>{
  const config=readFileSync('workers/api/wrangler.toml','utf8');
  for(const row of config.split('\n').filter(x=>x.startsWith('TRUSTED_SHARED_HOSTS')))expect(row).not.toMatch(/(?:rajesh|mggs|smvdic)\.gurukull\.in/);
 });
});
