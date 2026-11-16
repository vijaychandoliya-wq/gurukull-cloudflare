import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type ApiContext,type AppEnv,type Env} from './context.js';
import {fail} from './security.js';
import {hmacKey} from './hmac-key.js';
import {audit,command,cleanupGuards,guard,parse,requiredText} from './management-common.js';
import {scopedStudent} from './academic-work.js';
import {localCalendarDate} from './notice-management.js';

const nowSec=()=>Math.floor(Date.now()/1000);
const INTENT_LEASE_SECONDS=300;
const INTENT_AMOUNT_CAP=1000000000000;
const METHOD_MAP:Record<string,string>={upi:'upi',card:'card',netbanking:'bank_transfer',emandate:'auto_debit'};

export const gatewayInput=z.object({
 merchantId:requiredText(100),
 merchantKey:requiredText(200),
 webhookSecret:z.string().regex(/^[A-Za-z0-9_-]{32,128}$/,'The webhook secret must be 32-128 characters from A-Z, a-z, 0-9, - or _.'),
}).strict();

export const payLinkInput=z.object({
 studentId:requiredText(100),
 invoiceIds:z.array(requiredText(100).refine(v=>/^[A-Za-z0-9-]{16,64}$/.test(v),'Select an actual fee invoice from the list.'))
  .min(1).max(100)
  .refine(v=>new Set(v).size===v.length,'Each invoice appears once.'),
 expiresInDays:z.number().int().min(1).max(30).default(1),
}).strict();

function constantTimeEqual(a:string,b:string){
 if(a.length!==b.length||!a.length)return false;
 let diff=0;
 for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);
 return diff===0;
}
async function hmacHex(secret:string,raw:string){
 const key=await hmacKey(secret);
 return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(raw)))).map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function primaryHost(c:ApiContext,schoolId:string){
 const row=await db(c).prepare(`SELECT hostname FROM domains WHERE school_id=? AND status='active' AND is_primary=1 ORDER BY created_at LIMIT 1`).bind(schoolId).first<{hostname:string}>();
 return row?.hostname||null;
}
interface LedgerEntryDraft{invoiceId:string;version:number;studentId:string;currency:string;yearId:string;minor:number;receiptNo:string}
interface InvoiceOpen{invoiceId:string;version:number;yearId:string;studentId:string;currency:string;balance:number}
type WebhookIntent={
 id:string;schoolId:string;studentId:string;status:string;amountPaise:number;currency:string;
 createdBy:string|null;secret:string|null;enabled:boolean;leaseUntil:number|null;
}

export async function expirePaymentIntents(env:Env):Promise<{expired:number;reclaimed:number}>{
 if(!env.DB)return {expired:0,reclaimed:0};
 const now=nowSec();
 const reclaimed=await env.DB.prepare(`UPDATE fee_payment_intents SET status='pending',lease_id=NULL,lease_until=NULL WHERE status='processing' AND lease_until<=?`).bind(now).run();
 const expired=await env.DB.prepare(`UPDATE fee_payment_intents SET status='expired',lease_id=NULL,lease_until=NULL WHERE status='pending' AND expires_at<=?`).bind(now).run();
 return {expired:Number(expired.meta?.changes||0),reclaimed:Number(reclaimed.meta?.changes||0)};
}

