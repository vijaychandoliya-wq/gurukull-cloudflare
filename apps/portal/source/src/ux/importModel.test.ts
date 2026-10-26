import {describe,it,expect} from 'vitest';
import {validateImport,importIdentity} from './importModel';
describe('import preflight',()=>{
 it('detects duplicate contacts and impossible dates before writing',()=>{const row={name:'A',email:'a@example.org',mobile:'1234567890',designation:'teacher',jobType:'full_time',joiningDate:'2026-02-30'};const errors=validateImport({teachers:[row,{...row,email:'A@example.org'}]});expect(errors.some(e=>e.message.includes('valid YYYY'))).toBe(true);expect(errors.some(e=>e.message.includes('repeats row 2'))).toBe(true);});
 it('allows optional auto employee ID without changing a leading-zero admission',()=>{expect(validateImport({teachers:[{name:'A',email:'a@example.org',mobile:'1234567890',designation:'teacher',jobType:'full_time',joiningDate:'2026-01-02'}]})).toEqual([]);expect(importIdentity('051296:2026','students',{registrationNumber:'001'})).toContain('001');});
 it('keeps retries stable and separates schools/years and changed rows',()=>{expect(importIdentity('108:2026','teachers',{b:'2',a:'1'})).toBe(importIdentity('108:2026','teachers',{a:'1',b:'2'}));expect(importIdentity('108:2026','teachers',{a:'1'})).not.toBe(importIdentity('117:2026','teachers',{a:'1'}));expect(importIdentity('108:2026','teachers',{a:'1'})).not.toBe(importIdentity('108:2027','teachers',{a:'1'}));});
});
