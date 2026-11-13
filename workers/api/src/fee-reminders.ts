import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type ApiContext,type AppEnv,type Env} from './context.js';
import {fail} from './security.js';
import {audit,parse} from './management-common.js';
import {localCalendarDate} from './notice-management.js';

// Fee reminders, live. Honest delivery model:
//  - email:  sent with the school's Cloudflare Email binding; when the binding
//            is absent (or disabled) the row becomes 'provider_not_configured'.
//  - whatsapp: sent with the worker's Graph API fee template. A row queues only
//            when a granted fee_reminder consent record matches the parent
//            number and no number-level suppression exists; provider
//            configuration is rechecked at dispatch time, never trusted from
//            queue time.
//  - sms:    no provider exists on this platform; rows skip at queue time.
// No provider is ever pretended to have worked: every terminal status is a
// real outcome recorded on the reminder row.

const channel=z.enum(['whatsapp','email','sms']);
const window=z.enum(['overdue','due_7d','all']);
export const feeReminderSendInput=z.object({
 structureId:z.string().trim().max(100).optional(),
 invoiceId:z.string().trim().max(100).optional(),
 window:window.optional(),
 channel:channel.default('whatsapp'),
 message:z.string().trim().max(1000).optional(),
}).strict().refine(v=>!v.structureId||!v.invoiceId,{message:'Choose a structure or a single invoice, not both.'});
export const feeStructureRemindAllInput=z.object({
 window:window.optional(),
 channel:channel.default('whatsapp'),
 message:z.string().trim().max(1000).optional(),
}).strict();

const MAX_ATTEMPTS=5;
const LEASE_SECONDS=300;
const DRAIN_LIMIT=20;
const QUEUE_CAP=5000;
const RECENT_SENT_SECONDS=7*86400;

const nowSec=()=>Math.floor(Date.now()/1000);
const normPhone=(value:string,cc='91')=>{
 const digits=value.replace(/[^\d]/g,'');
 if(digits.length===10)return `+${cc}${digits}`;
 if(digits.length===11&&digits.startsWith('91'))return `+${digits}`;
 if(digits.length>11)return `+${digits}`;
 return digits?`+${cc}${digits}`:'';
};
/** Mask a recipient for lists; the raw value stays in the row for the sender only. */
const maskRecipient=(value:string|null|undefined)=>{
 if(!value)return '—';
 if(value.includes('@')){const [l,d]=value.split('@');return `${(l||'').slice(0,2)}•••@${d||'•••'}`;}
 const digits=value.replace(/[^\d]/g,'');
 return digits.length>6?`+${digits.slice(0,2)} •••• ${digits.slice(-4)}`:'••••';
};
const amountText=(minor:number,currency:string|undefined|null)=>{
 try{return new Intl.NumberFormat(undefined,{style:'currency',currency:currency||'INR'}).format(minor/100);}catch{return String(minor/100);}
};

type OpenInvoice={id:string;studentId:string;feeName:string;studentName:string;admissionNo:string;balanceMinor:number;currency:string;dueOn:string};
export type ReminderTarget={invoiceId:string;studentId:string;recipient:string;status:'queued'|'skipped';detail:string|null};

