import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,expect,it,vi} from 'vitest';
import {Hono} from 'hono';
import {registerWhatsAppConnection,whatsappDraftInput} from '../src/whatsapp-connection.js';

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
 sql.exec(readFileSync(new URL('../../../migrations/0031_school_whatsapp_drafts.sql',import.meta.url),'utf8'));
 const DB:any={prepare:(statement:string)=>{let values:any[]=[];const prepared={bind:(...v:any[])=>{values=v;return prepared;},first:async()=>sql.prepare(statement).get(...values)||null,run:()=>sql.prepare(statement).run(...values)};return prepared;},batch:async(statements:any[])=>{sql.exec('BEGIN');try{for(const stmt of statements)stmt.run();sql.exec('COMMIT');return statements.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const app=new Hono<any>();registerWhatsAppConnection(app);
 const call=(method:string,school='one',user='a',role='admin',body?:unknown,key='command1')=>app.request(method==='GET'?'/api/admin/whatsapp/connection':'/api/admin/whatsapp/connection/draft',{method,headers:{'Content-Type':'application/json','Idempotency-Key':key,'x-test-school':school,'x-test-user':user,'x-test-role':role},...(body?{body:JSON.stringify(body)}:{})},{DB});
 return {sql,call};
}

describe('school WhatsApp draft connection',()=>{
 it('validates the international number and rejects extra credential fields',()=>{
  const input={phone:'+919876543210',displayName:'School',version:0};
  expect(whatsappDraftInput.safeParse(input).success).toBe(true);
  expect(whatsappDraftInput.safeParse({...input,phone:'9876543210'}).success).toBe(false);
  expect(whatsappDraftInput.safeParse({...input,token:'secret'}).success).toBe(false);
 });
 it('saves an idempotent draft without claiming a connection and isolates schools',async()=>{
  const {sql,call}=setup();try{
   const body={phone:'+919876543210',displayName:'School',version:0};
   let r=await call('PUT','one','a','admin',body);expect(r.status).toBe(200);expect(await r.json()).toMatchObject({data:{status:'not_connected',sendingAvailable:false,draft:{version:1}}});
   r=await call('PUT','one','a','admin',body);expect(r.status).toBe(200);
   expect((sql.prepare('SELECT count(*) AS n FROM audit_events').get() as any).n).toBe(1);
   r=await call('GET','two','b');expect(await r.json()).toMatchObject({data:{status:'not_connected',draft:null}});
   r=await call('PUT','one','a','admin',{...body,phone:'+919999999999',version:0},'newkey');expect(r.status).toBe(409);
   r=await call('GET','one','a','teacher');expect(r.status).toBe(403);
   expect(()=>sql.prepare("UPDATE school_whatsapp_drafts SET updated_by='b' WHERE school_id='one'").run()).toThrow();
  }finally{sql.close();}
 });
});
