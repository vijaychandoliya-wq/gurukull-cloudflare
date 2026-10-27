import {readFileSync,writeFileSync,mkdirSync,chmodSync,rmSync} from 'node:fs';
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const directory=process.argv[2];if(!directory)throw Error('Private output directory required');
const key=Buffer.from(process.env.BACKUP_ENCRYPTION_KEY||'','hex');if(key.length!==32)throw Error('Set a 32-byte BACKUP_ENCRYPTION_KEY outside source control');
mkdirSync(directory,{recursive:true,mode:0o700});chmodSync(directory,0o700);
const snapshot=directory+'/snapshot.sql',sealed=directory+'/snapshot.enc';
const exported=spawnSync('npx',['wrangler','d1','export','DB','--remote','--config','workers/api/wrangler.toml','--env','production','--output',snapshot,'--skip-confirmation'],{encoding:'utf8'});
if(exported.status!==0)throw Error('Snapshot export failed; inspect redacted Wrangler diagnostics');chmodSync(snapshot,0o600);
try{
 const raw=readFileSync(snapshot),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 const encrypted=Buffer.concat([cipher.update(raw),cipher.final()]);
 writeFileSync(sealed,Buffer.concat([Buffer.from('GKB1'),iv,cipher.getAuthTag(),encrypted]),{mode:0o600});
 const data=readFileSync(sealed),decipher=createDecipheriv('aes-256-gcm',key,data.subarray(4,16));decipher.setAuthTag(data.subarray(16,32));const restored=Buffer.concat([decipher.update(data.subarray(32)),decipher.final()]);
 if(!restored.equals(raw))throw Error('Encrypted snapshot round-trip mismatch');
 const started=Date.now();
 const drill=spawnSync('python3',['-c',`import sqlite3,sys,json\nc=sqlite3.connect(':memory:');c.executescript(sys.stdin.read());assert c.execute('PRAGMA integrity_check').fetchone()[0]=='ok';assert not c.execute('PRAGMA foreign_key_check').fetchall();print(json.dumps({'integrity':'ok','foreignKeys':'ok','tables':c.execute("SELECT COUNT(*) FROM sqlite_master WHERE type='table'").fetchone()[0]}))`],{input:restored,encoding:'utf8',maxBuffer:1024*1024});
 if(drill.status!==0)throw Error('Isolated restore integrity check failed');
 writeFileSync(directory+'/manifest.json',JSON.stringify({version:1,createdAt:new Date().toISOString(),sha256:createHash('sha256').update(data).digest('hex'),bytes:data.length,drillMs:Date.now()-started,checks:JSON.parse(drill.stdout)},null,2),{mode:0o600});
 console.log(JSON.stringify({event:'encrypted_recovery_verified',durationMs:Date.now()-started,checks:JSON.parse(drill.stdout)}));
}finally{rmSync(snapshot,{force:true});}
