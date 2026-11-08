import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect} from 'vitest';
import {counterStudentQuery,counterInvoiceSelect} from '../src/fee-counter.js';
import {feeCsv,feeAssignmentReviewInput,replacementReceiptSql} from '../src/fee-parity-management.js';
import {setupRequestAllowed} from '../src/admin-access.js';
import app from '../src/index.js';
import {feePaymentInput} from '../src/fee-management.js';

describe('fee counter read boundaries',()=>{
 it('executes tenant/year-scoped search and ledger SQL against the migrated schema without seeding records',()=>{
  const database=new DatabaseSync(':memory:');try{
   const dir=new URL('../../../migrations/',import.meta.url);for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())database.exec(readFileSync(new URL(name,dir),'utf8'));
   for(const q of ['','Shared parent','%_\\']){const query=counterStudentQuery('school-boundary','year-boundary',q);expect(database.prepare('SELECT s.id '+query.from+' LIMIT ? OFFSET ?').all(...query.values,10,0)).toEqual([]);expect(query.values.slice(0,2)).toEqual(['school-boundary','year-boundary']);}
   expect(database.prepare(counterInvoiceSelect+' ORDER BY i.due_on,i.id LIMIT ? OFFSET ?').all('school-boundary','year-boundary','student-boundary',20,0)).toEqual([]);
   // Preparing validates the INSERT/SELECT column contract; zero rows are inserted.
   expect(()=>database.prepare(replacementReceiptSql)).not.toThrow();
  }finally{database.close();}
 });
 it('treats wildcard characters as search text and scopes parent links to the student school',()=>{
  const q=counterStudentQuery('school','year','%_');expect(q.values[2]).toBe('%_');expect(q.from).toContain('l.school_id=s.school_id');expect(q.from).toContain('pp.contact_mobile');
 });
 it('allows only exact read-only setup routes',()=>{
  expect(setupRequestAllowed('GET','/api/admin/fees/counter/students')).toBe(true);
  expect(setupRequestAllowed('POST','/api/admin/fees/counter/students')).toBe(false);
  expect(setupRequestAllowed('GET','/api/admin/fees/counter/students/a/extra')).toBe(false);
 });
 it('does not expose student search, commands or previews to anonymous users',async()=>{
  for(const route of ['/api/admin/fees/counter/students','/api/admin/fees/counter/commands/key','/api/admin/fees/structures/key/assignment-preview'])expect((await app.request(route)).status).toBe(401);
 });
 it('exports major currency amounts and neutralizes spreadsheet formulas',()=>{
  const row={studentName:'=HYPERLINK("x")',currency:'INR',amountMinor:350000,paidMinor:200000,concessionMinor:0,balanceMinor:150000};const csv=feeCsv([row],true);expect(csv).toContain('3500.00');expect(csv).toContain('1500.00');expect(csv).toContain("'=HYPERLINK");expect(csv).not.toContain('amountMinor');
 });
 it('requires the complete reviewed count, version and batch identity together',()=>{
  expect(feeAssignmentReviewInput.safeParse({}).success).toBe(true);
  expect(feeAssignmentReviewInput.safeParse({expectedVersion:1,expectedCount:1,expectedBatchIds:'student'}).success).toBe(true);
  expect(feeAssignmentReviewInput.safeParse({expectedVersion:1,expectedCount:1}).success).toBe(false);
  expect(feeAssignmentReviewInput.safeParse({expectedCount:1}).success).toBe(false);
 });
 it('accepts an optional routine note but requires a concession reason and non-cash reference',()=>{
  const body={invoiceId:'invoice',version:1,amountMinor:100,concessionMinor:0,paymentMode:'cash',paidOn:'2026-11-08'};
  expect(feePaymentInput.safeParse(body).success).toBe(true);
  expect(feePaymentInput.safeParse({...body,concessionMinor:10}).success).toBe(false);
  expect(feePaymentInput.safeParse({...body,concessionMinor:10,remarks:'Approved scholarship'}).success).toBe(true);
  expect(feePaymentInput.safeParse({...body,paymentMode:'upi'}).success).toBe(false);
 });
});
