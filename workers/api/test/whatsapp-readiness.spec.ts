import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppReadiness,whatsappReadinessInput} from '../src/whatsapp-readiness.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-test-user')||'a',school_id:c.req.header('x-test-school')||'one',user_type:c.req.header('x-test-role')||'admin'});await next();}};
});
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE schools(id TEXT PRIMARY KEY);CREATE TABLE users(id TEXT PRIMARY KEY,school_id TEXT,user_type TEXT,status TEXT);
 CREATE TABLE user_roles(school_id TEXT,user_id TEXT,role TEXT);
 INSERT INTO schools VALUES('one'),('two');INSERT INTO users VALUES('a','one','admin','active'),('p','one','parent','active'),('p2','one','parent','active'),('b','two','admin','active'),('q','two','parent','active');`);
 for(const n of ['0031_school_whatsapp_drafts.sql','0032_whatsapp_consent.sql','0033_whatsapp_template_drafts.sql','0034_whatsapp_number_suppressions.sql'])sql.exec(readFileSync(new URL('../../../migrations/'+n,import.meta.url),'utf8'));
 sql.exec(`INSERT INTO school_whatsapp_drafts VALUES('one','+911111111111','School',1,'a',1);
 INSERT INTO whatsapp_consent_records VALUES('one','p','+911111111111','+919876543210','school_notice','granted','written','record',1,'a',1);
 INSERT INTO whatsapp_template_drafts VALUES('one','school_notice','en','Message',1,'a',1);`);
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const p={bind:(...v:any[])=>{values=v;return p;},all:()=>sql.prepare(statement).all(...values)};return p;},batch:async(stmts:any[])=>stmts.map(s=>({success:true,results:s.all()}))};
 const app=new Hono<any>();registerWhatsAppReadiness(app);
 const call=(body:unknown,school='one',user='a',role='admin')=>app.request('/api/admin/whatsapp/readiness',{method:'POST',headers:{'Content-Type':'application/json','x-test-school':school,'x-test-user':user,'x-test-role':role},body:JSON.stringify(body)},{DB});
 return {sql,call};
}
const base={recipientId:'p',senderPhone:'+911111111111',recipientPhone:'+919876543210',purpose:'school_notice',locale:'en'};
describe('WhatsApp readiness preview',()=>{
 it('validates input and rejects client-supplied approval',()=>{expect(whatsappReadinessInput.safeParse(base).success).toBe(true);expect(whatsappReadinessInput.safeParse({...base,canSend:true}).success).toBe(false);});
 it('never authorizes sending, makes no writes, and blocks a shared opted-out number',async()=>{
  const {sql,call}=setup();try{
   const before=(sql.prepare('SELECT total_changes() AS n').get() as any).n;
   let r=await call(base);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({data:{canSend:false,checks:{schoolNumber:'draft_matches',consent:'grant_recorded',numberOptOut:'not_recorded',template:'draft_available',senderVerification:'not_verified',templateApproval:'not_verified',delivery:'not_available'}}});
   expect((sql.prepare('SELECT total_changes() AS n').get() as any).n).toBe(before);
   sql.exec("INSERT INTO whatsapp_number_suppressions VALUES('one','+911111111111','+919876543210','request',1,'a',1)");
   r=await call(base);expect(await r.json()).toMatchObject({data:{canSend:false,checks:{numberOptOut:'blocked'}}});
   r=await call({...base,recipientId:'p2'});expect(await r.json()).toMatchObject({data:{canSend:false,checks:{consent:'not_recorded',numberOptOut:'blocked'}}});
   r=await call({...base,purpose:'fee_reminder'});expect(await r.json()).toMatchObject({data:{checks:{consent:'not_recorded',template:'draft_missing'}}});
   r=await call(base,'two','b');expect(r.status).toBe(404);
   r=await call(base,'one','a','teacher');expect(r.status).toBe(403);
  }finally{sql.close();}
 });
});
