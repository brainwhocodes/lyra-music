import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '~/server/db';
import { users } from '~/server/db/schema';
import { hashPassword } from '~/server/utils/auth';
import login from '~/server/api/auth/login.post';
import { migrateTestDatabase } from '../helpers/database';
import { serveHandler } from '../helpers/http';

describe('login over HTTP with real SQLite and password hashes', () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'local-test-secret-not-for-real-accounts' }));
    migrateTestDatabase(db.$client);
    await db.insert(users).values({ email: 'listener@example.test', name: 'Listener', passwordHash: await hashPassword('correct password') });
    server = await serveHandler('/api/auth/login', login);
  });
  afterAll(async () => { await server?.close(); db.$client.close(); vi.unstubAllGlobals(); });
  const request = (password: string) => fetch(`${server.url}/api/auth/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'listener@example.test', password }),
  });

  it('rejects an incorrect password without issuing a session', async () => {
    const response = await request('incorrect password');
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(await response.json()).not.toHaveProperty('token');
  });
  it('accepts the correct password and sets an HTTP-only cookie', async () => {
    const response = await request('correct password');
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(await response.json()).toHaveProperty('token');
  });
});
