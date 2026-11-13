import type {Hono} from 'hono';
import {db,requireAuth,requireRole,type ApiContext,type AppEnv} from './context.js';
import {fail} from './security.js';
import {feeBalance} from './fee-management.js';
import {scopedStudent} from './academic-work.js';

// P0-2 fee demand: one student's whole open term bill, consolidated by fee
// head with totals, the next due date and the last receipt. Read-only,
// tenant-scoped; the printable document is a view of this data, not a copy.

const demandSelect=`
 SELECT i.id,i.invoice_no AS invoiceNo,i.status,
  i.amount_paise AS billedMinor,i.paid_minor AS paidMinor,i.concession_minor AS concessionMinor,
  i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor,
  i.currency,i.due_on AS dueOn,g.name AS feeHead,
  COALESCE(f.name,'') AS structureName,COALESCE(f.term,'') AS term
 FROM fee_invoice_balances i
 JOIN fee_groups g ON g.id=i.fee_group_id AND g.school_id=i.school_id
 LEFT JOIN fee_structures f ON f.id=i.structure_id AND f.school_id=i.school_id
 WHERE i.school_id=? AND i.student_id=? AND i.status!='cancelled' AND i.amount_paise-i.paid_minor-i.concession_minor>0
 ORDER BY i.due_on,i.id`;

async function demandForStudent(c:ApiContext,studentId:string){
 const u=requireRole(c,'admin','parent','student'),school=u.school_id;
 const student=await db(c).prepare(`
  SELECT su.full_name AS studentName,s.admission_no AS admissionNo,s.academic_year_id AS academicYearId,
  y.name AS yearName,cl.name AS className,se.name AS sectionName,COALESCE(cfg.currency,sc.currency) AS currency
  FROM students s
  JOIN users su ON su.id=s.user_id AND su.school_id=s.school_id
  LEFT JOIN classes cl ON cl.id=s.class_id AND cl.school_id=s.school_id
  LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id
  LEFT JOIN academic_years y ON y.id=s.academic_year_id AND y.school_id=s.school_id
  LEFT JOIN school_configuration cfg ON cfg.school_id=s.school_id
  JOIN schools sc ON sc.id=s.school_id
  WHERE s.school_id=? AND s.id=?`).bind(school,studentId).first();
 if(!student)fail(404,'STUDENT_NOT_FOUND');
 const heads=await db(c).prepare(demandSelect).bind(school,studentId).all();
 if(!heads.success)fail(503,'FEES_READ_FAILED');
 for(const row of heads.results as Record<string,unknown>[])if(feeBalance(Number(row.billedMinor),Number(row.paidMinor),Number(row.concessionMinor))===null)fail(503,'LEDGER_RECONCILIATION_REQUIRED');
 const lastReceipt=await db(c).prepare(`SELECT receipt_no FROM fee_ledger_entries WHERE school_id=? AND student_id=? AND entry_type='collection' AND NOT EXISTS(SELECT 1 FROM fee_ledger_entries r WHERE r.school_id=fee_ledger_entries.school_id AND r.reverses_id=fee_ledger_entries.id) ORDER BY created_at DESC,receipt_no DESC LIMIT 1`).bind(school,studentId).first<{receipt_no:string}>();
 const rows=heads.results as Array<{invoiceNo:string;status:string;billedMinor:number;paidMinor:number;concessionMinor:number;balanceMinor:number;currency:string;dueOn:string;feeHead:string;structureName:string;term:string}>;
 const totals={billedMinor:0,paidMinor:0,concessionMinor:0,balanceMinor:0};
 for(const r of rows){totals.billedMinor+=r.billedMinor;totals.paidMinor+=r.paidMinor;totals.concessionMinor+=r.concessionMinor;totals.balanceMinor+=r.balanceMinor;}
 c.header('Cache-Control','no-store');
 return c.json({data:{
  student:{name:student.studentName,admissionNo:student.admissionNo,className:student.className||null,sectionName:student.sectionName||null,yearName:student.yearName||null,currency:student.currency||null},
  heads:rows,
  totals,
  nextDue:rows.length?rows[0].dueOn:null,
  lastReceiptNo:lastReceipt?.receipt_no||null,
 }});
}

export function registerFeeDemand(app:Hono<AppEnv>){
 app.get('/api/admin/fees/demand/:studentId',requireAuth,async c=>demandForStudent(c,c.req.param('studentId')!));
 app.get('/api/portal/fee-demand/:studentId',requireAuth,async c=>{const s=await scopedStudent(c,c.req.param('studentId')!);return demandForStudent(c,String(s.id));});
}
