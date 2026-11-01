import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppTemplates,whatsappTemplateDraftInput} from '../src/whatsapp-templates.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-test-user')||'a',school_id:c.req.header('x-test-school')||'one',user_type:c.req.header('x-test-role')||'admin'});await next();}};
});
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schools(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,school_id TEXT,user_type TEXT);
 CREATE TABLE command_guards(id TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1));
 CREATE TABLE mutation_commands(school_id TEXT,actor_id TEXT,command_id TEXT,request_hash TEXT,response_json TEXT,created_at INTEGER,PRIMARY KEY(school_id,actor_id,command_id));
 CREATE TABLE audit_events(id TEXT PRIMARY KEY,school_id TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,created_at INTEGER);
 INSERT INTO schools VALUES('one'),('two');INSERT INTO users VALUES('a','one','admin'),('b','two','admin');`);
 sql.exec(readFileSync(new URL('../../../migrations/0033_whatsapp_template_drafts.sql',import.meta.url),'utf8'));
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const p={bind:(...v:any[])=>{values=v;return p;},first:async()=>sql.prepare(statement).get(...values)||null,all:async()=>({success:true,results:sql.prepare(statement).all(...values)}),run:()=>sql.prepare(statement).run(...values)};return p;},batch:async(stmts:any[])=>{sql.exec('BEGIN');try{for(const s of stmts)s.run();sql.exec('COMMIT');return stmts.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const app=new Hono<any>();registerWhatsAppTemplates(app);
 const call=(method:string,body?:unknown,key='key1',school='one',user='a',role='admin')=>app.request(method==='GET'?'/api/admin/whatsapp/templates':'/api/admin/whatsapp/templates/draft',{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-test-school':school,'x-test-user':user,'x-test-role':role},...(body?{body:JSON.stringify(body)}:{})},{DB});
 return {sql,call};
}
const base={purpose:'school_notice',locale:'en',body:'Message from {{school_name}}',version:0};
describe('school WhatsApp template drafts',()=>{
 it('only accepts supported placeholders and never accepts an approval field',()=>{
  expect(whatsappTemplateDraftInput.safeParse(base).success).toBe(true);
  expect(whatsappTemplateDraftInput.safeParse({...base,body:'Hello {{student_name}}'}).success).toBe(false);
  expect(whatsappTemplateDraftInput.safeParse({...base,approved:true}).success).toBe(false);
 });
 it('saves versioned drafts, handles retries and stale edits, and isolates schools',async()=>{
  const {sql,call}=setup();try{
   let r=await call('PUT',base);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({data:{version:1,providerApproval:'not_verified',sendingAvailable:false}});
   r=await call('PUT',base);expect(r.status).toBe(200);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_template_draft_versions').get() as any).n).toBe(1);
   r=await call('PUT',{...base,body:'Updated',version:0},'stale');expect(r.status).toBe(409);
   r=await call('PUT',{...base,body:'Updated',version:1},'update');expect(r.status).toBe(200);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_template_draft_versions').get() as any).n).toBe(2);
   r=await call('GET',undefined,'x','two','b');expect(await r.json()).toMatchObject({data:[],providerApproval:'not_verified',sendingAvailable:false});
   r=await call('GET',undefined,'x','one','a','teacher');expect(r.status).toBe(403);
   expect(()=>sql.prepare("UPDATE whatsapp_template_drafts SET updated_by='b' WHERE school_id='one'").run()).toThrow();
  }finally{sql.close();}
 });
});