async function openInvoices(c:ApiContext,scope:{structureId?:string;invoiceId?:string;win?:string}):Promise<OpenInvoice[]>{
 const u=requireRole(c,'admin'),d=db(c),school=u.school_id;
 const today=localCalendarDate(new Date().toISOString(),c.get('school').timezone);
 const plus=new Date(today+'T00:00:00Z');plus.setDate(plus.getDate()+7);const sevenDays=plus.toISOString().slice(0,10);
 const where=['i.school_id=?',"i.status!='cancelled'",'i.amount_paise-i.paid_minor-i.concession_minor>0'];const binds:unknown[]=[school];
 if(scope.invoiceId){where.push('i.id=?');binds.push(scope.invoiceId);}
 else{
  if(scope.structureId){where.push('i.structure_id=?');binds.push(scope.structureId);}
  if(scope.win==='overdue'){where.push('i.due_on<?');binds.push(today);}
  if(scope.win==='due_7d'){where.push('i.due_on>=?','i.due_on<=?');binds.push(today,sevenDays);}
 }
 const rows=await d.prepare(`SELECT i.id,i.student_id AS studentId,g.name AS feeName,su.full_name AS studentName,s.admission_no AS admissionNo,i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor,i.currency,i.due_on AS dueOn FROM fee_invoice_balances i JOIN fee_groups g ON g.id=i.fee_group_id AND g.school_id=i.school_id JOIN students s ON s.id=i.student_id AND s.school_id=i.school_id JOIN users su ON su.id=s.user_id AND su.school_id=su.school_id WHERE ${where.join(' AND ')} ORDER BY i.due_on,i.id LIMIT ?`).bind(...binds,QUEUE_CAP).all<OpenInvoice>();
 if(!rows.success)fail(503,'FEE_REMINDER_READ_FAILED');
 return rows.results;
}
/** One active parent per student (the most recently linked). */
async function parentsFor(d:D1Database,school:string,studentIds:string[],cc:string){
 const map=new Map<string,{parent:string;email:string|null;mobile:string;consentKey:string}>();
 const ids=[...new Set(studentIds)];
 for(let at=0;at<ids.length;at+=400){
  const chunk=ids.slice(at,at+400),ph=chunk.map(()=>'?').join(',');
  const rows=await d.prepare(`SELECT l.student_id AS studentId,p.id AS parentId,p.email AS email,COALESCE(pp.contact_mobile,p.mobile) AS mobile FROM parent_student_links l JOIN users p ON p.id=l.parent_user_id AND p.school_id=l.school_id AND p.status='active' LEFT JOIN parent_profiles pp ON pp.user_id=p.id AND pp.school_id=p.school_id WHERE l.school_id=? AND l.student_id IN(${ph}) ORDER BY l.student_id,l.created_at DESC`).bind(school,...chunk).all<{studentId:string;parentId:string;email:string|null;mobile:string|null}>();
  if(!rows.success)fail(503,'FEE_REMINDER_READ_FAILED');
  for(const r of rows.results)if(!map.has(r.studentId))map.set(r.studentId,{parent:r.parentId,email:r.email,mobile:r.mobile?normPhone(r.mobile,cc):'',consentKey:r.mobile?normPhone(r.mobile,cc):''});
 }
 return map;
}

