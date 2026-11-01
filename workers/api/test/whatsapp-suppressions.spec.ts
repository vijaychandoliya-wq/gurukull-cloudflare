import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppSuppressions,suppressionInput} from '../src/whatsapp-suppressions.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-test-user')||'a',school_id:c.req.header('x-test-school')||'one',user_type:c.req.header('x-test-role')||'admin'});await next();}};
});
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schools(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,school_id TEXT,user_type TEXT,status TEXT);
 CREATE TABLE command_guards(id TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1));
 CREATE TABLE mutation_commands(school_id TEXT,actor_id TEXT,command_id TEXT,request_hash TEXT,response_json TEXT,created_at INTEGER,PRIMARY KEY(school_id,actor_id,command_id));
 CREATE TABLE audit_events(id TEXT PRIMARY KEY,school_id TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,created_at INTEGER);
 INSERT INTO schools VALUES('one'),('two');INSERT INTO users VALUES('a','one','admin','active'),('b','two','admin','active');`);
 for(const n of ['0031_school_whatsapp_drafts.sql','0032_whatsapp_consent.sql','0034_whatsapp_number_suppressions.sql'])sql.exec(readFileSync(new URL('../../../migrations/'+n,import.meta.url),'utf8'));
 sql.prepare("INSERT INTO school_whatsapp_drafts VALUES('one','+911111111111','School',1,'a',1)").run();
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const p={bind:(...v:any[])=>{values=v;return p;},first:async()=>sql.prepare(statement).get(...values)||null,all:async()=>({success:true,results:sql.prepare(statement).all(...values)}),run:()=>sql.prepare(statement).run(...values)};return p;},batch:async(stmts:any[])=>{sql.exec('BEGIN');try{for(const s of stmts)s.run();sql.exec('COMMIT');return stmts.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const app=new Hono<any>();registerWhatsAppSuppressions(app);
 const call=(method:string,body?:unknown,key='key1',school='one',user='a',role='admin')=>app.request('/api/admin/whatsapp/suppressions',{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-test-school':school,'x-test-user':user,'x-test-role':role},...(body?{body:JSON.stringify(body)}:{})},{DB});
 return {sql,call};
}
const base={senderPhone:'+911111111111',recipientPhone:'+919876543210',evidence:'Withdrawal register',version:0};
describe('school WhatsApp number-level opt-outs',()=>{
 it('requires valid phone numbers and evidence and does not permit clearing a block',()=>{
  expect(suppressionInput.safeParse(base).success).toBe(true);
  expect(suppressionInput.safeParse({...base,recipientPhone:'9876543210'}).success).toBe(false);
  expect(suppressionInput.safeParse({...base,evidence:' '}).success).toBe(false);
  expect(suppressionInput.safeParse({...base,state:'clear'}).success).toBe(false);
 });
 it('records a school-sender-phone block atomically with audit, handles retries and prevents cross-school access',async()=>{
  const {sql,call}=setup();try{
   let r=await call('PUT',base);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({data:{status:'blocked',version:1,sendingAvailable:false}});
   r=await call('PUT',base);expect(r.status).toBe(200);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_number_suppression_events').get() as any).n).toBe(1);
   r=await call('PUT',{...base,evidence:'Another reference'},'stale');expect(r.status).toBe(409);
   r=await call('PUT',{...base,senderPhone:'+913333333333'},'wrong-sender');expect(r.status).toBe(409);
   r=await call('GET',undefined,'x','two','b');expect(await r.json()).toMatchObject({data:[],sendingAvailable:false});
   r=await call('GET',undefined,'x','one','a','teacher');expect(r.status).toBe(403);
   expect(()=>sql.prepare("UPDATE whatsapp_number_suppressions SET updated_by='b' WHERE school_id='one'").run()).toThrow();
   sql.prepare("UPDATE school_whatsapp_drafts SET phone_e164='+912222222222' WHERE school_id='one'").run();
   r=await call('PUT',{...base,evidence:'Confirmed again',version:1},'repeat');expect(r.status).toBe(200);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_number_suppression_events').get() as any).n).toBe(2);
  }finally{sql.close();}
 });
});
