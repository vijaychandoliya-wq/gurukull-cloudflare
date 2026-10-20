import type { Hono } from 'hono';
import { SyncPushRequestSchema } from '@gurukul/domain';
import { computePayloadHash } from '@gurukul/contracts';
import { db, readBody, requireAuth, type AppEnv } from './context.js';
import { encode, decode, fail, signJwt, verifyJwt } from './security.js';
import { recordAttendance } from './attendance.js';
import { HTTPException } from 'hono/http-exception';

export function registerSync(app:Hono<AppEnv>) {
  app.on('GET',['/api/v3/sync/bootstrap'],requireAuth,async c=>{
    // A changelog is not a full snapshot: imported entities may have no changes.
    // Do not advance a client watermark until an authorized, consistent snapshot exists.
    fail(503,'SYNC_SNAPSHOT_NOT_IMPLEMENTED');
  });
  app.post('/api/v3/sync/bootstrap',requireAuth,c=>c.json({error:'METHOD_NOT_ALLOWED',message:'Use GET /api/v3/sync/bootstrap.'},405));
  app.get('/api/v3/sync/pull',requireAuth,async c=>{
    const raw=c.req.query('cursor');if(!raw)fail(400,'CURSOR_REQUIRED');
    const cursor=await verifyJwt(raw,c.env.JWT_SECRET!);
    if(!cursor||cursor.sub!==c.get('user').id||cursor.sid!==c.get('claims').sid||cursor.schoolId!==c.get('user').school_id)fail(400,'RESET_REQUIRED');
    const data=JSON.parse(new TextDecoder().decode(decode(raw.split('.')[1]))) as {seq:number;cursor:boolean};
    if(data.cursor!==true||!Number.isSafeInteger(data.seq)||data.seq<0)fail(400,'RESET_REQUIRED');
    const u=c.get('user');
    const r=await db(c).prepare(`SELECT ch.id,ch.entity_type,ch.entity_id,ch.version,ch.operation,ch.payload_json,ch.created_at FROM changelog ch JOIN attendance a ON a.id=ch.entity_id AND a.school_id=ch.school_id WHERE ch.school_id=? AND ch.id>? AND ch.actor_scope=? AND ch.entity_type='attendance' AND ((?='parent' AND EXISTS(SELECT 1 FROM parent_student_links p WHERE p.school_id=a.school_id AND p.student_id=a.student_id AND p.parent_user_id=?)) OR (?='teacher' AND EXISTS(SELECT 1 FROM teacher_assignments ta JOIN academic_years ay ON ay.id=ta.academic_year_id AND ay.school_id=ta.school_id WHERE ta.school_id=a.school_id AND ta.section_id=a.section_id AND ta.teacher_user_id=? AND ay.is_current=1))) ORDER BY ch.id LIMIT 101`).bind(u.school_id,data.seq,`${u.user_type}:${u.id}`,u.user_type,u.id,u.user_type,u.id).all<{id:number;payload_json:string}>();
    const changes=r.results.slice(0,100),nextSeq=changes.at(-1)?.id??data.seq,now=Math.floor(Date.now()/1000);
    return c.json({status:'success',cursor:await signJwt({...c.get('claims'),iat:now,exp:now+3600,seq:nextSeq,cursor:true},c.env.JWT_SECRET!),has_more:r.results.length>100,changes:changes.map(({payload_json,...row})=>({...row,payload:JSON.parse(payload_json)}))});
  });
  app.post('/api/v3/sync/push',requireAuth,async c=>{
    const parsed=SyncPushRequestSchema.safeParse(await readBody(c));if(!parsed.success)fail(422,'INVALID_COMMANDS');
    const u=c.get('user'),results:unknown[]=[];
    for(const cmd of parsed.data.commands){
      const expectedHash=await computePayloadHash({kind:cmd.kind,entity_id:cmd.entity_id??null,base_version:cmd.base_version??null,payload:cmd.payload});
      if(cmd.payload_hash!==expectedHash){results.push({command_id:cmd.command_id,status:'rejected',error:'PAYLOAD_HASH_MISMATCH'});continue;}
      const prior=await db(c).prepare(`SELECT payload_hash,response_json FROM command_idempotency WHERE school_id=? AND actor_id=? AND command_id=?`).bind(u.school_id,u.id,cmd.command_id).first<{payload_hash:string;response_json:string}>();
      if(prior){results.push(prior.payload_hash===expectedHash?JSON.parse(prior.response_json):{command_id:cmd.command_id,status:'conflict',error:'IDEMPOTENCY_CONFLICT'});continue;}
      if(cmd.kind!=='ATTENDANCE_RECORD'){results.push({command_id:cmd.command_id,status:'rejected',error:'DOMAIN_COMMAND_NOT_IMPLEMENTED'});continue;}
      if(cmd.base_version===undefined){results.push({command_id:cmd.command_id,status:'rejected',error:'BASE_VERSION_REQUIRED'});continue;}
      try{results.push(await recordAttendance(c,cmd.payload,{id:cmd.command_id,hash:expectedHash,baseVersion:cmd.base_version}));}
      catch(err){
        if(err instanceof HTTPException && err.status<500){const body=await err.getResponse().json() as {error:string};results.push({command_id:cmd.command_id,status:err.status===409?'conflict':'rejected',error:body.error});}
        else throw err; // No success response after unknown/failed database writes.
      }
    }
    const statuses=results as {status:string}[];
    return c.json({status:statuses.every(r=>r.status==='accepted')?'success':statuses.some(r=>r.status==='accepted')?'partial':'failed',results,timestamp:Math.floor(Date.now()/1000)});
  });
}
