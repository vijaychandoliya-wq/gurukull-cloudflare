import type { Hono } from 'hono';
import { CreateSchoolInputSchema } from '@gurukul/domain';
import { computePayloadHash } from '@gurukul/contracts';
import { db, readBody, requireAuth, requireRole, type ApiContext, type AppEnv } from './context.js';
import { accessKeyDigest, validAccessKey } from './admin-access.js';
import { encode, fail, signJwt, digest, generatedPasswordDigest, verifyGeneratedPassword } from './security.js';
import { generateTemporaryPassword } from './member-access.js';
import { sendCredentialsEmail } from './email.js';

function operator(c: ApiContext) {
  const user = requireRole(c, 'superadmin');
  return db(c).prepare('SELECT 1 FROM platform_operators WHERE user_id=? AND revoked_at IS NULL').bind(user.id).first().then(row => {
    if (!row) fail(403, 'PLATFORM_PERMISSION_REQUIRED');
    return user;
  });
}

async function deliverCredentials(env: AppEnv['Bindings'], input: Parameters<typeof sendCredentialsEmail>[1]) {
  try { return await sendCredentialsEmail(env, input); }
  catch { return { status: 'failed' as const }; }
}

export async function platformLogin(c: ApiContext) {
  const body = await readBody(c);
  const identifier = String(body.email || body.mobile || '').trim();
  const credential = typeof body.password === 'string' ? body.password : '';
  if (!identifier || identifier.length > 254 || !credential || credential.length > 256) fail(422, 'INVALID_PLATFORM_CREDENTIAL');
  const attemptNow=Math.floor(Date.now()/1000);
  const attemptKeys=await Promise.all([`platform:${identifier.toLowerCase()}`,`ip:${c.req.header('cf-connecting-ip')||'local'}`].map(value=>digest(value)));
  const attempts=await db(c).batch<{attempts:number}>(attemptKeys.map(attemptKey=>db(c).prepare(`INSERT INTO login_attempts(attempt_key,window_start,attempts) VALUES(?,?,1) ON CONFLICT(attempt_key) DO UPDATE SET attempts=CASE WHEN window_start<=?-900 THEN 1 ELSE attempts+1 END,window_start=CASE WHEN window_start<=?-900 THEN excluded.window_start ELSE window_start END RETURNING attempts`).bind(attemptKey,attemptNow,attemptNow,attemptNow)));
  if(attempts.some(r=>!r.success||Number(r.results[0]?.attempts)>30))fail(429,'LOGIN_RATE_LIMITED','Too many sign-in attempts. Wait 15 minutes before retrying.');
  const accessKeyLogin = validAccessKey(credential);
  if (accessKeyLogin && c.env.ADMIN_ACCESS_KEY_CPU_VERIFIED !== 'true') fail(503, 'ADMIN_ACCESS_CPU_VERIFICATION_REQUIRED');
  if (!c.env.ADMIN_ACCESS_KEY_SECRET || !c.env.JWT_SECRET) fail(503, 'PLATFORM_AUTH_NOT_CONFIGURED');
  const user = await db(c).prepare(`SELECT u.*,s.code AS school_code,s.name AS school_name,a.id AS credential_id,a.credential_digest,ppc.password_hash AS platform_password_hash,ppc.hash_algorithm AS platform_password_algorithm
    FROM users u JOIN schools s ON s.id=u.school_id JOIN platform_operators po ON po.user_id=u.id AND po.revoked_at IS NULL
    LEFT JOIN admin_access_credentials a ON a.school_id=u.school_id AND a.user_id=u.id AND a.revoked_at IS NULL AND a.expires_at>unixepoch()
    LEFT JOIN platform_password_credentials ppc ON ppc.school_id=u.school_id AND ppc.user_id=u.id AND ppc.revoked_at IS NULL
    WHERE u.status='active' AND (lower(u.email)=lower(?) OR u.mobile=?) LIMIT 1`).bind(identifier, identifier).first<any>();
  let verified = false;
  if (user && accessKeyLogin && user.credential_id && user.credential_digest) {
    try { verified = await (await import('./admin-access.js')).verifyAccessKey(credential, user.credential_digest, c.env.ADMIN_ACCESS_KEY_SECRET!, user.school_id, user.id); } catch { verified = false; }
  } else if(user&&!accessKeyLogin&&c.env.GENERATED_PASSWORD_AUTH_ENABLED==='true'&&user.generated_password_hash?.startsWith('bcrypt-v1:')){
    verified=await verifyGeneratedPassword(credential,user.generated_password_hash,c.env.ADMIN_ACCESS_KEY_SECRET,user.school_id,user.id);
  } else if (user && !accessKeyLogin && c.env.GENERATED_PASSWORD_AUTH_ENABLED === 'true' && user.platform_password_algorithm === 'hmac-sha256-generated') {
    const passwordSecret = c.env.PLATFORM_PASSWORD_SECRET || c.env.ADMIN_ACCESS_KEY_SECRET;
    if (passwordSecret) verified = await verifyGeneratedPassword(credential, user.platform_password_hash, passwordSecret, user.school_id, user.id);
  }
  if (!user || !verified) fail(401, 'CREDENTIAL_REJECTED');
  const now = Math.floor(Date.now() / 1000), sid = crypto.randomUUID();
  const claims = {sub:user.id,sid,schoolId:user.school_id,schoolCode:user.school_code,userType:user.user_type,fullName:user.full_name,iat:now,exp:now+7200,iss:'gurukull-edge' as const,aud:'gurukull-clients' as const,authMethod:accessKeyLogin?'admin_access_key' as const:'password' as const,...(accessKeyLogin?{credentialId:user.credential_id}: {})};
  const token = await signJwt(claims, c.env.JWT_SECRET);
  const saved = await db(c).prepare(`INSERT INTO sessions(id,school_id,user_id,token_digest,platform,expires_at,created_at) VALUES(?,?,?,?, 'web', ?, ?)`).bind(sid,user.school_id,user.id,await digest(token),now+7200,now).run();
  if (!saved.success) fail(503, 'SESSION_WRITE_FAILED');
  return c.json({status:'success',token,schoolCode:user.school_code,user:{id:user.id,name:user.full_name,email:user.email,roles:['superadmin'],userType:user.user_type},platform:true});
}

