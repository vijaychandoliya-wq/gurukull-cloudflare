import { Command } from 'commander';
import { readFileSync,writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

export interface Checkpoint {lastEntity:string;lastProcessedId:string|number;processedCount:number;errorsCount:number;timestamp:string}
type Tables=Record<string,Record<string,unknown>[]>;
interface Snapshot {schoolId:string;schoolCode:string;sourceSystem:string;cutoff:string;tables:Tables}
interface TableMap {source:string;target:string;schoolColumn:string;columns:Record<string,string>;rupeeColumns?:string[]}
interface Mapping {sourceSchoolId:string;targetSchoolId:string;schoolCode:string;tables:TableMap[]}
export function amountToPaise(value:unknown):number{
  if(typeof value!=='string'&&typeof value!=='number')throw new Error('INVALID_MONEY');
  const text=String(value);
  // Require exact nonnegative decimal amounts; never round/drop trailing text.
  if(!/^(0|[1-9]\d*)(\.\d{1,2})?$/.test(text))throw new Error('INVALID_MONEY');
  const [whole,fraction='']=text.split('.');const result=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));
  if(result>BigInt(Number.MAX_SAFE_INTEGER))throw new Error('UNSAFE_MONEY');return Number(result);
}
function safeName(value:string){if(!/^[a-z][a-z0-9_]*$/.test(value))throw new Error('INVALID_IDENTIFIER');return value;}
function checksum(value:unknown){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function loadJson<T>(path:string):T{return JSON.parse(readFileSync(path,'utf8')) as T;}
function writeJson(path:string,value:unknown){writeFileSync(path,JSON.stringify(value),{flag:'wx',mode:0o600});}
export class GurukulEtlEngine {
 constructor(private options:{dryRun:boolean;schoolCode?:string;checkpointPath?:string}){}
 transformAmountToPaise(amount:number|string){return amountToPaise(amount);}
 analyzeSource(snapshot:Snapshot){validateSnapshot(snapshot);return {schoolCode:snapshot.schoolCode,cutoff:snapshot.cutoff,counts:Object.fromEntries(Object.entries(snapshot.tables).map(([name,rows])=>[name,rows.length]))};}
 reconcile(sourceTotalPaise:number,targetTotalPaise:number){if(![sourceTotalPaise,targetTotalPaise].every(v=>Number.isSafeInteger(v)&&v>=0))throw new Error('INVALID_RECONCILIATION_AMOUNT');return sourceTotalPaise===targetTotalPaise;}
 saveCheckpoint(checkpoint:Checkpoint){if(!this.options.dryRun&&this.options.checkpointPath)writeFileSync(this.options.checkpointPath,JSON.stringify(checkpoint),{mode:0o600});}
 loadCheckpoint():Checkpoint|null{if(!this.options.checkpointPath)return null;try{return loadJson<Checkpoint>(this.options.checkpointPath);}catch{return null;}}
}
function validateSnapshot(snapshot:Snapshot){
 if(!snapshot.schoolId||!snapshot.schoolCode||!snapshot.sourceSystem||!Number.isFinite(Date.parse(snapshot.cutoff))||!snapshot.tables)throw new Error('SOURCE_PROVENANCE_REQUIRED');
 for(const [table,rows] of Object.entries(snapshot.tables)){safeName(table);if(!Array.isArray(rows))throw new Error('INVALID_SOURCE_TABLE');}
}
export function transform(snapshot:Snapshot,mapping:Mapping):Snapshot{
 validateSnapshot(snapshot);
 if(snapshot.schoolId!==mapping.sourceSchoolId||snapshot.schoolCode!==mapping.schoolCode)throw new Error('SCHOOL_MAPPING_MISMATCH');
 const tables:Tables={};
 for(const [name,rows] of Object.entries(snapshot.tables)){
  const rule=mapping.tables.find(r=>r.source===name);if(!rule){if(rows.length)throw new Error(`UNMAPPED_TABLE_${safeName(name)}`);continue;}
  if(tables[rule.target])throw new Error('AMBIGUOUS_TARGET_TABLE');safeName(rule.target);tables[rule.target]=[];
  for(const row of rows){
   if(String(row[rule.schoolColumn])!==mapping.sourceSchoolId)throw new Error('CROSS_SCHOOL_SOURCE_ROW');
   const target:Record<string,unknown>={};
   for(const [from,to] of Object.entries(rule.columns)){safeName(to);if(!(from in row))throw new Error('MISSING_SOURCE_COLUMN');target[to]=rule.rupeeColumns?.includes(from)?amountToPaise(row[from]):row[from];}
   if(rule.target==='schools'){if(String(target.id)!==mapping.targetSchoolId)throw new Error('EXPLICIT_SCHOOL_ID_TRANSFORM_REQUIRED');}
   else target.school_id=mapping.targetSchoolId;
   tables[rule.target].push(target);
  }
 }
 return {...snapshot,schoolId:mapping.targetSchoolId,tables};
}
export function reconcileSnapshots(source:Snapshot,target:Snapshot){
 validateSnapshot(source);validateSnapshot(target);
 if(source.schoolId!==target.schoolId||source.schoolCode!==target.schoolCode)throw new Error('RECONCILIATION_SCHOOL_MISMATCH');
 const differences:string[]=[];
 for(const table of new Set([...Object.keys(source.tables),...Object.keys(target.tables)])){
  const left=source.tables[table]||[],right=target.tables[table]||[];
  const canonical=(rows:Record<string,unknown>[])=>rows.map(r=>JSON.stringify(Object.fromEntries(Object.entries(r).sort(([a],[b])=>a.localeCompare(b))))).sort();
  if(JSON.stringify(canonical(left))!==JSON.stringify(canonical(right)))differences.push(table);
 }
 return {matches:differences.length===0,differingTables:differences};
}
const importScript=String.raw`
import sys,json,sqlite3,pathlib
data=json.load(sys.stdin); conn=sqlite3.connect(pathlib.Path(sys.argv[1]).as_uri()+'?mode=rw',uri=True)
conn.row_factory=sqlite3.Row;conn.execute('PRAGMA foreign_keys=ON');conn.execute('BEGIN IMMEDIATE')
try:
 for table,rows in data['tables'].items():
  if not table.replace('_','').isalnum():raise RuntimeError('INVALID_TABLE')
  schema=list(conn.execute('PRAGMA table_info('+table+')'));columns={r['name'] for r in schema};pk=[r['name'] for r in schema if r['pk']]
  if not columns or not pk:raise RuntimeError('UNKNOWN_TARGET_SCHEMA')
  for row in rows:
   if not set(row).issubset(columns):raise RuntimeError('UNKNOWN_TARGET_COLUMN')
   if table=='schools' and str(row.get('id'))!=data['schoolId']:raise RuntimeError('CROSS_SCHOOL')
   if table!='schools' and str(row.get('school_id'))!=data['schoolId']:raise RuntimeError('CROSS_SCHOOL')
   old=conn.execute('SELECT * FROM '+table+' WHERE '+' AND '.join(k+'=?' for k in pk),[row[k] for k in pk]).fetchone()
   if old:
    if any(dict(old)[k]!=v for k,v in row.items()):raise RuntimeError('SOURCE_PAYLOAD_CONFLICT')
    continue
   names=list(row);conn.execute('INSERT INTO '+table+' ('+','.join(names)+') VALUES ('+','.join('?' for _ in names)+')',[row[k] for k in names])
 if conn.execute('PRAGMA foreign_key_check').fetchone():raise RuntimeError('SOURCE_RELATIONSHIP_FAILURE')
 if sys.argv[2]=='apply':conn.commit()
 else:conn.rollback()
 print(json.dumps({'status':'committed' if sys.argv[2]=='apply' else 'dry_run_validated','rows':sum(len(r) for r in data['tables'].values())}))
except:conn.rollback();raise
`;
export function main(args:string[]){
 const program=new Command().name('gurukul-etl');
 program.command('diagnose').requiredOption('--input <path>').action(opts=>console.log(JSON.stringify(new GurukulEtlEngine({dryRun:true}).analyzeSource(loadJson<Snapshot>(opts.input)))));
 program.command('transform').requiredOption('--input <path>').requiredOption('--mapping <path>').requiredOption('--output <path>').action(opts=>writeJson(opts.output,transform(loadJson<Snapshot>(opts.input),loadJson<Mapping>(opts.mapping))));
 program.command('load').requiredOption('--input <path>').requiredOption('--target-sqlite <path>').requiredOption('--school <code>').option('--apply','Commit to the explicitly named SQLite target; otherwise rollback').requiredOption('--checkpoint <path>').action(opts=>{
  const snapshot=loadJson<Snapshot>(opts.input);validateSnapshot(snapshot);if(snapshot.schoolCode!==opts.school)throw new Error('SCHOOL_ALLOWLIST_MISMATCH');
  const count=Object.values(snapshot.tables).reduce((n,r)=>n+r.length,0);if(count>5000)throw new Error('BOUNDED_IMPORT_LIMIT_REQUIRES_PARTITION');
  const result=spawnSync('python3',['-c',importScript,resolve(opts.targetSqlite),opts.apply?'apply':'dry_run'],{input:JSON.stringify(snapshot),encoding:'utf8',maxBuffer:1024*1024});
  if(result.status!==0)throw new Error('IMPORT_VALIDATION_OR_TRANSACTION_FAILED');
  if(opts.apply)writeFileSync(opts.checkpoint,JSON.stringify({sourceChecksum:checksum(snapshot),target:resolve(opts.targetSqlite),schoolCode:opts.school,processedCount:count,errorsCount:0,timestamp:new Date().toISOString()}),{mode:0o600});console.log(result.stdout.trim());
 });
 program.command('reconcile').requiredOption('--source <path>').requiredOption('--target <path>').action(opts=>{const result=reconcileSnapshots(loadJson<Snapshot>(opts.source),loadJson<Snapshot>(opts.target));console.log(JSON.stringify(result));if(!result.matches)process.exitCode=1;});
 program.parse(args,{from:'user'});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{main(process.argv.slice(2));}catch(err){console.error(err instanceof Error?err.message:'ETL_FAILED');process.exitCode=1;}}
