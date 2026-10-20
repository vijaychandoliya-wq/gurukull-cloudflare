import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { randomBytes,randomUUID,createHash } from 'node:crypto';
import { resolve } from 'node:path';

// This tool only prepares owner-reviewable SQL and a private invitation file.
// Applying SQL requires the already-authenticated Cloudflare owner and an explicit remote DB binding.
const [inputPath,outputDirectory]=process.argv.slice(2);
if(!inputPath||!outputDirectory)throw new Error('Usage: node prepare-admin.mjs <real-identity.json> <private-output-directory>');
const input=JSON.parse(await readFile(inputPath,'utf8'));
const fullName=typeof input.fullName==='string'?input.fullName.trim():'';
const email=typeof input.email==='string'?input.email.trim().toLowerCase():null;
const mobile=typeof input.mobile==='string'?input.mobile.trim():null;
const code=typeof input.schoolCode==='string'?input.schoolCode.trim().toUpperCase():'';
if(!fullName||fullName.length>160||!/^[A-Z0-9_-]{2,20}$/.test(code))throw new Error('Real administrator name and explicit schoolCode are required');
if((!email&&!mobile)||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||(mobile&&!/^\+?[0-9]{7,15}$/.test(mobile)))throw new Error('A valid real email or mobile is required');
if(email?.endsWith('.invalid')||email?.endsWith('@example.com')||email?.endsWith('@example.org'))throw new Error('Do not use test identities for actual enrollment');
const token=randomBytes(32).toString('base64url'),digest=createHash('sha256').update(token).digest('hex');
const id=randomUUID(),inviteId=randomUUID(),guard=randomUUID(),now=Math.floor(Date.now()/1000),expires=now+86400;
const sqlValue=v=>v===null?'NULL':"'"+String(v).replaceAll("'","''")+"'";
const q=sqlValue;
const sql=`-- Real owner-requested administrator only; one atomic statement and trigger. No business fixtures.
-- No platform operator/superadmin grant. A missing/non-enrollable school fails NOT NULL.
INSERT INTO admin_enrollment_requests(id,school_id,user_id,invitation_id,token_digest,full_name,email,mobile,created_at,expires_at) VALUES(${q(guard)},(SELECT id FROM schools WHERE code=${q(code)} AND status IN ('configuration_needed','administrator_pending','active')),${q(id)},${q(inviteId)},${q(digest)},${q(fullName)},${q(email)},${q(mobile)},${now},${expires});
`;
const dir=resolve(outputDirectory);await mkdir(dir,{recursive:true,mode:0o700});
await writeFile(resolve(dir,'administrator.sql'),sql,{mode:0o600,flag:'wx'});
await writeFile(resolve(dir,'invitation.json'),JSON.stringify({schoolCode:code,fullName,email,mobile,token,expiresAt:new Date(expires*1000).toISOString(),setupPage:'https://gurukul-worker-api.gurukull.workers.dev/enroll',note:'Password is chosen privately in the enrollment form. No default password. Enrollment remains gated until secure Free authentication is verified.'},null,2),{mode:0o600,flag:'wx'});
console.log('Prepared private administrator.sql and invitation.json. No database was modified; no secret printed. Review identity and apply only to the verified school database after migration 0004.');