export function registerPlatform(app: Hono<AppEnv>) {
  app.post('/platform/v1/login', platformLogin);
  app.get('/platform/v1/login-activity', requireAuth, async c => {
    await operator(c);
    const query = (c.req.query('q') || '').trim();
    const schoolCode = (c.req.query('schoolCode') || '').trim().toUpperCase();
    const status = (c.req.query('status') || 'all').trim();
    const page = Math.max(1, Math.min(10000, Number.parseInt(c.req.query('page') || '1', 10) || 1));
    const perPage = Math.max(10, Math.min(100, Number.parseInt(c.req.query('per_page') || '25', 10) || 25));
    if (query.length > 120 || (schoolCode && !/^[A-Z0-9_-]{2,20}$/.test(schoolCode)) || !['all', 'active', 'expired', 'revoked'].includes(status)) fail(422, 'INVALID_LOGIN_ACTIVITY_FILTER');
    const now = Math.floor(Date.now() / 1000);
    const conditions = ['1=1'];
    const params: unknown[] = [];
    if (query) {
      const needle = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(`(u.full_name LIKE ? ESCAPE '\\' OR COALESCE(u.email,'') LIKE ? ESCAPE '\\' OR COALESCE(u.mobile,'') LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\' OR s.code LIKE ? ESCAPE '\\')`);
      params.push(needle, needle, needle, needle, needle);
    }
    if (schoolCode) { conditions.push('s.code=?'); params.push(schoolCode); }
    if (status === 'active') { conditions.push('ss.revoked_at IS NULL AND ss.expires_at>?'); params.push(now); }
    if (status === 'expired') { conditions.push('ss.revoked_at IS NULL AND ss.expires_at<=?'); params.push(now); }
    if (status === 'revoked') conditions.push('ss.revoked_at IS NOT NULL');
    const where = conditions.join(' AND ');
    const from = `FROM sessions ss JOIN users u ON u.id=ss.user_id AND u.school_id=ss.school_id JOIN schools s ON s.id=ss.school_id LEFT JOIN domains d ON d.school_id=s.id AND d.is_primary=1`;
    const totalRow = await db(c).prepare(`SELECT COUNT(*) AS total ${from} WHERE ${where}`).bind(...params).first<{ total: number }>();
    const total = Number(totalRow?.total || 0), offset = (page - 1) * perPage;
    const rows = await db(c).prepare(`SELECT ss.id AS sessionId,ss.created_at AS createdAt,ss.expires_at AS expiresAt,ss.revoked_at AS revokedAt,ss.device_id AS deviceId,ss.platform,u.id AS userId,u.full_name AS fullName,u.email,u.mobile,u.user_type AS userType,u.status AS userStatus,s.id AS schoolId,s.code AS schoolCode,s.name AS schoolName,d.hostname ${from} WHERE ${where} ORDER BY ss.created_at DESC,ss.id DESC LIMIT ? OFFSET ?`).bind(...params, perPage, offset).all();
    return c.json({ data: rows.results.map((row: any) => ({ ...row, sessionStatus: row.revokedAt ? 'revoked' : Number(row.expiresAt) <= now ? 'expired' : 'active' })), meta: { currentPage: page, lastPage: Math.max(1, Math.ceil(total / perPage)), perPage, total } });
  });
  app.get('/platform/v1/schools', requireAuth, async c => {
    await operator(c);
    const rows = await db(c).prepare(`SELECT s.id,s.code,s.slug,s.name,s.status,s.timezone,s.currency,s.created_at AS createdAt,
      d.hostname,sc.address,(SELECT COUNT(*) FROM users u WHERE u.school_id=s.id AND u.user_type='admin' AND u.status='active') AS administratorCount
      FROM schools s LEFT JOIN domains d ON d.school_id=s.id AND d.is_primary=1 LEFT JOIN school_configuration sc ON sc.school_id=s.id
      ORDER BY s.created_at DESC LIMIT 500`).all();
    return c.json({data:rows.results});
  });
  // School credentials are intentionally inventory-only. Passwords and access
  // keys are stored as one-way, tenant-bound digests and can never be read back.
  // The platform owner can issue a replacement credential, which is returned
  // once and immediately invalidates active sessions for that administrator.
  app.get('/platform/v1/school-credentials', requireAuth, async c => {
    await operator(c);
    const rows = await db(c).prepare(`SELECT s.id AS schoolId,s.code AS schoolCode,s.name AS schoolName,s.status AS schoolStatus,
      d.hostname,u.id AS userId,u.full_name AS fullName,u.email,u.mobile,u.status AS userStatus,
      CASE WHEN u.generated_password_hash IS NOT NULL OR (u.password_hash IS NOT NULL AND u.password_hash!='!') THEN 1 ELSE 0 END AS passwordSet,
      a.created_at AS accessKeyCreatedAt,a.expires_at AS accessKeyExpiresAt,a.revoked_at AS accessKeyRevokedAt,
      (SELECT MAX(created_at) FROM audit_events x WHERE x.school_id=u.school_id AND x.entity_type='user' AND x.entity_id=u.id
        AND x.action IN ('platform_generate_password','platform_generate_access_key')) AS lastGeneratedAt
      FROM schools s
      LEFT JOIN domains d ON d.school_id=s.id AND d.is_primary=1
      LEFT JOIN users u ON u.school_id=s.id AND u.user_type='admin'
      LEFT JOIN admin_access_credentials a ON a.school_id=u.school_id AND a.user_id=u.id
      ORDER BY s.created_at DESC,u.created_at ASC`).all();
    const now = Math.floor(Date.now() / 1000);
    return c.json({data: rows.results.map((row: any) => ({
      schoolId: row.schoolId, schoolCode: row.schoolCode, schoolName: row.schoolName,
      schoolStatus: row.schoolStatus, hostname: row.hostname || `${row.schoolCode}.gurukull.in`,
      administrator: row.userId ? {
        userId: row.userId, fullName: row.fullName, email: row.email, mobile: row.mobile,
        userStatus: row.userStatus, loginId: row.email || row.mobile || null,
        passwordSet: Boolean(row.passwordSet), lastGeneratedAt: row.lastGeneratedAt || null,
        accessKey: row.accessKeyCreatedAt ? {
          createdAt: row.accessKeyCreatedAt, expiresAt: row.accessKeyExpiresAt,
          revokedAt: row.accessKeyRevokedAt || null,
          status: row.accessKeyRevokedAt ? 'revoked' : Number(row.accessKeyExpiresAt) <= now ? 'expired' : 'active',
        } : null,
      } : null,
    }))});
  });
  app.get('/platform/v1/schools/:schoolId', requireAuth, async c => {
    await operator(c); const id=c.req.param('schoolId');
    const school=await db(c).prepare(`SELECT s.*,d.hostname,sc.address,sc.configuration_verified_at FROM schools s LEFT JOIN domains d ON d.school_id=s.id AND d.is_primary=1 LEFT JOIN school_configuration sc ON sc.school_id=s.id WHERE s.id=?`).bind(id).first();
    if(!school) fail(404,'SCHOOL_NOT_FOUND'); return c.json({data:school});
  });
  app.patch('/platform/v1/schools/:schoolId', requireAuth, async c => {
    await operator(c); const id=c.req.param('schoolId'), body=await readBody(c); const now=Math.floor(Date.now()/1000);
    const name=typeof body.name==='string'?body.name.trim():undefined, timezone=typeof body.timezone==='string'?body.timezone.trim():undefined, currency=typeof body.currency==='string'?body.currency.trim().toUpperCase():undefined, address=typeof body.address==='string'?body.address.trim():undefined;
    if(name!==undefined&&(!name||name.length>100))fail(422,'INVALID_SCHOOL_NAME');
    if(timezone!==undefined){try{new Intl.DateTimeFormat('en',{timeZone:timezone});}catch{fail(422,'INVALID_TIMEZONE');}}
    if(currency!==undefined&&!/^[A-Z]{3}$/.test(currency))fail(422,'INVALID_CURRENCY');
    const result=await db(c).batch([
      db(c).prepare('UPDATE schools SET name=COALESCE(?,name),timezone=COALESCE(?,timezone),currency=COALESCE(?,currency),updated_at=? WHERE id=?').bind(name??null,timezone??null,currency??null,now,id),
      db(c).prepare('UPDATE school_configuration SET address=COALESCE(?,address),updated_at=? WHERE school_id=?').bind(address??null,now,id),
    ]); if(result.some(r=>!r.success))fail(503,'SCHOOL_UPDATE_FAILED'); return c.json({status:'success'});
  });
  app.post('/platform/v1/schools', requireAuth, async (c: ApiContext): Promise<Response> => {
    const user=await operator(c); const parsed=CreateSchoolInputSchema.safeParse(await readBody(c)); if(!parsed.success)fail(422,'INVALID_SCHOOL'); const input=parsed.data;
    if(['app','api','admin','www','assets','mail','status','staging','dev','support','platform'].includes(input.slug))fail(422,'RESERVED_SLUG');
    const idem=c.req.header('Idempotency-Key'); if(!idem||idem.length>128)fail(422,'IDEMPOTENCY_KEY_REQUIRED'); const hash=await computePayloadHash(input); const prior=await db(c).prepare('SELECT payload_hash,school_id FROM provisioning_operations WHERE actor_id=? AND idempotency_key=?').bind(user.id,idem).first<any>();
    if(prior){if(prior.payload_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT'); return c.json({status:'reserved',data:await db(c).prepare('SELECT id,code,slug,name,status FROM schools WHERE id=?').bind(prior.school_id).first()});}
    const id=crypto.randomUUID(),now=Math.floor(Date.now()/1000),host=`${input.slug}.gurukull.in`;
    const result=await db(c).batch([
      db(c).prepare(`INSERT INTO schools(id,code,slug,name,status,timezone,currency,created_at,updated_at) VALUES(?,?,?,?,'configuration_needed',?,?,?,?)`).bind(id,input.code,input.slug,input.name,input.timezone,input.currency,now,now),
      db(c).prepare(`INSERT INTO domains(id,school_id,hostname,is_primary,status,created_at) VALUES(?,?,?,1,'active',?)`).bind(crypto.randomUUID(),id,host,now),
      db(c).prepare(`INSERT INTO school_configuration(school_id,address,updated_at) VALUES(?,?,?)`).bind(id,input.address ?? null,now),
      db(c).prepare(`INSERT INTO provisioning_operations(id,actor_id,idempotency_key,payload_hash,school_id,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(),user.id,idem,hash,id,now),
    ]); if(result.some(r=>!r.success))fail(409,'SCHOOL_PROVISIONING_CONFLICT'); return c.json({status:'reserved',data:{id,code:input.code,slug:input.slug,name:input.name,hostname:host,status:'configuration_needed'}},201);
  });
  app.post('/platform/v1/schools/:schoolId/administrator', requireAuth, async c => {
    await operator(c); const schoolId=c.req.param('schoolId'), body=await readBody(c), fullName=String(body.fullName||'').trim(), email=typeof body.email==='string'?body.email.trim().toLowerCase():null, mobile=typeof body.mobile==='string'?body.mobile.trim():null;
    if(!fullName||fullName.length>160||(!email&&!mobile)|| (email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) || (mobile&&!/^\+?[0-9]{7,15}$/.test(mobile)))fail(422,'INVALID_ADMINISTRATOR');
    const school=await db(c).prepare('SELECT id,code,name,slug,status FROM schools WHERE id=?').bind(schoolId).first<any>(); if(!school)fail(404,'SCHOOL_NOT_FOUND');
    if(!c.env.ADMIN_ACCESS_KEY_SECRET)fail(503,'ADMIN_ACCESS_NOT_CONFIGURED');
    const bytes=new Uint8Array(32); crypto.getRandomValues(bytes); const accessKey=`gka1_${encode(bytes)}`, userId=crypto.randomUUID(), credentialId=crypto.randomUUID(), requestId=crypto.randomUUID(), now=Math.floor(Date.now()/1000), expires=now+7776000, credentialDigest=await accessKeyDigest(accessKey,c.env.ADMIN_ACCESS_KEY_SECRET,schoolId,userId);
    const inserted=await db(c).prepare(`INSERT INTO owner_admin_access_requests(id,school_id,user_id,credential_id,credential_digest,full_name,email,mobile,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(requestId,schoolId,userId,credentialId,credentialDigest,fullName,email,mobile,now,expires).run(); if(!inserted.success)fail(409,'ADMINISTRATOR_ALREADY_EXISTS');
    const delivery=email?await deliverCredentials(c.env,{recipient:email,schoolName:school.name,schoolCode:school.code,fullName,role:'administrator',identifier:email||mobile||'',password:accessKey,loginUrl:`https://${school.slug}.gurukull.in/login`}):{status:'not_configured' as const};
    return c.json({status:'success',data:{userId,credentialId,identifier:email||mobile,accessKey,expiresAt:new Date(expires*1000).toISOString(),delivery:delivery.status,hostname:`${school.slug}.gurukull.in`}},201);
  });
  app.post('/platform/v1/schools/:schoolId/administrators/:userId/access-key', requireAuth, async c => {
    const actor = await operator(c), schoolId = c.req.param('schoolId'), userId = c.req.param('userId');
    if (!c.env.ADMIN_ACCESS_KEY_SECRET) fail(503, 'ADMIN_ACCESS_NOT_CONFIGURED');
    const target = await db(c).prepare(`SELECT s.id AS schoolId,s.code AS schoolCode,s.name AS schoolName,s.slug,u.id,u.full_name AS fullName,u.email,u.mobile
      FROM users u JOIN schools s ON s.id=u.school_id
      JOIN user_roles r ON r.school_id=u.school_id AND r.user_id=u.id AND r.role='admin'
      WHERE u.id=? AND u.school_id=? AND u.user_type='admin' AND u.status='active'`).bind(userId, schoolId).first<any>();
    if (!target) fail(404, 'ADMINISTRATOR_NOT_FOUND');
    const accessKey = `gka1_${encode(crypto.getRandomValues(new Uint8Array(32)))}`;
    const now = Math.floor(Date.now() / 1000), expires = now + 7776000;
    const credentialDigest = await accessKeyDigest(accessKey, c.env.ADMIN_ACCESS_KEY_SECRET, schoolId, userId);
    const writes = await db(c).batch([
      db(c).prepare(`INSERT INTO admin_access_credentials(id,school_id,user_id,credential_digest,created_at,expires_at,revoked_at)
        VALUES(?,?,?,?,?,?,NULL) ON CONFLICT(school_id,user_id) DO UPDATE SET id=excluded.id,credential_digest=excluded.credential_digest,created_at=excluded.created_at,expires_at=excluded.expires_at,revoked_at=NULL`)
        .bind(crypto.randomUUID(), schoolId, userId, credentialDigest, now, expires),
      db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now, schoolId, userId),
      db(c).prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), schoolId, actor.id, 'platform_generate_access_key', 'user', userId, now),
    ]);
    if (writes.some(result => !result.success)) fail(503, 'CREDENTIAL_WRITE_FAILED');
    const delivery = target.email ? await deliverCredentials(c.env, {recipient: target.email, schoolName: target.schoolName, schoolCode: target.schoolCode, fullName: target.fullName, role: 'administrator access key', identifier: target.email || target.mobile || '', password: accessKey, loginUrl: `https://${target.slug}.gurukull.in/login`}) : {status: 'not_configured' as const};
    return c.json({data: {schoolCode: target.schoolCode, identifier: target.email || target.mobile, accessKey, expiresAt: new Date(expires * 1000).toISOString(), delivery: delivery.status, hostname: `${target.slug}.gurukull.in`}, message: 'New access key generated and shown once. The prior key and active sessions were revoked.'});
  });
  app.post('/platform/v1/schools/:schoolId/administrators/:userId/password', requireAuth, async c => {
    const actor = await operator(c), schoolId = c.req.param('schoolId'), userId = c.req.param('userId');
    const secret = c.env.ADMIN_ACCESS_KEY_SECRET;
    if (c.env.GENERATED_PASSWORD_AUTH_ENABLED !== 'true' || !secret) fail(503, 'PASSWORD_AUTH_NOT_CONFIGURED');
    const target = await db(c).prepare(`SELECT s.code AS schoolCode,s.name AS schoolName,s.slug,u.id,u.full_name AS fullName,u.email,u.mobile
      FROM users u JOIN schools s ON s.id=u.school_id JOIN user_roles r ON r.school_id=u.school_id AND r.user_id=u.id AND r.role='admin'
      WHERE u.id=? AND u.school_id=? AND u.user_type='admin' AND u.status='active'`).bind(userId, schoolId).first<any>();
    if (!target) fail(404, 'ADMINISTRATOR_NOT_FOUND');
    const password = generateTemporaryPassword(), passwordHash = await generatedPasswordDigest(password, secret, schoolId, userId), now = Math.floor(Date.now() / 1000);
    const writes = await db(c).batch([
      db(c).prepare(`UPDATE users SET generated_password_hash=?,version=version+1,updated_at=? WHERE id=? AND school_id=? AND user_type='admin' AND status='active'`).bind(passwordHash, now, userId, schoolId),
      db(c).prepare('UPDATE sessions SET revoked_at=? WHERE school_id=? AND user_id=? AND revoked_at IS NULL').bind(now, schoolId, userId),
      db(c).prepare('INSERT INTO audit_events VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), schoolId, actor.id, 'platform_generate_password', 'user', userId, now),
    ]);
    if (writes.some(result => !result.success)) fail(503, 'PASSWORD_WRITE_FAILED');
    const delivery = target.email ? await deliverCredentials(c.env, {recipient: target.email, schoolName: target.schoolName, schoolCode: target.schoolCode, fullName: target.fullName, role: 'administrator', identifier: target.email || target.mobile || '', password, loginUrl: `https://${target.slug}.gurukull.in/login`}) : {status: 'not_configured' as const};
    return c.json({data: {schoolCode: target.schoolCode, identifier: target.email || target.mobile, password, delivery: delivery.status, hostname: `${target.slug}.gurukull.in`}, message: 'New password generated and shown once. Existing sessions were revoked.'});
  });
  app.post('/platform/v1/schools/:schoolId/activate', requireAuth, async c => {
    await operator(c); const id=c.req.param('schoolId'); const config=await db(c).prepare('SELECT timezone,currency,address FROM school_configuration WHERE school_id=?').bind(id).first<any>(); const admin=await db(c).prepare(`SELECT 1 FROM users WHERE school_id=? AND user_type='admin' AND status='active'`).bind(id).first(); const domain=await db(c).prepare(`SELECT 1 FROM domains WHERE school_id=? AND status='active'`).bind(id).first(); if(!config?.timezone||!config?.currency||!config?.address||!admin||!domain)fail(422,'SCHOOL_ACTIVATION_REQUIREMENTS'); const result=await db(c).prepare(`UPDATE schools SET status='active',updated_at=? WHERE id=? AND status IN ('configuration_needed','administrator_pending','validated','reserved')`).bind(Math.floor(Date.now()/1000),id).run(); if(!result.success)fail(503,'SCHOOL_ACTIVATION_FAILED'); return c.json({status:'active'});
  });
}
