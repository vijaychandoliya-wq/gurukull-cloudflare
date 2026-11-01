import {describe,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
import {DatabaseSync} from 'node:sqlite';
import {registerFeeParityManagement} from '../src/fee-parity-management.js';

vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:'admin',school_id:'school',user_type:'admin'});await next();}};
});

describe('fee reminder delivery availability',()=>{
 it.each([
  ['/api/admin/fees/reminders',{invoiceId:'invoice',channel:'whatsapp'}],
  ['/api/admin/fees/structures/structure/remind-all',{channel:'whatsapp'}],
  ['/api/admin/fees/reminders',{invoiceId:'invoice',channel:'email'}],
  ['/api/admin/fees/structures/structure/remind-all',{channel:'sms'}],
 ])('does not record or claim a delivery for %s',async(path,body)=>{
  const prepare=vi.fn(()=>{throw new Error('Unexpected database access');});
  const app=new Hono<any>();registerFeeParityManagement(app);
  const response=await app.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)},{DB:{prepare},WHATSAPP_ACCESS_TOKEN:'configured',WHATSAPP_PHONE_NUMBER_ID:'configured',WHATSAPP_PASSWORD_TEMPLATE:'configured',EMAIL:{}});
  expect(response.status).toBe(503);
  expect(await response.json()).toMatchObject({error:'FEE_REMINDER_DELIVERY_UNAVAILABLE'});
  expect(prepare).not.toHaveBeenCalled();
 });
 it('keeps legacy reminder history scoped to the school and marks its delivery unverified',async()=>{
  const db=new DatabaseSync(':memory:');
  try{
   db.exec(`CREATE TABLE fee_reminders(id TEXT, invoice_id TEXT, channel TEXT, recipient TEXT, status TEXT, message TEXT, created_at INTEGER, sent_at INTEGER, student_id TEXT, school_id TEXT);
    CREATE TABLE students(id TEXT, school_id TEXT, user_id TEXT);
    CREATE TABLE users(id TEXT, school_id TEXT, full_name TEXT);
    INSERT INTO students VALUES('s1','school','u1'),('s2','other','u2');
    INSERT INTO users VALUES('u1','school','Example'),('u2','other','Other');
    INSERT INTO fee_reminders VALUES('r1','i1','whatsapp','recipient','queued','message',1,1,'s1','school'),('r2','i2','whatsapp','recipient','sent','message',2,2,'s2','other');`);
   const DB={prepare:(sql:string)=>({bind:(...args:any[])=>({all:async()=>({success:true,results:db.prepare(sql).all(...args)})})})};
   const app=new Hono<any>();registerFeeParityManagement(app);
   const response=await app.request('/api/admin/fees/reminders',{}, {DB});
   expect(response.status).toBe(200);
   const data=(await response.json() as any).data;
   expect(data).toHaveLength(1);
   expect(data[0]).toMatchObject({id:'r1',status:'delivery_unverified',legacyStatus:'queued',sentAt:null});
  }finally{db.close();}
 });
});
