import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
import {registerFeePayments,expirePaymentIntents} from '../src/fee-payments.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-user')||'admin1',school_id:c.req.header('x-school')||'one',user_type:'admin',full_name:'Bursar',email:null,mobile:null,roles:['admin']});c.set('school',{id:'one',code:'RAJ',slug:'raj',name:'Rajesh School',status:'active',timezone:'Asia/Kolkata',currency:'INR',logo_r2_key:null});await next();}};
});

function d1Shim(sql:DatabaseSync){
 return {prepare:(statement:string)=>{let values:unknown[]=[];const prepared={bind:(...v:unknown[])=>{values=v;return prepared;},first:async()=>sql.prepare(statement).get(...(values as never[]))??null,all:async()=>({success:true,results:sql.prepare(statement).all(...(values as never[]))}),run:()=>sql.prepare(statement).run(...(values as never[]))};return prepared;},batch:async(statements:unknown[])=>{sql.exec('BEGIN');try{for(const stmt of statements)await (stmt as {run:()=>unknown}).run();sql.exec('COMMIT');return statements.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
const pendingDispatch:Promise<unknown>[]=[];
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const directory=new URL('../../../migrations/',import.meta.url);
 for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,directory),'utf8'));
 const T=1700000000;
 // payLinkInput requires invoice ids of 16-64 alphanumeric chars.
 const inv1='inv0000000000001',inv2='inv0000000000002';
 sql.exec(`
  INSERT INTO schools(id,code,slug,name,status,timezone,currency,created_at,updated_at) VALUES('one','RAJ','raj','Rajesh School','active','Asia/Kolkata','INR',${T},${T});
  INSERT INTO school_configuration(school_id,timezone,currency,configuration_verified_at,updated_at) VALUES('one','Asia/Kolkata','INR',${T},${T});
  INSERT INTO domains(id,hostname,school_id,status,is_primary,created_at) VALUES('d1','raj.gurukull.in','one','active',1,${T});
  INSERT INTO users(id,school_id,email,mobile,password_hash,full_name,user_type,status,created_at,updated_at) VALUES
   ('admin1','one',NULL,NULL,'x','Bursar','admin','active',${T},${T}),
   ('parent1','one','parent@school.in','9876543210','x','Parent One','parent','active',${T},${T}),
   ('stud1','one',NULL,NULL,'x','Child One','student','active',${T},${T});
  INSERT INTO academic_years(id,school_id,name,is_current,starts_on,ends_on) VALUES('yr1','one','2026-27',1,'2026-04-01','2027-03-31');
  INSERT INTO classes(id,school_id,name,code,sort_order,created_at,updated_at) VALUES('cl1','one','Five','V',5,${T},${T});
  INSERT INTO sections(id,school_id,class_id,name,sort_order,created_at,updated_at) VALUES('sec1','one','cl1','A',1,${T},${T});
  INSERT INTO students(id,school_id,user_id,admission_no,class_id,section_id,academic_year_id,status,created_at,updated_at) VALUES
   ('st1','one','stud1','ADM-1','cl1','sec1','yr1','active',${T},${T});
  INSERT INTO fee_groups(id,school_id,name,created_at,updated_at) VALUES('fg1','one','Tuition Fee',${T},${T});
  INSERT INTO fee_invoices(id,school_id,student_id,fee_group_id,invoice_no,amount_paise,due_date,due_on,currency,academic_year_id,version,status,created_at,updated_at) VALUES
   ('${inv1}','one','st1','fg1','INV-0001',1050000,'2024-01-01','2024-01-01','INR','yr1',1,'unpaid',${T},${T}),
   ('${inv2}','one','st1','fg1','INV-0002',500000,'2024-01-01','2024-01-01','INR','yr1',1,'unpaid',${T},${T});
  INSERT INTO parent_student_links(id,school_id,parent_user_id,student_id,relationship,created_at) VALUES
   ('link1','one','parent1','st1','father',${T});
 `);
 const app=new Hono<any>();registerFeePayments(app);
 const env={...d1Shim(sql),DB:d1Shim(sql),RAZORPAY_API_URL:'http://localhost:5217'} as any;
 const call=async(method:string,path:string,body?:unknown,vars:Record<string,unknown>={},headers:Record<string,string>={'x-user':'admin1','x-school':'one','Idempotency-Key':crypto.randomUUID()})=>{
  const executionCtx={waitUntil:(p:Promise<unknown>)=>{pendingDispatch.push(p);p.catch?.(()=>{});void p;}} as unknown as ExecutionContext;
  const r=await app.request(path,{method,headers:{'Content-Type':'application/json',...headers},body:body?JSON.stringify(body):undefined},Object.assign(env,vars),executionCtx);
  const text=await r.text();
  let json:Record<string,any>={};
  try{json=JSON.parse(text);}catch{json={raw:text};}
  return {status:r.status,json};
 };
 return {sql,app,call,env};
}

