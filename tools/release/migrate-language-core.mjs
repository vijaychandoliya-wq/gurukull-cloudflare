// An explicitly approved production job for migration 0036 only.
import {readFileSync,readdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
if(process.env.CLOUDFLARE_ACCOUNT_ID!=='e640cac6d5f89a87e7c952f4b3669af0')throw Error('Unexpected production account');
const config='workers/api/wrangler.toml';
if(!readFileSync(config,'utf8').split('[env.production]')[1]?.includes('70b2a68a-d0c8-47b6-8837-c66eef4c19e0'))throw Error('Unexpected production database');
function run(args){const r=spawnSync('npx',['wrangler',...args,'--env','production','--config',config],{encoding:'utf8'});if(r.status!==0)throw Error('Cloudflare migration operation failed');return r.stdout;}
function remoteNames(){return JSON.parse(run(['d1','execute','DB','--remote','--command','SELECT name FROM d1_migrations ORDER BY id','--json'])).flatMap(x=>x.results||[]).map(x=>x.name).sort();}
const local=readdirSync('migrations').filter(x=>x.endsWith('.sql')).sort(),remote=remoteNames();
if(JSON.stringify(local)===JSON.stringify(remote)){console.log('Language migration already applied');process.exit(0);}
if(local.at(-1)!=='0036_indian_language_core_previews.sql'||JSON.stringify(local.slice(0,-1))!==JSON.stringify(remote))throw Error('Only the reviewed language-list migration may be pending');
const bookmark=run(['d1','time-travel','info','DB','--json']);JSON.parse(bookmark);
writeFileSync('language-recovery-bookmark.json',bookmark,{mode:0o600});
run(['d1','migrations','apply','DB','--remote']);
if(JSON.stringify(remoteNames())!==JSON.stringify(local))throw Error('Post-migration verification failed');
console.log(JSON.stringify({event:'language_migration_verified',migration:local.at(-1)}));
