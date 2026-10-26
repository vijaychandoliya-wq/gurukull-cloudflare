import type {D1Database, ExportedHandlerScheduledHandler} from '@cloudflare/workers-types';
import type {Hono} from 'hono';
import type {Env} from './context.js';
import {db, requireAuth, requireRole, type AppEnv} from './context.js';
import {sendCredentialsEmail, type CredentialsEmailInput} from './email.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 120;

type StoredEnvelope = {version: 1; iv: string; ciphertext: string};
export type CredentialEnvelope = CredentialsEmailInput & {schoolId: string; eventId: string; aggregateId: string};
type OutboxRow = {id: string; school_id: string; payload_json: string; attempts: number; lease_id: string | null};

function base64(bytes: Uint8Array) {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unbase64(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
async function encryptionKey(env: Env) {
  const secret = env.EMAIL_OUTBOX_SECRET || env.ADMIN_ACCESS_KEY_SECRET;
  if (!secret || encoder.encode(secret).byteLength < 32) throw new Error('EMAIL_OUTBOX_NOT_CONFIGURED');
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function encryptCredentialEnvelope(env: Env, envelope: CredentialEnvelope): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({name: 'AES-GCM', iv}, await encryptionKey(env), encoder.encode(JSON.stringify(envelope)));
  const stored: StoredEnvelope = {version: 1, iv: base64(iv), ciphertext: base64(new Uint8Array(ciphertext))};
  return JSON.stringify(stored);
}
async function decryptCredentialEnvelope(env: Env, serialized: string): Promise<CredentialEnvelope> {
  const stored = JSON.parse(serialized) as StoredEnvelope;
  if (stored.version !== 1 || typeof stored.iv !== 'string' || typeof stored.ciphertext !== 'string') throw new Error('EMAIL_OUTBOX_PAYLOAD_INVALID');
  const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: unbase64(stored.iv)}, await encryptionKey(env), unbase64(stored.ciphertext));
  const envelope = JSON.parse(decoder.decode(plaintext)) as CredentialEnvelope;
  if (!envelope.eventId || !envelope.schoolId || !envelope.recipient || !envelope.password) throw new Error('EMAIL_OUTBOX_PAYLOAD_INVALID');
  return envelope;
}
export function credentialEmailStatement(db: D1Database, envelope: CredentialEnvelope, encryptedPayload: string) {
  return db.prepare(`INSERT INTO outbox(id,school_id,event_type,aggregate_id,payload_json,status,attempts,scheduled_at,created_at)
    VALUES(?,?,?,?,?,'pending',0,unixepoch(),unixepoch())`).bind(envelope.eventId, envelope.schoolId, 'email_credentials', envelope.aggregateId, encryptedPayload);
}
function retryAt(now: number, attempts: number) { return now + Math.min(3600, 30 * (2 ** Math.max(0, attempts - 1))); }
function errorCategory(error: unknown) {
  const message = String(error);
  if (message.includes('NOT_CONFIGURED')) return 'configuration';
  if (message.includes('PAYLOAD')) return 'payload';
  if (message.includes('suppression') || message.includes('recipient')) return 'recipient';
  return 'provider';
}
// Claim one event at a time. A durable send-intent means an expired lease has
// an uncertain provider result and must never be resent automatically.
export async function claimCredentialEmail(db: D1Database, now: number): Promise<OutboxRow | null> {
  await db.prepare(`UPDATE outbox SET status='dead_letter',last_error='PROVIDER_ACCEPTANCE_UNKNOWN',lease_id=NULL,lease_until=NULL
    WHERE event_type='email_credentials' AND status='processing' AND lease_until<=? AND last_error='EMAIL_SEND_STARTED'`).bind(now).run();
  return db.prepare(`UPDATE outbox SET status='processing',lease_id=?,lease_until=?,attempts=attempts+1,last_error=NULL
    WHERE id=(SELECT id FROM outbox WHERE event_type='email_credentials'
      AND ((status='pending' AND scheduled_at<=?) OR (status='processing' AND lease_until<=?))
      ORDER BY scheduled_at,created_at LIMIT 1)
    RETURNING id,school_id,payload_json,attempts,lease_id`).bind(crypto.randomUUID(),now+LEASE_SECONDS,now,now).first<OutboxRow>();
}
export async function dispatchCredentialEmails(env: Env, now?: number) {
  if (!env.DB || !env.EMAIL || env.EMAIL_DELIVERY_ENABLED === 'false') return {processed:0, skipped:true, held:0};
  let processed=0, held=0;
  for(let count=0;count<20;count++) {
    const clock=()=>now??Math.floor(Date.now()/1000);
    const row=await claimCredentialEmail(env.DB,clock());
    if(!row)break;
    let sendStarted=false;
    try {
      const envelope=await decryptCredentialEnvelope(env,row.payload_json);
      if(envelope.eventId!==row.id||envelope.schoolId!==row.school_id)throw new Error('EMAIL_OUTBOX_PAYLOAD_INVALID');
      const started=await env.DB.prepare(`UPDATE outbox SET last_error='EMAIL_SEND_STARTED',lease_until=?
        WHERE id=? AND event_type='email_credentials' AND status='processing' AND lease_id=? AND lease_until>?
        RETURNING id`).bind(clock()+LEASE_SECONDS,row.id,row.lease_id,clock()).first();
      if(!started)continue; // Revocation or another consumer invalidated ownership.
      sendStarted=true;
      const result=await sendCredentialsEmail(env,envelope);
      if(result.status!=='sent'||!result.messageId)throw new Error('PROVIDER_ACCEPTANCE_UNKNOWN');
      const stored=await env.DB.prepare(`UPDATE outbox SET status='completed',payload_json='{}',lease_id=NULL,lease_until=NULL,last_error=NULL,completed_at=unixepoch(),provider_message_id=?
        WHERE id=? AND lease_id=? AND status='processing' RETURNING id`).bind(result.messageId,row.id,row.lease_id).first();
      if(stored)processed++;
    } catch(error) {
      // Any exception after send-intent may have followed provider acceptance.
      // Even a failed acknowledgement must not cause a duplicate email.
      const terminal=sendStarted||row.attempts>=MAX_ATTEMPTS||errorCategory(error)==='payload';
      if(sendStarted)held++;
      await env.DB.prepare(`UPDATE outbox SET status=?,lease_id=NULL,lease_until=NULL,last_error=?,scheduled_at=?
        WHERE id=? AND lease_id=? AND status='processing'`).bind(terminal?'dead_letter':'pending',sendStarted?'PROVIDER_ACCEPTANCE_UNKNOWN':errorCategory(error),terminal?clock():retryAt(clock(),row.attempts),row.id,row.lease_id).run();
    }
  }
  return {processed,skipped:false,held};
}
export const scheduledEmailDispatcher: ExportedHandlerScheduledHandler<Env> = async (_controller,env) => {
  const stats=await dispatchCredentialEmails(env);
  console.log(JSON.stringify({event:'credential_dispatch',release:env.APP_RELEASE,...stats}));
};

function maskEmail(value: string | null) {
  if (!value) return null;
  const [local, domain] = value.split('@');
  if (!domain) return '••••';
  return `${local.slice(0, 2)}•••@${domain}`;
}

export function registerEmailDeliveryStatus(app: Hono<AppEnv>) {
  app.get('/api/admin/email-deliveries', requireAuth, async c => {
    const user = requireRole(c, 'admin');
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || 50)));
    const rows = await db(c).prepare(`SELECT o.id,o.aggregate_id AS aggregateId,o.status,o.attempts,o.last_error AS lastError,
      o.scheduled_at AS scheduledAt,o.created_at AS createdAt,o.completed_at AS completedAt,o.provider_message_id AS providerMessageId,
      u.full_name AS fullName,u.email,u.user_type AS role
      FROM outbox o LEFT JOIN users u ON u.id=o.aggregate_id AND u.school_id=o.school_id
      WHERE o.school_id=? AND o.event_type='email_credentials' ORDER BY o.created_at DESC LIMIT ?`).bind(user.school_id, limit).all<Record<string, unknown>>();
    return c.json({data: rows.results.map(row => ({...row, email: maskEmail(typeof row.email === 'string' ? row.email : null)}))});
  });
}