describe('fee payment links (P0-3)',()=>{
 it('gateway is unconfigured by default',async()=>{
  const {call}=setup();
  const r=await call('GET','/api/admin/fees/gateway');
  expect(r.status).toBe(200);
  expect(r.json.data.configured).toBe(false);
  expect(r.json.data.webhookUrl).toBe('https://raj.gurukull.in/api/pay/webhook/razorpay');
 });
 it('stores credentials as disabled and self-test fails against unreachable provider',async()=>{
  const {call}=setup();
  const put=await call('PUT','/api/admin/fees/gateway',{merchantId:'rzp_live_1',merchantKey:'sk_live_1',webhookSecret:'a'.repeat(32)});
  expect(put.status).toBe(200);
  expect(put.json.data.configured).toBe(true);
  expect(put.json.data.enabled).toBe(false);
  // The fake Razorpay URL does not respond, so the self-test reports invalid credentials.
  const st=await call('POST','/api/admin/fees/gateway/self-test');
  expect(st.status).toBe(422);
  expect(st.json.error).toBe('GATEWAY_CREDENTIALS_INVALID');
 });
 it('requires gateway enabled before creating links',async()=>{
  const {call}=setup();
  const inv1='inv0000000000001',inv2='inv0000000000002';
  const r=await call('POST','/api/admin/fees/pay-links',{studentId:'st1',invoiceIds:[inv1,inv2]});
  expect(r.status).toBe(409);
  expect(r.json.error).toBe('GATEWAY_NOT_ENABLED');
 });
 it('list, create, cancel, portal and public pay page',async()=>{
  const {call,sql}=setup();
  const inv1='inv0000000000001',inv2='inv0000000000002';
  await sql.exec(`INSERT INTO fee_payment_gateways(school_id,provider,merchant_id,merchant_key,webhook_secret,currency,enabled,version,created_by,updated_at) VALUES('one','razorpay','rzp_live_1','sk_live_1','${'a'.repeat(32)}','INR',1,1,'admin1',1700000000)`);
  const listEmpty=await call('GET','/api/admin/fees/pay-links');
  expect(listEmpty.status).toBe(200);
  expect(listEmpty.json.data).toEqual([]);
  expect(listEmpty.json.summary.open).toBe(0);
  const create=await call('POST','/api/admin/fees/pay-links',{studentId:'st1',invoiceIds:[inv1,inv2]});
  expect(create.status).toBe(201);
  const linkId=create.json.data.id;
  expect(linkId).toBeTruthy();
  expect(create.json.data.url).toContain('/pay/');
  const afterCreate=await call('GET','/api/admin/fees/pay-links');
  expect(afterCreate.json.data.length).toBe(1);
  expect(afterCreate.json.data[0].status).toBe('pending');
  // cancel
  const cancel=await call('POST',`/api/admin/fees/pay-links/${linkId}/cancel`);
  expect(cancel.status).toBe(200);
  expect(cancel.json.data.status).toBe('cancelled');
  // public pay page
  const publicPage=await call('GET',`/api/fees/pay/${linkId}`);
  expect(publicPage.status).toBe(200);
  expect(publicPage.json.data.gateway.siteKey).toBe('rzp_live_1');
  // portal
  const portal=await call('GET','/api/portal/fee-pay-links?studentId=st1');
  expect(portal.status).toBe(200);
 });
 it('rejects duplicate invoice ids',async()=>{
  const {call}=setup();
  const r=await call('POST','/api/admin/fees/pay-links',{studentId:'st1',invoiceIds:['inv1','inv1']});
  expect(r.status).toBe(422);
 });
 it('expirePaymentIntents reclaims leases and expires old links',async()=>{
  const {sql}=setup();
  const now=Math.floor(Date.now()/1000);
  sql.exec(`INSERT INTO fee_payment_intents(id,school_id,student_id,gateway,status,amount_paise,currency,expires_at,created_by,created_at,lease_until)
   VALUES('int1','one','st1','razorpay','processing',1000,'INR',${now+999999},'admin1',${now},${now-100}),('int2','one','st1','razorpay','pending',1000,'INR',${now-1},'admin1',${now},${now})`);
  const result=expirePaymentIntents({DB:{prepare:(s:string)=>{const m=s.match(/fee_payment_intents/);const p:any={run:(...a:unknown[])=>m?{meta:{changes:1}}:{meta:{changes:0}}};p.bind=(...a:unknown[])=>p;return p;}} as any} as import('../src/context.js').Env);
  expect((await result).expired).toBe(1);
  expect((await result).reclaimed).toBe(1);
 });
});
