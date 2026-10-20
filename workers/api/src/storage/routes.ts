import type { Hono } from 'hono';
import { db, boundedBytes, requireAuth, requireRole, child, type AppEnv, type ApiContext } from '../context.js';
import { assignedSection } from '../attendance.js';
import { fail, digest } from '../security.js';

async function entityAccess(c:ApiContext,scope:string,entityType:string|null,entityId:string|null) {
  const u=c.get('user');
  if(scope==='public'){requireRole(c,'admin','superadmin');return;}
  if(scope==='school_private')return;
  if(!entityId)fail(422,'PRIVATE_ENTITY_REQUIRED');
  if(scope==='student_private'&&entityType==='student'){
    if(u.user_type==='parent'||u.roles?.includes('parent')){await child(c,entityId);return;}
    const student=await db(c).prepare(`SELECT section_id,user_id FROM students WHERE school_id=? AND id=?`).bind(u.school_id,entityId).first<{section_id:string;user_id:string}>();
    if(!student)fail(404,'STUDENT_NOT_FOUND');
    if(u.user_type==='student'&&student.user_id===u.id)return;
    if(u.user_type==='teacher'){await assignedSection(c,student.section_id);return;}
    requireRole(c,'admin','superadmin');return;
  }
  if(scope==='staff_private'&&entityType==='user'){
    if(!await db(c).prepare(`SELECT 1 FROM users WHERE school_id=? AND id=? AND user_type IN('teacher','staff','admin')`).bind(u.school_id,entityId).first())fail(404,'USER_NOT_FOUND');
    if(u.id!==entityId)requireRole(c,'admin','superadmin');return;
  }
  fail(422,'INVALID_ACCESS_SCOPE');
}
export function registerStorage(app:Hono<AppEnv>) {
  app.post('/api/v3/storage/upload',requireAuth,async c=>{
    const u=requireRole(c,'teacher','admin','superadmin','staff','parent');
    if(!c.env.R2_MEDIA)fail(503,'STORAGE_UNAVAILABLE');
    const scope=c.req.header('x-access-scope')||'school_private';
    if(!['public','school_private','student_private','staff_private'].includes(scope))fail(422,'INVALID_ACCESS_SCOPE');
    if((u.user_type==='parent'||u.roles?.includes('parent'))&&scope!=='student_private')fail(403,'PRIVATE_STUDENT_UPLOAD_REQUIRED');
    const entityType=c.req.header('x-entity-type')||null,entityId=c.req.header('x-entity-id')||null;
    await entityAccess(c,scope,entityType,entityId);
    const bytes=await boundedBytes(c,5*1024*1024);if(!bytes.byteLength)fail(422,'EMPTY_FILE');
    const name=(c.req.header('x-file-name')||'upload.bin').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,128);
    const mime=c.req.header('content-type')||'application/octet-stream';
    if(!['application/pdf','image/jpeg','image/png','application/octet-stream'].includes(mime))fail(422,'FILE_TYPE_NOT_ALLOWED');
    const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),key=`${u.school_id}/${scope}/${id}`,guard=crypto.randomUUID();
    const size=bytes.byteLength,schoolScope=`school:${u.school_id}`;
    await db(c).batch([
      db(c).prepare(`INSERT INTO command_guards(id,valid) VALUES(?,CASE WHEN (SELECT COUNT(*) FROM storage_limits WHERE scope IN('account',?) AND used_bytes+reserved_bytes+?<=max_bytes)=2 THEN 1 ELSE 0 END)`).bind(guard,schoolScope,size),
      db(c).prepare(`UPDATE storage_limits SET reserved_bytes=reserved_bytes+? WHERE scope IN('account',?)`).bind(size,schoolScope),
      db(c).prepare(`INSERT INTO upload_reservations(id,school_id,size_bytes,expires_at,state) VALUES(?,?,?,?,'reserved')`).bind(id,u.school_id,size,now+3600),
      db(c).prepare(`INSERT INTO files(id,school_id,uploaded_by,r2_key,file_name,mime_type,size_bytes,checksum_sha256,access_scope,entity_type,entity_id,created_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'reserved')`).bind(id,u.school_id,u.id,key,name,mime,size,await digest(bytes),scope,entityType,entityId,now),
      db(c).prepare('DELETE FROM command_guards WHERE id=?').bind(guard),
    ]);
    let stored=false;
    try{
      const object=await c.env.R2_MEDIA.put(key,bytes,{httpMetadata:{contentType:mime}});stored=true;
      if(!object||object.size!==size)throw new Error('SIZE_MISMATCH');
      await db(c).batch([
        db(c).prepare(`UPDATE storage_limits SET reserved_bytes=reserved_bytes-?,used_bytes=used_bytes+? WHERE scope IN('account',?)`).bind(size,size,schoolScope),
        db(c).prepare(`UPDATE upload_reservations SET state='committed' WHERE id=? AND state='reserved'`).bind(id),
        db(c).prepare(`UPDATE files SET state='verified' WHERE id=? AND school_id=? AND state='reserved'`).bind(id,u.school_id),
      ]);
      return c.json({status:'success',fileId:id,sizeBytes:size});
    }catch(err){
      let state:string|undefined;
      try{state=(await db(c).prepare('SELECT state FROM upload_reservations WHERE id=? AND school_id=?').bind(id,u.school_id).first<{state:string}>())?.state;}catch{throw err;}
      if(state==='committed')return c.json({status:'success',fileId:id,sizeBytes:size});
      if(state!=='reserved')throw err;
      // Retain quota reservation if object cleanup cannot be confirmed.
      let deleted=!stored;
      try{await c.env.R2_MEDIA.delete(key);deleted=true;}catch{}
      if(deleted)await db(c).batch([
        db(c).prepare(`UPDATE storage_limits SET reserved_bytes=reserved_bytes-? WHERE scope IN('account',?) AND EXISTS(SELECT 1 FROM upload_reservations WHERE id=? AND state='reserved')`).bind(size,schoolScope,id),
        db(c).prepare(`UPDATE upload_reservations SET state='released' WHERE id=? AND state='reserved'`).bind(id),
        db(c).prepare(`DELETE FROM files WHERE id=? AND school_id=? AND state='reserved'`).bind(id,u.school_id),
      ]);
      throw err;
    }
  });
  app.get('/api/v3/storage/:fileId',requireAuth,async c=>{
    if(!c.env.R2_MEDIA)fail(503,'STORAGE_UNAVAILABLE');
    const row=await db(c).prepare(`SELECT * FROM files WHERE id=? AND school_id=? AND state='verified'`).bind(c.req.param('fileId'),c.get('user').school_id).first<{r2_key:string;mime_type:string;access_scope:string;entity_type:string|null;entity_id:string|null}>();
    if(!row)fail(404,'FILE_NOT_FOUND');
    if(row.access_scope!=='public')await entityAccess(c,row.access_scope,row.entity_type,row.entity_id);
    const object=await c.env.R2_MEDIA.get(row.r2_key);if(!object)fail(404,'OBJECT_NOT_FOUND');
    c.header('Content-Type',row.mime_type);c.header('Cache-Control','private, no-store');c.header('Content-Disposition','attachment');return c.body(object.body);
  });
}
