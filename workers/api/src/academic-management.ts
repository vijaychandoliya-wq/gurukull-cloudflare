import {z} from 'zod';
import type {Hono} from 'hono';
import {db,readBody,requireAuth,requireRole,type AppEnv,type ApiContext} from './context.js';
import {parse,requiredText,nullableText,command,commandReplay,managementReady,guard,cleanupGuards,audit} from './management-common.js';
import {fail} from './security.js';
export const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] as const;
export const subjectInput=z.object({name:requiredText(120),code:nullableText(30),type:requiredText(60),sectionId:requiredText(100),version:z.number().int().positive().optional()}).strict();
export const assignmentInput=z.object({teacherId:requiredText(100),subjectId:requiredText(100),plannedPeriods:z.number().int().min(1).max(112),version:z.number().int().positive().optional()}).strict();
export const timetableConfigInput=z.object({days:z.array(z.enum(weekdays)).min(1).max(7).refine(v=>new Set(v).size===v.length,'Days must be unique'),periodsPerDay:z.number().int().min(1).max(16),version:z.number().int().min(0)}).strict();
const clock=z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/);
export const timetableInput=z.object({standardLinkId:requiredText(100),subjectId:requiredText(100),teacherId:requiredText(100),day:z.enum(weekdays),periodNo:z.number().int().min(1).max(16),roomNo:nullableText(50),startTime:z.preprocess(v=>v===''||v===undefined?null:v,clock.nullable()),endTime:z.preprocess(v=>v===''||v===undefined?null:v,clock.nullable()),version:z.number().int().positive().optional()}).strict().refine(v=>(v.startTime===null&&v.endTime===null)||(!!v.startTime&&!!v.endTime&&v.startTime<v.endTime),{path:['endTime'],message:'Provide both times, with the end after the start.'});
const versionInput=z.object({version:z.number().int().positive()}).strict();
function yearGuard(c:ApiContext,yearId:string,id:string){return guard(c,`EXISTS(SELECT 1 FROM academic_years a JOIN school_configuration cfg ON cfg.school_id=a.school_id WHERE a.id=? AND a.school_id=? AND a.is_current=1 AND cfg.configuration_verified_at IS NOT NULL)`,[yearId,c.get('user').school_id],id);}
async function options(c:ApiContext){
 const u=requireRole(c,'admin'),r=await db(c).batch([
  db(c).prepare('SELECT s.id AS value,c.name||\' - \'||s.name AS label FROM sections s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE s.school_id=? ORDER BY c.sort_order,s.sort_order,c.name,s.name').bind(u.school_id),
  db(c).prepare('SELECT sub.id AS value,sub.name||\' (\'||c.name||\' - \'||s.name||\')\' AS label,sub.section_id AS sectionId FROM subjects sub JOIN academic_years a ON a.id=sub.academic_year_id AND a.school_id=sub.school_id AND a.is_current=1 JOIN sections s ON s.id=sub.section_id AND s.school_id=sub.school_id JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE sub.school_id=? ORDER BY sub.name').bind(u.school_id),
  db(c).prepare("SELECT id AS value,full_name AS label FROM users WHERE school_id=? AND user_type='teacher' AND status='active' ORDER BY full_name").bind(u.school_id),
  db(c).prepare('SELECT days_json,periods_per_day,version FROM timetable_configuration WHERE school_id=?').bind(u.school_id)
 ]);
 const cfg=r[3].results[0] as {days_json:string;periods_per_day:number;version:number}|undefined;
 return {classes:r[0].results,subjects:r[1].results,teachers:r[2].results,days:cfg?JSON.parse(cfg.days_json):[],periods:cfg?Array.from({length:cfg.periods_per_day},(_,i)=>i+1):[],configuration:cfg?{days:JSON.parse(cfg.days_json),periodsPerDay:cfg.periods_per_day,version:cfg.version}:null};
}
async function saveSubject(c:ApiContext){
 const u=requireRole(c,'admin'),input=parse(subjectInput,await readBody(c)),{yearId}=await managementReady(c),editing=!!c.req.param('id'),id=c.req.param('id')||crypto.randomUUID(),g=crypto.randomUUID();
 if(editing&&!input.version)fail(422,'VERSION_REQUIRED');
 if(!await db(c).prepare('SELECT id FROM sections WHERE school_id=? AND id=?').bind(u.school_id,input.sectionId).first())fail(422,'INVALID_SECTION');
 const result=await command(c,'subject.'+(editing?'update':'create'),{...input,id:editing?id:null},()=>{
  const writes=[yearGuard(c,yearId,g)];
  if(editing)writes.push(guard(c,'EXISTS(SELECT 1 FROM subjects WHERE school_id=? AND id=? AND academic_year_id=? AND section_id=? AND version=?)',[u.school_id,id,yearId,input.sectionId,input.version],g+'-record'));
  writes.push(editing?db(c).prepare('UPDATE subjects SET name=?,code=?,type=?,version=version+1 WHERE school_id=? AND id=? AND academic_year_id=? AND version=?').bind(input.name,input.code,input.type,u.school_id,id,yearId,input.version):db(c).prepare('INSERT INTO subjects(id,school_id,academic_year_id,section_id,name,code,type) VALUES(?,?,?,?,?,?,?)').bind(id,u.school_id,yearId,input.sectionId,input.name,input.code,input.type));
  // Legacy serializers keep the corresponding current subject name in the same transaction.
  if(editing)writes.push(db(c).prepare('UPDATE teacher_assignments SET subject_name=?,version=version+1 WHERE school_id=? AND subject_id=?').bind(input.name,u.school_id,id),db(c).prepare('UPDATE timetables SET subject_name=?,version=version+1 WHERE school_id=? AND subject_id=?').bind(input.name,u.school_id,id));
  writes.push(audit(c,editing?'update':'create','subject',id),cleanupGuards(c,g));if(editing)writes.push(cleanupGuards(c,g+'-record'));return writes;
 },{message:'Subject saved.',data:{id,version:editing?input.version!+1:1}});return c.json(result,editing?200:201);
}
async function saveAssignment(c:ApiContext){
 const u=requireRole(c,'admin'),input=parse(assignmentInput,await readBody(c)),{yearId}=await managementReady(c),editing=!!c.req.param('id'),id=c.req.param('id')||crypto.randomUUID(),g=crypto.randomUUID();
 if(editing&&!input.version)fail(422,'VERSION_REQUIRED');
 const subject=await db(c).prepare('SELECT sub.section_id,s.class_id,sub.name FROM subjects sub JOIN sections s ON s.id=sub.section_id AND s.school_id=sub.school_id WHERE sub.school_id=? AND sub.id=? AND sub.academic_year_id=?').bind(u.school_id,input.subjectId,yearId).first<{section_id:string;class_id:string;name:string}>();if(!subject)fail(422,'INVALID_SUBJECT');
 const result=await command(c,'assignment.'+(editing?'update':'create'),{...input,id:editing?id:null},()=>{
  const writes=[yearGuard(c,yearId,g),guard(c,`EXISTS(SELECT 1 FROM users WHERE school_id=? AND id=? AND user_type='teacher' AND status='active')`,[u.school_id,input.teacherId],g+'-teacher')];
  if(editing)writes.push(guard(c,`EXISTS(SELECT 1 FROM teacher_assignments WHERE school_id=? AND id=? AND academic_year_id=? AND version=?) AND NOT EXISTS(SELECT 1 FROM timetables t JOIN teacher_assignments a ON a.school_id=t.school_id AND a.teacher_user_id=t.teacher_user_id AND a.section_id=t.section_id AND a.subject_id=t.subject_id AND a.academic_year_id=t.academic_year_id WHERE a.school_id=? AND a.id=? AND (a.teacher_user_id!=? OR a.subject_id!=?))`,[u.school_id,id,yearId,input.version,u.school_id,id,input.teacherId,input.subjectId],g+'-record'));
  writes.push(guard(c,'(SELECT COUNT(*) FROM timetables WHERE school_id=? AND academic_year_id=? AND section_id=? AND teacher_user_id=? AND subject_id=?)<=?',[u.school_id,yearId,subject.section_id,input.teacherId,input.subjectId,input.plannedPeriods],g+'-capacity'));
  const args=[input.teacherId,subject.class_id,subject.section_id,yearId,subject.name,input.subjectId,input.plannedPeriods];
  writes.push(editing?db(c).prepare('UPDATE teacher_assignments SET teacher_user_id=?,class_id=?,section_id=?,academic_year_id=?,subject_name=?,subject_id=?,planned_periods=?,version=version+1 WHERE school_id=? AND id=? AND version=?').bind(...args,u.school_id,id,input.version):db(c).prepare('INSERT INTO teacher_assignments(id,school_id,teacher_user_id,class_id,section_id,academic_year_id,subject_name,subject_id,planned_periods) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,u.school_id,...args));
  writes.push(audit(c,editing?'update':'create','teacher_assignment',id),cleanupGuards(c,g),cleanupGuards(c,g+'-teacher'),cleanupGuards(c,g+'-capacity'));if(editing)writes.push(cleanupGuards(c,g+'-record'));return writes;
 },{message:'Teacher assignment saved.',data:{id,version:editing?input.version!+1:1}});return c.json(result,editing?200:201);
}
export const slotConflictPredicate=`NOT EXISTS(SELECT 1 FROM timetables t WHERE t.school_id=? AND t.academic_year_id=? AND t.id!=? AND lower(t.day)=lower(?) AND (t.section_id=? OR t.teacher_user_id=? OR (? IS NOT NULL AND t.room_no=?)) AND (t.period_no=? OR (? IS NOT NULL AND t.start_time IS NOT NULL AND t.start_time<? AND t.end_time>?)))`;
function slotGuards(c:ApiContext,v:z.output<typeof timetableInput>,yearId:string,id:string,g:string){
 const school=c.get('user').school_id;
 return [yearGuard(c,yearId,g),guard(c,`EXISTS(SELECT 1 FROM timetable_configuration cfg,json_each(cfg.days_json) d WHERE cfg.school_id=? AND d.value=? AND ?<=cfg.periods_per_day) AND EXISTS(SELECT 1 FROM teacher_assignments a JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id WHERE a.school_id=? AND a.academic_year_id=? AND a.section_id=? AND a.teacher_user_id=? AND a.subject_id=? AND u.user_type='teacher' AND u.status='active' AND a.planned_periods>(SELECT COUNT(*) FROM timetables t WHERE t.school_id=a.school_id AND t.academic_year_id=a.academic_year_id AND t.section_id=a.section_id AND t.teacher_user_id=a.teacher_user_id AND t.subject_id=a.subject_id AND t.id!=?))`,[school,v.day,v.periodNo,school,yearId,v.standardLinkId,v.teacherId,v.subjectId,id],g+'-assignment'),guard(c,slotConflictPredicate,[school,yearId,id,v.day,v.standardLinkId,v.teacherId,v.roomNo,v.roomNo,v.periodNo,v.startTime,v.endTime,v.startTime],g+'-clash')];
}
async function saveSlot(c:ApiContext,restore=false){
 const u=requireRole(c,'admin'),body=await readBody(c),{yearId}=await managementReady(c),editing=!!c.req.param('id')&&!restore,id=c.req.param('id')||crypto.randomUUID(),g=crypto.randomUUID();
 let original:Record<string,any>|undefined,version:number|undefined;
 if(restore){version=parse(versionInput,body).version;const replay=await commandReplay(c,'timetable.restore',{id,version});if(replay)return c.json(replay);const archive=await db(c).prepare('SELECT payload_json FROM timetable_archives WHERE school_id=? AND id=?').bind(u.school_id,id).first<{payload_json:string}>();if(!archive)fail(404,'SLOT_NOT_FOUND');original=JSON.parse(archive.payload_json);if(original!.version!==version||original!.academic_year_id!==yearId)fail(409,'RECORD_CHANGED');}
 const v=parse(timetableInput,restore?{standardLinkId:original!.section_id,subjectId:original!.subject_id,teacherId:original!.teacher_user_id,day:original!.day,periodNo:original!.period_no,roomNo:original!.room_no,startTime:original!.start_time,endTime:original!.end_time}:body);
 if(editing&&!v.version)fail(422,'VERSION_REQUIRED');
 const sub=await db(c).prepare('SELECT sub.name,s.class_id FROM subjects sub JOIN sections s ON s.id=sub.section_id AND s.school_id=sub.school_id WHERE sub.school_id=? AND sub.id=? AND sub.section_id=? AND sub.academic_year_id=?').bind(u.school_id,v.subjectId,v.standardLinkId,yearId).first<{name:string;class_id:string}>();if(!sub)fail(422,'INVALID_SUBJECT');
 const result=await command(c,'timetable.'+(restore?'restore':editing?'update':'create'),restore?{id,version}:{...v,id:editing?id:null},()=>{
  const writes=slotGuards(c,v,yearId,id,g);
  if(editing)writes.push(guard(c,'EXISTS(SELECT 1 FROM timetables WHERE school_id=? AND id=? AND academic_year_id=? AND version=?)',[u.school_id,id,yearId,v.version],g+'-record'));
  if(restore)writes.push(guard(c,"EXISTS(SELECT 1 FROM timetable_archives WHERE school_id=? AND id=? AND json_extract(payload_json,'$.version')=?)",[u.school_id,id,version],g+'-record'));
  const args=[v.teacherId,sub.class_id,v.standardLinkId,yearId,v.day,v.periodNo,sub.name,v.startTime,v.endTime,v.roomNo,v.subjectId];
  writes.push(editing?db(c).prepare('UPDATE timetables SET teacher_user_id=?,class_id=?,section_id=?,academic_year_id=?,day=?,period_no=?,subject_name=?,start_time=?,end_time=?,room_no=?,subject_id=?,version=version+1 WHERE school_id=? AND id=? AND version=?').bind(...args,u.school_id,id,v.version):db(c).prepare('INSERT INTO timetables(id,school_id,teacher_user_id,class_id,section_id,academic_year_id,day,period_no,subject_name,start_time,end_time,room_no,subject_id,version) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,u.school_id,...args,restore?version!+1:1));
  if(restore)writes.push(db(c).prepare('DELETE FROM timetable_archives WHERE school_id=? AND id=?').bind(u.school_id,id));
  writes.push(audit(c,restore?'restore':editing?'update':'create','timetable',id),cleanupGuards(c,g),cleanupGuards(c,g+'-assignment'),cleanupGuards(c,g+'-clash'));if(editing||restore)writes.push(cleanupGuards(c,g+'-record'));return writes;
 },{message:'Timetable slot saved.',data:{id,version:editing?v.version!+1:restore?version!+1:1}});return c.json(result,editing||restore?200:201);
}
export function registerAcademicManagement(app:Hono<AppEnv>){
 app.get('/api/admin/academic-options',requireAuth,async c=>c.json({data:await options(c)}));
 app.get('/api/admin/timetable/options',requireAuth,async c=>c.json({data:await options(c)}));
 app.get('/api/admin/subjects',requireAuth,async c=>{const u=requireRole(c,'admin');const r=await db(c).prepare('SELECT sub.id,sub.name,sub.code,sub.type,sub.version,sub.section_id AS sectionId,c.name||\' - \'||s.name AS className FROM subjects sub JOIN academic_years a ON a.id=sub.academic_year_id AND a.school_id=sub.school_id AND a.is_current=1 JOIN sections s ON s.id=sub.section_id AND s.school_id=sub.school_id JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE sub.school_id=? ORDER BY c.sort_order,s.sort_order,sub.name LIMIT 500').bind(u.school_id).all();return c.json({data:r.results});});
 app.post('/api/admin/subjects',requireAuth,saveSubject);app.put('/api/admin/subjects/:id',requireAuth,saveSubject);
 app.get('/api/admin/teacher-assignments',requireAuth,async c=>{const u=requireRole(c,'admin');const r=await db(c).prepare('SELECT a.id,a.version,a.teacher_user_id AS teacherId,u.full_name AS teacherName,a.subject_id AS subjectId,a.subject_name AS subjectName,a.planned_periods AS plannedPeriods,c.name||\' - \'||s.name AS className FROM teacher_assignments a JOIN academic_years y ON y.id=a.academic_year_id AND y.school_id=a.school_id AND y.is_current=1 JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id JOIN sections s ON s.id=a.section_id AND s.school_id=a.school_id JOIN classes c ON c.id=a.class_id AND c.school_id=a.school_id WHERE a.school_id=? ORDER BY c.sort_order,s.sort_order,u.full_name LIMIT 500').bind(u.school_id).all();return c.json({data:r.results});});
 app.post('/api/admin/teacher-assignments',requireAuth,saveAssignment);app.put('/api/admin/teacher-assignments/:id',requireAuth,saveAssignment);
 app.put('/api/admin/timetable/configuration',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(timetableConfigInput,await readBody(c)),g=crypto.randomUUID();
  const result=await command(c,'timetable.configuration',v,()=>[
   guard(c,'COALESCE((SELECT version FROM timetable_configuration WHERE school_id=?),0)=? AND NOT EXISTS(SELECT 1 FROM timetables t WHERE t.school_id=? AND (t.period_no>? OR NOT EXISTS(SELECT 1 FROM json_each(?) d WHERE lower(d.value)=lower(t.day))))',[u.school_id,v.version,u.school_id,v.periodsPerDay,JSON.stringify(v.days)],g),
   db(c).prepare('INSERT INTO timetable_configuration(school_id,days_json,periods_per_day,version,updated_at) VALUES(?,?,?,?,unixepoch()) ON CONFLICT(school_id) DO UPDATE SET days_json=excluded.days_json,periods_per_day=excluded.periods_per_day,version=timetable_configuration.version+1,updated_at=excluded.updated_at').bind(u.school_id,JSON.stringify(v.days),v.periodsPerDay,1),
   audit(c,'configure','timetable',u.school_id),cleanupGuards(c,g)
  ],{message:'Timetable configuration saved.',data:{version:v.version+1}});return c.json(result);
 });
 app.get('/api/admin/timetable/removed',requireAuth,async c=>{const u=requireRole(c,'admin');const r=await db(c).prepare("SELECT id,json_extract(payload_json,'$.version') AS version,json_extract(payload_json,'$.day') AS day,json_extract(payload_json,'$.period_no') AS periodNo,json_extract(payload_json,'$.subject_name') AS subjectName,removed_at AS removedAt FROM timetable_archives WHERE school_id=? ORDER BY removed_at DESC LIMIT 100").bind(u.school_id).all();return c.json({data:r.results});});
 app.get('/api/admin/timetable/:sectionId',requireAuth,async c=>{const u=requireRole(c,'admin'),id=c.req.param('sectionId');if(!await db(c).prepare('SELECT id FROM sections WHERE school_id=? AND id=?').bind(u.school_id,id).first())fail(404,'SECTION_NOT_FOUND');const r=await db(c).prepare('SELECT t.id,t.version,t.day,t.period_no AS periodNo,t.start_time AS startTime,t.end_time AS endTime,t.room_no AS roomNo,t.teacher_user_id AS teacherId,u.full_name AS teacherName,t.subject_id AS subjectId,t.subject_name AS subjectName FROM timetables t JOIN academic_years a ON a.id=t.academic_year_id AND a.school_id=t.school_id AND a.is_current=1 JOIN users u ON u.id=t.teacher_user_id AND u.school_id=t.school_id WHERE t.school_id=? AND t.section_id=? ORDER BY t.day,t.period_no').bind(u.school_id,id).all();return c.json({data:r.results});});
 app.post('/api/admin/timetable',requireAuth,c=>saveSlot(c));app.put('/api/admin/timetable/:id',requireAuth,c=>saveSlot(c));app.post('/api/admin/timetable/:id/restore',requireAuth,c=>saveSlot(c,true));
 app.delete('/api/admin/timetable/:id',requireAuth,async c=>{
  const u=requireRole(c,'admin'),v=parse(versionInput,await readBody(c)),id=c.req.param('id'),g=crypto.randomUUID();
  const result=await command(c,'timetable.remove',{id,...v},()=>[
   guard(c,'EXISTS(SELECT 1 FROM timetables WHERE school_id=? AND id=? AND version=?)',[u.school_id,id,v.version],g),
   db(c).prepare(`INSERT INTO timetable_archives(school_id,id,payload_json,removed_by,removed_at) SELECT school_id,id,json_object('id',id,'school_id',school_id,'teacher_user_id',teacher_user_id,'class_id',class_id,'section_id',section_id,'academic_year_id',academic_year_id,'day',day,'period_no',period_no,'subject_name',subject_name,'start_time',start_time,'end_time',end_time,'room_no',room_no,'subject_id',subject_id,'version',version),?,unixepoch() FROM timetables WHERE school_id=? AND id=? AND version=?`).bind(u.id,u.school_id,id,v.version),
   db(c).prepare('DELETE FROM timetables WHERE school_id=? AND id=? AND version=?').bind(u.school_id,id,v.version),audit(c,'remove_recoverable','timetable',id),cleanupGuards(c,g)
  ],{message:'Slot removed. It can be restored from Removed slots.',data:{id}});return c.json(result);
 });
}
