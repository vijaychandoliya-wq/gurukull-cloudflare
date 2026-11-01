import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppMessageDrafts,whatsappMessageDraftInput} from '../src/whatsapp-message-drafts.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-test-user')||'a',school_id:c.req.header('x-test-school')||'one',user_type:c.req.header('x-test-role')||'admin'});await next();}};
});
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schools(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,school_id TEXT,user_type TEXT,status TEXT,full_name TEXT);
 CREATE TABLE user_roles(school_id TEXT,user_id TEXT,role TEXT);
 CREATE TABLE command_guards(id TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1));
 CREATE TABLE mutation_commands(school_id TEXT,actor_id TEXT,command_id TEXT,request_hash TEXT,response_json TEXT,created_at INTEGER,PRIMARY KEY(school_id,actor_id,command_id));
 CREATE TABLE audit_events(id TEXT PRIMARY KEY,school_id TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,created_at INTEGER);
 CREATE TABLE outbox(id TEXT PRIMARY KEY);
 INSERT INTO schools VALUES('one'),('two');INSERT INTO users VALUES('a','one','admin','active','Admin'),('p','one','parent','active','Parent'),('b','two','admin','active','Other admin'),('q','two','parent','active','Other parent');`);
 for(const n of ['0031_school_whatsapp_drafts.sql','0033_whatsapp_template_drafts.sql','0035_whatsapp_message_drafts.sql'])sql.exec(readFileSync(new URL('../../../migrations/'+n,import.meta.url),'utf8'));
 sql.exec(`INSERT INTO school_whatsapp_drafts VALUES('one','+911111111111','School',1,'a',1);
 INSERT INTO whatsapp_template_drafts VALUES('one','school_notice','en','Old text',1,'a',1);
 INSERT INTO whatsapp_template_draft_versions VALUES('one','school_notice','en','Old text',1,'a',1);`);
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const p={bind:(...v:any[])=>{values=v;return p;},first:async()=>sql.prepare(statement).get(...values)||null,all:async()=>({success:true,results:sql.prepare(statement).all(...values)}),run:()=>sql.prepare(statement).run(...values)};return p;},batch:async(stmts:any[])=>{sql.exec('BEGIN');try{for(const s of stmts)s.run();sql.exec('COMMIT');return stmts.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const app=new Hono<any>();registerWhatsAppMessageDrafts(app);
 const call=(method:string,body?:unknown,key='key1',school='one',user='a',role='admin')=>app.request('/api/admin/whatsapp/message-drafts',{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-test-school':school,'x-test-user':user,'x-test-role':role},...(body?{body:JSON.stringify(body)}:{})},{DB});
 return {sql,call};
}
const base={recipientId:'p',senderPhone:'+911111111111',recipientPhone:'+919876543210',purpose:'school_notice',locale:'en',templateVersion:1};
describe('WhatsApp message request drafts',()=>{
 it('rejects fields that imply approval or sending',()=>{
  expect(whatsappMessageDraftInput.safeParse(base).success).toBe(true);
  expect(whatsappMessageDraftInput.safeParse({...base,status:'sent'}).success).toBe(false);
 });
 it('creates an idempotent draft only, preserves the template version and enforces tenant guards',async()=>{
  const {sql,call}=setup();try{
   let r=await call('POST',base);expect(r.status).toBe(200);const first=await r.json() as any;expect(first).toMatchObject({data:{status:'draft_only',sendingAvailable:false}});
   r=await call('POST',base);expect((await r.json() as any).data.id).toBe(first.data.id);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_message_drafts').get() as any).n).toBe(1);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM outbox').get() as any).n).toBe(0);
   sql.exec("UPDATE whatsapp_template_drafts SET body='New text',version=2 WHERE school_id='one'; INSERT INTO whatsapp_template_draft_versions VALUES('one','school_notice','en','New text',2,'a',2)");
   r=await call('POST',base,'stale');expect(r.status).toBe(409);
   r=await call('POST',{...base,recipientId:'q',templateVersion:2},'foreign');expect(r.status).toBe(409);
   r=await call('GET',undefined,'x','two','b');expect(await r.json()).toMatchObject({data:[],status:'draft_only',sendingAvailable:false});
   r=await call('GET',undefined,'x','one','a','teacher');expect(r.status).toBe(403);
   expect((sql.prepare('SELECT template_version AS v FROM whatsapp_message_drafts').get() as any).v).toBe(1);
  }finally{sql.close();}
 });
});
