import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveHandler } from '../../../helpers/http';
import subscribe from '~/server/api/podcasts/index.post';

describe('POST /api/podcasts', () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  beforeAll(async () => { server = await serveHandler('/api/podcasts', subscribe); });
  afterAll(async () => { await server?.close(); });
  it('requires authentication before fetching a podcast feed', async () => {
    const response = await fetch(`${server.url}/api/podcasts`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ feedUrl: 'https://example.com/feed' }),
    });
    expect(response.status).toBe(401);
  });
});
