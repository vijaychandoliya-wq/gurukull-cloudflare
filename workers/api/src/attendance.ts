import {audit} from './management-common.js';
import type { Hono } from 'hono';
import { z } from 'zod';
import { computePayloadHash } from '@gurukul/contracts';
import { db, readBody, requireAuth, requireRole, type ApiContext, type AppEnv } from './context.js';
import { fail } from './security.js';

const Attendance=z.object({
  Standardlinkid:z.union([z.string(),z.number()]).transform(String),
  Date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  Session:z.string().transform(v=>v.toLowerCase()).pipe(z.enum(['morning','afternoon','whole_day'])),
  AbsentList:z.array(z.object({student_id:z.union([z.string(),z.number()]).transform(String),reasonId:z.union([z.string(),z.number()]).optional(),remarks:z.string().max(1000).optional()})).max(300),
});
export async function assignedSection(c:ApiContext,sectionId:string) {
  const u=requireRole(c,'teacher','admin');
  if(u.user_type==='admin'){const section=await db(c).prepare(`SELECT se.id,se.class_id,ay.id AS academic_year_id FROM sections se JOIN academic_years ay ON ay.school_id=se.school_id AND ay.is_current=1 WHERE se.school_id=? AND se.id=?`).bind(u.school_id,sectionId).first<{id:string;class_id:string;academic_year_id:string}>();if(!section)fail(404,'SECTION_NOT_FOUND');return section;}
  const section=await db(c).prepare(`SELECT se.*,ay.id AS academic_year_id FROM sections se JOIN teacher_assignments a ON a.section_id=se.id AND a.school_id=se.school_id JOIN academic_years ay ON ay.id=a.academic_year_id AND ay.school_id=a.school_id AND ay.is_current=1 WHERE se.school_id=? AND a.teacher_user_id=? AND (se.id=? OR se.id IN(SELECT target_id FROM id_mappings WHERE school_id=? AND entity_type='standards_link' AND legacy_id=?)) LIMIT 1`).bind(u.school_id,u.id,sectionId,u.school_id,sectionId).first<{id:string;class_id:string;academic_year_id:string}>();
  if(!section)fail(403,'CLASS_NOT_ASSIGNED');return section;
}
// Shared by the legacy absent-list adapter and modern command processor.
export async function recordAttendance(c:ApiContext,input:unknown,command?:{id:string;hash:string;baseVersion:number},options?:{portal:boolean;academicYearId?:string}) {
  const parsed=Attendance.safeParse(input);if(!parsed.success)fail(422,'INVALID_ATTENDANCE');
  const v=parsed.data,u=c.get('user'),section=await assignedSection(c,v.Standardlinkid);
  if(options?.academicYearId&&section.academic_year_id!==options.academicYearId)fail(409,'ATTENDANCE_STATE_CHANGED');
  if(options?.portal&&await db(c).prepare(`SELECT id FROM attendance WHERE school_id=? AND section_id=? AND calendar_date=? AND session=? AND status NOT IN ('present','absent') LIMIT 1`).bind(u.school_id,section.id,v.Date,v.Session).first())fail(409,'ATTENDANCE_STATUS_REQUIRES_REVIEW','Existing late, half-day or excused records cannot be overwritten by this present/absent workflow.');
  const timestamp=Date.parse(`${v.Date}T00:00:00Z`)/1000;
  if(!Number.isSafeInteger(timestamp)||new Date(timestamp*1000).toISOString().slice(0,10)!==v.Date)fail(422,'INVALID_CALENDAR_DATE');
  const roster=await db(c).prepare(`SELECT s.id,s.user_id FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN academic_years y ON y.school_id=s.school_id AND y.id=s.academic_year_id AND y.is_current=1 WHERE s.school_id=? AND s.section_id=? AND s.class_id=? AND s.status='active' AND u.status='active' ORDER BY s.id LIMIT 301`).bind(u.school_id,section.id,section.class_id).all<{id:string;user_id:string}>();
  if(roster.results.length>300)fail(503,'FREE_ATTENDANCE_BATCH_REQUIRES_MEASUREMENT');
  if(!roster.results.length)fail(422,'CLASS_HAS_NO_STUDENTS');
  const absent=new Map<string,typeof v.AbsentList[number]>();
  for(const a of v.AbsentList){const student=roster.results.find(s=>s.id===a.student_id||s.user_id===a.student_id);if(!student||absent.has(student.id))fail(422,'INVALID_ABSENT_STUDENT');absent.set(student.id,a);}
  const reasons=await db(c).prepare(`SELECT id FROM absent_reasons WHERE school_id=? AND status='active'`).bind(u.school_id).all<{id:string}>();
  for(const a of absent.values())if(a.reasonId&&!reasons.results.some(r=>r.id===String(a.reasonId)))fail(422,'INVALID_ABSENT_REASON');
  const hash=await computePayloadHash(v),now=Math.floor(Date.now()/1000);
  const previous=await db(c).prepare(`SELECT version,payload_hash FROM attendance_batches WHERE school_id=? AND section_id=? AND calendar_date=? AND session=?`).bind(u.school_id,section.id,v.Date,v.Session).first<{version:number;payload_hash:string}>();
  const version=previous?.version||0;
  if(command&&command.baseVersion!==version)fail(409,'VERSION_CONFLICT');
  const outcome={command_id:command?.id,status:'accepted' as const,entity_id:section.id,version:version+1,totalEnrolled:roster.results.length,absentCount:absent.size,presentCount:roster.results.length-absent.size};
  // An identical legacy state update is a no-op; do not resend absence alerts.
  if(!command&&previous?.payload_hash===hash)return {...outcome,version};
  const rows=roster.results.map(s=>({id:crypto.randomUUID(),student:s.id,status:absent.has(s.id)?'absent':'present',reason:absent.get(s.id)?.reasonId?String(absent.get(s.id)!.reasonId):null,remarks:absent.get(s.id)?.remarks||null}));
  const guard=crypto.randomUUID();
  const statements=[
    db(c).prepare(`INSERT INTO command_guards(id,valid) VALUES(?,CASE WHEN COALESCE((SELECT version FROM attendance_batches WHERE school_id=? AND section_id=? AND calendar_date=? AND session=?),0)=? AND EXISTS(SELECT 1 FROM academic_years WHERE id=? AND school_id=? AND is_current=1 AND starts_on<=? AND ends_on>=?) AND ((?='teacher' AND EXISTS(SELECT 1 FROM teacher_assignments a JOIN academic_years ay ON ay.id=a.academic_year_id AND ay.school_id=a.school_id JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id JOIN schools s ON s.id=a.school_id WHERE a.school_id=? AND a.teacher_user_id=? AND a.section_id=? AND ay.is_current=1 AND u.status='active' AND u.user_type='teacher' AND s.status='active')) OR (?='admin' AND EXISTS(SELECT 1 FROM users u JOIN school_configuration cfg ON cfg.school_id=u.school_id JOIN academic_years a ON a.school_id=u.school_id AND a.is_current=1 JOIN sections se ON se.school_id=u.school_id WHERE u.id=? AND u.school_id=? AND u.user_type='admin' AND u.status='active' AND cfg.configuration_verified_at IS NOT NULL AND cfg.timezone IS NOT NULL AND cfg.currency IS NOT NULL AND se.id=?))) AND (SELECT COUNT(*) FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN academic_years y ON y.school_id=s.school_id AND y.id=s.academic_year_id AND y.is_current=1 WHERE s.school_id=? AND s.section_id=? AND s.class_id=? AND s.status='active' AND u.status='active')=? AND (SELECT COUNT(*) FROM json_each(?) j JOIN students s ON s.id=json_extract(j.value,'$.student') JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN academic_years y ON y.school_id=s.school_id AND y.id=s.academic_year_id AND y.is_current=1 WHERE s.school_id=? AND s.section_id=? AND s.class_id=? AND s.status='active' AND u.status='active')=? THEN 1 ELSE 0 END)`).bind(guard,u.school_id,section.id,v.Date,v.Session,version,section.academic_year_id,u.school_id,v.Date,v.Date,u.user_type,u.school_id,u.id,section.id,u.user_type,u.id,u.school_id,section.id,u.school_id,section.id,section.class_id,rows.length,JSON.stringify(rows),u.school_id,section.id,section.class_id,rows.length),
    db(c).prepare(`INSERT INTO attendance(id,school_id,student_id,class_id,section_id,date_timestamp,session,status,recorded_by,version,created_at,updated_at,calendar_date,academic_year_id,reason_id,remarks) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.student'),?,?,?,?,json_extract(value,'$.status'),?,?,?,?,?,?,json_extract(value,'$.reason'),json_extract(value,'$.remarks') FROM json_each(?) WHERE 1 ON CONFLICT(school_id,student_id,date_timestamp,session) DO UPDATE SET status=excluded.status,recorded_by=excluded.recorded_by,version=excluded.version,updated_at=excluded.updated_at,reason_id=excluded.reason_id,remarks=excluded.remarks,calendar_date=excluded.calendar_date,academic_year_id=excluded.academic_year_id`).bind(u.school_id,section.class_id,section.id,timestamp,v.Session,u.id,version+1,now,now,v.Date,section.academic_year_id,JSON.stringify(rows)),
    db(c).prepare(`INSERT INTO attendance_batches(school_id,section_id,calendar_date,session,version,payload_hash,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(school_id,section_id,calendar_date,session) DO UPDATE SET version=excluded.version,payload_hash=excluded.payload_hash,updated_at=excluded.updated_at`).bind(u.school_id,section.id,v.Date,v.Session,version+1,hash,now),
    // Teacher and each linked parent get only the attendance rows they may read.
    db(c).prepare(`INSERT INTO changelog(school_id,actor_scope,entity_type,entity_id,version,operation,payload_json,created_at) SELECT school_id,?,'attendance',id,version,'upsert',json_object('id',id,'student_id',student_id,'date',calendar_date,'session',session,'status',status),? FROM attendance WHERE school_id=? AND section_id=? AND calendar_date=? AND session=?`).bind(`teacher:${u.id}`,now,u.school_id,section.id,v.Date,v.Session),
    db(c).prepare(`INSERT INTO changelog(school_id,actor_scope,entity_type,entity_id,version,operation,payload_json,created_at) SELECT a.school_id,'parent:'||p.parent_user_id,'attendance',a.id,a.version,'upsert',json_object('id',a.id,'student_id',a.student_id,'date',a.calendar_date,'session',a.session,'status',a.status),? FROM attendance a JOIN parent_student_links p ON p.school_id=a.school_id AND p.student_id=a.student_id WHERE a.school_id=? AND a.section_id=? AND a.calendar_date=? AND a.session=?`).bind(now,u.school_id,section.id,v.Date,v.Session),
    db(c).prepare(`INSERT INTO outbox(id,school_id,event_type,aggregate_id,payload_json,status,attempts,scheduled_at,created_at) SELECT ?||':'||a.id||':'||p.parent_user_id,a.school_id,'push_notification',a.id,json_object('targetUserId',p.parent_user_id,'data',json_object('screen','attendance','event_id',a.id)),'pending',0,?,? FROM attendance a JOIN parent_student_links p ON p.school_id=a.school_id AND p.student_id=a.student_id WHERE a.school_id=? AND a.section_id=? AND a.calendar_date=? AND a.session=? AND a.status='absent'`).bind(guard,now,now,u.school_id,section.id,v.Date,v.Session),
  ];
  if(options?.portal){statements.pop();statements.push(audit(c,'record','attendance',section.id));}
  if(command)statements.push(db(c).prepare(`INSERT INTO command_idempotency(id,school_id,actor_id,command_id,kind,payload_hash,status,response_json,created_at) VALUES(?,?,?,?, 'ATTENDANCE_RECORD',?,'accepted',?,?)`).bind(crypto.randomUUID(),u.school_id,u.id,command.id,command.hash,JSON.stringify(outcome),now));
  statements.push(db(c).prepare('DELETE FROM command_guards WHERE id=?').bind(guard));
  try { await db(c).batch(statements); }
  catch(error) {
    // A concurrent identical command may have committed while this batch was waiting.
    // Only a durable, matching receipt establishes success after an ambiguous failure.
    if(command) {
      const receipt=await db(c).prepare(`SELECT payload_hash,response_json FROM command_idempotency WHERE school_id=? AND actor_id=? AND command_id=?`).bind(u.school_id,u.id,command.id).first<{payload_hash:string;response_json:string}>();
      if(receipt) { if(receipt.payload_hash!==command.hash)fail(409,'IDEMPOTENCY_CONFLICT');return JSON.parse(receipt.response_json) as typeof outcome; }
    }
    if(error instanceof Error && /CHECK constraint failed: valid/.test(error.message))fail(409,'ATTENDANCE_STATE_CHANGED');
    throw error;
  }
  return outcome;
}
export function registerAttendance(app:Hono<AppEnv>) {
  app.on('GET',['/api/teacher/classes','/api/teacher/assignment/standardLinklist'],requireAuth,async c=>{
    const u=requireRole(c,'teacher');const r=await db(c).prepare(`SELECT DISTINCT se.id,se.id AS standardLink_id,cl.name||' - '||se.name AS name,cl.name AS standard_name,se.name AS section_name FROM teacher_assignments a JOIN academic_years ay ON ay.id=a.academic_year_id AND ay.school_id=a.school_id AND ay.is_current=1 JOIN sections se ON se.id=a.section_id AND se.school_id=a.school_id JOIN classes cl ON cl.id=a.class_id AND cl.school_id=a.school_id WHERE a.school_id=? AND a.teacher_user_id=? ORDER BY cl.sort_order,se.sort_order`).bind(u.school_id,u.id).all();return c.json({status:'success',data:r.results});
  });
  app.get('/api/teacher/attendance/list',requireAuth,async c=>{
    const u=requireRole(c,'teacher');const standards=await db(c).prepare(`SELECT DISTINCT se.id,se.id AS standardLink_id,cl.name||' - '||se.name AS name FROM teacher_assignments a JOIN academic_years ay ON ay.id=a.academic_year_id AND ay.school_id=a.school_id AND ay.is_current=1 JOIN sections se ON se.id=a.section_id AND se.school_id=a.school_id JOIN classes cl ON cl.id=a.class_id AND cl.school_id=a.school_id WHERE a.school_id=? AND a.teacher_user_id=?`).bind(u.school_id,u.id).all<{id:string}>();
    const selected=c.req.query('section_id')||standards.results[0]?.id;
    let students:unknown[]=[];
    if(selected){const section=await assignedSection(c,selected);students=(await db(c).prepare(`SELECT s.user_id AS student_id,s.user_id,s.roll_no,s.admission_no,u.full_name AS name FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id WHERE s.school_id=? AND s.section_id=? AND s.status='active' AND u.status='active'`).bind(u.school_id,section.id).all()).results;}
    const reasons=await db(c).prepare(`SELECT id,name FROM absent_reasons WHERE school_id=? AND status='active'`).bind(u.school_id).all();return c.json({status:true,data:{standardlist:standards.results,studentlist:students,absentReasonlist:reasons.results}});
  });
  app.on('POST',['/api/teacher/attendance/add','/api/teacher/attendance'],requireAuth,async c=>c.json({success:true,data:await recordAttendance(c,await readBody(c))}));
  app.get('/api/teacher/attendance/absentList/:section/:date/:session',requireAuth,async c=>{
    const section=await assignedSection(c,c.req.param('section'));const r=await db(c).prepare(`SELECT a.*,s.user_id AS student_id,u.full_name AS name FROM attendance a JOIN students s ON s.id=a.student_id AND s.school_id=a.school_id JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id WHERE a.school_id=? AND a.section_id=? AND a.calendar_date=? AND a.session=? AND a.status='absent'`).bind(c.get('user').school_id,section.id,c.req.param('date'),c.req.param('session').toLowerCase()).all();return c.json({success:true,data:r.results,count:r.results.length});
  });
  app.get('/api/teacher/timetable',requireAuth,async c=>{
    const u=requireRole(c,'teacher');const r=await db(c).prepare(`SELECT t.day,t.period_no,t.subject_name,t.start_time,t.end_time,t.room_no,cl.name||' - '||se.name AS class FROM timetables t JOIN academic_years ay ON ay.id=t.academic_year_id AND ay.school_id=t.school_id AND ay.is_current=1 JOIN classes cl ON cl.id=t.class_id AND cl.school_id=t.school_id JOIN sections se ON se.id=t.section_id AND se.school_id=t.school_id WHERE t.school_id=? AND t.teacher_user_id=? ORDER BY t.period_no`).bind(u.school_id,u.id).all<Record<string,unknown>>();
    const days:Record<string,unknown[]>={};for(const row of r.results){const day=String(row.day);(days[day]||=[]).push({...row,period:row.period_no,time:row.start_time?`${row.start_time} - ${row.end_time}`:null,room:row.room_no});}return c.json({status:'success',data:days});
  });
}
