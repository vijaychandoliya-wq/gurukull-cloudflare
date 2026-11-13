import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
import {registerFeeReminders,processFeeReminders} from '../src/fee-reminders.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-user')||'admin1',school_id:c.req.header('x-school')||'one',user_type:'admin',full_name:'Bursar',email:null,mobile:null});c.set('school',{id:'one',code:'RAJ',slug:'raj',name:'Rajesh School',status:'active',timezone:'Asia/Kolkata',currency:'INR',logo_r2_key:null});await next();}};
});

function d1Shim(sql:DatabaseSync){
 return {prepare:(statement:string)=>{let values:unknown[]=[];const prepared={bind:(...v:unknown[])=>{values=v;return prepared;},first:async()=>sql.prepare(statement).get(...(values as never[]))??null,all:async()=>({success:true,results:sql.prepare(statement).all(...(values as never[]))}),run:()=>sql.prepare(statement).run(...(values as never[]))};return prepared;},batch:async(statements:unknown[])=>{sql.exec('BEGIN');try{for(const stmt of statements)await (stmt as {run:()=>unknown}).run();sql.exec('COMMIT');return statements.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const pendingDispatch:Promise<unknown>[]=[];
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const directory=new URL('../../../migrations/',import.meta.url);
 for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,directory),'utf8'));
 // One school, two families: parent1 (consented, has email + mobile) and
 // parent2 (no consent, mobile only). inv1 is long-overdue, inv2 far in the
 // future, inv3 belongs to the unconsented family.
 const T=1700000000;
 sql.exec(`
  INSERT INTO schools(id,code,slug,name,status,timezone,currency,created_at,updated_at) VALUES('one','RAJ','raj','Rajesh School','active','Asia/Kolkata','INR',${T},${T});
  INSERT INTO users(id,school_id,email,mobile,password_hash,full_name,user_type,status,created_at,updated_at) VALUES
   ('admin1','one',NULL,NULL,'x','Bursar','admin','active',${T},${T}),
   ('parent1','one','parent@school.in','9876543210','x','Parent One','parent','active',${T},${T}),
   ('stud1','one',NULL,NULL,'x','Child One','student','active',${T},${T}),
   ('parent2','one',NULL,'9899999999','x','Parent Two','parent','active',${T},${T}),
   ('stud2u','one',NULL,NULL,'x','Child Two','student','active',${T},${T});
  INSERT INTO classes(id,school_id,name,code,sort_order,created_at,updated_at) VALUES('cl1','one','Five','V',5,${T},${T});
  INSERT INTO sections(id,school_id,class_id,name,sort_order,created_at,updated_at) VALUES('sec1','one','cl1','A',1,${T},${T});
  INSERT INTO students(id,school_id,user_id,admission_no,class_id,section_id,status,created_at,updated_at) VALUES
   ('st1','one','stud1','ADM-1','cl1','sec1','active',${T},${T}),
   ('st2','one','stud2u','ADM-2','cl1','sec1','active',${T},${T});
  INSERT INTO fee_groups(id,school_id,name,created_at,updated_at) VALUES('fg1','one','Tuition Fee',${T},${T});
  INSERT INTO fee_invoices(id,school_id,student_id,fee_group_id,invoice_no,amount_paise,due_date,status,created_at,updated_at) VALUES
   ('inv1','one','st1','fg1','INV-0001',1050000,${T},'unpaid',${T},${T}),
   ('inv2','one','st1','fg1','INV-0002',500000,${T},'unpaid',${T},${T}),
   ('inv3','one','st2','fg1','INV-0003',200000,${T},'unpaid',${T},${T});
  INSERT INTO parent_student_links(id,school_id,parent_user_id,student_id,relationship,created_at) VALUES
   ('link1','one','parent1','st1','father',${T}),
   ('link2','one','parent2','st2','mother',${T});
  INSERT INTO whatsapp_consent_records(school_id,recipient_id,sender_phone,recipient_phone,purpose,state,source,evidence,version,updated_by,updated_at) VALUES
   ('one','parent1','+919000000000','+919876543210','fee_reminder','granted','written','admission form',1,'admin1',${T});
 `);
 // Clock-independent due dates: 2020 is overdue, 2999 is far in the future.
 sql.exec(`UPDATE fee_invoices SET due_on='2020-01-01' WHERE id IN('inv1','inv3'); UPDATE fee_invoices SET due_on='2999-01-01' WHERE id='inv2';`);
 const app=new Hono<any>();registerFeeReminders(app);
 const env={...d1Shim(sql),DB:d1Shim(sql),WHATSAPP_DEFAULT_COUNTRY_CODE:'91'} as any;
 const call=async(method:string,path:string,body?:unknown,vars:Record<string,unknown>={})=>{
  const executionCtx={waitUntil:(p:Promise<unknown>)=>{pendingDispatch.push(p);p.catch?.(()=>{});void p;}} as unknown as ExecutionContext;
  const r=await app.request(path,{method,headers:{'Content-Type':'application/json','x-user':'admin1','x-school':'one'},body:body?JSON.stringify(body):undefined},Object.assign(env,vars),executionCtx);
  const json:Record<string,any>=await r.json();
  return {status:r.status,json};
 };
 const settle=async()=>{const batch=pendingDispatch.splice(0,pendingDispatch.length);await Promise.allSettled(batch);};
 return {sql,call,env,settle};
}

