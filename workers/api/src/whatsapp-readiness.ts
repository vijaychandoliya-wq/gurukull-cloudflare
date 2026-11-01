import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {parse} from './management-common.js';
import {fail} from './security.js';

const phone=z.string().regex(/^\+[1-9][0-9]{7,14}$/,'Enter the full international number.');
export const whatsappReadinessInput=z.object({
 recipientId:z.string().trim().min(1).max(100),senderPhone:phone,recipientPhone:phone,
 purpose:z.enum(['school_notice','fee_reminder']),
 locale:z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/).max(32),
}).strict();

// This is a point-in-time administrative preview, not an authorization to send.
// A future dispatcher must independently recheck every condition at send time.
export function registerWhatsAppReadiness(app:Hono<AppEnv>){
 app.post('/api/admin/whatsapp/readiness',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(whatsappReadinessInput,await readBody(c)),d=db(c);
  const results=await d.batch([
   d.prepare('SELECT 1 AS found FROM school_whatsapp_drafts WHERE school_id=? AND phone_e164=?').bind(u.school_id,v.senderPhone),
   d.prepare("SELECT status FROM users WHERE school_id=? AND id=? AND (user_type IN ('parent','teacher') OR EXISTS(SELECT 1 FROM user_roles r WHERE r.school_id=users.school_id AND r.user_id=users.id AND r.role IN ('parent','teacher'))) ").bind(u.school_id,v.recipientId),
   d.prepare('SELECT state FROM whatsapp_consent_records WHERE school_id=? AND recipient_id=? AND sender_phone=? AND recipient_phone=? AND purpose=?').bind(u.school_id,v.recipientId,v.senderPhone,v.recipientPhone,v.purpose),
   d.prepare('SELECT 1 AS found FROM whatsapp_number_suppressions WHERE school_id=? AND sender_phone=? AND recipient_phone=?').bind(u.school_id,v.senderPhone,v.recipientPhone),
   d.prepare('SELECT version FROM whatsapp_template_drafts WHERE school_id=? AND purpose=? AND locale=?').bind(u.school_id,v.purpose,v.locale),
  ]);
  if(results.some(r=>!r.success))fail(503,'WHATSAPP_READINESS_UNAVAILABLE','The readiness check could not be completed.');
  const recipient=results[1].results[0] as {status:string}|undefined;
  if(!recipient)fail(404,'RECIPIENT_NOT_FOUND','The selected recipient is not available in this school.');
  const consent=results[2].results[0] as {state:string}|undefined;
  const template=results[4].results[0] as {version:number}|undefined;
  return c.json({data:{canSend:false,templateVersion:template?.version||null,checks:{
   schoolNumber:results[0].results.length?'draft_matches':'draft_missing_or_different',
   recipient:recipient.status==='active'?'active':'inactive',
   consent:consent?.state==='granted'?'grant_recorded':consent?.state==='withdrawn'?'withdrawal_recorded':'not_recorded',
   numberOptOut:results[3].results.length?'blocked':'not_recorded',
   template:template?'draft_available':'draft_missing',
   senderVerification:'not_verified',templateApproval:'not_verified',recipientNumberOwnership:'not_verified',delivery:'not_available',
  },message:'This preview does not verify number ownership, guardian relationships or provider approval. No message was sent. Conditions must be checked again before any future send.'}});
 });
}
