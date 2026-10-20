import {hmacKey} from './hmac-key.js';
import { HTTPException } from 'hono/http-exception';
import bcrypt from 'bcryptjs';

export const roles = ['superadmin', 'admin', 'teacher', 'parent', 'student', 'staff'] as const;
export type Role = typeof roles[number];
export interface Claims {
  sub: string; sid: string; schoolId: string; schoolCode: string; userType: Role;
  fullName: string; iat: number; exp: number; iss: 'gurukull-edge'; aud: 'gurukull-clients';
  purpose?: 'school_setup'; authMethod?: 'admin_access_key' | 'member_access_key'; credentialId?: string;
}
export function fail(status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 429 | 500 | 501 | 502 | 503, error: string, message = error): never {
  throw new HTTPException(status, { res: Response.json({ error, message }, { status }) });
}
export function encode(value: string | Uint8Array): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return btoa(Array.from(bytes, b => String.fromCharCode(b)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decode(value: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('INVALID_ENCODING');
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4-value.length%4)%4)), c => c.charCodeAt(0));
}
export async function digest(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
}
async function key(secret: string) {
  if (new TextEncoder().encode(secret).length < 32) throw new Error('JWT_SECRET_REQUIRES_32_BYTES');
  return hmacKey(secret);
}
export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const input = `${encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${encode(JSON.stringify(payload))}`;
  return `${input}.${encode(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), new TextEncoder().encode(input))))}`;
}
export async function verifyJwt(token: string, secret: string): Promise<Claims | null> {
  try {
    if (token.length > 4096) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const h = JSON.parse(new TextDecoder().decode(decode(header)));
    if (h.alg !== 'HS256' || h.typ !== 'JWT') return null;
    if (!await crypto.subtle.verify('HMAC', await key(secret), decode(signature), new TextEncoder().encode(`${header}.${payload}`))) return null;
    const p = JSON.parse(new TextDecoder().decode(decode(payload))) as Claims;
    const now = Math.floor(Date.now()/1000);
    if (![p.sub,p.sid,p.schoolId,p.schoolCode,p.fullName].every(v => typeof v === 'string' && v.length > 0) || !roles.includes(p.userType)) return null;
    if (!Number.isSafeInteger(p.exp) || !Number.isSafeInteger(p.iat) || p.exp <= now || p.iat > now+30 || p.exp <= p.iat || p.exp-p.iat > 86400) return null;
    if (p.iss !== 'gurukull-edge' || p.aud !== 'gurukull-clients') return null;
    if(p.purpose!==undefined&&p.purpose!=='school_setup')return null;
    if(p.authMethod!==undefined&&(!['admin_access_key','member_access_key'].includes(p.authMethod)||typeof p.credentialId!=='string'||!p.credentialId))return null;
    return p;
  } catch { return null; }
}
// Preserve imported bcrypt cost. Unsupported formats fail closed; never downgrade hashes.
export async function verifyPassword(password: string, hash: string, algorithm: string): Promise<boolean> {
  if (algorithm === 'hmac-sha256-generated') {
    throw new Error('GENERATED_PASSWORD_CONTEXT_REQUIRED');
  }
  if (algorithm !== 'bcrypt' || !/^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/.test(hash)) fail(503, 'PASSWORD_HASH_MIGRATION_REQUIRED');
  const cost = Number(hash.slice(4,6));
  if (cost < 10 || cost > 16) fail(503, 'PASSWORD_HASH_POLICY_REVIEW_REQUIRED');
  return bcrypt.compare(password, hash.replace(/^\$2y\$/, '$2a$'));
}
const generatedPasswordMessage=(password:string,schoolId:string,userId:string)=>new TextEncoder().encode(JSON.stringify(['gurukull-generated-password-v1',schoolId,userId,password]));
export async function generatedPasswordDigest(password:string,secret:string,schoolId:string,userId:string):Promise<string>{
  if(new TextEncoder().encode(secret).length<32)fail(503,'GENERATED_PASSWORD_NOT_CONFIGURED');
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC',await hmacKey(secret),generatedPasswordMessage(password,schoolId,userId))));
}
export async function verifyGeneratedPassword(password:string,hash:string,secret:string,schoolId:string,userId:string):Promise<boolean>{
  if(!/^[A-Za-z0-9_-]{43}$/.test(hash))return false;
  if(new TextEncoder().encode(secret).length<32)fail(503,'GENERATED_PASSWORD_NOT_CONFIGURED');
  try{return await crypto.subtle.verify('HMAC',await hmacKey(secret),decode(hash),generatedPasswordMessage(password,schoolId,userId));}catch{return false;}
}
export function money(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) fail(500, 'INVALID_STORED_MONEY');
  return value;
}
