import type {Hono} from 'hono';
import {db,readBody,requireAuth,type AppEnv,type ApiContext} from '../context.js';
import {digest,fail} from '../security.js';
import {z} from 'zod';
import {parse} from '../management-common.js';
import {readSource,sourceRows,validExportSource,type Source,type SourceReader} from './read-source.js';
import {snapshotRecords} from './document.js';
import {exportPrefix,processExportJob,recordIdentity,type ExportJob,type StoredSnapshot} from './jobs.js';
import {zipFiles,type ZipFile} from './zip.js';
const input=z.object({source:z.object({path:z.string().max(220).refine(validExportSource),query:z.record(z.string(),z.string().max(1000)).refine(v=>Object.keys(v).length<=30),arrayPath:z.array(z.union([z.string().regex(/^[A-Za-z0-9_-]+$/),z.object({key:z.enum(['id','userId','studentId','sessionId']),value:z.union([z.string().max(160),z.number().finite()])}).strict()])).min(1).max(8)}).strict(),format:z.enum(['csv','pdf','xlsx'])}).strict();
const fingerprint=(c:ApiContext)=>JSON.stringify([c.get('user').user_type,[...(c.get('user').roles||[])].sort()]);
const view=(job:ExportJob)=>({id:job.id,title:job.title,format:job.format,status:job.status,total:job.rows_total,done:job.rows_done,files:JSON.parse(job.parts_json).length,error:job.error,expiresAt:job.expires_at});
async function ownerJob(c:ApiContext){const u=c.get('user'),job=await db(c).prepare('SELECT * FROM record_exports WHERE id=? AND school_id=? AND actor_id=?').bind(c.req.param('id'),u.school_id,u.id).first<ExportJob>();if(!job)fail(404,'EXPORT_NOT_FOUND');if(job.expires_at<=Date.now()/1000||job.status==='expired')fail(404,'EXPORT_EXPIRED');if(job.authorization!==fingerprint(c))fail(403,'EXPORT_PERMISSION_CHANGED');return job;}
async function boundedJson(response:Response){const reader=response.body?.getReader();if(!reader)throw Error('EXPORT_EMPTY_RESPONSE');const chunks:Uint8Array[]=[];let size=0;try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.length;if(size>8*1024*1024)throw Error('EXPORT_SNAPSHOT_TOO_LARGE');chunks.push(item.value);}}finally{await reader.cancel().catch(()=>undefined);reader.releaseLock();}const text=new TextDecoder(),parts:string[]=[];chunks.forEach(b=>parts.push(text.decode(b,{stream:true})));parts.push(text.decode());return JSON.parse(parts.join(''));}
export function registerRecordExports(app:Hono<AppEnv>,reader:SourceReader){
 app.post('/api/exports',requireAuth,async c=>{
  const u=c.get('user'),v=parse(input,await readBody(c)),key=c.req.header('Idempotency-Key');if(!key||!/^[-A-Za-z0-9_]{1,128}$/.test(key))fail(422,'IDEMPOTENCY_KEY_REQUIRED');const hash=await digest(JSON.stringify(v));
  const prior=await db(c).prepare('SELECT * FROM record_exports WHERE school_id=? AND actor_id=? AND command_id=?').bind(u.school_id,u.id,key).first<ExportJob>();if(prior){if(prior.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT');return c.json({data:view(prior)},202);}
  const now=Math.floor(Date.now()/1000),active=await db(c).prepare("SELECT COUNT(*) AS n FROM record_exports WHERE school_id=? AND status IN ('capturing','queued','processing') AND expires_at>?").bind(u.school_id,now).first<{n:number}>();if(Number(active?.n)>=3)fail(429,'EXPORT_JOBS_BUSY');
  const id=crypto.randomUUID(),title=v.source.path.split('/').filter(p=>p&&!/^[0-9a-f-]{20,}$/i.test(p)).slice(-1)[0].replaceAll('-',' '),job={id,school_id:u.school_id,actor_id:u.id};
  const inserted=await db(c).prepare("INSERT INTO record_exports(id,school_id,actor_id,source_json,authorization,format,title,school_name,status,created_at,expires_at,command_id,request_hash,lease_until) SELECT ?,?,?,?,?,?,?,?,'capturing',?,?,?,?,? WHERE (SELECT COUNT(*) FROM record_exports WHERE school_id=? AND status IN ('capturing','queued','processing') AND expires_at>?)<3 RETURNING id").bind(id,u.school_id,u.id,JSON.stringify(v.source),fingerprint(c),v.format,title,c.get('school').name,now,now+86400,key,hash,now+300,u.school_id,now).first<{id:string}>();
  if(!inserted)fail(429,'EXPORT_JOBS_BUSY');
  try{const response=await readSource(reader,c.req.raw,c.env,v.source,true),body=await boundedJson(response),records=sourceRows(body,v.source.arrayPath),snapshot:StoredSnapshot={...snapshotRecords(records,{title,school:c.get('school').name,capturedAt:new Date().toISOString(),source:v.source.path}),recordIds:records.map(recordIdentity),fieldKeys:Array.from(new Set(records.flatMap(Object.keys)))};
   if(v.source.arrayPath.length===1&&v.source.arrayPath[0]==='data'){const expected=body?.meta?.total??body?.total;if(typeof expected==='number'&&expected!==records.length)throw Error('EXPORT_INCOMPLETE_SOURCE');}
   await c.env.R2_MEDIA.put(exportPrefix(job)+'snapshot.json',JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'},customMetadata:{school:u.school_id,actor:u.id}});
   await db(c).prepare("UPDATE record_exports SET status='queued',rows_total=?,lease_until=NULL WHERE id=? AND status='capturing'").bind(records.length,id).run();
   c.executionCtx.waitUntil(processExportJob(c.env,id));
  }catch(error){const code=error instanceof Error&&/^EXPORT_[A-Z_]+$/.test(error.message)?error.message:'EXPORT_CAPTURE_FAILED';await db(c).prepare("UPDATE record_exports SET status='failed',error=?,lease_until=NULL WHERE id=?").bind(code,id).run();}
  const saved=await db(c).prepare('SELECT * FROM record_exports WHERE id=? AND school_id=? AND actor_id=?').bind(id,u.school_id,u.id).first<ExportJob>();return c.json({data:view(saved!)},202);
 });
 app.get('/api/exports',requireAuth,async c=>{const u=c.get('user'),rows=await db(c).prepare("SELECT * FROM record_exports WHERE school_id=? AND actor_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 25").bind(u.school_id,u.id,Math.floor(Date.now()/1000)).all<ExportJob>();c.header('Cache-Control','no-store');return c.json({data:rows.results.map(view)});});
 app.get('/api/exports/:id',requireAuth,async c=>{const job=await ownerJob(c);c.header('Cache-Control','no-store');return c.json({data:view(job)});});
 app.post('/api/exports/:id/continue',requireAuth,async c=>{const job=await ownerJob(c);if(job.status==='queued'||job.status==='processing')await processExportJob(c.env,job.id);return c.json({data:{id:job.id}});});
 app.get('/api/exports/:id/download',requireAuth,async c=>{
  const job=await ownerJob(c);if(job.status!=='ready')fail(409,'EXPORT_NOT_READY');
  const saved=await c.env.R2_MEDIA.get(exportPrefix(job)+'snapshot.json');if(!saved)fail(404,'EXPORT_EXPIRED');const snapshot=await saved.json<StoredSnapshot>(),source=JSON.parse(job.source_json) as Source;
  try{const current=sourceRows(await boundedJson(await readSource(reader,c.req.raw,c.env,source,true)),source.arrayPath),ids=new Set(current.map(recordIdentity));if(snapshot.recordIds.some(id=>!ids.has(id)))fail(403,'EXPORT_SCOPE_CHANGED');}catch{fail(403,'EXPORT_SCOPE_CHANGED','Your access or the source records changed. Generate a new export.');}
  const parts=JSON.parse(job.parts_json) as {key:string;name:string;size:number}[];if(!parts.length)fail(503,'EXPORT_FILE_MISSING');
  c.header('Cache-Control','private, no-store');c.header('X-Content-Type-Options','nosniff');
  if(parts.length===1){const object=await c.env.R2_MEDIA.get(parts[0].key);if(!object)fail(503,'EXPORT_FILE_MISSING');c.header('Content-Type',job.format==='pdf'?'application/pdf':job.format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv; charset=utf-8');c.header('Content-Disposition','attachment; filename="'+job.id+'.'+job.format+'"');return c.body(object.body);}
  const files:ZipFile[]=[];for(const part of parts)files.push({name:part.name,open:async()=>{const object=await c.env.R2_MEDIA.get(part.key);if(!object)throw Error('EXPORT_FILE_MISSING');return object.body;}});
  const manifest=new TextEncoder().encode(JSON.stringify({records:job.rows_total,parts:parts.map(p=>p.name),capturedAt:snapshot.capturedAt,source:snapshot.source},null,2));files.push({name:'manifest.json',open:async()=>new ReadableStream({start(controller){controller.enqueue(manifest);controller.close();}})});
  c.header('Content-Type','application/zip');c.header('Content-Disposition','attachment; filename="'+job.id+'-pdfs.zip"');return c.body(zipFiles(files));
 });
}