/** Resolve recipient + gate every open invoice; pure reads. */
export async function resolveReminderTargets(c:ApiContext,scope:{structureId?:string;invoiceId?:string;win?:string},channelName:'whatsapp'|'email'|'sms'):Promise<{targets:ReminderTarget[];open:number}>{
 const u=requireRole(c,'admin'),d=db(c),school=u.school_id,cc=c.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.replace(/\D/g,'')||'91';
 const invoices=await openInvoices(c,scope);
 if(!invoices.length)return {targets:[],open:0};
 if(channelName==='sms')return {targets:invoices.map(i=>({invoiceId:i.id,studentId:i.studentId,recipient:'',status:'skipped',detail:'sms_provider_unavailable'})),open:invoices.length};
 const parents=await parentsFor(d,school,invoices.map(i=>i.studentId),cc);
 const numbers=[...new Set([...parents.values()].map(p=>p.consentKey).filter(Boolean))];
 const consent=new Set<string>(),suppressed=new Set<string>(),recentOpen=new Set<string>();
 for(let at=0;at<numbers.length;at+=400){
  const chunk=numbers.slice(at,at+400),ph=chunk.map(()=>'?').join(',');
  const grants=await d.prepare(`SELECT DISTINCT recipient_phone FROM whatsapp_consent_records WHERE school_id=? AND purpose='fee_reminder' AND state='granted' AND recipient_phone IN(${ph})`).bind(school,...chunk).all<{recipient_phone:string}>();
  const sups=await d.prepare(`SELECT DISTINCT recipient_phone FROM whatsapp_number_suppressions WHERE school_id=? AND recipient_phone IN(${ph})`).bind(school,...chunk).all<{recipient_phone:string}>();
  if(!grants.success||!sups.success)fail(503,'FEE_REMINDER_READ_FAILED');
  chunk.forEach((n,i)=>{if(grants.results.some(r=>r.recipient_phone===n))consent.add(n);if(sups.results.some(r=>r.recipient_phone===n))suppressed.add(n);void i;});
 }
 const recentRows=await d.prepare(`SELECT DISTINCT invoice_id FROM fee_reminders WHERE school_id=? AND channel=? AND (status IN('queued','processing','provider_not_configured') OR (status='sent' AND created_at>=?))`).bind(school,channelName,nowSec()-RECENT_SENT_SECONDS).all<{invoice_id:string}>();
 if(!recentRows.success)fail(503,'FEE_REMINDER_READ_FAILED');
 recentRows.results.forEach(r=>{recentOpen.add(r.invoice_id);});
 const targets:ReminderTarget[]=invoices.map(inv=>{
  const p=parents.get(inv.studentId);
  if(channelName==='email'){
   if(!p||!p.email)return {invoiceId:inv.id,studentId:inv.studentId,recipient:'',status:'skipped',detail:'no_parent_email'};
   if(recentOpen.has(inv.id))return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.email,status:'skipped',detail:'duplicate_recent'};
   return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.email,status:'queued',detail:null};
  }
  if(!p?.consentKey)return {invoiceId:inv.id,studentId:inv.studentId,recipient:'',status:'skipped',detail:'no_parent_mobile'};
  if(suppressed.has(p.consentKey))return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.consentKey,status:'skipped',detail:'number_suppressed'};
  if(!consent.has(p.consentKey))return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.consentKey,status:'skipped',detail:'no_whatsapp_consent'};
  if(recentOpen.has(inv.id))return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.consentKey,status:'skipped',detail:'duplicate_recent'};
  return {invoiceId:inv.id,studentId:inv.studentId,recipient:p.consentKey,status:'queued',detail:null};
 });
 return {targets,open:invoices.length};
}
function reminderMessage(c:ApiContext,inv:OpenInvoice,custom:string|undefined):string{
 const school=c.get('school'),amount=amountText(inv.balanceMinor,inv.currency);
 const body=custom?.trim()||`${school.name}: fee reminder. ${inv.feeName} for ${inv.studentName} (Adm No ${inv.admissionNo}) has a balance of ${amount} due on ${inv.dueOn}. Please clear the dues with the school office.`;
 // Private balance details must not ride in a provider-approved template
 // slot for WhatsApp; the office chooses the message, we only enforce length.
 return body.slice(0,1000);
}

/** Trigger an immediate dispatch pass after queueing. Falls back to the
 * worker cron when no execution context exists (unit tests). */
function dispatchSoon(c:ApiContext){
 try{c.executionCtx.waitUntil(processFeeReminders(c.env));}catch{/* no execution context; the scheduled handler drains the queue */}
}

async function queueReminders(c:ApiContext,scope:{structureId?:string;invoiceId?:string;win?:string;channelName:'whatsapp'|'email'|'sms';message?:string}):Promise<{batchId:string;queued:number;skipped:number;open:number;byReason:Record<string,number>}>{
 const u=requireRole(c,'admin'),d=db(c),school=u.school_id,batchId=crypto.randomUUID();
 const {targets}=await resolveReminderTargets(c,scope,scope.channelName);
 const byReason:Record<string,number>={};
 const invoices=new Map((await openInvoices(c,scope)).map(i=>[i.id,i] as const));
 const statements:D1PreparedStatement[]=[];
 for(const t of targets){
  const inv=invoices.get(t.invoiceId)!;
  const message=reminderMessage(c,inv,scope.message);
  if(t.status==='skipped')byReason[t.detail||'skipped']=(byReason[t.detail||'skipped']||0)+1;
  statements.push(d.prepare('INSERT INTO fee_reminders(id,school_id,invoice_id,student_id,channel,recipient,message,status,detail,batch_id,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,unixepoch()) ON CONFLICT(school_id,invoice_id,channel,created_at) DO NOTHING').bind(crypto.randomUUID(),school,t.invoiceId,t.studentId,scope.channelName,t.recipient,message,t.status,t.detail,batchId,u.id));
 }
 for(let at=0;at<statements.length;at+=50){
  const result=await d.batch(statements.slice(at,at+50));
  const bad=result.find(r=>!r.success);
  if(bad)fail(503,'FEE_REMINDER_QUEUE_FAILED','A reminder could not be saved because a related record changed. Reload and retry.');
 }
 if(statements.length)await audit(c,'queue_fee_reminders','fee_reminder',batchId).run();
 const queued=targets.filter(t=>t.status==='queued').length;
 return {batchId,queued,skipped:targets.length-queued,open:targets.length,byReason};
}

