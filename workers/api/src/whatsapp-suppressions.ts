import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {audit,cleanupGuards,command,guard,parse} from './management-common.js';
import {fail} from './security.js';

const phone=z.string().regex(/^\+[1-9][0-9]{7,14}$/,'Enter the full international number.');
export const suppressionInput=z.object({senderPhone:phone,recipientPhone:phone,evidence:z.string().trim().min(1).max(250),version:z.number().int().min(0)}).strict();

export function registerWhatsAppSuppressions(app:Hono<AppEnv>){
 app.get('/api/admin/whatsapp/suppressions',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const rows=await db(c).prepare('SELECT sender_phone AS senderPhone,recipient_phone AS recipientPhone,evidence,version,updated_at AS updatedAt FROM whatsapp_number_suppressions WHERE school_id=? ORDER BY updated_at DESC,sender_phone,recipient_phone LIMIT 100').bind(u.school_id).all();
  if(!rows.success)fail(503,'SUPPRESSION_READ_FAILED');
  return c.json({data:rows.results,sendingAvailable:false});
 });
 app.put('/api/admin/whatsapp/suppressions',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(suppressionInput,await readBody(c)),g=crypto.randomUUID(),event=crypto.randomUUID();
  const identity=[u.school_id,v.senderPhone,v.recipientPhone];
  return c.json(await command(c,'whatsapp.number_suppression',v,()=>[
   guard(c,'EXISTS(SELECT 1 FROM school_whatsapp_drafts WHERE school_id=? AND phone_e164=?) OR EXISTS(SELECT 1 FROM whatsapp_consent_records WHERE school_id=? AND sender_phone=? AND recipient_phone=?) OR EXISTS(SELECT 1 FROM whatsapp_number_suppressions WHERE school_id=? AND sender_phone=? AND recipient_phone=?)',[u.school_id,v.senderPhone,...identity,...identity],g+'-sender'),
   guard(c,'COALESCE((SELECT version FROM whatsapp_number_suppressions WHERE school_id=? AND sender_phone=? AND recipient_phone=?),0)=?',[...identity,v.version],g+'-version'),
   db(c).prepare(`INSERT INTO whatsapp_number_suppressions(school_id,sender_phone,recipient_phone,evidence,version,updated_by,updated_at) VALUES(?,?,?,?,1,?,unixepoch()) ON CONFLICT(school_id,sender_phone,recipient_phone) DO UPDATE SET evidence=excluded.evidence,version=whatsapp_number_suppressions.version+1,updated_by=excluded.updated_by,updated_at=unixepoch()`).bind(...identity,v.evidence,u.id),
   db(c).prepare('INSERT INTO whatsapp_number_suppression_events(id,school_id,sender_phone,recipient_phone,evidence,version,actor_id,created_at) VALUES(?,?,?,?,?,?,?,unixepoch())').bind(event,...identity,v.evidence,v.version+1,u.id),
   audit(c,'block','whatsapp_number_suppression',event),cleanupGuards(c,g+'-sender'),cleanupGuards(c,g+'-version'),
  ],{message:'Number-level opt-out recorded. WhatsApp sending is not available.',data:{...v,version:v.version+1,status:'blocked',sendingAvailable:false}}));
 });
}
