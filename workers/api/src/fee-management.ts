import { z } from 'zod';
import type { Hono } from 'hono';
import { db, readBody, requireAuth, requireRole, type ApiContext, type AppEnv } from './context.js';
import { fail } from './security.js';
import { directoryInput } from './admin.js';
import {parse,command,guard,cleanupGuards,audit,requiredText,dateInput,nullableText} from './management-common.js';
import {workflowYear,workflowYearGuard,dateInYear} from './workflow-common.js';
import {localCalendarDate} from './notice-management.js';
import {scopedStudent} from './academic-work.js';

export const feeGroupInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(255).optional().nullable(),
}).strict();

export const feeInvoiceInput=z.object({studentId:requiredText(100),feeGroupId:requiredText(100),amountMinor:z.number().int().positive().max(1000000000000),dueDate:dateInput}).strict();
export const feePaymentInput=z.object({invoiceId:requiredText(100),version:z.number().int().positive(),amountMinor:z.number().int().positive().max(1000000000000),concessionMinor:z.number().int().min(0).max(1000000000000),paymentMode:z.enum(['cash','cheque','bank_transfer','upi','card']),transactionRef:nullableText(100),paidOn:dateInput,remarks:requiredText(500)}).strict().refine(v=>v.paymentMode==='cash'||!!v.transactionRef,{path:['transactionRef'],message:'Enter the actual non-cash transaction reference.'});
export const financePolicyInput=z.object({invoicePrefix:requiredText(30).regex(/^[A-Za-z0-9/_-]+$/),receiptPrefix:requiredText(30).regex(/^[A-Za-z0-9/_-]+$/),numberWidth:z.number().int().min(1).max(12),nextInvoiceNumber:z.number().int().min(1).max(999999999999),nextReceiptNumber:z.number().int().min(1).max(999999999999),version:z.number().int().min(0)}).strict().refine(v=>v.invoicePrefix!==v.receiptPrefix,{path:['receiptPrefix'],message:'Use different actual prefixes.'});
export function feeBalance(amount:number,paid:number,concession:number){if(![amount,paid,concession].every(v=>Number.isSafeInteger(v)&&v>=0)||paid+concession>amount)return null;return amount-paid-concession;}
type Policy={currency:string;version:number};
async function policy(c:ApiContext,year:string){const p=await db(c).prepare('SELECT p.* FROM finance_policy p JOIN school_configuration cfg ON cfg.school_id=p.school_id AND cfg.currency=p.currency WHERE p.school_id=? AND p.academic_year_id=?').bind(c.get('user').school_id,year).first<Policy>();if(!p)fail(409,'ACTUAL_FINANCE_POLICY_REQUIRED','Save the actual invoice and receipt numbering policy first.');return p;}
function policyGuard(c:ApiContext,year:string,p:Policy,g:string){return guard(c,'EXISTS(SELECT 1 FROM finance_policy p JOIN school_configuration cfg ON cfg.school_id=p.school_id AND cfg.currency=p.currency WHERE p.school_id=? AND p.academic_year_id=? AND p.version=? AND p.currency=?)',[c.get('user').school_id,year,p.version,p.currency],g);}
const receiptSelect=`SELECT l.id,l.invoice_id AS invoiceId,i.invoice_no AS invoiceNo,l.receipt_no AS receiptNo,l.entry_type AS entryType,l.amount_minor AS amountMinor,l.concession_minor AS concessionMinor,l.currency,l.payment_mode AS paymentMode,l.transaction_ref AS transactionRef,l.paid_on AS paidOn,l.remarks,l.reverses_id AS reversesId,(SELECT r.id FROM fee_ledger_entries r WHERE r.school_id=l.school_id AND r.reverses_id=l.id) AS reversedBy,u.full_name AS studentName,s.admission_no AS admissionNo,g.name AS feeName,a.full_name AS recordedBy FROM fee_ledger_entries l JOIN fee_invoices i ON i.id=l.invoice_id AND i.school_id=l.school_id JOIN students s ON s.id=l.student_id AND s.school_id=l.school_id JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN users a ON a.id=l.created_by AND a.school_id=l.school_id JOIN fee_groups g ON g.id=i.fee_group_id AND g.school_id=i.school_id`;
export function registerFeeManagement(app: Hono<AppEnv>) {
  app.get('/api/portal/student-fees',requireAuth,async c=>{const u=requireRole(c,'admin','parent','student'),s=await scopedStudent(c,c.req.query('studentId')||(u.user_type==='student'?u.id:undefined)),v=directoryInput(c.req.query()),r=await db(c).batch([db(c).prepare('SELECT COUNT(*) AS total FROM fee_invoices WHERE school_id=? AND student_id=?').bind(u.school_id,s.id),db(c).prepare('SELECT i.id,i.invoice_no AS invoiceNo,g.name AS feeName,i.amount_paise AS amountMinor,i.paid_minor AS paidMinor,i.concession_minor AS concessionMinor,i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor,i.currency,i.due_on AS dueDate,i.status FROM fee_invoice_balances i JOIN fee_groups g ON g.id=i.fee_group_id AND g.school_id=i.school_id WHERE i.school_id=? AND i.student_id=? ORDER BY i.due_date DESC,i.id LIMIT ? OFFSET ?').bind(u.school_id,s.id,v.perPage,v.offset)]);if(r.some(v=>!v.success))fail(503,'FEES_READ_FAILED');for(const row of r[1].results as Record<string,unknown>[])if(feeBalance(Number(row.amountMinor),Number(row.paidMinor),Number(row.concessionMinor))===null)fail(503,'LEDGER_RECONCILIATION_REQUIRED');return c.json({data:r[1].results,total:(r[0].results[0] as {total:number}).total});});
  // 1. List Invoices with student details and payment totals
  app.get('/api/admin/fees/invoices', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const input = directoryInput(c.req.query());
    const schoolId = u.school_id;

    const countSql = `
      SELECT COUNT(*) AS total
      FROM fee_invoice_balances fi
      JOIN students s ON s.id = fi.student_id AND s.school_id = fi.school_id
      JOIN users u ON u.id = s.user_id AND u.school_id = fi.school_id
      WHERE fi.school_id = ?
    `;

    const listSql = `
      SELECT
        fi.id,
        fi.invoice_no AS invoiceNo,
        fi.amount_paise AS amountPaise,
        fi.due_date AS dueDate,
        fi.status,fi.version,fi.currency,fi.due_on AS dueOn,fi.concession_minor AS concessionMinor,
        fi.created_at AS createdAt,
        fg.id AS feeGroupId,
        fg.name AS feeName,
        s.id AS studentId,
        s.admission_no AS admissionNo,
        s.roll_no AS rollNo,
        u.full_name AS studentName,
        cl.name || ' - ' || sec.name AS className,
        fi.paid_minor AS paidAmountPaise
      FROM fee_invoice_balances fi
      JOIN fee_groups fg ON fg.id = fi.fee_group_id AND fg.school_id = fi.school_id
      JOIN students s ON s.id = fi.student_id AND s.school_id = fi.school_id
      JOIN users u ON u.id = s.user_id AND u.school_id = fi.school_id
      LEFT JOIN classes cl ON cl.id = s.class_id AND cl.school_id = fi.school_id
      LEFT JOIN sections sec ON sec.id = s.section_id AND sec.school_id = fi.school_id
      WHERE fi.school_id = ?
      GROUP BY fi.id
      ORDER BY fi.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await db(c).batch<Record<string, unknown>>([
      db(c).prepare(countSql).bind(schoolId),
      db(c).prepare(listSql).bind(schoolId, input.perPage, input.offset)
    ]);

    if (results.some(r => !r.success)) fail(503, 'FEES_READ_FAILED');

    const total = Number((results[0].results[0] as { total: number } | undefined)?.total || 0);
    const rows = (results[1].results || []) as Array<{
      id: string;
      invoiceNo: string;
      amountPaise: number;
      dueDate: number;
      status: string;
      feeGroupId: string;
      feeName: string;
      studentId: string;
      studentName: string;
      className: string | null;
      paidAmountPaise: number;
      createdAt: number;
    }>;

    const data=(results[1].results as Record<string,unknown>[]).map(r=>{const balance=feeBalance(Number(r.amountPaise),Number(r.paidAmountPaise),Number(r.concessionMinor));if(balance===null)fail(503,'LEDGER_RECONCILIATION_REQUIRED');return {...r,id:r.id,key:r.id,feeId:r.id,amountMinor:r.amountPaise,paidMinor:r.paidAmountPaise,balanceMinor:balance,dueDate:r.dueOn};});

    return c.json({
      data,
      meta: {
        currentPage: input.page,
        lastPage: Math.max(1, Math.ceil(total / input.perPage)),
        perPage: input.perPage,
        total,
      }
    });
  });

  // 2. Fee Groups list
  app.get('/api/admin/fees/groups', requireAuth, async (c) => {
    const u = requireRole(c, 'admin');
    const result = await db(c).prepare(`
      SELECT id, name, description, created_at AS createdAt
      FROM fee_groups
      WHERE school_id = ?
      ORDER BY name ASC
    `).bind(u.school_id).all();

    if (!result.success) fail(503, 'FEE_GROUPS_READ_FAILED');
    return c.json({ data: result.results });
  });

  app.get('/api/admin/fees/policy',requireAuth,async c=>{const u=requireRole(c,'admin'),r=await db(c).prepare(`SELECT p.currency,p.invoice_prefix AS invoicePrefix,p.receipt_prefix AS receiptPrefix,p.number_width AS numberWidth,p.next_invoice_number AS nextInvoiceNumber,p.next_receipt_number AS nextReceiptNumber,p.version FROM finance_policy p JOIN academic_years y ON y.id=p.academic_year_id AND y.school_id=p.school_id AND y.is_current=1 WHERE p.school_id=?`).bind(u.school_id).first();return c.json({data:r});});
  app.put('/api/admin/fees/policy',requireAuth,async c=>{const u=requireRole(c,'admin'),v=parse(financePolicyInput,await readBody(c)),year=await workflowYear(c),cfg=await db(c).prepare('SELECT currency FROM school_configuration WHERE school_id=?').bind(u.school_id).first<{currency:string}>(),g=crypto.randomUUID();if(!cfg)fail(409,'SCHOOL_SETUP_REQUIRED');return c.json(await command(c,'finance.policy',v,()=>[workflowYearGuard(c,year.id,g),guard(c,`NOT EXISTS(SELECT 1 FROM fee_invoices WHERE school_id=? AND academic_year_id=?) AND COALESCE((SELECT version FROM finance_policy WHERE school_id=? AND academic_year_id=?),0)=? AND EXISTS(SELECT 1 FROM school_configuration WHERE school_id=? AND currency=?)`,[u.school_id,year.id,u.school_id,year.id,v.version,u.school_id,cfg.currency],g+'-policy'),db(c).prepare('INSERT INTO finance_policy(school_id,academic_year_id,currency,invoice_prefix,receipt_prefix,number_width,next_invoice_number,next_receipt_number,version) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(school_id,academic_year_id) DO UPDATE SET currency=excluded.currency,invoice_prefix=excluded.invoice_prefix,receipt_prefix=excluded.receipt_prefix,number_width=excluded.number_width,next_invoice_number=excluded.next_invoice_number,next_receipt_number=excluded.next_receipt_number,version=excluded.version').bind(u.school_id,year.id,cfg.currency,v.invoicePrefix,v.receiptPrefix,v.numberWidth,v.nextInvoiceNumber,v.nextReceiptNumber,v.version+1),audit(c,'configure','finance_policy',year.id),cleanupGuards(c,g),cleanupGuards(c,g+'-policy')],{message:'Actual numbering policy saved; locked after the first invoice.',data:{version:v.version+1}}));});
  app.get('/api/admin/fees/form-options',requireAuth,async c=>{const u=requireRole(c,'admin'),q='%'+directoryInput(c.req.query()).q+'%',r=await db(c).batch([db(c).prepare('SELECT id AS value,name AS label FROM fee_groups WHERE school_id=? AND archived_at IS NULL ORDER BY name LIMIT 500').bind(u.school_id),db(c).prepare(`SELECT s.id AS value,u.full_name||' ('||s.admission_no||')' AS label FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id AND u.status='active' JOIN academic_years y ON y.id=s.academic_year_id AND y.school_id=s.school_id AND y.is_current=1 WHERE s.school_id=? AND s.status='active' AND (u.full_name LIKE ? OR s.admission_no LIKE ?) ORDER BY u.full_name LIMIT 100`).bind(u.school_id,q,q),db(c).prepare('SELECT currency FROM school_configuration WHERE school_id=? AND configuration_verified_at IS NOT NULL').bind(u.school_id)]);if(r.some(v=>!v.success))fail(503,'FEES_READ_FAILED');return c.json({data:{groups:r[0].results,students:r[1].results,currency:(r[2].results[0] as {currency:string}|undefined)?.currency||null}});});
  app.post('/api/admin/fees/groups',requireAuth,async c=>{const u=requireRole(c,'admin'),v=parse(feeGroupInput,await readBody(c)),year=await workflowYear(c),id=crypto.randomUUID(),g=crypto.randomUUID();return c.json(await command(c,'fee_group.create',v,()=>[workflowYearGuard(c,year.id,g),db(c).prepare('INSERT INTO fee_groups(id,school_id,name,description,created_at,updated_at) VALUES(?,?,?,?,unixepoch(),unixepoch())').bind(id,u.school_id,v.name,v.description||null),audit(c,'create','fee_group',id),cleanupGuards(c,g)],{message:'Actual fee group saved.',data:{id}}),201);});
  app.post('/api/admin/fees/invoices',requireAuth,async c=>{const u=requireRole(c,'admin'),v=parse(feeInvoiceInput,await readBody(c)),year=await workflowYear(c),p=await policy(c,year.id),id=crypto.randomUUID(),g=crypto.randomUUID();dateInYear(v.dueDate,year);const response=await command(c,'fee_invoice.issue',v,()=>[workflowYearGuard(c,year.id,g),policyGuard(c,year.id,p,g+'-policy'),guard(c,`EXISTS(SELECT 1 FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id AND u.status='active' WHERE s.school_id=? AND s.id=? AND s.status='active' AND s.academic_year_id=?) AND EXISTS(SELECT 1 FROM fee_groups WHERE school_id=? AND id=? AND archived_at IS NULL)`,[u.school_id,v.studentId,year.id,u.school_id,v.feeGroupId],g+'-relations'),db(c).prepare('UPDATE finance_policy SET next_invoice_number=next_invoice_number+1 WHERE school_id=? AND academic_year_id=?').bind(u.school_id,year.id),db(c).prepare(`INSERT INTO fee_invoices(id,school_id,student_id,fee_group_id,invoice_no,amount_paise,due_date,due_on,currency,academic_year_id,created_at,updated_at) SELECT ?,school_id,?,?,invoice_prefix||printf('%0*d',number_width,next_invoice_number-1),?,?,?,?,academic_year_id,unixepoch(),unixepoch() FROM finance_policy WHERE school_id=? AND academic_year_id=?`).bind(id,v.studentId,v.feeGroupId,v.amountMinor,Date.parse(v.dueDate+'T00:00:00Z')/1000,v.dueDate,p.currency,u.school_id,year.id),audit(c,'issue','fee_invoice',id),cleanupGuards(c,g),cleanupGuards(c,g+'-policy'),cleanupGuards(c,g+'-relations')],{message:'Invoice issued.',data:{id}});return c.json({...response,data:await db(c).prepare('SELECT id,invoice_no AS invoiceNo,amount_paise AS amountMinor,currency,version FROM fee_invoices WHERE school_id=? AND id=?').bind(u.school_id,(response.data as {id:string}).id).first()},201);});
  app.get('/api/admin/fees/invoices/:id',requireAuth,async c=>{const u=requireRole(c,'admin'),row=await db(c).prepare('SELECT id,invoice_no AS invoiceNo,student_id AS studentId,amount_paise AS amountMinor,paid_minor AS paidMinor,concession_minor AS concessionMinor,amount_paise-paid_minor-concession_minor AS balanceMinor,currency,version,status,cancellation_reason AS cancellationReason FROM fee_invoice_balances WHERE school_id=? AND id=?').bind(u.school_id,c.req.param('id')).first();if(!row)fail(404,'INVOICE_NOT_FOUND');return c.json({data:row});});
  app.get('/api/admin/fees/receipts',requireAuth,async c=>{const u=requireRole(c,'admin'),v=directoryInput(c.req.query()),id=c.req.query('invoiceId')||null,r=await db(c).batch([db(c).prepare('SELECT COUNT(*) AS total FROM fee_ledger_entries WHERE school_id=? AND (? IS NULL OR invoice_id=?)').bind(u.school_id,id,id),db(c).prepare(receiptSelect+' WHERE l.school_id=? AND (? IS NULL OR l.invoice_id=?) ORDER BY l.created_at DESC,l.rowid DESC LIMIT ? OFFSET ?').bind(u.school_id,id,id,v.perPage,v.offset)]);if(r.some(v=>!v.success))fail(503,'RECEIPT_READ_FAILED');return c.json({data:r[1].results,total:(r[0].results[0] as {total:number}).total});});
  app.get('/api/admin/fees/receipts/:id',requireAuth,async c=>{const u=requireRole(c,'admin'),row=await db(c).prepare(receiptSelect+' WHERE l.school_id=? AND l.id=?').bind(u.school_id,c.req.param('id')).first();if(!row)fail(404,'RECEIPT_NOT_FOUND');return c.json({data:row});});
  app.post('/api/admin/fees/payments',requireAuth,async c=>{const u=requireRole(c,'admin'),v=parse(feePaymentInput,await readBody(c)),year=await workflowYear(c),p=await policy(c,year.id),id=crypto.randomUUID(),g=crypto.randomUUID();dateInYear(v.paidOn,year);if(v.paidOn>localCalendarDate(new Date().toISOString(),year.timezone))fail(422,'FUTURE_PAYMENT_DATE');const response=await command(c,'fee.collection',v,()=>[workflowYearGuard(c,year.id,g),policyGuard(c,year.id,p,g+'-policy'),guard(c,`EXISTS(SELECT 1 FROM fee_invoice_balances WHERE school_id=? AND id=? AND version=? AND academic_year_id=? AND currency=? AND status!='cancelled' AND amount_paise-paid_minor-concession_minor>=?)`,[u.school_id,v.invoiceId,v.version,year.id,p.currency,v.amountMinor+v.concessionMinor],g+'-balance'),db(c).prepare('UPDATE finance_policy SET next_receipt_number=next_receipt_number+1 WHERE school_id=? AND academic_year_id=?').bind(u.school_id,year.id),db(c).prepare(`INSERT INTO fee_ledger_entries(id,school_id,invoice_id,student_id,academic_year_id,currency,receipt_no,entry_type,amount_minor,concession_minor,payment_mode,transaction_ref,paid_on,remarks,created_by,created_at) SELECT ?,i.school_id,i.id,i.student_id,i.academic_year_id,i.currency,p.receipt_prefix||printf('%0*d',p.number_width,p.next_receipt_number-1),'collection',?,?,?,?,?,?,?,unixepoch() FROM fee_invoices i JOIN finance_policy p ON p.school_id=i.school_id AND p.academic_year_id=i.academic_year_id WHERE i.school_id=? AND i.id=?`).bind(id,v.amountMinor,v.concessionMinor,v.paymentMode,v.transactionRef,v.paidOn,v.remarks,u.id,u.school_id,v.invoiceId),db(c).prepare(`UPDATE fee_invoices SET status=CASE WHEN (SELECT paid_minor+concession_minor FROM fee_invoice_balances WHERE school_id=? AND id=?)=amount_paise THEN 'paid' ELSE 'partially_paid' END,version=version+1,updated_at=unixepoch() WHERE school_id=? AND id=? AND version=?`).bind(u.school_id,v.invoiceId,u.school_id,v.invoiceId,v.version),audit(c,'record_collection','fee_ledger',id),cleanupGuards(c,g),cleanupGuards(c,g+'-policy'),cleanupGuards(c,g+'-balance')],{message:'Actual collection recorded. No payment provider charged and no notification sent.',data:{id,invoiceId:v.invoiceId,version:v.version+1}});return c.json({...response,data:await db(c).prepare(receiptSelect+' WHERE l.school_id=? AND l.id=?').bind(u.school_id,(response.data as {id:string}).id).first()},201);});
  app.post('/api/admin/fees/invoices/:id/cancel',requireAuth,async c=>{const u=requireRole(c,'admin'),id=c.req.param('id')!,v=parse(z.object({version:z.number().int().positive(),reason:requiredText(500)}).strict(),await readBody(c)),g=crypto.randomUUID();return c.json(await command(c,'fee_invoice.cancel',{id,...v},()=>[guard(c,`EXISTS(SELECT 1 FROM fee_invoice_balances WHERE school_id=? AND id=? AND version=? AND status!='cancelled' AND paid_minor=0 AND concession_minor=0)`,[u.school_id,id,v.version],g),db(c).prepare("UPDATE fee_invoices SET status='cancelled',cancellation_reason=?,cancelled_by=?,cancelled_at=unixepoch(),version=version+1,updated_at=unixepoch() WHERE school_id=? AND id=? AND version=?").bind(v.reason,u.id,u.school_id,id,v.version),audit(c,'cancel','fee_invoice',id),cleanupGuards(c,g)],{message:'Unpaid invoice cancelled; history retained.',data:{id,version:v.version+1}}));});
  app.post('/api/admin/fees/receipts/:id/reverse',requireAuth,async c=>{const u=requireRole(c,'admin'),original=c.req.param('id')!,v=parse(z.object({invoiceId:requiredText(100),version:z.number().int().positive(),paidOn:dateInput,reason:requiredText(500)}).strict(),await readBody(c)),year=await workflowYear(c),p=await policy(c,year.id),id=crypto.randomUUID(),g=crypto.randomUUID();dateInYear(v.paidOn,year);if(v.paidOn>localCalendarDate(new Date().toISOString(),year.timezone))fail(422,'FUTURE_PAYMENT_DATE');return c.json(await command(c,'fee.reverse',{original,...v},()=>[workflowYearGuard(c,year.id,g),policyGuard(c,year.id,p,g+'-policy'),guard(c,`EXISTS(SELECT 1 FROM fee_ledger_entries l JOIN fee_invoices i ON i.id=l.invoice_id AND i.school_id=l.school_id WHERE l.school_id=? AND l.id=? AND l.invoice_id=? AND l.entry_type='collection' AND l.paid_on<=? AND i.version=? AND i.academic_year_id=? AND i.currency=? AND i.status!='cancelled' AND NOT EXISTS(SELECT 1 FROM fee_ledger_entries r WHERE r.school_id=l.school_id AND r.reverses_id=l.id))`,[u.school_id,original,v.invoiceId,v.paidOn,v.version,year.id,p.currency],g+'-balance'),db(c).prepare('UPDATE finance_policy SET next_receipt_number=next_receipt_number+1 WHERE school_id=? AND academic_year_id=?').bind(u.school_id,year.id),db(c).prepare(`INSERT INTO fee_ledger_entries(id,school_id,invoice_id,student_id,academic_year_id,currency,receipt_no,entry_type,amount_minor,concession_minor,payment_mode,transaction_ref,paid_on,remarks,created_by,created_at,reverses_id) SELECT ?,l.school_id,l.invoice_id,l.student_id,l.academic_year_id,l.currency,p.receipt_prefix||printf('%0*d',p.number_width,p.next_receipt_number-1),'reversal',-l.amount_minor,-l.concession_minor,l.payment_mode,l.transaction_ref,?,?,?,unixepoch(),l.id FROM fee_ledger_entries l JOIN finance_policy p ON p.school_id=l.school_id AND p.academic_year_id=l.academic_year_id WHERE l.school_id=? AND l.id=?`).bind(id,v.paidOn,v.reason,u.id,u.school_id,original),db(c).prepare(`UPDATE fee_invoices SET status=CASE WHEN (SELECT paid_minor+concession_minor FROM fee_invoice_balances WHERE school_id=? AND id=?)=0 THEN 'unpaid' ELSE 'partially_paid' END,version=version+1,updated_at=unixepoch() WHERE school_id=? AND id=? AND version=?`).bind(u.school_id,v.invoiceId,u.school_id,v.invoiceId,v.version),audit(c,'record_reversal','fee_ledger',id),cleanupGuards(c,g),cleanupGuards(c,g+'-policy'),cleanupGuards(c,g+'-balance')],{message:'Ledger correction recorded; original receipt retained. This does not refund or transfer money through a provider.',data:{id,version:v.version+1}}),201);});
}
