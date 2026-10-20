import {db,requireRole,type ApiContext} from './context.js';
import {guard} from './management-common.js';
import {fail} from './security.js';
export async function workflowYear(c:ApiContext){
 const u=requireRole(c,'admin','teacher','staff','parent','student');
 const year=await db(c).prepare(`SELECT a.id,a.starts_on,a.ends_on,cfg.timezone FROM academic_years a JOIN school_configuration cfg ON cfg.school_id=a.school_id WHERE a.school_id=? AND a.is_current=1 AND cfg.configuration_verified_at IS NOT NULL AND cfg.timezone IS NOT NULL AND cfg.currency IS NOT NULL`).bind(u.school_id).first<{id:string;starts_on:string;ends_on:string;timezone:string}>();
 if(!year)fail(409,'SCHOOL_SETUP_REQUIRED','Save the real school settings and current academic year first.');return year;
}
export function workflowYearGuard(c:ApiContext,yearId:string,id:string){return guard(c,`EXISTS(SELECT 1 FROM academic_years a JOIN school_configuration cfg ON cfg.school_id=a.school_id WHERE a.id=? AND a.school_id=? AND a.is_current=1 AND cfg.configuration_verified_at IS NOT NULL AND cfg.timezone IS NOT NULL AND cfg.currency IS NOT NULL)`,[yearId,c.get('user').school_id],id);}
export async function workflowAssignment(c:ApiContext,id:string,yearId:string){
 const u=requireRole(c,'admin','teacher');
 const a=await db(c).prepare(`SELECT a.id,a.class_id,a.section_id,a.subject_name,a.teacher_user_id,a.version FROM teacher_assignments a JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id AND u.user_type='teacher' AND u.status='active' JOIN subjects s ON s.id=a.subject_id AND s.school_id=a.school_id AND s.section_id=a.section_id AND s.academic_year_id=a.academic_year_id WHERE a.school_id=? AND a.academic_year_id=? AND a.id=? AND (?='admin' OR a.teacher_user_id=?)`).bind(u.school_id,yearId,id,u.user_type,u.id).first<{id:string;class_id:string;section_id:string;subject_name:string;teacher_user_id:string;version:number}>();
 if(!a)fail(422,'INVALID_ASSIGNMENT','Select a current subject assigned to an active teacher.');return a;
}
export function workflowAssignmentGuard(c:ApiContext,id:string,yearId:string,version:number,g:string){const u=c.get('user');return guard(c,`EXISTS(SELECT 1 FROM teacher_assignments a JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id AND u.user_type='teacher' AND u.status='active' WHERE a.id=? AND a.school_id=? AND a.academic_year_id=? AND a.version=? AND (?='admin' OR a.teacher_user_id=?))`,[id,u.school_id,yearId,version,u.user_type,u.id],g);}
export function dateInYear(value:string,year:{starts_on:string;ends_on:string}){if(value<year.starts_on||value>year.ends_on)fail(422,'DATE_OUTSIDE_ACADEMIC_YEAR');}
export async function workflowOptions(c:ApiContext){
 const u=requireRole(c,'admin','teacher'),r=await db(c).batch([
 db(c).prepare(`SELECT a.id AS value,s.name||' ('||cl.name||' - '||se.name||', '||u.full_name||')' AS label FROM teacher_assignments a JOIN academic_years y ON y.school_id=a.school_id AND y.id=a.academic_year_id AND y.is_current=1 JOIN subjects s ON s.id=a.subject_id AND s.school_id=a.school_id JOIN sections se ON se.id=a.section_id AND se.school_id=a.school_id JOIN classes cl ON cl.id=a.class_id AND cl.school_id=a.school_id JOIN users u ON u.id=a.teacher_user_id AND u.school_id=a.school_id AND u.status='active' AND u.user_type='teacher' WHERE a.school_id=? AND (?='admin' OR a.teacher_user_id=?) ORDER BY label LIMIT 500`).bind(u.school_id,u.user_type,u.id),
 db(c).prepare(`SELECT se.id AS value,cl.name||' - '||se.name AS label FROM sections se JOIN classes cl ON cl.id=se.class_id AND cl.school_id=se.school_id WHERE se.school_id=? ORDER BY cl.sort_order,se.sort_order LIMIT 500`).bind(u.school_id),
 db(c).prepare('SELECT id,name,starts_on AS startsOn,ends_on AS endsOn FROM academic_years WHERE school_id=? AND is_current=1').bind(u.school_id)
 ]);if(r.some(v=>!v.success))fail(503,'WORKFLOW_READ_FAILED');return {assignments:r[0].results,classes:r[1].results,year:r[2].results[0]||null};
}
