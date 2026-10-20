import {describe,it,expect} from 'vitest';
import app from '../src/index.js';
import {signJwt} from '../src/security.js';

const secret='roles-access-test-secret-with-at-least-32-bytes';

function dbFor(userType:'admin'|'teacher') {
  const statementFor=(sql:string)=>{
    const statement={
      bind:(..._values:unknown[])=>statement,
      first:async()=>sql.includes('FROM schools')
        ? {id:'roles-school',code:'108',slug:'rajesh',name:'Rajesh school',status:'active',timezone:'Asia/Kolkata',currency:'INR',logo_r2_key:null}
        : sql.includes('FROM sessions ss')
          ? {id:'roles-user',school_id:'roles-school',user_type:userType,full_name:'Real-account test',email:'test@example.invalid',mobile:'9000000000',role_json:JSON.stringify([userType])}
          : null,
      all:async()=>({results:[]}),
    };
    return statement;
  };
  return {prepare:statementFor} as unknown as D1Database;
}

async function token(userType:'admin'|'teacher') {
  const now=Math.floor(Date.now()/1000);
  return signJwt({sub:'roles-user',sid:'roles-session',schoolId:'roles-school',schoolCode:'108',userType,fullName:'Real-account test',iat:now,exp:now+3600,iss:'gurukull-edge',aud:'gurukull-clients'},secret);
}

describe('Roles and account access API',()=>{
  it('returns the server-enforced permission matrix to an administrator',async()=>{
    const response=await app.request('https://api.gurukull.in/api/admin/roles',{headers:{Authorization:`Bearer ${await token('admin')}`,'x-school-code':'108'}},{JWT_SECRET:secret,DB:dbFor('admin')} as any);
    expect(response.status).toBe(200);
    const body=await response.json() as {data:Array<{role:string;permissions:string[]}>;notice:string};
    expect(body.data.map(role=>role.role)).toEqual(['admin','teacher','staff','parent','student']);
    expect(body.data.find(role=>role.role==='admin')?.permissions).toContain('people_manage');
    expect(body.data.find(role=>role.role==='parent')?.permissions).toContain('linked_children');
    expect(body.notice).toMatch(/server enforced/i);
  });

  it('does not expose the permission matrix to a teacher session',async()=>{
    const response=await app.request('https://api.gurukull.in/api/admin/roles',{headers:{Authorization:`Bearer ${await token('teacher')}`,'x-school-code':'108'}},{JWT_SECRET:secret,DB:dbFor('teacher')} as any);
    expect(response.status).toBe(403);
  });
});
