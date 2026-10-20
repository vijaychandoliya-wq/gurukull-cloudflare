// Isolated scalar performance probe: no DB, school users, files or provider bindings.
import { verifyPassword, decode } from '../../workers/api/src/security.js';
import {signJwt,verifyJwt,encode} from '../../workers/api/src/security.js';
import {accessKeyDigest,verifyAccessKey} from '../../workers/api/src/admin-access.js';
const utf8=new TextEncoder();
export default {
 async fetch(request:Request, env:{PROBE_SECRET:string}):Promise<Response>{
  const url=new URL(request.url),kind=url.pathname;
  const key=await crypto.subtle.importKey('raw',utf8.encode(env.PROBE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  let allowed=false;
  try{allowed=await crypto.subtle.verify('HMAC',key,decode(request.headers.get('x-probe-signature')||''),utf8.encode(kind));}catch{}
  if(!allowed||request.method!=='POST')return Response.json({error:'FORBIDDEN'},{status:403});
  const start=Date.now();
  try {
   if(kind==='/admin-access-key'){
    const credential='gka1_'+encode(new Uint8Array(32).fill(7));
    const stored=await accessKeyDigest(credential,env.PROBE_SECRET,'nonpersisting-school','nonpersisting-owner');
    const verified=await verifyAccessKey(credential,stored,env.PROBE_SECRET,'nonpersisting-school','nonpersisting-owner');
    const now=Math.floor(Date.now()/1000);
    const token=await signJwt({sub:'nonpersisting-owner',sid:'nonpersisting-session',schoolId:'nonpersisting-school',schoolCode:'BOUNDARY',userType:'admin',fullName:'Nonpersisting scalar',iat:now,exp:now+7200,iss:'gurukull-edge',aud:'gurukull-clients'},env.PROBE_SECRET);
    return Response.json({kind,verified,jwtVerified:!!await verifyJwt(token,env.PROBE_SECRET),wall_ms:Date.now()-start});
   }
   if(kind==='/bcrypt-10'){
    const verified=await verifyPassword('nonpersisting-bcrypt-boundary','$2a$10$Wfy.WzIE8m6d.WNHDtFbSu9q0Cev9CEZMB55yD3Y9pfE3A.5N2Lw6','bcrypt');
    return Response.json({kind,verified,wall_ms:Date.now()-start});
   }
   if(kind==='/pbkdf2-600k'){
    const key=await crypto.subtle.importKey('raw',utf8.encode('nonpersisting-kdf-boundary'),'PBKDF2',false,['deriveBits']);
    await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:crypto.getRandomValues(new Uint8Array(16)),iterations:600000},key,256);
    return Response.json({kind,completed:true,wall_ms:Date.now()-start});
   }
   return Response.json({error:'NOT_FOUND'},{status:404});
  }catch{
   return Response.json({kind,error:'RUNTIME_KDF_REJECTED',wall_ms:Date.now()-start},{status:503});
  }
 }
};
