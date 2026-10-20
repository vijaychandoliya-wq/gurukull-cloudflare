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
 const row=await db(c).prepare(`SELECT a.id FROM academic_years a JOIN school_configuration cfg ON cfg.school_id=a.school_id WHERE a.school_id=? AND a.is_current=1 AND cfg.configuration_verified_at IS NOT NULL AND cfg.timezone IS NOT NULL AND cfg.currency IS NOT NULL`).bind(u.school_id).first<{id:string}>();
 if(!row)fail(409,'SCHOOL_SETUP_REQUIRED','Save the real school settings and current academic year in Settings and Academics before adding people.');
 return {school,yearId:row.id};
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
  const result=await database.batch(writes);if(result.some(r=>!r.success))fail(503,'MANAGEMENT_WRITE_FAILED');
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
