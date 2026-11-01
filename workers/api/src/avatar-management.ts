import type { Hono } from 'hono';
import { boundedBytes, db, requireAuth, requireRole, type ApiContext, type AppEnv } from './context.js';
import { digest, fail } from './security.js';

type AvatarKind = 'students' | 'teachers' | 'staff';

function kind(value: string | undefined): AvatarKind {
  if (value === 'students' || value === 'teachers' || value === 'staff') return value;
  fail(404, 'PERSON_NOT_FOUND');
}

async function target(c: ApiContext, avatarKind: AvatarKind, userId: string) {
  const table = avatarKind === 'staff' ? 'staff_profiles' : avatarKind;
  const row = await db(c).prepare(`
    SELECT u.id AS userId, e.id AS entityId, p.avatar_r2_key AS avatarKey
    FROM ${table} e
    JOIN users u ON u.id=e.user_id AND u.school_id=e.school_id
    LEFT JOIN user_profiles p ON p.user_id=u.id AND p.school_id=u.school_id
    WHERE u.school_id=? AND u.id=? AND u.user_type=?
  `).bind(c.get('user').school_id, userId, avatarKind === 'students' ? 'student' : avatarKind === 'teachers' ? 'teacher' : 'staff').first<{userId:string;entityId:string;avatarKey:string|null}>();
  if (!row) fail(404, 'PERSON_NOT_FOUND');
  return row;
}

export function registerAvatarManagement(app: Hono<AppEnv>) {
  app.get('/api/admin/:kind/:id/avatar', requireAuth, async c => {
    requireRole(c, 'admin', 'superadmin');
    const avatarKind = kind(c.req.param('kind'));
    const row = await target(c, avatarKind, c.req.param('id'));
    if (!row.avatarKey || !c.env.R2_MEDIA) fail(404, 'AVATAR_NOT_FOUND');
    const object = await c.env.R2_MEDIA.get(row.avatarKey);
    if (!object) fail(404, 'AVATAR_NOT_FOUND');
    c.header('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
    c.header('Cache-Control', 'private, no-store');
    c.header('Content-Disposition', 'inline');
    return c.body(object.body);
  });

  app.post('/api/admin/:kind/:id/avatar', requireAuth, async c => {
    const actor = requireRole(c, 'admin', 'superadmin');
    const avatarKind = kind(c.req.param('kind'));
    const row = await target(c, avatarKind, c.req.param('id'));
    if (!c.env.R2_MEDIA) fail(503, 'STORAGE_UNAVAILABLE');
    const mime = (c.req.header('content-type') || '').split(';', 1)[0].toLowerCase();
    if (!['image/jpeg', 'image/png'].includes(mime)) fail(422, 'AVATAR_TYPE_NOT_ALLOWED', 'Choose a JPEG or PNG image for the profile photo.');
    const bytes = await boundedBytes(c, 2 * 1024 * 1024);
    if (!bytes.byteLength) fail(422, 'EMPTY_AVATAR', 'Choose a photo before uploading.');
    const fileId = crypto.randomUUID();
    const extension = mime === 'image/png' ? 'png' : 'jpg';
    const key = `${actor.school_id}/avatars/${avatarKind}/${row.userId}/${fileId}.${extension}`;
    try {
      await c.env.R2_MEDIA.put(key, bytes, { httpMetadata: { contentType: mime } });
      const now = Math.floor(Date.now() / 1000);
      const entityType = avatarKind === 'students' ? 'student' : 'user';
      const accessScope = avatarKind === 'students' ? 'student_private' : 'staff_private';
      const writes = await db(c).batch([
        db(c).prepare(`INSERT INTO files(id,school_id,uploaded_by,r2_key,file_name,mime_type,size_bytes,checksum_sha256,access_scope,entity_type,entity_id,created_at,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'verified')`).bind(fileId, actor.school_id, actor.id, key, `avatar.${extension}`, mime, bytes.byteLength, await digest(bytes), accessScope, entityType, avatarKind === 'students' ? row.entityId : row.userId, now),
        db(c).prepare(`INSERT INTO user_profiles(id,school_id,user_id,avatar_r2_key,created_at,updated_at) VALUES(?,?,?,?,unixepoch(),unixepoch()) ON CONFLICT(user_id) DO UPDATE SET avatar_r2_key=excluded.avatar_r2_key,updated_at=excluded.updated_at`).bind(crypto.randomUUID(), actor.school_id, row.userId, key),
      ]);
      if (writes.some(write => !write.success)) throw new Error('AVATAR_METADATA_WRITE_FAILED');
      if (row.avatarKey && row.avatarKey !== key) await c.env.R2_MEDIA.delete(row.avatarKey).catch(() => undefined);
      return c.json({ status: 'success', message: 'Profile photo saved.', data: { fileId, avatarPath: `/api/admin/${avatarKind}/${row.userId}/avatar` } });
    } catch (error) {
      await c.env.R2_MEDIA.delete(key).catch(() => undefined);
      if (error instanceof Error && error.message === 'AVATAR_METADATA_WRITE_FAILED') fail(503, 'AVATAR_SAVE_FAILED', 'The photo was uploaded but its school record could not be saved. Try again.');
      throw error;
    }
  });
}