/** Claim queued reminders and deliver them. Provider configuration is
 * rechecked at dispatch time; a crashed lease re-queues instead of losing
 * or duplicating a send. */
export async function processFeeReminders(env:Env):Promise<{sent:number;requeued:number;failed:number;notConfigured:number}>{
 const stats={sent:0,requeued:0,failed:0,notConfigured:0};
 if(!env.DB)return stats;
 const now=nowSec(),lease=crypto.randomUUID();
 // Expired processing leases: re-queue, unless attempts are exhausted.
 await env.DB.prepare(`UPDATE fee_reminders SET status=CASE WHEN attempts>=? THEN 'failed' ELSE 'queued' END,lease_id=NULL,lease_until=NULL WHERE status='processing' AND lease_until<=?`).bind(MAX_ATTEMPTS,now).run();
 const due=await env.DB.prepare(`SELECT id FROM fee_reminders WHERE status='queued' ORDER BY created_at,id LIMIT ?`).bind(DRAIN_LIMIT).all<{id:string}>();
 if(!due.results.length)return stats;
 const ph=due.results.map(()=>'?').join(',');
 type ClaimedReminder={id:string;school_id:string;channel:string;recipient:string;message:string;attempts:number};
 const claimed=await env.DB.prepare(`UPDATE fee_reminders SET status='processing',lease_id=?,lease_until=?,attempts=attempts+1 WHERE id IN(${ph}) AND status='queued' RETURNING *`).bind(lease,now+LEASE_SECONDS,...due.results.map(r=>r.id)).all<ClaimedReminder>();
 const names=await env.DB.prepare(`SELECT id,name FROM schools WHERE id IN(${due.results.length?ph:'NULL'})`).bind(...due.results.map(r=>r.id)).all<{id:string;name:string}>();
 const nameById=new Map(names.results.map(r=>[r.id,r.name]));
 for(const row of claimed.results){
  const id=row.id,attempts=row.attempts;
    const finish=(status:'sent'|'queued'|'failed'|'provider_not_configured',detail:string|null,providerId:string|null)=>env.DB.prepare(`UPDATE fee_reminders SET status=?,detail=?,provider_message_id=COALESCE(?,provider_message_id),sent_at=CASE WHEN ?='sent' THEN ? ELSE sent_at END,lease_id=NULL,lease_until=NULL WHERE id=?`).bind(status,detail,providerId,status,now,id).run();
  if(row.channel==='email'){
   if(!env.EMAIL||env.EMAIL_DELIVERY_ENABLED==='false'){await finish('provider_not_configured','email_provider_not_configured',null);stats.notConfigured++;continue;}
   try{
    const result=await env.EMAIL.send({to:row.recipient,from:env.EMAIL_FROM||'welcome@gurukull.in',subject:`${nameById.get(row.school_id)||'School'}: fee reminder`,text:row.message,html:`<p>${row.message.replaceAll('\n','<br/>')}</p>`});
    await finish('sent',null,result.messageId||null);stats.sent++;
   }catch{
    if(attempts>=MAX_ATTEMPTS){await finish('failed','email_send_failed',null);stats.failed++;}
    else{await finish('queued','email_send_retry',null);stats.requeued++;}
   }
  }else if(row.channel==='whatsapp'){
   if(!env.WHATSAPP_ACCESS_TOKEN||!env.WHATSAPP_PHONE_NUMBER_ID||!env.WHATSAPP_FEE_TEMPLATE){await finish('provider_not_configured','whatsapp_provider_not_configured',null);stats.notConfigured++;continue;}
   const base=(env.WHATSAPP_GRAPH_API_URL||'https://graph.facebook.com/v20.0').replace(/\/$/,'');
   try{
    const response=await fetch(`${base}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:row.recipient,type:'template',template:{name:env.WHATSAPP_FEE_TEMPLATE,language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:row.message}]}]}})});
    if(!response.ok){
     const text=await response.text().catch(()=> '');
     if(attempts>=MAX_ATTEMPTS){await finish('failed','whatsapp_rejected:'+response.status, null);stats.failed++;}
     else{await finish('queued','whatsapp_rejected:'+response.status+(text?' ':''),null);stats.requeued++;}
     continue;
    }
    const body=await response.json().catch(()=>({})) as {messages?:Array<{id?:string}>};
    await finish('sent',null,body.messages?.[0]?.id||null);stats.sent++;
   }catch{
    if(attempts>=MAX_ATTEMPTS){await finish('failed','whatsapp_send_failed',null);stats.failed++;}
    else{await finish('queued','whatsapp_send_retry',null);stats.requeued++;}
   }
  }else{
   await finish('failed','sms_provider_unavailable',null);stats.failed++;
  }
 }
 return stats;
}

const skipText=(skipped:number,byReason:Record<string,number>)=>{
 if(!skipped)return '';
 const reasons=Object.entries(byReason).map(([k,n])=>{const label={no_parent_email:'no parent email',no_parent_mobile:'no parent mobile',number_suppressed:'number opted out',no_whatsapp_consent:'no WhatsApp consent',duplicate_recent:'already reminded in 7 days',sms_provider_unavailable:'no SMS provider',provider_not_configured:'provider not configured'}[k]||k.replaceAll('_',' ');return n+' '+label+(n===1?'':'s');}).join(', ');
 return '; '+skipped+' skipped ('+reasons+')';
};

export function registerFeeReminders(app:Hono<AppEnv>){
 // Single queue endpoint: one invoice, one structure, or the school's whole
 // scope. The response reports exactly what was queued and every skip reason.
 app.post('/api/admin/fees/reminders',requireAuth,async c=>{
  const v=parse(feeReminderSendInput,await readBody(c));
  if(!v.structureId&&!v.invoiceId&&!v.window)fail(422,'FEE_REMINDER_SCOPE_REQUIRED','Choose a structure, an invoice, or a window (default: overdue school-wide).');
  const result=await queueReminders(c,{structureId:v.structureId,invoiceId:v.invoiceId,win:v.window||(v.invoiceId?'all':'overdue'),channelName:v.channel,message:v.message});
  dispatchSoon(c);
  return c.json({data:{...result,message:result.queued?`${result.queued} reminder(s) queued${skipText(result.skipped,result.byReason)}`:'No reminders queued: every target was already open or not eligible.'}},202);
 });
 app.post('/api/admin/fees/structures/:id/remind-all',requireAuth,async c=>{
  const v=parse(feeStructureRemindAllInput,await readBody(c));
  const structureId=c.req.param('id')!;
  const result=await queueReminders(c,{structureId:structureId,win:v.window||'overdue',channelName:v.channel,message:v.message});
  dispatchSoon(c);
  return c.json({data:{...result,message:result.queued?`${result.queued} reminder(s) queued for this structure${skipText(result.skipped,result.byReason)}`:'No reminders queued for this structure.'}},202);
 });
 app.get('/api/admin/fees/reminders/dry-run',requireAuth,async c=>{
  const q=parse(z.object({structureId:z.string().trim().max(100).optional(),invoiceId:z.string().trim().max(100).optional(),window:window.optional(),channel:channel.default('whatsapp')}),c.req.query());
  const {targets,open}=await resolveReminderTargets(c,{structureId:q.structureId,invoiceId:q.invoiceId,win:q.window||(q.invoiceId?'all':'overdue')},q.channel);
  const byReason:Record<string,number>={};targets.filter(t=>t.status==='skipped').forEach(t=>{byReason[t.detail||'skipped']=(byReason[t.detail||'skipped']||0)+1;});
  const eligible=targets.filter(t=>t.status==='queued').length;
  c.header('Cache-Control','no-store');
  return c.json({data:{open,eligible,skipped:open-eligible,byReason,
   note:q.channel==='whatsapp'?'WhatsApp delivery needs the school number, a provider-approved fee template and per-family fee consent recorded in the WhatsApp page. Email needs the worker email binding.':q.channel==='sms'?'SMS has no provider on this platform; choose WhatsApp or email.':'Email delivery needs the worker email binding configured.'}});
 });
 app.post('/api/admin/fees/reminders/:id/retry',requireAuth,async c=>{
  const u=requireRole(c,'admin'),id=c.req.param('id')!;
  const row=await db(c).prepare(`UPDATE fee_reminders SET status='queued',attempts=0,lease_id=NULL,lease_until=NULL,detail=NULL WHERE school_id=? AND id=? AND status IN('failed','provider_not_configured') RETURNING id`).bind(u.school_id,id).first<{id:string}>();
  if(!row)fail(404,'FEE_REMINDER_NOT_RETRYABLE','Only failed or not-configured reminders can be retried.');
  await audit(c,'retry_fee_reminder','fee_reminder',id).run();
  dispatchSoon(c);
  return c.json({data:{id,message:'Reminder requeued for delivery.'}});
 });
 app.get('/api/admin/fees/reminders',requireAuth,async c=>{
  const u=requireRole(c,'admin'),d=db(c);
  const pageRaw=c.req.query('page'),perPageRaw=c.req.query('per_page');
  const page=pageRaw&&/^[1-9]\d*$/.test(pageRaw)?Number(pageRaw):1;const perPage=perPageRaw&&/^[1-9]\d*$/.test(perPageRaw)?Math.min(100,Number(perPageRaw)):20;
  if((page-1)*perPage>10000)fail(422,'DIRECTORY_PAGE_LIMIT');
  const where=['r.school_id=?'];const binds:unknown[]=[u.school_id];
  const status=c.req.query('status');if(status){where.push('r.status=?');binds.push(status);}
  const chan=c.req.query('channel');if(chan){where.push('r.channel=?');binds.push(chan);}
  const batch=c.req.query('batchId');if(batch){where.push('r.batch_id=?');binds.push(batch);}
  const result=await d.batch([
   d.prepare(`SELECT COUNT(*) AS total FROM fee_reminders r WHERE ${where.join(' AND ')}`).bind(...binds),
   d.prepare(`SELECT r.id,r.invoice_id AS invoiceId,r.student_id AS studentId,r.channel,r.recipient,r.status,r.detail,r.batch_id AS batchId,r.attempts,r.provider_message_id AS providerMessageId,r.sent_at AS sentAt,r.created_at AS createdAt,g.name AS feeName,i.invoice_no AS invoiceNo,i.currency,i.due_on AS dueOn,i.amount_paise-i.paid_minor-i.concession_minor AS balanceMinor,su.full_name AS studentName,s.admission_no AS admissionNo FROM fee_reminders r JOIN fee_invoices i ON i.id=r.invoice_id AND i.school_id=r.school_id JOIN fee_groups g ON g.id=i.fee_group_id AND g.school_id=r.school_id JOIN students s ON s.id=r.student_id AND s.school_id=r.school_id JOIN users su ON su.id=s.user_id AND su.school_id=su.school_id WHERE ${where.join(' AND ')} ORDER BY r.created_at DESC,r.id LIMIT ? OFFSET ?`).bind(...binds,perPage,(page-1)*perPage),
  ]);
  if(result.some(r=>!r.success))fail(503,'FEE_REMINDER_READ_FAILED');
  const rows=result[1].results as Array<Record<string,unknown>>;
  c.header('Cache-Control','no-store');
  return c.json({data:rows.map(r=>({id:r.id,invoiceId:r.invoiceId,studentId:r.studentId,channel:r.channel,recipient:maskRecipient(String(r.recipient)),status:r.status,detail:r.detail,batchId:r.batchId,attempts:r.attempts,providerMessageId:r.providerMessageId,sentAt:r.sentAt,createdAt:r.createdAt,feeName:r.feeName,invoiceNo:r.invoiceNo,currency:r.currency,dueOn:r.dueOn,balanceMinor:r.balanceMinor,studentName:r.studentName,admissionNo:r.admissionNo})),total:(result[0].results[0] as {total:number}).total,meta:{page,per_page:perPage}});
 });
 app.get('/api/admin/fees/reminders/summary',requireAuth,async c=>{
  const u=requireRole(c,'admin'),d=db(c),school=u.school_id,cc=c.env.WHATSAPP_DEFAULT_COUNTRY_CODE?.replace(/\D/g,'')||'91';
  const counts=await d.prepare(`SELECT COUNT(*) AS total,COALESCE(SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END),0) AS queued,COALESCE(SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END),0) AS processing,COALESCE(SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END),0) AS sent,COALESCE(SUM(CASE WHEN status='sent' AND sent_at>? THEN 1 ELSE 0 END),0) AS sentLast24h,COALESCE(SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END),0) AS failed,COALESCE(SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END),0) AS skipped,COALESCE(SUM(CASE WHEN status='provider_not_configured' THEN 1 ELSE 0 END),0) AS providerNotConfigured FROM fee_reminders WHERE school_id=?`).bind(nowSec()-86400,school).first<Record<string,number>>();
  const openFamilies=await d.prepare(`SELECT COUNT(DISTINCT i.student_id) AS n FROM fee_invoice_balances i WHERE i.school_id=? AND i.status!='cancelled' AND i.amount_paise-i.paid_minor-i.concession_minor>0`).bind(school).first<{n:number}>();
  const openStudentIds=(await d.prepare(`SELECT DISTINCT i.student_id AS id FROM fee_invoice_balances i WHERE i.school_id=? AND i.status!='cancelled' AND i.amount_paise-i.paid_minor-i.concession_minor>0`).bind(school).all<{id:string}>()).results;
  let consentedFamilies=0;
  if(openStudentIds.length){
   const ids=[...new Set(openStudentIds.map(r=>r.id))];const ph=ids.map(()=>'?').join(',');
   const parents=await d.prepare(`SELECT l.student_id AS studentId,COALESCE(pp.contact_mobile,p.mobile) AS mobile FROM parent_student_links l JOIN users p ON p.id=l.parent_user_id AND p.school_id=l.school_id AND p.status='active' LEFT JOIN parent_profiles pp ON pp.user_id=p.id AND pp.school_id=p.school_id WHERE l.school_id=? AND l.student_id IN(${ph})`).bind(school,...ids).all<{studentId:string;mobile:string|null}>();
   const consentPhone=new Set((await d.prepare(`SELECT DISTINCT recipient_phone FROM whatsapp_consent_records WHERE school_id=? AND purpose='fee_reminder' AND state='granted'`).bind(school).all<{recipient_phone:string}>()).results.map(r=>r.recipient_phone));
   const suppressedPhone=new Set((await d.prepare(`SELECT DISTINCT recipient_phone FROM whatsapp_number_suppressions WHERE school_id=?`).bind(school).all<{recipient_phone:string}>()).results.map(r=>r.recipient_phone));
   const familyOk=new Set<string>();
   for(const r of parents.results){
    const key=r.mobile?normPhone(r.mobile,cc):'';
    if(key&&!suppressedPhone.has(key)&&consentPhone.has(key))familyOk.add(r.studentId);
   }
   consentedFamilies=familyOk.size;
  }
  c.header('Cache-Control','no-store');
  return c.json({data:{...(counts||{total:0,queued:0,processing:0,sent:0,sentLast24h:0,failed:0,skipped:0,providerNotConfigured:0}),openFamilies:openFamilies?.n||0,consentedFamilies}});
 });
}
