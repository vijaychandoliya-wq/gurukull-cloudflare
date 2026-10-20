import {describe,it,expect} from 'vitest';
import {subjectInput,assignmentInput,timetableConfigInput,timetableInput} from '../src/academic-management.js';
import {setupRequestAllowed} from '../src/admin-access.js';
// Validation scalars only; never inserted as school or business records.
describe('Academic management boundaries',()=>{
 it('rejects unspecified/duplicate teaching days and guessed or excessive period counts',()=>{
  const v={days:['Monday'],periodsPerDay:1,version:0};
  expect(timetableConfigInput.safeParse(v).success).toBe(true);
  for(const change of [{...v,days:[]},{...v,days:['Monday','Monday']},{...v,days:['Holiday']},{...v,periodsPerDay:0},{...v,periodsPerDay:17},{...v,version:-1},{...v,school_id:'foreign'}])expect(timetableConfigInput.safeParse(change).success).toBe(false);
 });
 it('requires actual subject-section and teacher references and bounded weekly allocation',()=>{
  expect(subjectInput.safeParse({name:'Scalar',type:'Scalar type',sectionId:'nonpersisting'}).success).toBe(true);
  expect(subjectInput.safeParse({name:'Scalar',type:'Scalar type'}).success).toBe(false);
  const v={teacherId:'nonpersisting',subjectId:'nonpersisting',plannedPeriods:1};
  expect(assignmentInput.safeParse(v).success).toBe(true);
  for(const change of [{...v,teacherId:''},{...v,plannedPeriods:0},{...v,plannedPeriods:113},{...v,role:'admin'}])expect(assignmentInput.safeParse(change).success).toBe(false);
 });
 it('rejects malformed, incomplete, equal, backwards and overnight slot clocks',()=>{
  const v={standardLinkId:'nonpersisting',subjectId:'nonpersisting',teacherId:'nonpersisting',day:'Monday',periodNo:1,startTime:'09:00',endTime:'09:45'};
  expect(timetableInput.safeParse(v).success).toBe(true);
  expect(timetableInput.safeParse({...v,startTime:null,endTime:null}).success).toBe(true);
  for(const change of [{...v,startTime:'24:00'},{...v,endTime:'09:00'},{...v,endTime:'08:59'},{...v,startTime:null},{...v,startTime:'23:30',endTime:'00:30'},{...v,periodNo:0},{...v,teacherId:null}])expect(timetableInput.safeParse(change).success).toBe(false);
 });
 it('keeps setup academic paths narrow',()=>{
  for(const [method,path] of [['GET','/api/admin/subjects'],['POST','/api/admin/teacher-assignments'],['PUT','/api/admin/timetable/configuration'],['DELETE','/api/admin/timetable/scalar'],['POST','/api/admin/timetable/scalar/restore']])expect(setupRequestAllowed(method,path)).toBe(true);
  for(const [method,path] of [['POST','/api/admin/timetable/scalar/privileges'],['DELETE','/api/admin/subjects/scalar'],['POST','/api/teacher/attendance'],['POST','/platform/v1/schools']])expect(setupRequestAllowed(method,path)).toBe(false);
 });
});
