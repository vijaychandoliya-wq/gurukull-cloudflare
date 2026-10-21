import { describe, expect, it } from 'vitest';
import app from '../src/index.js';

describe('platform onboarding boundaries', () => {
  it('does not expose school inventory without an authenticated platform operator', async () => {
    const response = await app.request('https://admin.gurukull.in/platform/v1/schools');
    expect(response.status).toBe(401);
    expect((await response.json() as { error: string }).error).toBe('UNAUTHORIZED');
  });

  it('rejects a platform login before touching the database when the access-key shape is invalid', async () => {
    const response = await app.request('https://admin.gurukull.in/platform/v1/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'platform@example.com', password: 'password' }),
    }, { ADMIN_ACCESS_KEY_CPU_VERIFIED: 'true' } as any);
    expect(response.status).toBe(422);
    expect((await response.json() as { error: string }).error).toBe('INVALID_PLATFORM_CREDENTIAL');
  });

  it('allows the admin host in configured CORS without making the health endpoint claim auth readiness', async () => {
    const response = await app.request('https://admin.gurukull.in/health', {
      headers: { Origin: 'https://admin.gurukull.in' },
    }, {
      ALLOWED_ORIGINS: 'https://admin.gurukull.in',
      APP_RELEASE: 'platform-onboarding-test',
    } as any);
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://admin.gurukull.in');
    expect((await response.json() as { release: string }).release).toBe('platform-onboarding-test');
  });
});
