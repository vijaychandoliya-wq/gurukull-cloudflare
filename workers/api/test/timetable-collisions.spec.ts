import {describe,it,expect} from 'vitest';
let DatabaseSync: any = null;
try {
  DatabaseSync = (await import('node:sqlite')).DatabaseSync;
} catch {
  // node:sqlite is only available on Node >= 22
}
import {slotConflictPredicate} from '../src/academic-management.js';
// A CTE of scalar boundary values is evaluated as a predicate only. No database
// table, school, user, timetable or other business entity is ever persisted.
const sql=`WITH timetables(school_id,academic_year_id,id,day,section_id,teacher_user_id,room_no,period_no,start_time,end_time) AS (VALUES (?,?,?,?,?,?,?,?,?,?)) SELECT ${slotConflictPredicate} AS allowed`;
function allowed(existing:(string|number|null)[],candidate:(string|number|null)[]){
  if (!DatabaseSync) return true;
  const db=new DatabaseSync(':memory:');
  try{return (db.prepare(sql).get(...existing,...candidate) as {allowed:number}).allowed===1;}finally{db.close();}
}
const previous:(string|number|null)[]=['school-boundary','year-boundary','slot-boundary','Monday','section-a','teacher-a','room-a',1,'09:00','09:45'];
const next:(string|number|null)[]=['school-boundary','year-boundary','new-slot','Monday','section-b','teacher-b','room-b','room-b',2,'09:30','10:15','09:30'];
const describeSuite = DatabaseSync ? describe : describe.skip;
describeSuite('Timetable conflict predicate boundaries',()=>{
 it('allows different class, teacher and room during the same clock',()=>expect(allowed(previous,next)).toBe(true));
 it('rejects class, teacher and room overlaps even at different period numbers',()=>{
  for(const [index,value] of [[4,'section-a'],[5,'teacher-a'],[6,'room-a']] as const){const v=[...next];v[index]=value;if(index===6)v[7]=value;expect(allowed(previous,v)).toBe(false);}
 });
 it('rejects the same period even when optional times are missing',()=>{const v=[...next];v[5]='teacher-a';v[8]=1;v[9]=null;v[10]=null;v[11]=null;expect(allowed(previous,v)).toBe(false);});
 it('allows adjacent periods, editing the same slot, another day, year or school',()=>{
  const adjacent=[...next];adjacent[5]='teacher-a';adjacent[9]='09:45';adjacent[11]='09:45';expect(allowed(previous,adjacent)).toBe(true);
  for(const [index,value] of [[0,'another-school'],[1,'another-year'],[2,'slot-boundary'],[3,'Tuesday']] as const){const v=[...next];v[5]='teacher-a';v[index]=value;expect(allowed(previous,v)).toBe(true);}
 });
});
