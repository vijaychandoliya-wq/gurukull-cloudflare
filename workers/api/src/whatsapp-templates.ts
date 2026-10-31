import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {audit,cleanupGuards,command,guard,parse} from './management-common.js';
import {fail} from './security.js';

// Drafts are never provider-approved locally. The only supported variable is
// the school's public name; do not put private recipient data into a draft.
export const whatsappTemplateDraftInput=z.object({
 purpose:z.enum(['school_notice','fee_reminder']),
 locale:z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/).max(32),
 body:z.string().trim().min(1).max(1024),
 version:z.number().int().min(0),
}).strict().refine(v=>!v.body.replaceAll('{{school_name}}','').includes('{')&&!v.body.replaceAll('{{school_name}}','').includes('}'),{path:['body'],message:'Only {{school_name}} is supported as a placeholder.'});

export function registerWhatsAppTemplates(app:Hono<AppEnv>){
 app.get('/api/admin/whatsapp/templates',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const rows=await db(c).prepare('SELECT purpose,locale,body,version,updated_at AS updatedAt FROM whatsapp_template_drafts WHERE school_id=? ORDER BY purpose,locale').bind(u.school_id).all();
  if(!rows.success)fail(503,'TEMPLATE_READ_FAILED');
  return c.json({data:rows.results,providerApproval:'not_verified',sendingAvailable:false});
 });
 app.put('/api/admin/whatsapp/templates/draft',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(whatsappTemplateDraftInput,await readBody(c)),g=crypto.randomUUID();
  return c.json(await command(c,'whatsapp.template_draft',v,()=>[
   guard(c,'COALESCE((SELECT version FROM whatsapp_template_drafts WHERE school_id=? AND purpose=? AND locale=?),0)=?',[u.school_id,v.purpose,v.locale,v.version],g),
   db(c).prepare(`INSERT INTO whatsapp_template_drafts(school_id,purpose,locale,body,version,updated_by,updated_at) VALUES(?,?,?,?,1,?,unixepoch()) ON CONFLICT(school_id,purpose,locale) DO UPDATE SET body=excluded.body,version=whatsapp_template_drafts.version+1,updated_by=excluded.updated_by,updated_at=unixepoch()`).bind(u.school_id,v.purpose,v.locale,v.body,u.id),
   db(c).prepare('INSERT INTO whatsapp_template_draft_versions(school_id,purpose,locale,body,version,actor_id,created_at) VALUES(?,?,?,?,?,?,unixepoch())').bind(u.school_id,v.purpose,v.locale,v.body,v.version+1,u.id),
   audit(c,'update','whatsapp_template_draft',v.purpose+':'+v.locale),cleanupGuards(c,g),
  ],{message:'Draft saved. It has not been submitted to or approved by WhatsApp.',data:{...v,version:v.version+1,providerApproval:'not_verified',sendingAvailable:false}}));
 });
}
