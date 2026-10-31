import {describe,it,expect,vi} from 'vitest';
import {Hono} from 'hono';
import {registerMemberAccess} from '../src/member-access.js';
import {sendWhatsAppPassword} from '../src/whatsapp.js';
vi.mock('../src/whatsapp.js',()=>({sendWhatsAppPassword:vi.fn()}));
// Handler boundary only. These scalar contexts never create school or person rows.
vi.mock('../src/context.js',async importOriginal=>{
 const actual=await importOriginal<typeof import('../src/context.js')>();
 return {...actual,requireAuth:async(c:any,next:any)=>{c.set('user',{id:'boundary-admin',school_id:'boundary-school',user_type:'admin'});c.set('school',{name:'Boundary',slug:'boundary',code:'BOUNDARY'});c.set('requestId','boundary-request');await next();}};
});
async function request(action:string,{conflict=false,providerFailure=false}={}){
 const order:string[]=[],batches:any[][]=[];vi.mocked(sendWhatsAppPassword).mockReset();
 vi.mocked(sendWhatsAppPassword).mockImplementation(async()=>{order.push('provider');if(providerFailure)throw Error('provider unavailable');return undefined as any;});
 const DB:any={prepare:(sql:string)=>{let values:unknown[]=[];const stmt={sql,get values(){return values;},bind:(...args:unknown[])=>{values=args;return stmt;},first:async()=>({id:'boundary-member',full_name:'Boundary',user_type:'teacher',version:1,status:'active',email:'boundary@example.test',mobile:'1234567890'})};return stmt;},batch:async(writes:any[])=>{batches.push(writes);if(conflict)throw Error('CHECK constraint failed: valid=1');order.push('commit');return writes.map(()=>({success:true}));}};
 const app=new Hono<any>();registerMemberAccess(app);
 const response=await app.request('/api/admin/users/boundary-member/password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:1})},{DB,GENERATED_PASSWORD_AUTH_ENABLED:'true',ADMIN_ACCESS_KEY_SECRET:'s'.repeat(32)});
 return {response,order,batches};
}
describe('administrator credential delivery consistency',()=>{
 it('rejects WhatsApp delivery before changing a password, revoking sessions or contacting the provider',async()=>{const r=await request('generate_and_send');expect(r.response.status).toBe(503);expect(await r.response.json()).toMatchObject({error:'WHATSAPP_CREDENTIAL_DELIVERY_UNAVAILABLE'});expect(r.batches).toEqual([]);expect(r.order).toEqual([]);expect(sendWhatsAppPassword).not.toHaveBeenCalled();});
 it('does not commit when a concurrent account change invalidates password generation',async()=>{const r=await request('generate',{conflict:true});expect(r.response.status).toBe(409);expect(r.order).toEqual([]);});
 it('cancels older encrypted credential emails in the same batch before queuing the replacement',async()=>{const r=await request('generate_and_email');expect(r.response.status).toBe(200);const sql=r.batches[0].map(x=>x.sql);expect(sql.findIndex(x=>x.includes('UPDATE outbox'))).toBeLessThan(sql.findIndex(x=>x.includes('INSERT INTO outbox')));expect(sendWhatsAppPassword).not.toHaveBeenCalled();});
});
