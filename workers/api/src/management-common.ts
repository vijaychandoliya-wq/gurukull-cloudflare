import type {ApiContext,User} from './context.js';
import {db,requireRole} from './context.js';
import {digest,fail} from './security.js';
import {HTTPException} from 'hono/http-exception';
import {z} from 'zod';
export const nullableText=(max=160)=>z.preprocess(v=>v===undefined||(typeof v==='string'&&!v.trim())?null:v,z.string().trim().max(max).nullable());
export const requiredText=(max=160)=>z.string().trim().min(1).max(max);
export const dateInput=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v,'Enter a valid calendar date');
export function parse<S extends z.ZodTypeAny>(schema:S,body:unknown):z.output<S> {
 const result=schema.safeParse(body);if(result.success)return result.data;
 throw new HTTPException(422,{res:Response.json({error:'VALIDATION_FAILED',message:'Check the highlighted fields.',errors:result.error.flatten().fieldErrors},{status:422})});
}
export async function managementReady(c:ApiContext) {
 const school=c.get('school'),u=requireRole(c,'admin');
 const [configuration,currentYear]=await db(c).batch([
  db(c).prepare('SELECT timezone,currency,configuration_verified_at FROM school_configuration WHERE school_id=?').bind(u.school_id),
  db(c).prepare('SELECT id FROM academic_years WHERE school_id=? AND is_current=1').bind(u.school_id),
 ]);
 const cfg=configuration.results[0] as {timezone:string|null;currency:string|null;configuration_verified_at:number|null}|undefined;
 const year=currentYear.results[0] as {id:string}|undefined;
 if(!cfg?.configuration_verified_at || !cfg.timezone || !cfg.currency || !year){
  const missing:string[]=[];
  if(!cfg?.configuration_verified_at || !cfg.timezone || !cfg.currency)missing.push('verified school settings');
  if(!year)missing.push('one current academic year');
  fail(409,'SCHOOL_SETUP_REQUIRED',`Before adding a person, save ${missing.join(' and ')} in Settings and Academics for ${school.name}.`);
 }
 return {school,yearId:year.id};
}
export async function command(c:ApiContext,kind:string,input:unknown,build:()=>D1PreparedStatement[],response:Record<string,unknown>,allowed:User['user_type'][]=['admin']) {
 const u=requireRole(c,...allowed),database=db(c),commandId=c.req.header('Idempotency-Key');
 if(!commandId||commandId.length>128||!/^[-A-Za-z0-9_]+$/.test(commandId))fail(422,'IDEMPOTENCY_KEY_REQUIRED');
 const hash=await digest(JSON.stringify([kind,input]));
 const prior=()=>database.prepare('SELECT request_hash,response_json FROM mutation_commands WHERE school_id=? AND actor_id=? AND command_id=?').bind(u.school_id,u.id,commandId).first<{request_hash:string;response_json:string}>();
 const replay=(r:{request_hash:string;response_json:string})=>{if(r.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT');return JSON.parse(r.response_json) as Record<string,unknown>;};
 const existing=await prior();if(existing)return replay(existing);
 try{
  const writes=build();
  writes.push(database.prepare('INSERT INTO mutation_commands(school_id,actor_id,command_id,request_hash,response_json,created_at) VALUES(?,?,?,?,?,unixepoch())').bind(u.school_id,u.id,commandId,hash,JSON.stringify(response)));
  const result=await database.batch(writes);
  const failed=result.find(r=>!r.success) as (D1Result<unknown>&{error?:string})|undefined;
  if(failed){
   const detail=String(failed.error||'');
   if(detail.includes('UNIQUE constraint'))fail(409,'DUPLICATE_RECORD','This record conflicts with an existing email, mobile number, admission number, roll number, employee ID or academic value. Check the highlighted identifiers and try again.');
   if(detail.includes('CHECK constraint'))fail(409,'RECORD_CHANGED','A related school record changed while saving. Reload the form and try again.');
   if(detail.includes('FOREIGN KEY')||detail.includes('TENANT_RELATIONSHIP')||detail.includes('SECTION_CLASS'))fail(422,'INVALID_RELATIONSHIP','One of the selected school, class, section or account links is no longer available. Reload the form and select it again.');
   fail(503,'MANAGEMENT_WRITE_FAILED','The record could not be saved because the database rejected one of its related records. Reload the form, review every highlighted field, and try again.');
  }
 }catch(error){
  const raced=await prior();if(raced)return replay(raced);
  if(error instanceof HTTPException)throw error;
  const detail=String(error);
  if(detail.includes('UNIQUE constraint'))fail(409,'DUPLICATE_RECORD','The email, mobile, admission/employee number or academic name is already in use.');
  if(detail.includes('CHECK constraint')&&detail.includes('valid'))fail(409,'RECORD_CHANGED','This record or its dependencies changed. Reload and try again.');
  if(detail.includes('FOREIGN KEY')||detail.includes('TENANT_RELATIONSHIP')||detail.includes('SECTION_CLASS'))fail(422,'INVALID_RELATIONSHIP');
  throw error;
 }
 return response;
}
// Operations that move their source row (for example restore) can replay before
// checking whether that source still exists. The hash includes the operation kind.
export async function commandReplay(c:ApiContext,kind:string,input:unknown,allowed:User['user_type'][]=['admin']){
 const u=requireRole(c,...allowed),id=c.req.header('Idempotency-Key');
 if(!id||id.length>128||!/^[-A-Za-z0-9_]+$/.test(id))fail(422,'IDEMPOTENCY_KEY_REQUIRED');
 const prior=await db(c).prepare('SELECT request_hash,response_json FROM mutation_commands WHERE school_id=? AND actor_id=? AND command_id=?').bind(u.school_id,u.id,id).first<{request_hash:string;response_json:string}>();
 if(!prior)return null;
 if(prior.request_hash!==await digest(JSON.stringify([kind,input])))fail(409,'IDEMPOTENCY_CONFLICT');
 return JSON.parse(prior.response_json) as Record<string,unknown>;
}
export function guard(c:ApiContext,sql:string,values:unknown[],id:string) {return db(c).prepare(`INSERT INTO command_guards(id,valid) VALUES(?,CASE WHEN (${sql}) THEN 1 ELSE 0 END)`).bind(id,...values);}
export function cleanupGuards(c:ApiContext,id:string){return db(c).prepare('DELETE FROM command_guards WHERE id=?').bind(id);}
export function audit(c:ApiContext,action:string,type:string,id:string){const u=c.get('user');return db(c).prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,unixepoch())').bind(crypto.randomUUID(),u.school_id,u.id,action,type,id);}
