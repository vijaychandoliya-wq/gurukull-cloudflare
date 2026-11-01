import {deliveryHealthQuery as q} from './monitor-query.mjs';
import {spawnSync} from 'node:child_process';
const origin='https://gurukul-worker-api.gurukull.workers.dev';
const response=await fetch(origin+'/health',{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Production liveness failed');
const r=spawnSync('npx',['wrangler','d1','execute','DB','--remote','--env','production','--config','workers/api/wrangler.toml','--command',q,'--json'],{encoding:'utf8'});if(r.status!==0)throw Error('Production database probe failed');
const row=JSON.parse(r.stdout)[0].results[0];console.log(JSON.stringify({event:'operations_probe',delayed:row.delayed||0,held:row.held||0}));
if(row.delayed>0||row.held>0)throw Error('Delivery backlog requires operator reconciliation; do not blindly resend');
