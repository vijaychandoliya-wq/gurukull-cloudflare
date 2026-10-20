import type {Hono} from 'hono';
import {db,requireAuth,type AppEnv} from './context.js';
export function registerMemberWorkspace(app:Hono<AppEnv>){
 app.get('/api/portal/workspace',requireAuth,async c=>{
  const u=c.get('user'),school=c.get('school');
  const roles=await db(c).prepare('SELECT role FROM user_roles WHERE school_id=? AND user_id=?').bind(u.school_id,u.id).all<{role:string}>();
  const profile=await db(c).prepare('SELECT p.gender,p.dob AS dateOfBirth,p.blood_group AS bloodGroup,p.address,p.city,COALESCE(pp.contact_mobile,u.mobile) AS mobile FROM users u LEFT JOIN user_profiles p ON p.school_id=u.school_id AND p.user_id=u.id LEFT JOIN parent_profiles pp ON pp.school_id=u.school_id AND pp.user_id=u.id WHERE u.school_id=? AND u.id=?').bind(u.school_id,u.id).first();
  let classes:unknown[]=[],timetable:unknown[]=[],children:unknown[]=[];
  if(u.user_type==='teacher'){
   const r=await db(c).batch([
    db(c).prepare('SELECT a.id,a.subject_name AS subject,c.name AS className,s.name AS sectionName FROM teacher_assignments a JOIN academic_years y ON y.id=a.academic_year_id AND y.school_id=a.school_id AND y.is_current=1 JOIN classes c ON c.id=a.class_id AND c.school_id=a.school_id JOIN sections s ON s.id=a.section_id AND s.school_id=a.school_id WHERE a.school_id=? AND a.teacher_user_id=? LIMIT 200').bind(u.school_id,u.id),
    db(c).prepare('SELECT t.day,t.period_no AS period,t.subject_name AS subject,t.start_time AS startTime,t.end_time AS endTime,t.room_no AS room,c.name AS className,s.name AS sectionName FROM timetables t JOIN academic_years y ON y.id=t.academic_year_id AND y.school_id=t.school_id AND y.is_current=1 JOIN classes c ON c.id=t.class_id AND c.school_id=t.school_id JOIN sections s ON s.id=t.section_id AND s.school_id=t.school_id WHERE t.school_id=? AND t.teacher_user_id=? ORDER BY t.day,t.period_no LIMIT 200').bind(u.school_id,u.id)
   ]);classes=r[0].results;timetable=r[1].results;
  }
  if(u.user_type==='parent' || roles.results.some(r=>r.role==='parent'))children=(await db(c).prepare('SELECT u.id,u.full_name AS name,c.name AS className,se.name AS sectionName FROM parent_student_links l JOIN students s ON s.id=l.student_id AND s.school_id=l.school_id JOIN users u ON u.id=s.user_id AND u.school_id=s.school_id JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id JOIN sections se ON se.id=s.section_id AND se.school_id=s.school_id WHERE l.school_id=? AND l.parent_user_id=? AND s.status=\'active\' AND u.status=\'active\' LIMIT 100').bind(u.school_id,u.id).all()).results;
  return c.json({data:{school:{name:school.name,code:school.code,status:school.status},user:{id:u.id,name:u.full_name,email:u.email,mobile:u.mobile,type:u.user_type,roles:roles.results.map(r=>r.role),profile},classes,timetable,children},notice:'Only current assigned records are returned. School-member acceptance requires a real configured school and credentials.'});
 });
}
