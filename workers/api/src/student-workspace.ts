import type {Hono} from 'hono';
import {db,requireAuth,requireRole,type AppEnv} from './context.js';
import {scopedStudent} from './academic-work.js';
import {fail} from './security.js';
export function registerStudentWorkspace(app:Hono<AppEnv>){
 app.get('/api/portal/student-overview',requireAuth,async c=>{const u=requireRole(c,'admin','parent','student'),s=await scopedStudent(c,c.req.query('studentId')),r=await db(c).batch([
 db(c).prepare(`SELECT u.full_name AS name,s.admission_no AS admissionNo,s.roll_no AS rollNo,cl.name||' - '||se.name AS className,y.name AS academicYear FROM students s JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN classes cl ON cl.id=s.class_id AND cl.school_id=s.school_id JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id LEFT JOIN academic_years y ON y.id=s.academic_year_id AND y.school_id=s.school_id WHERE s.school_id=? AND s.id=?`).bind(u.school_id,s.id),
 db(c).prepare(`SELECT calendar_date AS date,session,status,remarks FROM attendance WHERE school_id=? AND student_id=? AND academic_year_id=? ORDER BY calendar_date DESC,session LIMIT 100`).bind(u.school_id,s.id,s.academic_year_id),
 db(c).prepare(`SELECT t.day,t.period_no AS period,t.subject_name AS subject,t.start_time AS startTime,t.end_time AS endTime,t.room_no AS room,u.full_name AS teacher FROM timetables t JOIN users u ON u.id=t.teacher_user_id AND u.school_id=t.school_id JOIN academic_years y ON y.id=t.academic_year_id AND y.school_id=t.school_id AND y.is_current=1 WHERE t.school_id=? AND t.section_id=? AND t.class_id=? AND t.academic_year_id=? ORDER BY t.day,t.period_no LIMIT 112`).bind(u.school_id,s.section_id,s.class_id,s.academic_year_id)
 ]);if(r.some(v=>!v.success)||!r[0].results[0])fail(503,'STUDENT_WORKSPACE_READ_FAILED');return c.json({data:{student:r[0].results[0],attendance:r[1].results,timetable:r[2].results}});});
}
