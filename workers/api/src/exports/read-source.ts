import type {AppEnv} from '../context.js';

/** Only remove outer pagination, never WHERE predicates or nested subquery limits. */
export function unpageSelect(sql:string){
 if(!/^\s*SELECT\b/i.test(sql))throw Error('EXPORT_READ_ONLY');
 let depth=0,quote='',line=false,block=false,parameters=0,cut=-1,keep=0;
 for(let i=0;i<sql.length;i++){
  const ch=sql[i],next=sql[i+1];if(line){if(ch==='\n')line=false;continue;}if(block){if(ch==='*'&&next==='/'){block=false;i++;}continue;}
  if(quote){if(ch===quote){if(next===quote)i++;else quote='';}else if(quote===']'&&ch===']')quote='';continue;}
  if(ch==='-'&&next==='-'){line=true;i++;continue;}if(ch==='/'&&next==='*'){block=true;i++;continue;}
  if(ch==="'"||ch==='"'||ch==='`'){quote=ch;continue;}if(ch==='['){quote=']';continue;}
  if(ch==='(')depth++;else if(ch===')')depth--;else if(ch==='?')parameters++;
  else if(depth===0&&/[a-z_]/i.test(ch)){let end=i+1;while(/[a-z_0-9]/i.test(sql[end]||''))end++;if(sql.slice(i,end).toUpperCase()==='LIMIT'&&cut<0){cut=i;keep=parameters;}i=end-1;}
 }
 if(quote||block||depth!==0)throw Error('EXPORT_SQL_PARSE_FAILED');
 return {sql:cut<0?sql:sql.slice(0,cut).trimEnd(),keepParameters:cut<0?parameters:keep};
}
/** Request-local read adapter; caller role/object checks run through the original API. */
export function exportReadDatabase(database:D1Database):D1Database{
 const raw=new WeakMap<object,D1PreparedStatement>();
 const wrap=(sql:string,values:unknown[]=[]):D1PreparedStatement=>{
  const plan=unpageSelect(sql),normal=database.prepare(sql).bind(...values),all=database.prepare(plan.sql).bind(...values.slice(0,plan.keepParameters));
  const proxy=new Proxy(normal,{get(target,key){if(key==='bind')return (...args:unknown[])=>wrap(sql,args);if(key==='all'||key==='raw')return Reflect.get(all,key).bind(all);if(key==='run')return ()=>{throw Error('EXPORT_READ_ONLY');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});raw.set(proxy,all);return proxy;
 };
 return new Proxy(database,{get(target,key){if(key==='prepare')return (sql:string)=>wrap(sql);if(key==='batch')return (statements:D1PreparedStatement[])=>target.batch(statements.map(s=>{const statement=raw.get(s);if(!statement)throw Error('EXPORT_UNREVIEWED_STATEMENT');return statement;}));if(key==='exec')return ()=>{throw Error('EXPORT_READ_ONLY');};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});
}
const allowed=[
 /^\/api\/admin\/(students|teachers|staff|parents|users|roles|features|setup|library|transport|inventory|payroll|reception|academics|academic-years|classes|sections|academic-options|subjects|teacher-assignments|attendance|notices|discipline|exams|quizzes|alumni|certificates|certificate-templates|promotion|promotions|grades|grade-boards|live-classes|leave-types|leaves|homework|lesson-plans|email-deliveries)$/,
 /^\/api\/admin\/(students|teachers|parents)\/[A-Za-z0-9_-]+$/,
 /^\/api\/admin\/(fees|library|transport|inventory|payroll|reception|whatsapp)\/[a-z-]+(?:\/[A-Za-z0-9_-]+(?:\/[a-z-]+)?)?$/,
 /^\/api\/admin\/timetable\/[A-Za-z0-9_-]+$/,
 /^\/api\/admin\/(homework\/[A-Za-z0-9_-]+\/submissions|exams\/[A-Za-z0-9_-]+\/(subjects|schedules|results|marks)|quizzes\/[A-Za-z0-9_-]+\/(questions|attempts))$/,
 /^\/api\/portal\/(workspace|student-overview|own-payroll|student-certificates|student-live-classes|student-quizzes|student-transport|student-library|my-library|attendance|exam-schedules|student-work|student-fees|student-attendance|student-conduct|student-exams|exam-results|notices|leave-types|leaves|library-loans|transport|homework|timetable)$/,
 /^\/api\/portal\/(?:quizzes|quiz-attempts|homework)\/[A-Za-z0-9_-]+(?:\/[a-z-]+)?$/,
 /^\/api\/admin\/(?:id-cards|teacher-id-cards|staff-id-cards)\/students$/,
 /^\/api\/admin\/(?:exam-schedules\/[A-Za-z0-9_-]+\/marks|exam-results\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+|marksheet\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+)$/,
 /^\/platform\/v1\/(schools|school-credentials|login-activity)$/,
];
export function validExportSource(path:string){return path.length<=220&&!/[?%#\\]/.test(path)&&allowed.some(rule=>rule.test(path))&&!/(?:export|download|avatar|secret|password|token|readiness)/.test(path);}
export type ArrayPathPart=string|{key:'id'|'userId'|'studentId'|'sessionId';value:string|number};
export type Source={path:string;query:Record<string,string>;arrayPath:ArrayPathPart[]};
export function sourceRows(body:unknown,path:ArrayPathPart[]):Record<string,unknown>[]{
 let value=body;for(const part of path){if(!value||typeof value!=='object')throw Error('EXPORT_ARRAY_NOT_FOUND');
  if(typeof part==='object'){if(!Array.isArray(value))throw Error('EXPORT_ARRAY_NOT_FOUND');value=value.find(row=>row&&typeof row==='object'&&row[part.key]===part.value);}
  else{if(['__proto__','constructor','prototype'].includes(part)||(Array.isArray(value)&&/^\d+$/.test(part)))throw Error('EXPORT_ARRAY_NOT_FOUND');value=(value as Record<string,unknown>)[part];}
 }
 if(!Array.isArray(value)||value.some(row=>!row||typeof row!=='object'||Array.isArray(row)))throw Error('EXPORT_SOURCE_NOT_A_RECORD_LIST');return value;
}
export type SourceReader=(request:Request,env:AppEnv['Bindings'])=>Promise<Response>;
export async function readSource(reader:SourceReader,request:Request,env:AppEnv['Bindings'],source:Source,all:boolean){
 if(!validExportSource(source.path))throw Error('EXPORT_SOURCE_NOT_ALLOWED');const url=new URL(source.path,request.url);for(const [key,value]of Object.entries(source.query))if(!['page','per_page','limit','offset','cursor'].includes(key))url.searchParams.set(key,value);url.searchParams.set('page','1');url.searchParams.set('per_page','1');
 const response=await reader(new Request(url,{headers:request.headers}),all?{...env,DB:exportReadDatabase(env.DB)}:env);
 if(!response.ok)throw Error('EXPORT_ACCESS_DENIED_OR_SOURCE_FAILED');return response;
}
