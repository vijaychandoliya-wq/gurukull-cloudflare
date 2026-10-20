import { type GoogleServiceAccountKey, getGoogleAccessToken, sendFcmNotification } from './fcm.js';
export interface OutboxConsumerEnv { DB:D1Database; KV_CACHE?:KVNamespace; FIREBASE_SERVICE_ACCOUNT_JSON?:string }
export interface OutboxConsumerStats {processed:number;succeeded:number;failed:number;deadLettered:number;prunedTokens:number}
interface Event {id:string;school_id:string;event_type:string;payload_json:string;attempts:number}
export async function processOutboxBatch(env:OutboxConsumerEnv,batchLimit=1):Promise<OutboxConsumerStats>{
  const stats:OutboxConsumerStats={processed:0,succeeded:0,failed:0,deadLettered:0,prunedTokens:0};
  if(!env.DB)throw new Error('DATABASE_UNAVAILABLE');
  const now=Math.floor(Date.now()/1000),lease=crypto.randomUUID();
  // A sending row whose lease expired has an uncertain provider outcome. Do not resend blindly.
  await env.DB.batch([
    env.DB.prepare(`UPDATE delivery_outcomes SET status='unknown',last_error='PROVIDER_ACCEPTANCE_UNKNOWN',updated_at=? WHERE status='sending' AND event_id IN(SELECT id FROM outbox WHERE status='processing' AND lease_until<=?)`).bind(now,now),
    env.DB.prepare(`UPDATE outbox SET status='dead_letter',last_error='PROVIDER_ACCEPTANCE_UNKNOWN',lease_id=NULL,lease_until=NULL WHERE status='processing' AND lease_until<=? AND EXISTS(SELECT 1 FROM delivery_outcomes d WHERE d.event_id=outbox.id AND d.status='unknown')`).bind(now),
    env.DB.prepare(`UPDATE outbox SET status='pending',lease_id=NULL,lease_until=NULL WHERE status='processing' AND lease_until<=?`).bind(now),
  ]);
  const claimed=await env.DB.prepare(`UPDATE outbox SET status='processing',lease_id=?,lease_until=? WHERE id IN(SELECT id FROM outbox WHERE status='pending' AND scheduled_at<=? ORDER BY scheduled_at,id LIMIT ?) RETURNING id,school_id,event_type,payload_json,attempts`).bind(lease,now+300,now,Math.min(1,Math.max(1,batchLimit))).all<Event>();
  for(const event of claimed.results){
    stats.processed++;
    let fatal=false,error='DELIVERY_FAILED',complete=false;
    try{
      if(event.event_type!=='push_notification'){fatal=true;throw new Error('UNSUPPORTED_EVENT_TYPE');}
      if(!env.FIREBASE_SERVICE_ACCOUNT_JSON)throw new Error('FCM_NOT_CONFIGURED');
      const account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as GoogleServiceAccountKey;
      if(!account.project_id||!account.client_email||!account.private_key)throw new Error('FCM_NOT_CONFIGURED');
      const payload=JSON.parse(event.payload_json) as {targetUserId?:string;data?:Record<string,string>};
      if(!payload.targetUserId){fatal=true;throw new Error('EXPLICIT_RECIPIENT_REQUIRED');}
      // Each user-specific event is populated with ALL eligible devices, then drained in bounded chunks.
      await env.DB.prepare(`INSERT INTO delivery_outcomes(event_id,device_id,school_id,status,attempts,updated_at) SELECT ?,d.id,d.school_id,'pending',0,? FROM devices d JOIN users u ON u.id=d.user_id AND u.school_id=d.school_id JOIN schools s ON s.id=d.school_id WHERE d.school_id=? AND d.user_id=? AND d.status='active' AND u.status='active' AND s.status='active' ON CONFLICT(event_id,device_id) DO NOTHING`).bind(event.id,now,event.school_id,payload.targetUserId).run();
      const targets=await env.DB.prepare(`SELECT o.device_id,d.fcm_token FROM delivery_outcomes o JOIN devices d ON d.id=o.device_id AND d.school_id=o.school_id JOIN users u ON u.id=d.user_id AND u.school_id=d.school_id WHERE o.event_id=? AND o.school_id=? AND o.status IN('pending','failed') AND d.status='active' AND u.status='active' ORDER BY o.device_id LIMIT 5`).bind(event.id,event.school_id).all<{device_id:string;fcm_token:string}>();
      const accessToken=targets.results.length?await getGoogleAccessToken(account):null;
      let anyFailure=false;
      for(const target of targets.results){
        // Recheck targeting/lease atomically immediately before provider work.
        const started=await env.DB.prepare(`UPDATE delivery_outcomes SET status='sending',attempts=attempts+1,updated_at=? WHERE event_id=? AND device_id=? AND status IN('pending','failed') AND EXISTS(SELECT 1 FROM outbox WHERE id=? AND lease_id=? AND lease_until>?) AND EXISTS(SELECT 1 FROM devices WHERE id=? AND status='active') RETURNING device_id`).bind(now,event.id,target.device_id,event.id,lease,now,target.device_id).first();
        if(!started)continue;
        let result;
        try{result=await sendFcmNotification(account,accessToken!,target.fcm_token,{title:'School update',body:'Open Gurukull.',data:payload.data});}
        catch{
          // A transport failure might have occurred after acceptance. Hold for reconciliation.
          await env.DB.prepare(`UPDATE delivery_outcomes SET status='unknown',last_error='PROVIDER_ACCEPTANCE_UNKNOWN',updated_at=? WHERE event_id=? AND device_id=?`).bind(now,event.id,target.device_id).run();
          fatal=true;throw new Error('PROVIDER_ACCEPTANCE_UNKNOWN');
        }
        const state=result.status==='sent'?'sent':result.status==='unregistered'?'invalid':'failed';
        fatal=true; // Until the provider result is durable, retrying may duplicate an accepted send.
        await env.DB.prepare(`UPDATE delivery_outcomes SET status=?,provider_message_id=?,last_error=?,updated_at=? WHERE event_id=? AND device_id=?`).bind(state,result.messageId||null,result.error||null,now,event.id,target.device_id).run();
        fatal=false;
        if(state==='invalid'){await env.DB.prepare(`UPDATE devices SET status='revoked',updated_at=? WHERE id=? AND school_id=?`).bind(now,target.device_id,event.school_id).run();stats.prunedTokens++;}
        if(state==='failed')anyFailure=true;
      }
      const remainder=await env.DB.prepare(`SELECT COUNT(*) AS total,SUM(CASE WHEN status NOT IN('sent','invalid') THEN 1 ELSE 0 END) AS outstanding FROM delivery_outcomes WHERE event_id=? AND school_id=?`).bind(event.id,event.school_id).first<{total:number;outstanding:number}>();
      if(!remainder?.total)throw new Error('NO_ACTIVE_RECIPIENT');
      complete=!anyFailure&&remainder.outstanding===0;
      if(!complete)error=anyFailure?'PROVIDER_RETRY_REQUIRED':'FANOUT_PENDING';
    }catch(err){error=err instanceof Error && /^[A-Z_0-9]+$/.test(err.message)?err.message:'DELIVERY_FAILED';}
    const attempts=event.attempts+1;
    const dead=fatal||(!complete&&error!=='FANOUT_PENDING'&&attempts>=5);
    const status=complete?'completed':dead?'dead_letter':'pending';
    await env.DB.prepare(`UPDATE outbox SET status=?,attempts=?,last_error=?,scheduled_at=?,lease_id=NULL,lease_until=NULL WHERE id=? AND lease_id=?`).bind(status,error==='FANOUT_PENDING'?event.attempts:attempts,complete?null:error,now+(error==='FANOUT_PENDING'?1:Math.min(3600,2**attempts*10)),event.id,lease).run();
    if(complete)stats.succeeded++;else stats.failed++;if(dead)stats.deadLettered++;
  }
  return stats;
}
