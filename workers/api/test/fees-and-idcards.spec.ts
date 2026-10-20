import { describe, it, expect, vi } from 'vitest';
import app from '../src/index.js';
import { signJwt } from '../src/security.js';

const secret = 'test-secret-with-at-least-32-bytes-long';

async function makeToken(role = 'admin') {
  const now = Math.floor(Date.now() / 1000);
  return await signJwt({
    sub: 'test-admin-id',
    sid: 'test-session-id',
    schoolId: 'test-school-id',
    schoolCode: 'RAJESH',
    userType: role,
    fullName: 'Admin User',
    iat: now,
    exp: now + 3600,
    iss: 'gurukull-edge',
    aud: 'gurukull-clients'
  }, secret);
}

describe('Fees & ID Cards Management Endpoints', () => {
  it('loads fee invoices list cleanly with empty dataset (zero dummy data)', async () => {
    const token = await makeToken();
    const DB = {
      prepare: (sql: string) => {
        const stmt = {
          bind: (..._args: any[]) => stmt,
          first: async () => {
            if (sql.includes('FROM schools')) return { id: 'test-school-id', code: 'RAJESH', status: 'active', name: 'Rajesh School' };
            if (sql.includes('FROM sessions ss')) return { id: 'test-admin-id', school_id: 'test-school-id', user_type: 'admin', full_name: 'Admin User' };
            return null;
          },
          all: async () => ({ results: [], success: true }),
          run: async () => ({ success: true })
        };
        return stmt;
      },
      batch: async () => [
        { success: true, results: [{ total: 0 }] },
        { success: true, results: [] }
      ]
    };

    const res = await app.request('https://api.gurukull.in/api/admin/fees/invoices', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`
      }
    }, { DB, JWT_SECRET: secret } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(0);
  });

  it('rejects the old unversioned non-idempotent payment request without writing', async () => {
    const token = await makeToken();
    const batchMock = vi.fn(async () => [
      { success: true, results: [] },
      { success: true, results: [] }
    ]);

    const DB = {
      prepare: (sql: string) => {
        const stmt = {
          bind: (..._args: any[]) => stmt,
          first: async () => {
            if (sql.includes('FROM schools')) return { id: 'test-school-id', code: 'RAJESH', status: 'active', name: 'Rajesh School' };
            if (sql.includes('FROM sessions ss')) return { id: 'test-admin-id', school_id: 'test-school-id', user_type: 'admin', full_name: 'Admin User' };
            if (sql.includes('FROM fee_invoices')) {
              return { id: 'inv_123', student_id: 'st_123', amount_paise: 500000, status: 'unpaid' };
            }
            if (sql.includes('FROM fee_payments')) {
              return { totalPaid: 0 };
            }
            return null;
          },
          all: async () => ({ results: [], success: true }),
          run: async () => ({ success: true })
        };
        return stmt;
      },
      batch: batchMock
    };

    const res = await app.request('https://api.gurukull.in/api/admin/fees/payments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        invoiceId: 'inv_123',
        amount: 2500,
        paymentMode: 'cash'
      })
    }, { DB, JWT_SECRET: secret } as any);

    expect(res.status).toBe(422);
    const body:any=await res.json();
    expect(body.error).toBe('VALIDATION_FAILED');
    expect(batchMock).not.toHaveBeenCalled();
  });

  it('provides id-cards options containing classes and school info', async () => {
    const token = await makeToken();
    const DB = {
      prepare: (sql: string) => {
        const stmt = {
          bind: (..._args: any[]) => stmt,
          first: async () => {
            if (sql.includes('FROM schools')) return { id: 'test-school-id', code: 'RAJESH', status: 'active', name: 'Rajesh School' };
            if (sql.includes('FROM sessions ss')) return { id: 'test-admin-id', school_id: 'test-school-id', user_type: 'admin', full_name: 'Admin User' };
            return null;
          },
          all: async () => ({ results: [], success: true }),
          run: async () => ({ success: true })
        };
        return stmt;
      },
      batch: async () => [
        { success: true, results: [{ address: 'School Road', board: 'CBSE', logo_url: null }] },
        { success: true, results: [{ id: 'cls_1', name: 'Class 10', studentCount: 45 }] },
        { success: true, results: [{ name: '2026-2027' }] }
      ]
    };

    const res = await app.request('https://api.gurukull.in/api/admin/id-cards/options', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`
      }
    }, { DB, JWT_SECRET: secret } as any);

    expect(res.status).toBe(200);
    const body: any = await res.json();
    expect(body.status).toBe('success');
    expect(body.data.school.board).toBeNull();
    expect(body.data.classes).toEqual([
      { value: 'cls_1', label: 'Class 10', studentCount: 45 }
    ]);
  });
});
