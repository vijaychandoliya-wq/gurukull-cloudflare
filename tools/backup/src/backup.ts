import { createHash } from 'node:crypto';
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalJsonStringify } from '@gurukul/contracts';

type Rows=Record<string,Record<string,unknown>[]>;
export interface BackupManifest {
 manifestVersion:string;schoolCode:string;schoolId:string;exportedAt:string;schemaVersion:number;
 tables:Record<string,{rowCount:number;checksumSha256:string}>;totalEntities:number;overallChecksumSha256:string;
}
const hash=(value:unknown)=>createHash('sha256').update(canonicalJsonStringify(value)).digest('hex');
const validName=(name:string)=>/^[a-z][a-z0-9_]*$/.test(name);
export class D1BackupEngine {
 generateTenantManifest(schoolCode:string,schoolId:string,tablesData:Rows,schemaVersion=3):BackupManifest{
  const tables:BackupManifest['tables']={};let totalEntities=0;
  for(const name of Object.keys(tablesData).sort()){
   if(!validName(name)||!Array.isArray(tablesData[name]))throw new Error('INVALID_TABLE');
   for(const row of tablesData[name])if(name==='schools'?row.id!==schoolId:row.school_id!==schoolId)throw new Error('CROSS_TENANT_BACKUP');
   tables[name]={rowCount:tablesData[name].length,checksumSha256:hash(tablesData[name])};totalEntities+=tablesData[name].length;
  }
  const unsigned={manifestVersion:'2.0.0',schoolCode:schoolCode.toUpperCase(),schoolId,exportedAt:new Date().toISOString(),schemaVersion,tables,totalEntities};
  return {...unsigned,overallChecksumSha256:hash(unsigned)};
 }
 verifyBackup(manifest:BackupManifest,tablesData:Rows):boolean{
  try{
   const {overallChecksumSha256,...unsigned}=manifest;
   if(manifest.manifestVersion!=='2.0.0'||!manifest.schoolId||!Number.isSafeInteger(manifest.schemaVersion)||manifest.schemaVersion<1||!Number.isFinite(Date.parse(manifest.exportedAt))||hash(unsigned)!==overallChecksumSha256)return false;
   if(canonicalJsonStringify(Object.keys(manifest.tables).sort())!==canonicalJsonStringify(Object.keys(tablesData).sort()))return false;
   let total=0;
   for(const [name,meta] of Object.entries(manifest.tables)){
    const rows=tablesData[name];if(!validName(name)||!Array.isArray(rows)||rows.length!==meta.rowCount||hash(rows)!==meta.checksumSha256)return false;
    for(const row of rows)if(name==='schools'?row.id!==manifest.schoolId:row.school_id!==manifest.schoolId)return false;
    total+=rows.length;
   }
   return total===manifest.totalEntities;
  }catch{return false;}
 }
}

