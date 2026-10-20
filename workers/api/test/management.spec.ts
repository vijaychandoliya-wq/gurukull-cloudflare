import {describe,it,expect} from 'vitest';
import {studentInput,teacherInput,staffInput} from '../src/people-management.js';
import {configurationInput,yearInput} from '../src/school-management.js';
import {validMemberKey,memberKeyDigest,verifyMemberKey} from '../src/member-access.js';
import {encode} from '../src/security.js';
import {setupRequestAllowed} from '../src/admin-access.js';
// Scalar inputs only. These values never become persisted people or school configuration.
describe('Management and member credential boundaries',()=>{
 it('requires student class and admission references and rejects role injection',()=>{
  const boundary={name:'Nonpersisting scalar',registrationNumber:'SCALAR',rollNumber:'1',sectionId:'nonpersisting-section',enrollmentDate:'2026-01-01'};
  expect(studentInput.safeParse(boundary).success).toBe(true);
  for(const changed of [{...boundary,sectionId:''},{...boundary,registrationNumber:''},{...boundary,user_type:'admin'},{...boundary,school_id:'foreign'},{...boundary,enrollmentDate:'2026-02-30'}])expect(studentInput.safeParse(changed).success).toBe(false);
 });
 it('never accepts default passwords when recording staff/teachers',()=>{
  const boundary={name:'Nonpersisting scalar',employeeId:'SCALAR',joiningDate:'2026-01-01',designation:'teacher',jobType:'full_time',email:'scalar@example.invalid',mobile:'1234567890'};
  expect(teacherInput.safeParse(boundary).success).toBe(true);
  expect(teacherInput.safeParse({...boundary,password:'password'}).success).toBe(false);
  expect(teacherInput.safeParse({...boundary,mobile:''}).success).toBe(false);
  expect(staffInput.safeParse({name:'Scalar',employeeId:'SCALAR',joiningDate:'2026-01-01',designation:'staff'}).success).toBe(false);
 });
 it('requires real timezone/currency/address and consistent academic dates',()=>{
  expect(configurationInput.safeParse({timezone:'Unknown/Zone',currency:'INR',address:'Scalar boundary'}).success).toBe(false);
  expect(configurationInput.safeParse({timezone:'Asia/Kolkata',currency:'XXX',address:'Scalar boundary'}).success).toBe(false);
  expect(yearInput.safeParse({name:'Scalar',startsOn:'2026-09-01',endsOn:'2026-08-01',isCurrent:true}).success).toBe(false);
 });
 it('allows owner roster/configuration paths without opening platform or private-file operations',()=>{
  for(const [method,path] of [['POST','/api/admin/students'],['PUT','/api/admin/teachers/scalar'],['PUT','/api/admin/school/configuration'],['GET','/api/admin/roles']])expect(setupRequestAllowed(method,path)).toBe(true);
  for(const [method,path] of [['POST','/platform/v1/schools'],['GET','/api/v3/sync/bootstrap'],['POST','/api/v3/storage/upload'],['DELETE','/api/admin/users/scalar'],['POST','/api/admin/students/../../platform']])expect(setupRequestAllowed(method,path)).toBe(false);
 });
 it('requires canonical 256-bit member keys and binds them to the school and actual member',async()=>{
  const key='gku1_'+encode(new Uint8Array(32).fill(7)),secret='nonpersisting-boundary-secret-more-than-32-bytes';
  expect(validMemberKey(key)).toBe(true);
  expect(validMemberKey('password')).toBe(false);expect(validMemberKey('gku1_'+'A'.repeat(42)+'B')).toBe(false);
  const tag=await memberKeyDigest(key,secret,'scalar-school','scalar-user');
  expect(await verifyMemberKey(key,tag,secret,'scalar-school','scalar-user')).toBe(true);
  expect(await verifyMemberKey(key,tag,secret,'foreign-school','scalar-user')).toBe(false);
  expect(await verifyMemberKey(key,tag,secret,'scalar-school','foreign-user')).toBe(false);
  await expect(memberKeyDigest('password',secret,'school','user')).rejects.toThrow();
 });
});
