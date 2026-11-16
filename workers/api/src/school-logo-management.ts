import type {Hono} from 'hono';
import {boundedBytes,db,requireAuth,requireRole,type ApiContext,type AppEnv} from './context.js';
import {digest,fail} from './security.js';

export function registerSchoolLogoManagement(app:Hono<AppEnv>){
 app.get('/api/admin/school/logo',requireAuth,async c=>{
  requireRole(c,'admin','superadmin');
  const u=c.get('user');
  const row=await db(c).prepare('SELECT logo_r2_key FROM schools WHERE id=?').bind(u.school_id).first<{logo_r2_key:string|null}>();
  if(!row?.logo_r2_key||!c.env.R2_MEDIA)fail(404,'LOGO_NOT_FOUND');
  const object=await c.env.R2_MEDIA.get(row.logo_r2_key);
  if(!object)fail(404,'LOGO_NOT_FOUND');
  c.header('Content-Type',object.httpMetadata?.contentType||'image/png');
  c.header('Cache-Control','private, no-store');
  c.header('Content-Disposition','inline');
  return c.body(object.body);
 });

 app.post('/api/admin/school/logo',requireAuth,async c=>{
  const actor=requireRole(c,'admin','superadmin');
  if(!c.env.R2_MEDIA)fail(503,'STORAGE_UNAVAILABLE');
  const mime=(c.req.header('content-type')||'').split(';',1)[0].toLowerCase();
  if(!['image/jpeg','image/png','image/webp'].includes(mime))fail(422,'LOGO_TYPE_NOT_ALLOWED','Choose a JPEG, PNG or WebP image for the school logo.');
  const bytes=await boundedBytes(c,512*1024);
  if(!bytes.byteLength)fail(422,'EMPTY_LOGO','Choose a logo before uploading.');
  const fileId=crypto.randomUUID();
  const extension=mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg';
  const key=`${actor.school_id}/logo/${fileId}.${extension}`;
  try{
   await c.env.R2_MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});
   const now=Math.floor(Date.now()/1000);
   const writes=await db(c).batch([
    db(c).prepare('INSERT INTO files(id,school_id,uploaded_by,r2_key,file_name,mime_type,size_bytes,checksum_sha256,access_scope,entity_type,entity_id,created_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,\'verified\')').bind(fileId,actor.school_id,actor.id,key,`logo.${extension}`,mime,bytes.byteLength,await digest(bytes),'school_public',null,null,now),
    db(c).prepare('UPDATE schools SET logo_r2_key=?,updated_at=unixepoch() WHERE id=?').bind(key,actor.school_id),
   ]);
   if(writes.some(write=>!write.success))throw new Error('LOGO_METADATA_WRITE_FAILED');
   const oldKey=await db(c).prepare('SELECT logo_r2_key FROM schools WHERE id=?').bind(actor.school_id).first<{logo_r2_key:string|null}>().then(r=>r?.logo_r2_key).catch(()=>null);
   if(oldKey&&oldKey!==key)await c.env.R2_MEDIA.delete(oldKey).catch(()=>undefined);
   return c.json({status:'success',message:'School logo saved.',data:{logoPath:'/api/admin/school/logo?t='+now}});
  }catch(error){
   await c.env.R2_MEDIA.delete(key).catch(()=>undefined);
   if(error instanceof Error&&error.message==='LOGO_METADATA_WRITE_FAILED')fail(503,'LOGO_SAVE_FAILED','The logo was uploaded but its school record could not be saved. Try again.');
   throw error;
  }
 });

 app.delete('/api/admin/school/logo',requireAuth,async c=>{
  const actor=requireRole(c,'admin','superadmin');
  const row=await db(c).prepare('SELECT logo_r2_key FROM schools WHERE id=?').bind(actor.school_id).first<{logo_r2_key:string|null}>();
  const key=row?.logo_r2_key;
  await db(c).prepare('UPDATE schools SET logo_r2_key=NULL,updated_at=unixepoch() WHERE id=?').bind(actor.school_id).run();
  if(key&&c.env.R2_MEDIA)await c.env.R2_MEDIA.delete(key).catch(()=>undefined);
  return c.json({status:'success',message:'School logo removed.'});
 });
}
