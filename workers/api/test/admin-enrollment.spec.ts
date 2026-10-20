import {describe,it,expect} from 'vitest';
import {directoryInput,directoryQuery} from '../src/admin.js';
import {validateEnrollment} from '../src/enrollment.js';
import app from '../src/index.js';

describe('Administrator directory and enrollment boundaries',()=>{
 it.each(['0','-1','1.5','1e3','9007199254740993','1;DELETE FROM users'])('rejects unsafe page input %s',page=>{expect(()=>directoryInput({page})).toThrow();});
 it('bounds page size and search size',()=>{expect(()=>directoryInput({per_page:'101'})).toThrow();expect(()=>directoryInput({q:'a'.repeat(161)})).toThrow();});
 it('keeps caller search text out of SQL and escapes LIKE wildcard input',()=>{
  const value="%' OR 1=1 --",query=directoryQuery('current-school','students',directoryInput({q:value}));
  expect(query.listSql).not.toContain(value);expect(query.values.slice(0,3)).toEqual(['current-school','current-school','student']);expect(query.values[3]).toBe("%\\%' OR 1=1 --%");
 });
 it('filters teacher employment through bound SQL and rejects unknown types',()=>{const q=directoryQuery('current-school','teachers',directoryInput({job_type:'full_time'}));expect(q.listSql).toContain('e.job_type=?');expect(q.values).toContain('full_time');expect(()=>directoryInput({job_type:'unknown'})).toThrow();});
 it('rejects missing token and too-short password before database access',()=>{expect(()=>validateEnrollment({token:'a'.repeat(43),password:'short'})).toThrow();expect(()=>validateEnrollment({password:'long-enough-boundary'})).toThrow();});
 it('rejects a bcrypt-truncated Unicode password',()=>{expect(()=>validateEnrollment({token:'a'.repeat(43),password:'界'.repeat(25)})).toThrow();});
 it('does not accept an invitation token as a session',async()=>{const response=await app.request('/api/admin/profile',{headers:{Authorization:'Bearer '+'a'.repeat(43)}},{JWT_SECRET:'nonpersisting-boundary-key-at-least-32-bytes'} as any);expect(response.status).toBe(401);});
 it.each(['/api/admin/students','/api/admin/teachers','/api/admin/profile'])('denies anonymous directory/profile access %s',async path=>{expect((await app.request(path)).status).toBe(401);});
 it('rejects malformed enrollment without persisting any identity',async()=>{const response=await app.request('/api/portal/enrollment/accept',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({schoolCode:'RAJESH',token:'invalid',password:'nonpersisting-boundary'})});expect(response.status).toBe(422);});
});
