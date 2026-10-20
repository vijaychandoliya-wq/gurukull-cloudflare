import type {Hono} from 'hono';
import {z} from 'zod';
import {db,readBody,requireAuth,type AppEnv} from './context.js';
import {parse,requiredText,nullableText,dateInput,command,guard,cleanupGuards,audit} from './management-common.js';
import {fail} from './security.js';
const mobileInput=z.preprocess(v=>v===''||v===undefined?null:v,z.string().trim().regex(/^\+?[0-9]{7,15}$/,'Enter a valid mobile number.').nullable());
export const profileInput=z.object({name:requiredText(),version:z.number().int().positive(),mobile:mobileInput.optional(),gender:z.preprocess(v=>v===''||v===undefined?null:v,z.enum(['male','female','other']).nullable()),dateOfBirth:z.preprocess(v=>v===''||v===undefined?null:v,dateInput.nullable()),bloodGroup:nullableText(8),address:nullableText(500),city:nullableText(100),pincode:nullableText(12)}).strict();
export function registerProfileManagement(app:Hono<AppEnv>){
 app.put('/api/admin/profile',requireAuth,async c=>{
  const u=c.get('user'),input=parse(profileInput,await readBody(c)),id=crypto.randomUUID();
  if(input.dateOfBirth&&input.dateOfBirth>new Date().toISOString().slice(0,10))fail(422,'INVALID_BIRTH_DATE');
  return c.json(await command(c,'own-profile.update',input,()=>[
   guard(c,"EXISTS(SELECT 1 FROM users WHERE id=? AND school_id=? AND version=? AND status='active')",[u.id,u.school_id,input.version],id),
   db(c).prepare('UPDATE users SET full_name=?,mobile=?,version=version+1,updated_at=unixepoch() WHERE id=? AND school_id=? AND version=?').bind(input.name,input.mobile===undefined?u.mobile:input.mobile,u.id,u.school_id,input.version),
   db(c).prepare('INSERT INTO user_profiles(id,school_id,user_id,gender,dob,blood_group,address,city,pincode,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,unixepoch(),unixepoch()) ON CONFLICT(user_id) DO UPDATE SET gender=excluded.gender,dob=excluded.dob,blood_group=excluded.blood_group,address=excluded.address,city=excluded.city,pincode=excluded.pincode,updated_at=excluded.updated_at').bind(crypto.randomUUID(),u.school_id,u.id,input.gender,input.dateOfBirth,input.bloodGroup,input.address,input.city,input.pincode),
   audit(c,'update_own_profile','user',u.id),cleanupGuards(c,id)
  ],{message:'Profile saved.',data:{version:input.version+1}},['admin','teacher','staff','parent','student']));
 });
}
