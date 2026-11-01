import {cloudflareRequest} from './cloudflare-api.mjs';
const end=new Date(),start=new Date(end.getTime()-15*60*1000);
const query='query($accountTag: string!, $scriptName: string!, $start: Time!, $end: Time!){viewer{accounts(filter:{accountTag:$accountTag}){workersInvocationsAdaptive(limit:1,filter:{scriptName:$scriptName,datetime_geq:$start,datetime_leq:$end}){sum{requests errors}}}}}';
const data=await cloudflareRequest('graphql',{method:'POST',body:JSON.stringify({query,variables:{accountTag:process.env.CLOUDFLARE_ACCOUNT_ID||'e640cac6d5f89a87e7c952f4b3669af0',scriptName:'gurukul-worker-api',start:start.toISOString(),end:end.toISOString()}})});
if(data.errors){if(data.errors.some(e=>e.extensions?.code==='budget'))throw Error('Cloudflare Analytics rate budget exhausted; retry after the provider window resets');throw Error('Worker metrics unavailable: check Analytics Read permission');}
const sum=data.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive?.[0]?.sum||{requests:0,errors:0};
console.log(JSON.stringify({event:'worker_metrics',windowMinutes:15,...sum}));
if(sum.errors>0&&sum.errors/Math.max(1,sum.requests)>0.01)throw Error('Worker runtime error rate exceeded one percent');
