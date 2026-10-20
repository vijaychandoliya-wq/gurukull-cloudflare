import { describe,it,expect,vi,afterEach } from 'vitest';
import worker from '../src/index.js';
import { sanitizeLockScreenPayload,sendFcmNotification } from '../src/fcm.js';
import { processOutboxBatch } from '../src/outbox-consumer.js';

function database(event?:{event_type:string;payload_json:string}) {
 const mutations:{sql:string;values:unknown[]}[]=[];
 const DB={batch:vi.fn(async()=>[]),prepare:(sql:string)=>{
  let values:unknown[]=[];
  const stmt={bind:(...args:unknown[])=>{values=args;return stmt;},all:async()=>({results:sql.includes('RETURNING id,school_id')&&event?[{id:'boundary-event',school_id:'boundary-school',attempts:0,...event}]:[]}),run:async()=>{mutations.push({sql,values});return {success:true};}};
  return stmt;
 }};
 return {DB:DB as unknown as D1Database,mutations};
}
describe('Delivery safety boundaries',()=>{
 afterEach(()=>vi.restoreAllMocks());
 it('exposes shallow health',async()=>{expect((await worker.fetch(new Request('https://jobs.invalid/health'),{} as any,{} as any)).status).toBe(200);});
 it('denies unauthenticated manual dispatch',async()=>{expect((await worker.fetch(new Request('https://jobs.invalid/run',{method:'POST'}),{} as any,{} as any)).status).toBe(403);});
 it('drops all arbitrary private push content rather than matching selected patterns',()=>{
  const payload=sanitizeLockScreenPayload('Private student name','Student result 85; balance 500; medical record',{screen:'HOME',student_name:'private',balance:'500',event_id:'not-a-uuid'});
  expect(payload.title).toBe('School update');expect(payload.body).toBe('Open Gurukull to view your update.');expect(payload.data).toEqual({screen:'HOME'});
 });
 it('handles an empty claim without provider calls',async()=>{const d=database();expect(await processOutboxBatch(d)).toEqual({processed:0,succeeded:0,failed:0,deadLettered:0,prunedTokens:0});});
 it('does not complete delivery when credentials are absent',async()=>{
  const d=database({event_type:'push_notification',payload_json:'{}'});const result=await processOutboxBatch(d);
  expect(result.processed).toBe(1);expect(result.succeeded).toBe(0);expect(result.failed).toBe(1);
  expect(d.mutations.at(-1)?.values.slice(0,3)).toEqual(['pending',1,'FCM_NOT_CONFIGURED']);
 });
 it('dead letters unsupported events rather than silently completing them',async()=>{
  const d=database({event_type:'audit_log',payload_json:'{}'});const result=await processOutboxBatch(d);
  expect(result.succeeded).toBe(0);expect(result.deadLettered).toBe(1);expect(d.mutations.at(-1)?.values[0]).toBe('dead_letter');
 });
 it('surfaces an unavailable database',async()=>{await expect(processOutboxBatch({} as any)).rejects.toThrow('DATABASE_UNAVAILABLE');});
 it('does not interpret an arbitrary provider 404 as an invalid device token',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({error:{status:'NOT_FOUND'}},{status:404}));
  const result=await sendFcmNotification({project_id:'boundary-project',client_email:'',private_key:''},'nonpersisting-access-token','boundary-token',{title:'private',body:'private'});
  expect(result.status).toBe('failed');
 });
 it('requires a provider message ID before reporting a successful send',async()=>{
  vi.spyOn(globalThis,'fetch').mockResolvedValue(Response.json({}));
  await expect(sendFcmNotification({project_id:'boundary-project',client_email:'',private_key:''},'nonpersisting-access-token','boundary-token',{title:'private',body:'private'})).rejects.toThrow('PROVIDER_ACCEPTANCE_UNKNOWN');
 });
});
