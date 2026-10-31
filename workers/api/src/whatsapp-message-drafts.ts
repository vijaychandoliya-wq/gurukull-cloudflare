import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {audit,cleanupGuards,command,guard,parse} from './management-common.js';
import {fail} from './security.js';
import {whatsappReadinessInput} from './whatsapp-readiness.js';

export const whatsappMessageDraftInput=whatsappReadinessInput.extend({templateVersion:z.number().int().positive()}).strict();

export function registerWhatsAppMessageDrafts(app:Hono<AppEnv>){
 app.get('/api/admin/whatsapp/message-drafts',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const rows=await db(c).prepare(`SELECT d.id,d.recipient_id AS recipientId,u.full_name AS recipientName,d.sender_phone AS senderPhone,d.recipient_phone AS recipientPhone,d.purpose,d.locale,d.template_version AS templateVersion,d.created_at AS createdAt FROM whatsapp_message_drafts d JOIN users u ON u.id=d.recipient_id AND u.school_id=d.school_id WHERE d.school_id=? ORDER BY d.created_at DESC,d.id DESC LIMIT 100`).bind(u.school_id).all();
  if(!rows.success)fail(503,'MESSAGE_DRAFT_READ_FAILED');
  return c.json({data:rows.results,status:'draft_only',sendingAvailable:false});
 });
 app.post('/api/admin/whatsapp/message-drafts',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(whatsappMessageDraftInput,await readBody(c)),id=crypto.randomUUID(),g=crypto.randomUUID();
  return c.json(await command(c,'whatsapp.message_draft',v,()=>[
   guard(c,'EXISTS(SELECT 1 FROM school_whatsapp_drafts WHERE school_id=? AND phone_e164=?)',[u.school_id,v.senderPhone],g+'-sender'),
   guard(c,"EXISTS(SELECT 1 FROM users WHERE school_id=? AND id=? AND status='active' AND (user_type IN ('parent','teacher') OR EXISTS(SELECT 1 FROM user_roles r WHERE r.school_id=users.school_id AND r.user_id=users.id AND r.role IN ('parent','teacher'))))",[u.school_id,v.recipientId],g+'-recipient'),
   guard(c,'EXISTS(SELECT 1 FROM whatsapp_template_drafts WHERE school_id=? AND purpose=? AND locale=? AND version=?) AND EXISTS(SELECT 1 FROM whatsapp_template_draft_versions WHERE school_id=? AND purpose=? AND locale=? AND version=?)',[u.school_id,v.purpose,v.locale,v.templateVersion,u.school_id,v.purpose,v.locale,v.templateVersion],g+'-template'),
   db(c).prepare('INSERT INTO whatsapp_message_drafts(id,school_id,recipient_id,sender_phone,recipient_phone,purpose,locale,template_version,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,unixepoch())').bind(id,u.school_id,v.recipientId,v.senderPhone,v.recipientPhone,v.purpose,v.locale,v.templateVersion,u.id),
   audit(c,'create','whatsapp_message_draft',id),...['-sender','-recipient','-template'].map(s=>cleanupGuards(c,g+s)),
  ],{message:'Message request saved as a draft. It was not queued or sent.',data:{id,status:'draft_only',sendingAvailable:false}}));
 });
}
