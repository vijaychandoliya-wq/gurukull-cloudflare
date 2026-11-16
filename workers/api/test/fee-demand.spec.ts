import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
import {registerFeeDemand} from '../src/fee-demand.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:c.req.header('x-user')||'admin1',school_id:c.req.header('x-school')||'one',user_type:'admin',full_name:'Bursar',email:null,mobile:null});c.set('school',{id:'one',code:'RAJ',slug:'raj',name:'Rajesh School',status:'active',timezone:'Asia/Kolkata',currency:'INR',logo_r2_key:null});await next();}};
});
function d1Shim(sql:DatabaseSync){
 return {prepare:(statement:string)=>{let values:unknown[]=[];const prepared={bind:(...v:unknown[])=>{values=v;return prepared;},first:async()=>sql.prepare(statement).get(...(values as never[]))??null,all:async()=>({success:true,results:sql.prepare(statement).all(...(values as never[]))}),run:()=>sql.prepare(statement).run(...(values as never[]))};return prepared;},batch:async(statements:unknown[])=>{sql.exec('BEGIN');try{for(const stmt of statements)await (stmt as {run:()=>unknown}).run();sql.exec('COMMIT');return statements.map(()=>({success:true}));}catch(e){sql.exec('ROLLBACK');throw e;}}};
}
function setup(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON');
 const directory=new URL('../../../migrations/',import.meta.url);
 for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,directory),'utf8'));
 const T=1700000000;
 sql.exec(`
  INSERT INTO schools(id,code,slug,name,status,timezone,currency,created_at,updated_at) VALUES('one','RAJ','raj','Rajesh School','active','Asia/Kolkata','INR',${T},${T});
  INSERT INTO users(id,school_id,email,mobile,password_hash,full_name,user_type,status,created_at,updated_at) VALUES
   ('admin1','one',NULL,NULL,'x','Bursar','admin','active',${T},${T}),
   ('stud1','one',NULL,NULL,'x','Child One','student','active',${T},${T});
  INSERT INTO classes(id,school_id,name,code,sort_order,created_at,updated_at) VALUES('cl1','one','Five','V',5,${T},${T});
  INSERT INTO sections(id,school_id,class_id,name,sort_order,created_at,updated_at) VALUES('sec1','one','cl1','A',1,${T},${T});
  INSERT INTO students(id,school_id,user_id,admission_no,class_id,section_id,status,created_at,updated_at) VALUES('st1','one','stud1','ADM-1','cl1','sec1','active',${T},${T});
  INSERT INTO academic_years(id,school_id,name,starts_on,ends_on,is_current) VALUES('ay1','one','AY 2025-26','2025-04-01','2026-03-31',1);
  INSERT INTO fee_groups(id,school_id,name,created_at,updated_at) VALUES('fg1','one','Tuition Fee',${T},${T}),('fg2','one','Transport Fee',${T},${T});
  UPDATE students SET academic_year_id='ay1' WHERE id='st1';
  INSERT INTO fee_invoices(id,school_id,student_id,fee_group_id,invoice_no,amount_paise,due_date,status,created_at,updated_at) VALUES
   ('inv1','one','st1','fg1','INV-0001',1050000,${T},'unpaid',${T},${T}),
   ('inv2','one','st1','fg2','INV-0002',250000,${T},'unpaid',${T},${T}),
   ('inv3','one','st1','fg1','INV-0003',500000,${T},'cancelled',${T},${T});
 `);
 sql.exec(`UPDATE fee_invoices SET due_on='2020-01-01',academic_year_id='ay1',currency='INR' WHERE id IN('inv1','inv2','inv3');`);
 const app=new Hono<any>();registerFeeDemand(app);
 const env={...d1Shim(sql),DB:d1Shim(sql)} as any;
 const call=(path:string)=>app.request(path,{headers:{'x-user':'admin1','x-school':'one'}},env);
 return {sql,call,env};
}
describe('fee demand consolidation',()=>{
 it('consolidates open invoices per fee head with running totals and next due date',async()=>{
  const {sql,call}=setup();
  // A partial collection on inv1 so paid/concession math is exercised.
  sql.exec(`INSERT INTO fee_ledger_entries(id,school_id,invoice_id,student_id,academic_year_id,currency,receipt_no,entry_type,amount_minor,concession_minor,payment_mode,paid_on,remarks,created_by,created_at) VALUES('led1','one','inv1','st1','ay1','INR','R-1','collection',500000,50000,'cash','2020-01-05','partial','admin1',1700000000)`);
  const res=await call('/api/admin/fees/demand/st1');
  expect(res.status).toBe(200);
  const d=await res.json() as any;
  // Cancelled inv3 is excluded; two open invoices remain.
  expect(d.data.heads).toHaveLength(2);
  expect(d.data.heads.map((h:any)=>h.invoiceNo).sort()).toEqual(['INV-0001','INV-0002']);
  // inv1: 1050000 - 500000 paid - 50000 concession = 500000 balance
  const head1=d.data.heads.find((h:any)=>h.invoiceNo==='INV-0001');
  expect(head1.balanceMinor).toBe(500000);
  expect(d.data.totals.balanceMinor).toBe(500000+250000);
  expect(d.data.totals.billedMinor).toBe(1050000+250000);
  expect(d.data.nextDue).toBe('2020-01-01');
  expect(d.data.lastReceiptNo).toBe('R-1');
  expect(d.data.student).toMatchObject({admissionNo:'ADM-1',className:'Five',sectionName:'A',currency:'INR'});
 });
 it('returns an empty demand for a student with no open balance',async()=>{
  const {sql,call}=setup();
  // Cancelling every open invoice (as the admin flow does) leaves no balance;
  // a 'paid' status alone would not qualify, since balance is balance-based.
  sql.exec(`UPDATE fee_invoices SET status='cancelled' WHERE id IN('inv1','inv2')`);
  const res=await call('/api/admin/fees/demand/st1');
  const d=await res.json() as any;
  expect(d.data.heads).toHaveLength(0);
  expect(d.data.totals.balanceMinor).toBe(0);
  expect(d.data.nextDue).toBeNull();
  expect(d.data.lastReceiptNo).toBeNull();
 });
 it('returns 404 for another school student id',async()=>{
  const {call}=setup();
  expect((await call('/api/admin/fees/demand/other')).status).toBe(404);
 });
});