export function registerFeePayments(app:Hono<AppEnv>){
 app.get('/api/admin/fees/gateway',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const row=await db(c).prepare(`SELECT provider,merchant_id,currency,enabled,version,updated_at FROM fee_payment_gateways WHERE school_id=? AND provider='razorpay'`).bind(u.school_id).first<Record<string,unknown>|null>();
  const host=await primaryHost(c,u.school_id);
  return c.json({data:row
   ?{configured:true,provider:row.provider,merchantId:row.merchant_id,enabled:!!row.enabled,currency:row.currency,version:row.version,webhookUrl:host?`https://${host}/api/pay/webhook/razorpay`:null}
   :{configured:false,webhookUrl:host?`https://${host}/api/pay/webhook/razorpay`:null}});
 });
 app.put('/api/admin/fees/gateway',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const v=parse(gatewayInput,await readBody(c));
  const g=crypto.randomUUID();
  return c.json(await command(c,'fee_gateway.configure',v,()=>[
   guard(c,'EXISTS(SELECT 1 FROM school_configuration WHERE school_id=? AND configuration_verified_at IS NOT NULL AND currency IS NOT NULL)',[u.school_id],g+'-setup'),
   db(c).prepare(`INSERT INTO fee_payment_gateways(school_id,provider,merchant_id,merchant_key,webhook_secret,currency,enabled,version,created_by,updated_at)
    SELECT ?,'razorpay',?,?,?,currency,0,COALESCE((SELECT version FROM fee_payment_gateways WHERE school_id=?),0)+1,?,unixepoch()
    FROM school_configuration WHERE school_id=?
    ON CONFLICT(school_id,provider) DO UPDATE SET merchant_id=excluded.merchant_id,merchant_key=excluded.merchant_key,webhook_secret=excluded.webhook_secret,currency=excluded.currency,version=fee_payment_gateways.version+1,created_by=excluded.created_by,updated_at=excluded.updated_at`).bind(u.school_id,v.merchantId,v.merchantKey,v.webhookSecret,u.school_id,u.id,u.school_id),
   audit(c,'configure','fee_gateway',u.school_id),
   cleanupGuards(c,g+'-setup'),
  ],{message:'Gateway credentials stored. The gateway stays disabled until the self-test passes.',data:{configured:true,enabled:false}}));
 });
 app.post('/api/admin/fees/gateway/self-test',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const row=await db(c).prepare(`SELECT merchant_id,merchant_key,enabled FROM fee_payment_gateways WHERE school_id=? AND provider='razorpay'`).bind(u.school_id).first<{merchant_id:string;merchant_key:string;enabled:number}>();
  if(!row)fail(409,'GATEWAY_NOT_CONFIGURED','Store the gateway credentials before testing the webhook.');
  const apiBase=c.env?.RAZORPAY_API_URL||'https://api.razorpay.com/v1';
  const live=await fetch(`${apiBase}/orders`,{method:'GET',headers:{Authorization:`Basic ${btoa(`${row.merchant_id}:${row.merchant_key}`)}`}})
   .then(r=>r.status===200).catch(()=>false);
  if(!live)fail(422,'GATEWAY_CREDENTIALS_INVALID','The provider rejected the stored merchant credentials. Nothing was changed.');
  const flipped=await db(c).prepare(`UPDATE fee_payment_gateways SET enabled=1,version=version+1,updated_at=unixepoch() WHERE school_id=? AND provider='razorpay' AND enabled=0`).bind(u.school_id).run();
  if(!flipped.success||!(flipped.meta?.changes&&Number(flipped.meta.changes)>0))fail(503,'GATEWAY_UPDATE_FAILED');
  await audit(c,'enable_gateway','fee_gateway',u.school_id).run();
  return c.json({data:{enabled:true,credentialsLive:true}});
 });

 const intentSelect=`
  SELECT i.id,i.amount_paise AS amountPaise,i.currency,i.status,i.expires_at AS expiresAt,i.paid_at AS paidAt,
   i.receipt_no AS receiptNo,i.last_error AS lastError,i.created_at AS createdAt,i.provider_ref AS providerRef,
   u.full_name AS studentName,s.admission_no AS admissionNo,
   (SELECT COUNT(*) FROM fee_payment_intent_invoices x WHERE x.intent_id=i.id) AS invoiceCount
  FROM fee_payment_intents i
  JOIN students s ON s.id=i.student_id AND s.school_id=i.school_id
  JOIN users u ON u.id=s.user_id AND u.school_id=u.school_id`;
 app.get('/api/admin/fees/pay-links',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const status=c.req.query('status'),studentId=c.req.query('studentId');
  const where:string[]=['i.school_id=?'],binds:(string|number)[]=[u.school_id];
  if(status){where.push('i.status=?');binds.push(status);}
  if(studentId){where.push('i.student_id=?');binds.push(studentId);}
  const r=await db(c).prepare(`${intentSelect} WHERE ${where.join(' AND ')} ORDER BY i.created_at DESC LIMIT 200`).bind(...binds).all<Record<string,unknown>>();
  if(!r.success)fail(503,'PAY_LINKS_READ_FAILED');
  const now=nowSec();
  const counts=await db(c).prepare(`SELECT COUNT(*) AS open,
   SUM(CASE WHEN status='paid' AND paid_at>=? THEN 1 ELSE 0 END) AS paidToday,
   SUM(CASE WHEN status='expired' AND expires_at>=? THEN 1 ELSE 0 END) AS expired7d
   FROM fee_payment_intents WHERE school_id=?`).bind(now-86400,now-7*86400,u.school_id).first<Record<string,number>>();
  return c.json({data:r.results,summary:{open:Number(counts?.open||0),paidToday:Number(counts?.paidToday||0),expired7d:Number(counts?.expired7d||0)}});
 });
 app.post('/api/admin/fees/pay-links',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const v=parse(payLinkInput,await readBody(c));
  const gateway=await db(c).prepare(`SELECT enabled FROM fee_payment_gateways WHERE school_id=? AND provider='razorpay'`).bind(u.school_id).first<{enabled:number}>();
  if(!gateway||!gateway.enabled)fail(409,'GATEWAY_NOT_ENABLED','Configure and self-test the payment gateway before issuing payment links.');
  const totalRow=await db(c).prepare(`SELECT COALESCE(SUM(amount_paise-paid_minor-concession_minor),0) AS total,
   COUNT(*) AS openCount FROM fee_invoice_balances WHERE school_id=? AND student_id=? AND status!='cancelled' AND amount_paise-paid_minor-concession_minor>0 AND id IN (${v.invoiceIds.map(()=>'?').join(',')})`).bind(u.school_id,v.studentId,...v.invoiceIds).first<{total:number;openCount:number}>();
  if(!totalRow||Number(totalRow.openCount)!==v.invoiceIds.length)fail(422,'SELECT_INVALID_INVOICES','Every selected invoice must belong to this student and still have an open balance.');
  if(!totalRow.total)fail(422,'NO_OPEN_INVOICES','None of the selected invoices has an open balance. Collect or cancel them first.');
  if(totalRow.total>INTENT_AMOUNT_CAP)fail(422,'PAY_LINK_AMOUNT_CAP','The combined open balance exceeds the payment-link cap.');
  const id=crypto.randomUUID(),g=crypto.randomUUID();
  const response=await command(c,'fee_paylink.create',v,()=>[
   guard(c,'EXISTS(SELECT 1 FROM users su JOIN students s ON s.user_id=su.id AND s.school_id=su.school_id WHERE s.school_id=? AND s.id=? AND s.status=\'active\' AND su.status=\'active\')',[u.school_id,v.studentId],g+'-student'),
   guard(c,`(SELECT COUNT(*) FROM fee_invoice_balances i WHERE i.school_id=? AND i.student_id=? AND i.status!='cancelled' AND i.amount_paise-i.paid_minor-i.concession_minor>0 AND i.id IN (${v.invoiceIds.map(()=>'?').join(',')}))=? AND (SELECT COUNT(*) FROM fee_invoices i WHERE i.school_id=? AND i.id IN (${v.invoiceIds.map(()=>'?').join(',')}) AND i.currency IS NOT NULL AND i.currency=(SELECT currency FROM fee_invoices WHERE school_id=? AND id=? LIMIT 1))=?`,[u.school_id,v.studentId,...v.invoiceIds,v.invoiceIds.length,u.school_id,...v.invoiceIds,u.school_id,v.invoiceIds[0],v.invoiceIds.length],g+'-open'),
   db(c).prepare(`INSERT INTO fee_payment_intents(id,school_id,student_id,gateway,provider_ref,status,amount_paise,currency,expires_at,created_by,created_at)
    SELECT ?,?,?,'razorpay',NULL,'pending',
     (SELECT COALESCE(SUM(amount_paise-paid_minor-concession_minor),0) FROM fee_invoice_balances WHERE school_id=? AND student_id=? AND status!='cancelled' AND amount_paise-paid_minor-concession_minor>0 AND id IN (${v.invoiceIds.map(()=>'?').join(',')})),
     COALESCE((SELECT currency FROM fee_invoices WHERE school_id=? AND id=? LIMIT 1),(SELECT currency FROM school_configuration WHERE school_id=?)),
     unixepoch()+?,?,unixepoch()`).bind(id,u.school_id,v.studentId,u.school_id,v.studentId,...v.invoiceIds,u.school_id,v.invoiceIds[0],u.school_id,v.expiresInDays*86400,u.id),
   ...v.invoiceIds.map(invoiceId=>db(c).prepare(`INSERT INTO fee_payment_intent_invoices(intent_id,invoice_id) SELECT ?,? FROM fee_invoice_balances WHERE id=? AND school_id=? AND status!='cancelled' AND amount_paise-paid_minor-concession_minor>0`).bind(id,invoiceId,invoiceId,u.school_id)),
   audit(c,'create_pay_link','fee_payment_intent',id),
   cleanupGuards(c,g+'-student'),
   cleanupGuards(c,g+'-open'),
  ],{message:'Payment link created.',data:{id}});
  const host=await primaryHost(c,u.school_id);
  const data=(response.data as {id:string});
  return c.json({...response,data:{...data,url:host?`https://${host}/pay/${id}`:`/pay/${id}`}},201);
 });
 app.post('/api/admin/fees/pay-links/:id/cancel',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const id=c.req.param('id')!;
  const row=await db(c).prepare(`UPDATE fee_payment_intents SET status='cancelled',lease_id=NULL,lease_until=NULL WHERE school_id=? AND id=? AND status IN ('pending','failed') RETURNING status`).bind(u.school_id,id).first<{status:string}>();
  if(!row)fail(404,'PAY_LINK_NOT_CANCELLABLE','Only an open or failed link can be cancelled.');
  await audit(c,'cancel_pay_link','fee_payment_intent',id).run();
  return c.json({data:{id,status:'cancelled'}});
 });

 app.get('/api/portal/fee-pay-links',requireAuth,async c=>{
  const u=requireRole(c,'admin','parent','student');
  const s=await scopedStudent(c,c.req.query('studentId')||(u.user_type==='student'?u.id:undefined));
  const rows=await db(c).prepare(`SELECT i.id,i.amount_paise AS amountPaise,i.currency,i.status,i.expires_at AS expiresAt,i.created_at AS createdAt,i.receipt_no AS receiptNo,
   (SELECT COUNT(*) FROM fee_payment_intent_invoices x WHERE x.intent_id=i.id) AS invoiceCount
   FROM fee_payment_intents i WHERE i.school_id=? AND i.student_id=? AND i.status IN ('pending','paid') AND i.created_at>=? ORDER BY i.status='paid' DESC,i.created_at DESC LIMIT 10`)
   .bind(u.school_id,s.id,nowSec()-30*86400).all<Record<string,unknown>>();
  if(!rows.success)fail(503,'PAY_LINKS_READ_FAILED');
  return c.json({data:rows.results});
 });

 app.get('/api/fees/pay/:intentId',async c=>{
  const id=c.req.param('intentId')!;
  if(!/^[A-Za-z0-9-]{36}$/.test(id))fail(404,'PAY_LINK_NOT_FOUND');
  const intent=await db(c).prepare(`
   SELECT i.id,i.status,i.amount_paise AS amountPaise,i.currency,i.expires_at AS expiresAt,i.provider_ref AS providerRef,
    i.receipt_no AS receiptNo,u.full_name AS studentName,s.admission_no AS admissionNo,
    sch.name AS schoolName,sch.status AS schoolStatus,
    g.merchant_id AS merchantId,COALESCE(g.enabled,0) AS gatewayEnabled
   FROM fee_payment_intents i
   JOIN students s ON s.id=i.student_id AND s.school_id=i.school_id
   JOIN users u ON u.id=s.user_id AND u.school_id=u.school_id
   JOIN schools sch ON sch.id=s.school_id
   LEFT JOIN fee_payment_gateways g ON g.school_id=sch.id AND g.provider='razorpay'
   WHERE i.id=?`).bind(id).first<Record<string,unknown>>();
  if(!intent)fail(404,'PAY_LINK_NOT_FOUND');
  const invoices=await db(c).prepare(`
   SELECT x.invoice_id AS id,i.invoice_no AS invoiceNo,i.due_on AS dueOn,
    i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor
   FROM fee_payment_intent_invoices x
   JOIN fee_payment_intents p ON p.id=x.intent_id
   JOIN fee_invoice_balances i ON i.id=x.invoice_id AND i.school_id=p.school_id
   WHERE x.intent_id=? ORDER BY i.due_on,x.invoice_id`).bind(id).all<Record<string,unknown>>();
  if(!invoices.success)fail(503,'PAY_LINK_READ_FAILED');
  const v=intent as Record<string,unknown>;
  return c.json({data:{
   id,status:v.status,amountPaise:v.amountPaise,currency:v.currency,expiresAt:v.expiresAt,
   providerRef:v.providerRef||null,receiptNo:v.receiptNo||null,
   studentName:v.studentName,admissionNo:v.admissionNo,
   school:{name:v.schoolName,active:v.schoolStatus==='active'},
   gateway:{provider:'razorpay',enabled:!!v.gatewayEnabled,siteKey:v.merchantId||null},
   invoices:invoices.results,
  }});
 });

 app.post('/api/pay/:intentId/webhook/:provider',async c=>{
  const provider=c.req.param('provider')!;
  if(provider!=='razorpay')fail(404,'WEBHOOK_PROVIDER_UNKNOWN');
  const id=c.req.param('intentId')!;
  if(!/^[A-Za-z0-9-]{36}$/.test(id))fail(404,'PAY_LINK_NOT_FOUND');
  const raw=await c.req.text();
  let payload:Record<string,unknown>;
  try{payload=JSON.parse(raw) as Record<string,unknown>;}catch{fail(400,'WEBHOOK_BODY_INVALID');}
  const row=await db(c).prepare(`SELECT i.id,i.school_id AS schoolId,i.student_id AS studentId,i.status,i.amount_paise AS amountPaise,
   i.currency,i.created_by AS createdBy,i.lease_until AS leaseUntil,g.webhook_secret AS secret,COALESCE(g.enabled,0) AS enabled
   FROM fee_payment_intents i
   LEFT JOIN fee_payment_gateways g ON g.school_id=i.school_id AND g.provider='razorpay'
   WHERE i.id=?`).bind(id).first<WebhookIntent>();
  if(!row)fail(404,'PAY_LINK_NOT_FOUND');
  const intent=row as WebhookIntent;
  if(!intent.secret)fail(401,'WEBHOOK_SECRET_MISSING','Store the gateway webhook secret for this school first.');
  if(!constantTimeEqual(await hmacHex(intent.secret,raw),(c.req.header('x-gurukull-signature')||'').toLowerCase()))fail(401,'WEBHOOK_SIGNATURE_INVALID');
  const now=nowSec();
  const already=intent.status==='paid';
  const busy=intent.status==='processing'&&(intent.leaseUntil||0)>now;
  if(already||busy||intent.status!=='pending')return c.json({ok:true,noop:already?'already_recorded':'intent_'+intent.status});
  if(payload.event!=='payment.captured')return c.json({ok:true,ignored:true});
  if(!intent.enabled)return c.json({ok:true,ignored:'gateway_disabled'});
  const payment=payload.payment as {amount?:number;method?:string;id?:string}|undefined;
  const amount=typeof payment?.amount==='number'?payment.amount:NaN;
  const failCapture=async(detail:string)=>{
   await db(c).prepare(`UPDATE fee_payment_intents SET status='failed',last_error=? WHERE id=? AND status='pending'`).bind(detail,id).run();
   return c.json({ok:false,error:detail});
  };
  if(!Number.isSafeInteger(amount)||amount!==intent.amountPaise)return failCapture('AMOUNT_MISMATCH');
  const mode=payment?.method?METHOD_MAP[String(payment.method).toLowerCase()]:undefined;
  if(!mode)return failCapture('UNSUPPORTED_METHOD');
  const createdBy=intent.createdBy;
  if(!createdBy)return failCapture('CREATOR_MISSING');
  const lease=crypto.randomUUID();
  const claimed=await db(c).prepare(`UPDATE fee_payment_intents SET status='processing',lease_id=?,lease_until=? WHERE id=? AND (status='pending' OR (status='processing' AND lease_until<=?)) RETURNING id`).bind(lease,now+INTENT_LEASE_SECONDS,id,now).first<{id:string}>();
  if(!claimed)return c.json({ok:true,noop:'capture_in_progress'});
  const release=async(error:string)=>{
   await db(c).prepare(`UPDATE fee_payment_intents SET status='failed',last_error=?,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?`).bind(error,id,lease).run();
   return c.json({ok:false,error},503);
  };
  const open=await db(c).prepare(`
   SELECT x.invoice_id AS invoiceId,i.version,i.academic_year_id AS yearId,i.student_id AS studentId,i.currency,
    i.amount_paise-i.paid_minor-i.concession_minor AS balance
   FROM fee_payment_intent_invoices x
   JOIN fee_invoice_balances i ON i.id=x.invoice_id AND i.school_id=x.school_id
   WHERE x.intent_id=? ORDER BY x.invoice_id`).bind(id).all<Record<string,unknown>>();
  if(!open.success||(open.results.length===0))return release('INVOICE_SET_LOST');
  const rows=open.results as Array<{invoiceId:string;version:number;yearId:string;studentId:string;currency:string;balance:number}>;
  for(const r of rows)if(r.balance<=0)return release('BALANCE_CHANGED');
  const years=new Set(rows.map(r=>r.yearId));
  const currencies=new Set(rows.map(r=>r.currency));
  if(years.size>1||currencies.size>1)return release('INVOICE_YEARS_MIXED');
  const yearId=[...years][0];
  const policy=await db(c).prepare(`SELECT receipt_prefix, number_width, next_receipt_number, version FROM finance_policy WHERE school_id=? AND academic_year_id=? AND currency=?`).bind(intent.schoolId,yearId,intent.currency).first<{receipt_prefix:string;number_width:number;next_receipt_number:number;version:number}>();
  if(!policy)return release('POLICY_MISSING');
  let remaining=amount;
  const drafts:LedgerEntryDraft[]=[];
  for(const r of rows){
   if(remaining<=0)break;
   const minor=Math.min(r.balance,remaining);
   if(minor<=0)break;
   drafts.push({invoiceId:r.invoiceId,version:r.version,studentId:r.studentId,currency:r.currency,yearId,minor,receiptNo:`${policy.receipt_prefix}${String(policy.next_receipt_number+drafts.length).padStart(policy.number_width,'0')}`});
   remaining-=minor;
  }
  if(remaining>0)return release('BALANCE_CHANGED');
  const tzRow=await db(c).prepare(`SELECT timezone FROM school_configuration WHERE school_id=?`).bind(intent.schoolId).first<{timezone:string|null}>();
  const paidOn=localCalendarDate(new Date(now*1000).toISOString(),tzRow?.timezone||'Asia/Kolkata');
  const transactionRef=typeof payment?.id==='string'?payment.id:null;
  const statements:D1PreparedStatement[]=[];
  drafts.forEach((d,n)=>{
   statements.push(db(c).prepare(`
    INSERT INTO fee_ledger_entries(id,school_id,invoice_id,student_id,academic_year_id,currency,receipt_no,entry_type,amount_minor,concession_minor,payment_mode,transaction_ref,paid_on,remarks,created_by,created_at)
    VALUES (?,?,?,?,?,?,?,'collection',?,0,?,?,?,?,?,unixepoch())`).bind(
    crypto.randomUUID(),intent.schoolId,d.invoiceId,d.studentId,d.yearId,d.currency,d.receiptNo,d.minor,mode,transactionRef,paidOn,
    `Gateway fee link ${id.slice(0,8)} · ${d.receiptNo}`,createdBy));
   statements.push(guard(c,`EXISTS(SELECT 1 FROM fee_invoices WHERE school_id=? AND id=? AND version=? AND status!='cancelled')`,[intent.schoolId,d.invoiceId,d.version],lease.slice(0,20)+'-v'+n));
   statements.push(db(c).prepare(`
    UPDATE fee_invoices SET status=CASE WHEN (SELECT paid_minor+concession_minor FROM fee_invoice_balances WHERE school_id=? AND id=?)=amount_paise THEN 'paid' ELSE 'partially_paid' END,
    version=version+1,updated_at=unixepoch() WHERE school_id=? AND id=? AND version=?`).bind(intent.schoolId,d.invoiceId,intent.schoolId,d.invoiceId,d.version));
  });
  statements.push(db(c).prepare(`UPDATE finance_policy SET next_receipt_number=next_receipt_number+? WHERE school_id=? AND academic_year_id=? AND version=?`).bind(drafts.length,intent.schoolId,yearId,policy.version));
  statements.push(db(c).prepare(`UPDATE fee_payment_intents SET status='paid',paid_at=?,receipt_no=?,provider_ref=?,last_error=NULL,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?`).bind(now,drafts[0].receiptNo,transactionRef,id,lease));
  statements.push(db(c).prepare(`
   INSERT INTO outbox(id,school_id,event_type,aggregate_id,payload_json,status,attempts,scheduled_at,created_at)
   SELECT ?||':'||p.parent_user_id,?,'push_notification',?,json_object('targetUserId',p.parent_user_id,'data',json_object('screen','fees','event_id',?)),'pending',0,?,?
   FROM parent_student_links p WHERE p.school_id=? AND p.student_id=?`).bind(id,intent.schoolId,id,id,now,now,intent.schoolId,intent.studentId));
  statements.push(db(c).prepare(`INSERT INTO audit_events(id,school_id,actor_id,action,entity_type,entity_id,created_at) VALUES (?,?,?,?,?,?,unixepoch())`).bind(crypto.randomUUID(),intent.schoolId,createdBy,'record_gateway_collection','fee_payment_intent',id));
  drafts.forEach((_,n)=>statements.push(cleanupGuards(c,lease.slice(0,20)+'-v'+n)));
  const results=await db(c).batch(statements);
  if(results.some(r=>!r.success)){
   const detail=String(results.find(r=>!r.success)?.error||'');
   return release(detail.includes('CHECK constraint')||detail.includes('TENANT_RELATIONSHIP')?'LEDGER_GUARD':detail.includes('UNIQUE')?'RECEIPT_CONFLICT':'CAPTURE_WRITE_FAILED');
  }
  return c.json({ok:true,receiptNo:drafts[0].receiptNo,ledgerEntries:drafts.length});
 });
}
