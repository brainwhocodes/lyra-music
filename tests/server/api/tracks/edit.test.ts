import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { serveHandler } from '../../../helpers/http';
// Metadata enrichment is irrelevant to the unauthenticated request contract.
vi.mock('~/server/utils/scanner/db-operations', () => ({ dbOperations: {} }));
import editTrack from '~/server/api/tracks/[trackId]/index.put';

describe('PUT /api/tracks/:trackId', () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  beforeAll(async () => { server = await serveHandler('/api/tracks/:trackId', editTrack); });
  afterAll(async () => { await server?.close(); });
  it('requires authentication before editing a track', async () => {
    const response = await fetch(`${server.url}/api/tracks/123`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Test' }),
    });
    expect(response.status).toBe(401);
  });
});