describe('fee reminder queueing',()=>{
 it('queues open invoices to the parent email and reports the batch',async()=>{
  const {sql,call,settle}=setup();
  const res=await call('POST','/api/admin/fees/reminders',{window:'all',channel:'email'});
  expect(res.status).toBe(202);
  // inv1+inv2 belong to parent1 (has email), inv3 to parent2 (no email -> skipped).
  expect(res.json.data.queued).toBe(2);
  expect(res.json.data.byReason.no_parent_email).toBe(1);
  expect((sql.prepare(`SELECT COUNT(*) AS n FROM fee_reminders WHERE school_id='one' AND channel='email'`).get() as any).n).toBe(3);
  await settle();
 });
 it('skips whatsapp targets without granted consent, keeping the consented ones',async()=>{
  const {sql,call,settle}=setup();
  const res=await call('POST','/api/admin/fees/reminders',{window:'all',channel:'whatsapp'});
  expect(res.status).toBe(202);
  expect(res.json.data.byReason.no_whatsapp_consent).toBe(1);
  // The two consented invoices flow through dispatch; with no configured
  // WhatsApp fee template they settle as provider_not_configured, while the
  // unconsented family keeps its queue-time skip detail.
  await settle();
  const rows=sql.prepare(`SELECT detail,recipient FROM fee_reminders WHERE school_id='one' AND channel='whatsapp'`).all() as Array<{detail:string|null;recipient:string}>;
  expect(rows.filter(r=>r.detail==='no_whatsapp_consent')).toHaveLength(1);        // parent2, blocked at queue time
  const consented=rows.filter(r=>r.detail==='whatsapp_provider_not_configured');   // parent1's two invoices
  expect(consented).toHaveLength(2);
  expect(consented.every(r=>String(r.recipient).match(/^\+91\d{10}$/))).toBe(true);
 });
 it('honours a recorded number-level suppression over consent',async()=>{
  const {sql,call,settle}=setup();
  sql.exec(`INSERT INTO whatsapp_number_suppressions(school_id,sender_phone,recipient_phone,evidence,version,updated_by,updated_at) VALUES('one','+919000000000','+919876543210','parent opted out',1,'admin1',1700000000)`);
  const res=await call('POST','/api/admin/fees/reminders',{window:'all',channel:'whatsapp'});
  expect(res.status).toBe(202);
  expect(res.json.data.queued).toBe(0);
  expect(res.json.data.byReason.number_suppressed).toBe(2);
  expect(res.json.data.byReason.no_whatsapp_consent).toBe(1);
  await settle();
 });
 it('does not re-queue an invoice already open on the same channel within 7 days',async()=>{
  const {env,call,settle}=setup();
  const first=await call('POST','/api/admin/fees/reminders',{window:'all',channel:'email'});
  expect(first.json.data.queued).toBe(2);
  // Deliver so the rows move out of 'queued'; without a binding they would
  // flip to provider_not_configured and still count as "open".
  env.EMAIL={send:async()=>({messageId:'em-1'})};
  await settle();
  const second=await call('POST','/api/admin/fees/reminders',{window:'all',channel:'email'});
  expect(second.json.data.queued).toBe(0);
  expect(second.json.data.byReason.duplicate_recent).toBe(2);
  await settle();
 });
 it('rejects sending a structure and an invoice at once',async()=>{
  const {call,settle}=setup();
  const res=await call('POST','/api/admin/fees/reminders',{structureId:'s1',invoiceId:'inv1'});
  expect(res.status).toBe(422);
  await settle();
 });
});

