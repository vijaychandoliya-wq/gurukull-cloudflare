import type {Hono} from 'hono';
import {db,requireAuth,requireRole,type AppEnv} from './context.js';
import {directoryInput} from './admin.js';
import {workflowYear} from './workflow-common.js';
import {fail} from './security.js';
import {feeBalance} from './fee-management.js';

export function counterStudentQuery(school:string,year:string,q:string){
 const search=q;
 const from=`FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN academic_years y ON y.school_id=s.school_id AND y.id=s.academic_year_id LEFT JOIN classes cl ON cl.id=s.class_id AND cl.school_id=s.school_id LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=? AND s.academic_year_id=? AND (instr(lower(u.full_name),lower(?))>0 OR instr(lower(s.admission_no),lower(?))>0 OR EXISTS(SELECT 1 FROM parent_student_links l JOIN users pu ON pu.id=l.parent_user_id AND pu.school_id=l.school_id LEFT JOIN parent_profiles pp ON pp.user_id=pu.id AND pp.school_id=pu.school_id WHERE l.school_id=s.school_id AND l.student_id=s.id AND (instr(pu.mobile,?)>0 OR instr(pp.contact_mobile,?)>0)))`;
 return {from,values:[school,year,search,search,search,search]};
}
export const counterInvoiceSelect=`SELECT i.id,i.invoice_no AS invoiceNo,g.name AS feeName,f.term,i.due_on AS dueDate,i.amount_paise AS amountMinor,i.paid_minor AS paidMinor,i.concession_minor AS concessionMinor,i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor,i.currency,i.status,i.version FROM fee_invoice_balances i JOIN fee_groups g ON g.school_id=i.school_id AND g.id=i.fee_group_id LEFT JOIN fee_structures f ON f.school_id=i.school_id AND f.id=i.structure_id WHERE i.school_id=? AND i.academic_year_id=? AND i.student_id=?`;
export function registerFeeCounter(app:Hono<AppEnv>){
 app.get('/api/admin/fees/counter/context',requireAuth,async c=>{
  const u=requireRole(c,'admin'),year=await workflowYear(c);
  const context=await db(c).prepare('SELECT y.id,y.name,y.starts_on AS startsOn,y.ends_on AS endsOn,cfg.currency,cfg.timezone FROM academic_years y JOIN school_configuration cfg ON cfg.school_id=y.school_id WHERE y.school_id=? AND y.id=?').bind(u.school_id,year.id).first();
  return c.json({data:context});
 });
 app.get('/api/admin/fees/counter/students',requireAuth,async c=>{
  const u=requireRole(c,'admin'),year=await workflowYear(c),v=directoryInput(c.req.query()),query=counterStudentQuery(u.school_id,year.id,v.q);
  const r=await db(c).batch([db(c).prepare('SELECT COUNT(*) AS total '+query.from).bind(...query.values),db(c).prepare(`SELECT s.id,u.full_name AS fullName,s.admission_no AS admissionNo,cl.name||' - '||se.name AS className,y.name AS academicYear,u.status,COALESCE((SELECT SUM(i.amount_paise-i.paid_minor-i.concession_minor) FROM fee_invoice_balances i WHERE i.school_id=s.school_id AND i.student_id=s.id AND i.academic_year_id=s.academic_year_id AND i.status!='cancelled'),0) AS balanceMinor `+query.from+' ORDER BY u.full_name,s.id LIMIT ? OFFSET ?').bind(...query.values,v.perPage,v.offset)]);
  if(r.some(x=>!x.success))fail(503,'FEES_READ_FAILED');return c.json({data:r[1].results,total:(r[0].results[0] as {total:number}).total});
 });
 app.get('/api/admin/fees/counter/students/:id',requireAuth,async c=>{
  const u=requireRole(c,'admin'),year=await workflowYear(c),id=c.req.param('id'),v=directoryInput(c.req.query());
  const person=await db(c).prepare(`SELECT s.id,u.full_name AS fullName,s.admission_no AS admissionNo,cl.name||' - '||se.name AS className,y.name AS academicYear FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN academic_years y ON y.school_id=s.school_id AND y.id=s.academic_year_id LEFT JOIN classes cl ON cl.id=s.class_id AND cl.school_id=s.school_id LEFT JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE s.school_id=? AND s.id=? AND s.academic_year_id=?`).bind(u.school_id,id,year.id).first();
  if(!person)fail(404,'STUDENT_NOT_FOUND','This student is not available in the current school year.');
  const filter=c.req.query('history')==='1'?'':" AND i.status!='cancelled' AND i.amount_paise-i.paid_minor-i.concession_minor>0";
  const values=[u.school_id,year.id,id],r=await db(c).batch([db(c).prepare('SELECT COUNT(*) AS total FROM ('+counterInvoiceSelect+filter+')').bind(...values),db(c).prepare(counterInvoiceSelect+filter+' ORDER BY i.due_on,i.id LIMIT ? OFFSET ?').bind(...values,v.perPage,v.offset)]);
  if(r.some(x=>!x.success))fail(503,'FEES_READ_FAILED');for(const row of r[1].results as Record<string,unknown>[])if(feeBalance(Number(row.amountMinor),Number(row.paidMinor),Number(row.concessionMinor))===null)fail(503,'LEDGER_RECONCILIATION_REQUIRED');
  return c.json({data:{student:person,invoices:r[1].results},total:(r[0].results[0] as {total:number}).total});
 });
 app.get('/api/admin/fees/counter/commands/:id',requireAuth,async c=>{
  const u=requireRole(c,'admin'),id=c.req.param('id');
  if(!/^[-A-Za-z0-9_]{1,128}$/.test(id))fail(422,'INVALID_COMMAND');
  const row=await db(c).prepare(`SELECT l.id AS receiptId FROM mutation_commands m JOIN fee_ledger_entries l ON l.school_id=m.school_id AND l.id=json_extract(m.response_json,'$.data.id') AND l.created_by=m.actor_id WHERE m.school_id=? AND m.actor_id=? AND m.command_id=? AND l.entry_type='collection'`).bind(u.school_id,u.id,id).first();
  c.header('Cache-Control','no-store');return c.json({data:row||null});
 });
}