const extractScript=String.raw`
import sqlite3,json,sys,pathlib
conn=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+'?mode=ro',uri=True);conn.row_factory=sqlite3.Row
conn.execute('BEGIN')
school=conn.execute('SELECT * FROM schools WHERE code=?',(sys.argv[2],)).fetchone()
if not school:raise RuntimeError('SCHOOL_NOT_FOUND')
tables={}
for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid"):
 name=r[0]
 if not name.replace('_','').isalnum():raise RuntimeError('INVALID_TABLE_NAME')
 cols=[c[1] for c in conn.execute('PRAGMA table_info('+name+')')]
 if name=='schools':rows=[dict(school)]
 elif 'school_id' in cols:rows=[dict(row) for row in conn.execute('SELECT * FROM '+name+' WHERE school_id=?',(school['id'],))]
 else:continue
 tables[name]=rows
version=conn.execute('SELECT COUNT(*) FROM d1_migrations').fetchone()[0] if conn.execute("SELECT 1 FROM sqlite_master WHERE name='d1_migrations'").fetchone() else 3
print(json.dumps({'schoolId':school['id'],'schemaVersion':version,'tables':tables}))
`;
const restoreScript=String.raw`
import sqlite3,json,sys,pathlib
package=json.load(sys.stdin);manifest=package['manifest'];tables=package['tables']
conn=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+'?mode=rw',uri=True);conn.execute('PRAGMA foreign_keys=ON');conn.execute('BEGIN IMMEDIATE')
try:
 for table,rows in tables.items():
  if not rows:continue
  if not table.replace('_','').isalnum():raise RuntimeError('INVALID_TABLE')
  columns={r[1] for r in conn.execute('PRAGMA table_info('+table+')')}
  for row in rows:
   if not set(row).issubset(columns):raise RuntimeError('SCHEMA_MISMATCH')
   if table=='schools' and row['id']!=manifest['schoolId']:raise RuntimeError('TENANT_MISMATCH')
   if table!='schools' and row.get('school_id')!=manifest['schoolId']:raise RuntimeError('TENANT_MISMATCH')
   names=list(row)
   # Restores insert only; conflicting rows fail, never overwrite another tenant or ledger.
   primary=[r[1] for r in conn.execute('PRAGMA table_info('+table+')') if r[5]]
   if not primary:raise RuntimeError('PRIMARY_KEY_REQUIRED')
   existing=conn.execute('SELECT * FROM '+table+' WHERE '+' AND '.join(k+'=?' for k in primary),[row[k] for k in primary]).fetchone()
   if existing:
    dbcols=[d[0] for d in conn.execute('SELECT * FROM '+table+' LIMIT 0').description]
    if any(dict(zip(dbcols,existing))[k]!=v for k,v in row.items()):raise RuntimeError('RESTORE_CONFLICT')
    continue
   conn.execute('INSERT INTO '+table+' ('+','.join(names)+') VALUES ('+','.join('?' for _ in names)+')',[row[k] for k in names])
 if conn.execute('PRAGMA foreign_key_check').fetchone():raise RuntimeError('FOREIGN_KEY_FAILURE')
 conn.commit();print('Restore committed; other tenants were not modified.')
except:conn.rollback();raise
`;
function argumentsOf(args:string[]){const values:Record<string,string>={};for(let i=0;i<args.length;i+=2){if(!args[i].startsWith('--')||!args[i+1])throw new Error('EXPECTED_NAMED_ARGUMENTS');values[args[i].slice(2)]=args[i+1];}return values;}
export function main(args:string[]){
 const [command,...rest]=args,opts=argumentsOf(rest),engine=new D1BackupEngine();
 if(command==='export'){
  if(!opts['source-sqlite']||!opts.school||!opts.output)throw new Error('REQUIRE_SOURCE_SNAPSHOT_SCHOOL_OUTPUT');
  const result=spawnSync('python3',['-c',extractScript,resolve(opts['source-sqlite']),opts.school.toUpperCase()],{encoding:'utf8',maxBuffer:64*1024*1024});
  if(result.status!==0)throw new Error('SNAPSHOT_EXPORT_FAILED');
  const data=JSON.parse(result.stdout) as {schoolId:string;schemaVersion:number;tables:Rows};
  const manifest=engine.generateTenantManifest(opts.school,data.schoolId,data.tables,data.schemaVersion);
  const packageData={manifest,tables:data.tables};
  writeFileSync(opts.output,JSON.stringify(packageData),{mode:0o600,flag:'wx'});
  console.log(JSON.stringify({result:'exported',schoolCode:manifest.schoolCode,totalEntities:manifest.totalEntities,schemaVersion:manifest.schemaVersion}));
 }else if(command==='verify'||command==='restore'){
  if(!opts.input)throw new Error('BACKUP_INPUT_REQUIRED');
  const data=JSON.parse(readFileSync(opts.input,'utf8')) as {manifest:BackupManifest;tables:Rows};
  if(!engine.verifyBackup(data.manifest,data.tables))throw new Error('BACKUP_INTEGRITY_FAILED');
  if(command==='verify'){console.log('Backup checksums, metadata and tenant scope verified.');return;}
  if(!opts['target-sqlite']||opts.school!==data.manifest.schoolCode)throw new Error('EXPLICIT_TARGET_AND_MATCHING_SCHOOL_REQUIRED');
  const result=spawnSync('python3',['-c',restoreScript,resolve(opts['target-sqlite'])],{input:JSON.stringify(data),encoding:'utf8',maxBuffer:1024*1024});
  if(result.status!==0)throw new Error('RESTORE_FAILED_OR_CONFLICT');console.log(result.stdout.trim());
 }else throw new Error('USE_EXPORT_VERIFY_OR_RESTORE');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main(process.argv.slice(2));}catch(err){console.error(err instanceof Error?err.message:'BACKUP_FAILED');process.exitCode=1;}}