describe('fee reminder dispatch',()=>{
 it('marks an email row provider_not_configured when there is no email binding',async()=>{
  const {sql,env,settle}=setup();
  sql.exec(`INSERT INTO fee_reminders(id,school_id,invoice_id,student_id,channel,recipient,message,status,detail,attempts,created_by,created_at) VALUES('rem1','one','inv1','st1','email','parent@school.in','msg','queued',NULL,0,'admin1',1700000000)`);
  const stats=await processFeeReminders(env);
  expect(stats.notConfigured).toBe(1);
  expect((sql.prepare(`SELECT status FROM fee_reminders WHERE id='rem1'`).get() as any).status).toBe('provider_not_configured');
  await settle();
 });
 it('sends an email reminder through the binding and records the provider id',async()=>{
  const {sql,env,settle}=setup();
  sql.exec(`INSERT INTO fee_reminders(id,school_id,invoice_id,student_id,channel,recipient,message,status,detail,attempts,created_by,created_at) VALUES('rem1','one','inv1','st1','email','parent@school.in','msg','queued',NULL,0,'admin1',1700000000)`);
  const sent:{to:string}[]=[];
  env.EMAIL={send:async(m:{to:string})=>{sent.push({to:m.to});return{messageId:'em-1'};}};
  const stats=await processFeeReminders(env);
  expect(stats.sent).toBe(1);
  expect(sent[0].to).toBe('parent@school.in');
  expect(sql.prepare(`SELECT status,provider_message_id FROM fee_reminders WHERE id='rem1'`).get()).toMatchObject({status:'sent',provider_message_id:'em-1'});
  await settle();
 });
 it('marks a whatsapp row provider_not_configured when the fee template is unset',async()=>{
  const {sql,env,settle}=setup();
  sql.exec(`INSERT INTO fee_reminders(id,school_id,invoice_id,student_id,channel,recipient,message,status,detail,attempts,created_by,created_at) VALUES('rem2','one','inv1','st1','whatsapp','+919876543210','msg','queued',NULL,0,'admin1',1700000000)`);
  const stats=await processFeeReminders(env);
  expect(stats.notConfigured).toBe(1);
  expect((sql.prepare(`SELECT status FROM fee_reminders WHERE id='rem2'`).get() as any).status).toBe('provider_not_configured');
  await settle();
 });
 it('retries a failed reminder, resetting the lease and attempt counters',async()=>{
  const {sql,env,call,settle}=setup();
  sql.exec(`INSERT INTO fee_reminders(id,school_id,invoice_id,student_id,channel,recipient,message,status,detail,attempts,created_by,created_at) VALUES('rem3','one','inv1','st1','email','parent@school.in','msg','failed','email_send_failed',3,'admin1',1700000000)`);
  // Working binding so the automatic dispatch after the retry reaches a stable 'sent'.
  env.EMAIL={send:async()=>({messageId:'em-3'})};
  const res=await call('POST','/api/admin/fees/reminders/rem3/retry');
  expect(res.status).toBe(200);
  await settle();
  // attempts was 3; the retry reset it to 0 and dispatch incremented once.
  const row=sql.prepare(`SELECT status,attempts,provider_message_id FROM fee_reminders WHERE id='rem3'`).get();
  expect(row).toMatchObject({status:'sent',attempts:1,provider_message_id:'em-3'});
  const bad=await call('POST','/api/admin/fees/reminders/rem3/retry');
  expect(bad.status).toBe(404);
  await settle();
 });
});
