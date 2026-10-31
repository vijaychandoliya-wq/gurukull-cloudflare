import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {audit,cleanupGuards,command,guard,parse} from './management-common.js';
import {fail} from './security.js';

export const whatsappDraftInput=z.object({
 phone:z.string().trim().regex(/^\+[1-9][0-9]{7,14}$/, 'Enter the full international number, for example +91 followed by the mobile number.'),
 displayName:z.string().trim().min(1).max(100),
 version:z.number().int().min(0),
}).strict();
export const whatsappConsentInput=z.object({
 recipientId:z.string().trim().min(1).max(100),
 senderPhone:z.string().regex(/^\+[1-9][0-9]{7,14}$/),
 recipientPhone:z.string().regex(/^\+[1-9][0-9]{7,14}$/),
 purpose:z.enum(['school_notice','fee_reminder']),
 state:z.enum(['granted','withdrawn']),
 source:z.enum(['written','verbal','portal']),
 evidence:z.string().trim().min(1).max(250),
 explicitConsent:z.boolean().optional(),
 version:z.number().int().min(0),
}).strict().refine(v=>v.state!=='granted'||v.explicitConsent===true,{path:['explicitConsent'],message:'Confirm that the recipient explicitly opted in for this school, number and purpose.'});

export function registerWhatsAppConnection(app:Hono<AppEnv>){
 app.get('/api/admin/whatsapp/connection',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const row=await db(c).prepare('SELECT phone_e164 AS phone,display_name AS displayName,version,updated_at AS updatedAt FROM school_whatsapp_drafts WHERE school_id=?').bind(u.school_id).first();
  return c.json({data:{status:'not_connected',sendingAvailable:false,draft:row||null}});
 });
 app.put('/api/admin/whatsapp/connection/draft',requireAuth,async c=>{
  const u=requireRole(c,'admin'),input=parse(whatsappDraftInput,await readBody(c)),id=crypto.randomUUID();
  return c.json(await command(c,'whatsapp.sender_draft',input,()=>[
   guard(c,'COALESCE((SELECT version FROM school_whatsapp_drafts WHERE school_id=?),0)=?',[u.school_id,input.version],id),
   db(c).prepare(`INSERT INTO school_whatsapp_drafts(school_id,phone_e164,display_name,version,updated_by,updated_at) VALUES(?,?,?,1,?,unixepoch()) ON CONFLICT(school_id) DO UPDATE SET phone_e164=excluded.phone_e164,display_name=excluded.display_name,version=school_whatsapp_drafts.version+1,updated_by=excluded.updated_by,updated_at=unixepoch()`).bind(u.school_id,input.phone,input.displayName,u.id),
   audit(c,'update','whatsapp_sender_draft',u.school_id),cleanupGuards(c,id),
  ],{message:'Details saved as a draft. The number is not connected and cannot send messages.',data:{status:'not_connected',sendingAvailable:false,draft:{phone:input.phone,displayName:input.displayName,version:input.version+1}}}));
 });
 app.get('/api/admin/whatsapp/consents',requireAuth,async c=>{
  const u=requireRole(c,'admin'),recipientId=(c.req.query('recipientId')||'').trim();
  if(!recipientId||recipientId.length>100)fail(422,'RECIPIENT_REQUIRED','Choose a parent or teacher.');
  const recipient=await db(c).prepare("SELECT id FROM users WHERE school_id=? AND id=? AND (user_type IN ('parent','teacher') OR EXISTS(SELECT 1 FROM user_roles r WHERE r.school_id=users.school_id AND r.user_id=users.id AND r.role IN ('parent','teacher'))) ").bind(u.school_id,recipientId).first();
  if(!recipient)fail(404,'RECIPIENT_NOT_FOUND');
  const rows=await db(c).prepare('SELECT recipient_id AS recipientId,sender_phone AS senderPhone,recipient_phone AS recipientPhone,purpose,state,source,evidence,version,updated_at AS updatedAt FROM whatsapp_consent_records WHERE school_id=? AND recipient_id=? ORDER BY updated_at DESC LIMIT 100').bind(u.school_id,recipientId).all();
  if(!rows.success)fail(503,'CONSENT_READ_FAILED');
  return c.json({data:rows.results,sendingAvailable:false});
 });
 app.put('/api/admin/whatsapp/consents',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(whatsappConsentInput,await readBody(c)),g=crypto.randomUUID(),event=crypto.randomUUID();
  const identity=[u.school_id,v.recipientId,v.senderPhone,v.recipientPhone,v.purpose];
  return c.json(await command(c,'whatsapp.consent',v,()=>[
   guard(c,"EXISTS(SELECT 1 FROM users WHERE school_id=? AND id=? AND status='active' AND (user_type IN ('parent','teacher') OR EXISTS(SELECT 1 FROM user_roles r WHERE r.school_id=users.school_id AND r.user_id=users.id AND r.role IN ('parent','teacher'))))",[u.school_id,v.recipientId],g+'-recipient'),
   guard(c,'EXISTS(SELECT 1 FROM school_whatsapp_drafts WHERE school_id=? AND phone_e164=?) OR (?=\'withdrawn\' AND EXISTS(SELECT 1 FROM whatsapp_consent_records WHERE school_id=? AND recipient_id=? AND sender_phone=? AND recipient_phone=? AND purpose=?))',[u.school_id,v.senderPhone,v.state,...identity],g+'-sender'),
   guard(c,'COALESCE((SELECT version FROM whatsapp_consent_records WHERE school_id=? AND recipient_id=? AND sender_phone=? AND recipient_phone=? AND purpose=?),0)=?',[...identity,v.version],g+'-version'),
   db(c).prepare(`INSERT INTO whatsapp_consent_records(school_id,recipient_id,sender_phone,recipient_phone,purpose,state,source,evidence,version,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,unixepoch()) ON CONFLICT(school_id,recipient_id,sender_phone,recipient_phone,purpose) DO UPDATE SET state=excluded.state,source=excluded.source,evidence=excluded.evidence,version=whatsapp_consent_records.version+1,updated_by=excluded.updated_by,updated_at=unixepoch()`).bind(...identity,v.state,v.source,v.evidence,u.id),
   db(c).prepare('INSERT INTO whatsapp_consent_events(id,school_id,recipient_id,sender_phone,recipient_phone,purpose,state,source,evidence,version,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,unixepoch())').bind(event,...identity,v.state,v.source,v.evidence,v.version+1,u.id),
   audit(c,v.state==='granted'?'grant':'withdraw','whatsapp_consent',v.recipientId),
   ...['-recipient','-sender','-version'].map(s=>cleanupGuards(c,g+s)),
  ],{message:v.state==='granted'?'Consent evidence recorded. Sending is not available.':'Withdrawal recorded. Sending is not available.',data:{...v,explicitConsent:undefined,version:v.version+1,sendingAvailable:false}}));
 });
}
