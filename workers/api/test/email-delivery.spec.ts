import {describe, expect, it} from 'vitest';
import {encryptCredentialEnvelope} from '../src/email-delivery.js';

describe('credential email delivery envelope', () => {
  it('encrypts one-time credentials so the stored payload contains no plaintext password', async () => {
    const password = 'A-secure-one-time-password-123!';
    const payload = await encryptCredentialEnvelope({ADMIN_ACCESS_KEY_SECRET: 'x'.repeat(32)} as any, {
      eventId: 'event-1', aggregateId: 'user-1', schoolId: 'school-1', recipient: 'teacher@example.com',
      schoolName: 'Example School', schoolCode: 'EXAMPLE', fullName: 'A Teacher', role: 'teacher',
      identifier: 'teacher@example.com', password, loginUrl: 'https://example.gurukull.in/login',
    });
    expect(payload).not.toContain(password);
    expect(payload).not.toContain('teacher@example.com');
    expect(JSON.parse(payload).version).toBe(1);
  });
});

import {vi,afterEach} from 'vitest';
import {dispatchCredentialEmails} from '../src/email-delivery.js';

describe('credential dispatch ownership and ambiguous outcomes',()=>{
 afterEach(()=>vi.restoreAllMocks());
 async function harness({owned=true,providerFails=false,ackFails=false,revoked=false,badPayload=false,missingEncryption=false}={}){
  const envelope={eventId:'boundary-event',aggregateId:'boundary-user',schoolId:'boundary-school',recipient:'boundary@example.test',schoolName:'Boundary',schoolCode:'BOUNDARY',fullName:'Boundary',role:'teacher',identifier:'boundary@example.test',password:'nonpersisted-scalar',loginUrl:'https://example.test/login'};
  const env:any={ADMIN_ACCESS_KEY_SECRET:'s'.repeat(32),EMAIL:{send:vi.fn(async()=>{if(providerFails)throw new Error('connection lost');return {messageId:'provider-id'};})}};
  const encrypted=await encryptCredentialEnvelope(env,envelope);const payload=badPayload?'{}':encrypted;if(missingEncryption)env.ADMIN_ACCESS_KEY_SECRET=undefined;let claimed=false;const writes:{sql:string;args:unknown[]}[]=[];
  env.DB={prepare:(sql:string)=>{let args:unknown[]=[];const statement={bind:(...values:unknown[])=>{args=values;return statement;},run:async()=>{writes.push({sql,args});return {success:true,meta:{changes:1}};},first:async()=>{
   writes.push({sql,args});
   if(sql.includes('RETURNING id,school_id')){if(claimed||!owned)return null;claimed=true;return {id:envelope.eventId,school_id:envelope.schoolId,payload_json:payload,attempts:1,lease_id:'boundary-lease'};}
   if(sql.includes("last_error='EMAIL_SEND_STARTED'"))return revoked?null:{id:envelope.eventId};
   if(sql.includes("status='completed'")){if(ackFails)throw new Error('database unavailable');return {id:envelope.eventId};}
   return null;
  }};return statement;}};
  return {env,writes};
 }
 it('never sends without an atomically returned lease',async()=>{const {env}=await harness({owned:false});expect((await dispatchCredentialEmails(env,100)).processed).toBe(0);expect(env.EMAIL.send).not.toHaveBeenCalled();});
 it('rechecks ownership after decryption and honors credential revocation',async()=>{const {env}=await harness({revoked:true});await dispatchCredentialEmails(env,100);expect(env.EMAIL.send).not.toHaveBeenCalled();});
 it('records successful provider acknowledgement and erases queued secret material',async()=>{const {env,writes}=await harness();expect((await dispatchCredentialEmails(env,100)).processed).toBe(1);expect(env.EMAIL.send).toHaveBeenCalledTimes(1);expect(writes.some(w=>w.sql.includes("payload_json='{}'"))).toBe(true);});
 it.each([{providerFails:true},{ackFails:true}])('holds uncertain provider outcomes rather than resending: %j',async options=>{const {env,writes}=await harness(options);expect((await dispatchCredentialEmails(env,100)).held).toBe(1);expect(env.EMAIL.send).toHaveBeenCalledTimes(1);expect(writes.some(w=>w.args[0]==='dead_letter'&&w.args[1]==='PROVIDER_ACCEPTANCE_UNKNOWN')).toBe(true);});
 it('suppresses all outbound email in isolated staging',async()=>{const {env}=await harness();env.EMAIL_DELIVERY_ENABLED='false';expect((await dispatchCredentialEmails(env,100)).skipped).toBe(true);expect(env.EMAIL.send).not.toHaveBeenCalled();});
});

it.each([{badPayload:true,expected:'payload',status:'dead_letter'},{missingEncryption:true,expected:'configuration',status:'pending'}])('does not contact the provider for invalid encrypted queue material: $expected',async options=>{
 // Use the actual envelope parser with a nonpersisting D1 boundary.
 const env:any={EMAIL:{send:vi.fn()},ADMIN_ACCESS_KEY_SECRET:'s'.repeat(32)};
 const payload=options.badPayload?'{}':await encryptCredentialEnvelope(env,{eventId:'boundary',aggregateId:'boundary',schoolId:'boundary',recipient:'boundary@example.test',schoolName:'Boundary',schoolCode:'BOUNDARY',fullName:'Boundary',role:'teacher',identifier:'boundary',password:'nonpersisted-scalar',loginUrl:'https://example.test'});
 if(options.missingEncryption)env.ADMIN_ACCESS_KEY_SECRET=undefined;
 let claimed=false;const updates:unknown[][]=[];
 env.DB={prepare:(sql:string)=>{let args:unknown[]=[];const stmt={bind:(...a:unknown[])=>{args=a;return stmt;},run:async()=>{updates.push(args);return {success:true};},first:async()=>{if(!sql.includes('RETURNING id,school_id')||claimed)return null;claimed=true;return {id:'boundary',school_id:'boundary',payload_json:payload,attempts:1,lease_id:'boundary-lease'};}};return stmt;}};
 await dispatchCredentialEmails(env,100);expect(env.EMAIL.send).not.toHaveBeenCalled();expect(updates.some(args=>args[0]===options.status&&args[1]===options.expected)).toBe(true);
});
