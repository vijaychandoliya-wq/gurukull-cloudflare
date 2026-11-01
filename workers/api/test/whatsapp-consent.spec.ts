import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppConnection,whatsappConsentInput} from '../src/whatsapp-connection.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-test-user')||'a',school_id:c.req.header('x-test-school')||'one',user_type:c.req.header('x-test-role')||'admin'});await next();}};
});
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schools(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,school_id TEXT,user_type TEXT,status TEXT);
 CREATE TABLE user_roles(school_id TEXT,user_id TEXT,role TEXT);
 CREATE TABLE command_guards(id TEXT PRIMARY KEY,valid INTEGER CHECK(valid=1));
 CREATE TABLE mutation_commands(school_id TEXT,actor_id TEXT,command_id TEXT,request_hash TEXT,response_json TEXT,created_at INTEGER,PRIMARY KEY(school_id,actor_id,command_id));
 CREATE TABLE audit_events(id TEXT PRIMARY KEY,school_id TEXT,actor_id TEXT,action TEXT,entity_type TEXT,entity_id TEXT,created_at INTEGER);
 INSERT INTO schools VALUES('one'),('two');INSERT INTO users VALUES('a','one','admin','active'),('p','one','parent','active'),('b','two','admin','active'),('q','two','parent','active');`);
 for(const n of ['0031_school_whatsapp_drafts.sql','0032_whatsapp_consent.sql'])sql.exec(readFileSync(new URL('../../../migrations/'+n,import.meta.url),'utf8'));
 sql.prepare("INSERT INTO school_whatsapp_drafts VALUES('one','+911111111111','School',1,'a',1)").run();
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const p={bind:(...v:any[])=>{values=v;return p;},first:async()=>sql.prepare(statement).get(...values)||null,all:async()=>({success:true,results:sql.prepare(statement).all(...values)}),run:()=>sql.prepare(statement).run(...values)};return p;},batch:async(stmts:any[])=>{sql.exec('BEGIN');try{for(const s of stmts)s.run();sql.exec('COMMIT');return stmts.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const app=new Hono<any>();registerWhatsAppConnection(app);
 const call=(method:string,path:string,body?:unknown,key='key1',school='one',user='a',role='admin')=>app.request(path,{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-test-school':school,'x-test-user':user,'x-test-role':role},...(body?{body:JSON.stringify(body)}:{})},{DB});
 return {sql,call};
}
const base={recipientId:'p',senderPhone:'+911111111111',recipientPhone:'+919876543210',purpose:'school_notice',state:'granted',source:'written',evidence:'Consent register',explicitConsent:true,version:0};
describe('WhatsApp consent evidence',()=>{
 it('requires explicit permission for a grant',()=>{expect(whatsappConsentInput.safeParse({...base,explicitConsent:false}).success).toBe(false);expect(whatsappConsentInput.safeParse({...base,state:'withdrawn',explicitConsent:false}).success).toBe(true);});
 it('records and withdraws consent atomically, rejects stale updates and isolates schools',async()=>{
  const {sql,call}=setup();try{
   let r=await call('PUT','/api/admin/whatsapp/consents',base);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({data:{state:'granted',version:1,sendingAvailable:false}});
   r=await call('PUT','/api/admin/whatsapp/consents',base);expect(r.status).toBe(200);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_consent_events').get() as any).n).toBe(1);
   r=await call('PUT','/api/admin/whatsapp/consents',{...base,state:'withdrawn',version:0},'stale');expect(r.status).toBe(409);
   r=await call('PUT','/api/admin/whatsapp/consents',{...base,recipientId:'q'},'other-tenant');expect(r.status).toBe(409);
   r=await call('PUT','/api/admin/whatsapp/consents',{...base,senderPhone:'+913333333333'},'wrong-sender');expect(r.status).toBe(409);
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_consent_events').get() as any).n).toBe(1);
   sql.prepare("UPDATE school_whatsapp_drafts SET phone_e164='+912222222222' WHERE school_id='one'").run();
   r=await call('PUT','/api/admin/whatsapp/consents',{...base,state:'withdrawn',version:1},'withdraw');expect(r.status).toBe(200);
   expect((sql.prepare('SELECT state FROM whatsapp_consent_records').get() as any).state).toBe('withdrawn');
   expect((sql.prepare('SELECT COUNT(*) AS n FROM whatsapp_consent_events').get() as any).n).toBe(2);
   r=await call('GET','/api/admin/whatsapp/consents?recipientId=p',undefined,'x','two','b');expect(r.status).toBe(404);
   r=await call('GET','/api/admin/whatsapp/consents?recipientId=p',undefined,'x','one','a','teacher');expect(r.status).toBe(403);
   expect(()=>sql.prepare("UPDATE whatsapp_consent_records SET updated_by='b' WHERE school_id='one'").run()).toThrow();
  }finally{sql.close();}
 });
});
