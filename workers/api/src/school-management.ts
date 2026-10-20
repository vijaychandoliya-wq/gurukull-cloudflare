import type {Hono} from 'hono';
import {z} from 'zod';
import {db,readBody,requireAuth,requireRole,type AppEnv} from './context.js';
import {command,parse,requiredText,dateInput,nullableText,audit,guard,cleanupGuards,managementReady} from './management-common.js';
import {fail} from './security.js';
import {localCalendarDate} from './notice-management.js';
export const configurationInput=z.object({timezone:requiredText(80).refine(v=>{try{new Intl.DateTimeFormat('en',{timeZone:v});return true;}catch{return false;}},'Choose a valid IANA timezone'),currency:z.enum(['INR','USD','EUR','GBP','AUD','CAD','NZD','JPY','AED','SGD','ZAR']),address:requiredText(500)}).strict();
export const yearInput=z.object({name:requiredText(80),startsOn:dateInput,endsOn:dateInput,isCurrent:z.boolean()}).strict().refine(v=>v.startsOn<=v.endsOn,{path:['endsOn'],message:'End date must be on or after start date'});
export const classInput=z.object({name:requiredText(80),code:nullableText(40),sortOrder:z.number().int().min(0).max(1000).default(0)}).strict();
export const sectionInput=z.object({classId:requiredText(100),name:requiredText(80),sortOrder:z.number().int().min(0).max(1000).default(0)}).strict();
export function registerSchoolManagement(app:Hono<AppEnv>){
 app.get('/api/admin/setup',requireAuth,async c=>{
  const u=requireRole(c,'admin');
  const result=await db(c).batch([
   db(c).prepare('SELECT timezone,currency,address,configuration_verified_at FROM school_configuration WHERE school_id=?').bind(u.school_id),
   db(c).prepare('SELECT id,name,starts_on AS startsOn,ends_on AS endsOn,is_current AS isCurrent FROM academic_years WHERE school_id=? ORDER BY starts_on DESC').bind(u.school_id),
   db(c).prepare('SELECT id,name,code,sort_order AS sortOrder FROM classes WHERE school_id=? ORDER BY sort_order,name').bind(u.school_id),
   db(c).prepare('SELECT s.id,s.class_id AS classId,s.name,c.name AS className FROM sections s JOIN classes c ON c.id=s.class_id AND c.school_id=s.school_id WHERE s.school_id=? ORDER BY c.sort_order,c.name,s.name').bind(u.school_id)
  ]);
  return c.json({data:{school:{name:c.get('school').name,code:c.get('school').code,status:c.get('school').status},configuration:result[0].results[0]||null,academicYears:result[1].results,classes:result[2].results,sections:result[3].results}});
 });
 app.put('/api/admin/school/configuration',requireAuth,async c=>{
  const u=requireRole(c,'admin'),input=parse(configurationInput,await readBody(c));
  const currencyGuard=crypto.randomUUID();
  const response=await command(c,'school.configuration',input,()=>[
   guard(c,'NOT EXISTS(SELECT 1 FROM fee_invoices WHERE school_id=? AND (currency IS NULL OR currency!=?)) AND NOT EXISTS(SELECT 1 FROM inventory_items WHERE school_id=? AND currency!=?) AND NOT EXISTS(SELECT 1 FROM transport_routes WHERE school_id=? AND currency!=?) AND NOT EXISTS(SELECT 1 FROM payroll_templates WHERE school_id=? AND currency!=?)',[u.school_id,input.currency,u.school_id,input.currency,u.school_id,input.currency,u.school_id,input.currency],currencyGuard),
   db(c).prepare('INSERT INTO school_configuration(school_id,timezone,currency,address,configuration_verified_at,updated_at) VALUES(?,?,?,?,unixepoch(),unixepoch()) ON CONFLICT(school_id) DO UPDATE SET timezone=excluded.timezone,currency=excluded.currency,address=excluded.address,configuration_verified_at=excluded.configuration_verified_at,updated_at=excluded.updated_at').bind(u.school_id,input.timezone,input.currency,input.address),
   db(c).prepare('UPDATE schools SET timezone=?,currency=?,updated_at=unixepoch() WHERE id=?').bind(input.timezone,input.currency,u.school_id),audit(c,'configure','school',u.school_id),cleanupGuards(c,currencyGuard)
  ],{message:'School settings saved. Add the actual current academic year and classes in Academics.',data:input});return c.json(response);
 });
 app.post('/api/admin/school/activate',requireAuth,async c=>{
  const u=requireRole(c,'admin');const input=parse(z.object({confirmSchoolCode:requiredText(20)}).strict(),await readBody(c));
  if(input.confirmSchoolCode!==c.get('school').code)fail(422,'SCHOOL_CONFIRMATION_REQUIRED');
  await managementReady(c);
  const verifiedCodes=(c.env.SCHOOL_ACTIVATION_VERIFIED_CODES||'').split(',').map(code=>code.trim().toUpperCase()).filter(Boolean);
  const activationVerified=c.env.SCHOOL_ACTIVATION_VERIFIED==='true'||verifiedCodes.includes(c.get('school').code.toUpperCase());
  if(!activationVerified)fail(503,'FREE_CAPACITY_VERIFICATION_REQUIRED','School settings can be saved, but school activation requires account-wide Free capacity and recovery verification.');
  const id=crypto.randomUUID();return c.json(await command(c,'school.activate',input,()=>[guard(c,`EXISTS(SELECT 1 FROM school_configuration cfg JOIN academic_years a ON a.school_id=cfg.school_id AND a.is_current=1 WHERE cfg.school_id=? AND cfg.configuration_verified_at IS NOT NULL)`,[u.school_id],id),db(c).prepare("UPDATE schools SET status='active',updated_at=unixepoch() WHERE id=? AND status IN ('configuration_needed','administrator_pending')").bind(u.school_id),audit(c,'activate','school',u.school_id),cleanupGuards(c,id)],{message:'School activated. Sign out and sign in again to receive a normal school session.'}));
 });
 app.post('/api/admin/academic-years',requireAuth,async c=>{
  const u=requireRole(c,'admin'),input=parse(yearInput,await readBody(c)),id=crypto.randomUUID();
  return c.json(await command(c,'academic-year.create',input,()=>[
   ...(input.isCurrent?[db(c).prepare('UPDATE academic_years SET is_current=0 WHERE school_id=? AND is_current=1').bind(u.school_id)]:[]),
   db(c).prepare('INSERT INTO academic_years VALUES(?,?,?,?,?,?)').bind(id,u.school_id,input.name,input.startsOn,input.endsOn,input.isCurrent?1:0),audit(c,'create','academic_year',id)
  ],{message:'Academic year saved.',data:{id,...input}}),201);
 });
 app.post('/api/admin/classes',requireAuth,async c=>{
  const u=requireRole(c,'admin'),input=parse(classInput,await readBody(c)),id=crypto.randomUUID();
  return c.json(await command(c,'class.create',input,()=>[db(c).prepare('INSERT INTO classes VALUES(?,?,?,?,?,unixepoch(),unixepoch())').bind(id,u.school_id,input.name,input.code,input.sortOrder),audit(c,'create','class',id)],{message:'Class saved.',data:{id,...input}}),201);
 });
 app.put('/api/admin/classes/:id',requireAuth,async c=>{
  const u=requireRole(c,'admin'),id=c.req.param('id')!,input=parse(classInput,await readBody(c)),g=crypto.randomUUID();
  return c.json(await command(c,'class.update',{id,...input},()=>[
   guard(c,'EXISTS(SELECT 1 FROM classes WHERE school_id=? AND id=?)',[u.school_id,id],g),
   db(c).prepare('UPDATE classes SET name=?,code=?,sort_order=?,updated_at=unixepoch() WHERE school_id=? AND id=?').bind(input.name,input.code,input.sortOrder,u.school_id,id),
   audit(c,'update','class',id),cleanupGuards(c,g)
  ],{message:'Class updated.',data:{id,...input}}));
 });
 app.post('/api/admin/sections',requireAuth,async c=>{
  const u=requireRole(c,'admin'),input=parse(sectionInput,await readBody(c)),id=crypto.randomUUID();
  if(!await db(c).prepare('SELECT id FROM classes WHERE id=? AND school_id=?').bind(input.classId,u.school_id).first())fail(422,'INVALID_CLASS');
  return c.json(await command(c,'section.create',input,()=>[db(c).prepare('INSERT INTO sections VALUES(?,?,?,?,?,unixepoch(),unixepoch())').bind(id,u.school_id,input.classId,input.name,input.sortOrder),audit(c,'create','section',id)],{message:'Section saved.',data:{id,...input}}),201);
 });
 app.put('/api/admin/sections/:id',requireAuth,async c=>{
  const u=requireRole(c,'admin'),id=c.req.param('id')!,input=parse(sectionInput,await readBody(c)),g=crypto.randomUUID();
  if(!await db(c).prepare('SELECT id FROM classes WHERE id=? AND school_id=?').bind(input.classId,u.school_id).first())fail(422,'INVALID_CLASS');
  return c.json(await command(c,'section.update',{id,...input},()=>[
   guard(c,'EXISTS(SELECT 1 FROM sections WHERE school_id=? AND id=?)',[u.school_id,id],g),
   db(c).prepare('UPDATE sections SET class_id=?,name=?,sort_order=?,updated_at=unixepoch() WHERE school_id=? AND id=?').bind(input.classId,input.name,input.sortOrder,u.school_id,id),
   audit(c,'update','section',id),cleanupGuards(c,g)
  ],{message:'Section updated.',data:{id,...input}}));
 });
 app.post('/api/admin/academic-years/:id/current',requireAuth,async c=>{
  const u=requireRole(c,'admin'),id=c.req.param('id')!,v=parse(z.object({expectedCurrentYearId:nullableText(100),reason:requiredText(1000)}).strict(),await readBody(c)),g=crypto.randomUUID(),cfg=await db(c).prepare('SELECT timezone FROM school_configuration WHERE school_id=? AND configuration_verified_at IS NOT NULL').bind(u.school_id).first<{timezone:string}>();if(!cfg?.timezone)fail(409,'SCHOOL_SETUP_REQUIRED');const today=localCalendarDate(new Date().toISOString(),cfg.timezone);
  return c.json(await command(c,'academic-year.current',{id,...v},()=>[guard(c,`EXISTS(SELECT 1 FROM academic_years WHERE school_id=? AND id=? AND starts_on<=? AND ends_on>=?) AND (SELECT id FROM academic_years WHERE school_id=? AND is_current=1) IS ?`,[u.school_id,id,today,today,u.school_id,v.expectedCurrentYearId],g),db(c).prepare('UPDATE academic_years SET is_current=0 WHERE school_id=? AND is_current=1').bind(u.school_id),db(c).prepare('UPDATE academic_years SET is_current=1 WHERE school_id=? AND id=?').bind(u.school_id,id),audit(c,'set_current','academic_year',id),cleanupGuards(c,g)],{message:'Current school year changed. Move actual student enrollments separately; history is retained.'}));
 });

}
