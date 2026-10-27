import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {describe,it,expect} from 'vitest';
import {structureSelect,DEFAULT_FEE_GROUPS,feeAdjustmentInput,feeStructureInput,manualBalanceInput,reminderInput} from '../src/fee-parity-management.js';

describe('legacy fee parity validation',()=>{
 it('keeps the old portal fee heads available as an explicit setup action',()=>{
  expect(DEFAULT_FEE_GROUPS).toEqual(['Tuition Fee','Admission Fee','Exam Fee','Transport Fee','Hostel Fee','Annual Charges','Library Fee','Laboratory Fee','Extracurricular Fee','Miscellaneous Fee']);
 });
 it('requires real fee dates, a fee head and a positive amount',()=>{
  const base={feeGroupId:'group',name:'Term 1 Tuition',term:'Term 1',classId:null,sectionId:null,amountMinor:100000,startsOn:'2026-04-01',dueOn:'2026-07-31',status:'active' as const};
  expect(feeStructureInput.safeParse(base).success).toBe(true);
  expect(feeStructureInput.safeParse({...base,amountMinor:0}).success).toBe(false);
  expect(feeStructureInput.safeParse({...base,dueOn:'2026-03-31'}).success).toBe(false);
  expect(feeStructureInput.safeParse({...base,startsOn:'2026-02-30'}).success).toBe(false);
 });
 it('rejects an opening balance that exceeds the actual fee',()=>{
  const base={studentId:'student',name:'Migration arrears',totalMinor:1000,paidMinor:800,concessionMinor:200,dueDate:'2026-07-31',notes:null};
  expect(manualBalanceInput.safeParse(base).success).toBe(true);
  expect(manualBalanceInput.safeParse({...base,paidMinor:801}).success).toBe(false);
 });
 it('requires a reason and version for immutable payment correction',()=>{
  const base={invoiceId:'invoice',receiptId:'receipt',version:1,amountMinor:500,concessionMinor:0,paymentMode:'cash' as const,transactionRef:null,paidOn:'2026-07-20',reason:'Corrected amount'};
  expect(feeAdjustmentInput.safeParse(base).success).toBe(true);
  expect(feeAdjustmentInput.safeParse({...base,version:0}).success).toBe(false);
  expect(feeAdjustmentInput.safeParse({...base,reason:''}).success).toBe(false);
 });
 it('accepts only supported reminder channels and a real invoice id',()=>{
  const base={invoiceId:'invoice',channel:'whatsapp' as const,message:null};
  expect(reminderInput.safeParse(base).success).toBe(true);
  expect(reminderInput.safeParse({...base,channel:'push'}).success).toBe(false);
  expect(reminderInput.safeParse({...base,invoiceId:''}).success).toBe(false);
 });
});

// Schema-only regression: no people, fee structures or business records are seeded.
describe('fee structure ledger query',()=>{
 it('prepares and executes against all migrated tables, including computed ledger balances',()=>{
  const database=new DatabaseSync(':memory:');
  try{
   const directory=new URL('../../../migrations/',import.meta.url);
   for(const name of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort())database.exec(readFileSync(new URL(name,directory),'utf8'));
   expect(database.prepare(structureSelect()+' AND f.academic_year_id=? GROUP BY f.id').all('nonpersisting-school','nonpersisting-year')).toEqual([]);
  }finally{database.close();}
 });
});
