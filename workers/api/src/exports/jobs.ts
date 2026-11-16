import type {Env} from '../context.js';
import {csvSnapshot,pdfSnapshot,xlsxSnapshot,type ExportSnapshot} from './document.js';
export type ExportJob={id:string;school_id:string;actor_id:string;source_json:string;format:'csv'|'pdf'|'xlsx';title:string;school_name:string;status:string;rows_total:number;rows_done:number;parts_json:string;lease_id:string|null;lease_until:number|null;attempts:number;error:string|null;created_at:number;expires_at:number;authorization:string;request_hash:string};
export const exportPrefix=(job:Pick<ExportJob,'school_id'|'actor_id'|'id'>)=>'record-exports/'+[job.school_id,job.actor_id,job.id].map(encodeURIComponent).join('/')+'/';
export type StoredSnapshot=ExportSnapshot&{recordIds:string[];fieldKeys:string[]};
export function recordIdentity(row:Record<string,unknown>){for(const key of ['id','sessionId','userId','studentId','employeeId','value'])if(typeof row[key]==='string'||typeof row[key]==='number')return key+':'+String(row[key]);return JSON.stringify(Object.fromEntries(Object.entries(row).sort(([a],[b])=>a.localeCompare(b))));}
export async function processExportJob(env:Env,id?:string){
 const now=Math.floor(Date.now()/1000),lease=crypto.randomUUID();
 await env.DB.prepare("UPDATE record_exports SET status='failed',error='EXPORT_CAPTURE_INTERRUPTED' WHERE status='capturing' AND lease_until<?").bind(now).run();
 const job=await env.DB.prepare(`UPDATE record_exports SET status='processing',lease_id=?,lease_until=?,attempts=attempts+1 WHERE id=(SELECT id FROM record_exports WHERE expires_at>? AND (status='queued' OR (status='processing' AND lease_until<?)) AND (? IS NULL OR id=?) ORDER BY created_at LIMIT 1) RETURNING *`).bind(lease,now+300,now,now,id||null,id||null).first<ExportJob>();
 if(!job)return;
 const prefix=exportPrefix(job);
 try{
  if(job.rows_total>240000&&job.format==='pdf')throw Error('EXPORT_PDF_TOO_MANY_PARTS');
  if(job.attempts>20)throw Error('EXPORT_RETRY_LIMIT');
  const object=await env.R2_MEDIA.get(prefix+'snapshot.json');if(!object)throw Error('EXPORT_SNAPSHOT_MISSING');
  const snapshot=await object.json<StoredSnapshot>(),parts=JSON.parse(job.parts_json) as {key:string;name:string;size:number}[];
  const begin=job.rows_done,isXlsx=job.format==='xlsx',end=job.format==='pdf'?Math.min(begin+300,snapshot.rows.length):snapshot.rows.length,name=job.format==='csv'?'all-records.csv':isXlsx?'all-records.xlsx':!snapshot.rows.length?'records-empty.pdf':'records-'+String(begin+1).padStart(6,'0')+'-'+String(end).padStart(6,'0')+'.pdf';
  const data=job.format==='csv'?new TextEncoder().encode(csvSnapshot(snapshot)):isXlsx?await xlsxSnapshot(snapshot,begin,end):await pdfSnapshot(snapshot,begin,end,async family=>{
   if(!env.ASSETS)throw Error('EXPORT_FONTS_UNAVAILABLE');const response=await env.ASSETS.fetch(new Request('https://assets.invalid/export-fonts/'+family+'.ttf'));if(!response.ok)throw Error('EXPORT_FONT_MISSING');return new Uint8Array(await response.arrayBuffer());
  });
  if(data.byteLength>20*1024*1024)throw Error('EXPORT_PART_TOO_LARGE');
  const key=prefix+'parts/'+name;await env.R2_MEDIA.put(key,data,{httpMetadata:{contentType:job.format==='pdf'?'application/pdf':isXlsx?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'text/csv; charset=utf-8'},customMetadata:{school:job.school_id,actor:job.actor_id}});
  const updated=[...parts.filter(p=>p.key!==key),{key,name,size:data.byteLength}];
  await env.DB.prepare("UPDATE record_exports SET rows_done=?,parts_json=?,status=?,lease_id=NULL,lease_until=NULL,error=NULL,attempts=0 WHERE id=? AND lease_id=? AND expires_at>?").bind(end,JSON.stringify(updated),end>=snapshot.rows.length?'ready':'queued',job.id,lease,now).run();
 }catch(error){const message=error instanceof Error&&/^EXPORT_[A-Z_]+$/.test(error.message)?error.message:'EXPORT_GENERATION_FAILED';await env.DB.prepare("UPDATE record_exports SET status='failed',error=?,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?").bind(message,job.id,lease).run();}
}
export async function expireExports(env:Env){
 const now=Math.floor(Date.now()/1000),expired=await env.DB.prepare("SELECT * FROM record_exports WHERE expires_at<=? AND status!='expired' ORDER BY expires_at LIMIT 10").bind(now).all<ExportJob>();
 for(const job of expired.results){const list=await env.R2_MEDIA.list({prefix:exportPrefix(job),limit:1000});if(list.objects.length)await env.R2_MEDIA.delete(list.objects.map(o=>o.key));if(!list.truncated)await env.DB.prepare("UPDATE record_exports SET status='expired',parts_json='[]',source_json='{}',error=NULL WHERE id=? AND expires_at<=?").bind(job.id,now).run();}
}
