import {describe,it,expect} from 'vitest';
import {inventoryItemInput,stockMovementInput,stockDelta,stockBalance} from '../src/inventory-management.js';
import {visitorInput} from '../src/reception-management.js';
import {feePaymentInput,feeInvoiceInput,financePolicyInput,feeBalance} from '../src/fee-management.js';
describe('stock rules without persisted business fixtures',()=>{
 it('rejects fractional, negative and oversized movements',()=>{for(const quantity of [-1,0,0.5,1000001])expect(stockMovementInput.safeParse({version:1,type:'stock_in',quantity,transactionDate:'2026-10-10',remarks:'Boundary'}).success).toBe(false);});
 it('requires the recipient when stock is issued',()=>{expect(stockMovementInput.safeParse({version:1,type:'stock_out',quantity:1,transactionDate:'2026-10-10',remarks:'Boundary'}).success).toBe(false);});
 it('prevents negative stock and integer-bound overflow',()=>{expect(stockBalance(3,stockDelta('stock_out',4))).toBeNull();expect(stockBalance(1000000,1)).toBeNull();expect(stockBalance(3,stockDelta('return',2))).toBe(5);expect(stockBalance(3,stockDelta('damaged',3))).toBe(0);});
 it('requires integer minor price units and an actual item code',()=>{const scalar={name:'Scalar',itemCode:'SCALAR',categoryId:'not-persisted',unit:'Scalar',unitPriceMinor:1,reorderLevel:0};expect(inventoryItemInput.safeParse(scalar).success).toBe(true);expect(inventoryItemInput.safeParse({...scalar,unitPriceMinor:0.01}).success).toBe(false);expect(inventoryItemInput.safeParse({...scalar,itemCode:''}).success).toBe(false);});
 it('rejects impossible dates',()=>{expect(stockMovementInput.safeParse({version:1,type:'stock_in',quantity:1,transactionDate:'2026-02-30',remarks:'Boundary'}).success).toBe(false);});
});
describe('visitor validation without persisted people',()=>{
 const scalar={relation:'other',name:'Scalar Boundary',contactNumber:'1234567890',purpose:'enquiry',visitorCount:1,employeeId:'not-persisted',visitDate:'2026-10-10',entryTime:'09:00'};
 it('requires a real-linked student relationship for parent visits',()=>{expect(visitorInput.safeParse({...scalar,relation:'parent'}).success).toBe(false);});
 it('rejects student links on other visitors',()=>{expect(visitorInput.safeParse({...scalar,studentId:'not-persisted'}).success).toBe(false);});
 it('requires an organization for business visits',()=>{expect(visitorInput.safeParse({...scalar,purpose:'business'}).success).toBe(false);});
 it('rejects invalid, earlier or same exit time',()=>{for(const exitTime of ['08:59','09:00','25:00'])expect(visitorInput.safeParse({...scalar,exitTime}).success).toBe(false);expect(visitorInput.safeParse({...scalar,exitTime:'09:01'}).success).toBe(true);});
 it('bounds visitor count and contact format',()=>{for(const visitorCount of [0,21,1.5])expect(visitorInput.safeParse({...scalar,visitorCount}).success).toBe(false);expect(visitorInput.safeParse({...scalar,contactNumber:'123'}).success).toBe(false);});
});
describe('financial boundaries without persisted invoices or payments',()=>{
 it('accounts for both collections and concessions and rejects overpayment',()=>{expect(feeBalance(1000,500,200)).toBe(300);expect(feeBalance(1000,900,101)).toBeNull();expect(feeBalance(1000,-1,0)).toBeNull();expect(feeBalance(1000,1000,0)).toBe(0);});
 it('requires integer units, a version and actual non-cash references',()=>{const v={invoiceId:'nonpersisting',version:1,amountMinor:1,concessionMinor:0,paymentMode:'cash',paidOn:'2026-10-10',remarks:'Scalar'};expect(feePaymentInput.safeParse(v).success).toBe(true);for(const change of [{...v,amountMinor:0.1},{...v,amountMinor:0},{...v,concessionMinor:-1},{...v,version:0},{...v,paymentMode:'card'},{...v,paymentMode:'online_gateway'}])expect(feePaymentInput.safeParse(change).success).toBe(false);});
 it('requires an actual numbering policy and calendar due date',()=>{const p={invoicePrefix:'SCALAR-I-',receiptPrefix:'SCALAR-R-',numberWidth:1,nextInvoiceNumber:1,nextReceiptNumber:1,version:0};expect(financePolicyInput.safeParse(p).success).toBe(true);expect(financePolicyInput.safeParse({...p,receiptPrefix:p.invoicePrefix}).success).toBe(false);expect(financePolicyInput.safeParse({...p,nextReceiptNumber:0}).success).toBe(false);expect(feeInvoiceInput.safeParse({studentId:'nonpersisting',feeGroupId:'nonpersisting',amountMinor:1,dueDate:'2026-02-30'}).success).toBe(false);});
});
