import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { $fetch } from 'ofetch';
import { db } from '~/server/db';
import { podcasts, podcastSubscriptions, users } from '~/server/db/schema';
import { generateToken } from '~/server/utils/auth';
import subscribe from '~/server/api/podcasts/index.post';
import episodes from '~/server/api/podcasts/[podcastId]/episodes.get';
import { migrateTestDatabase } from '../helpers/database';

describe('podcast subscription and episodes with an actual RSS HTTP publisher', () => {
  let publisher: ReturnType<typeof createServer>, api: ReturnType<typeof createServer>, feedOrigin: string, origin: string;
  const token = () => generateToken({ userId: 'listener', name: 'Listener', email: 'listener@example.test' });
  const xml = () => `<?xml version="1.0"?><rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><title>Local conversations</title><description>Original test feed</description><item><title>A quiet afternoon</title><description>Original episode description</description><pubDate>Sun, 18 Oct 2026 10:00:00 GMT</pubDate><enclosure url="${feedOrigin}/episode.mp3" type="audio/mpeg" length="123" /><itunes:duration>00:12</itunes:duration><guid>original-episode</guid></item></channel></rss>`;
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'podcast-integration-secret-not-for-real-accounts' }));
    // Use real ofetch content-type inference, not a stubbed XML return value.
    vi.stubGlobal('$fetch', $fetch);
    db.$client.pragma('foreign_keys = ON'); migrateTestDatabase(db.$client);
    db.insert(users).values({ userId: 'listener', name: 'Listener', email: 'listener@example.test', passwordHash: 'unused' }).run();
    publisher = createServer((request, response) => {
      response.setHeader('content-type', request.url === '/xml' ? 'application/xml' : 'application/rss+xml; charset=utf-8');
      response.end(xml());
    });
    await new Promise<void>(resolve => publisher.listen(0, '127.0.0.1', resolve));
    feedOrigin = `http://127.0.0.1:${(publisher.address() as { port: number }).port}`;
    const router = createRouter().post('/api/podcasts', subscribe).get('/api/podcasts/:podcastId/episodes', episodes);
    api = createServer(toNodeListener(createApp().use(router)));
    await new Promise<void>(resolve => api.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(api.address() as { port: number }).port}`;
  });
  beforeEach(() => { db.delete(podcastSubscriptions).run(); db.delete(podcasts).run(); });
  afterAll(async () => {
    for (const server of [api, publisher]) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
    db.$client.close(); vi.unstubAllGlobals();
  });
  it.each(['/rss', '/xml'])('subscribes to %s content and persists the parsed metadata and subscription', async path => {
    const response = await fetch(origin + '/api/podcasts', { method: 'POST', headers: { authorization: 'Bearer ' + token(), 'content-type': 'application/json' }, body: JSON.stringify({ feedUrl: feedOrigin + path }) });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result).toMatchObject({ title: 'Local conversations', description: 'Original test feed', feedUrl: feedOrigin + path });
    expect(db.select().from(podcastSubscriptions).all()).toHaveLength(1);
    expect(db.select().from(podcasts).get()?.podcastId).toBe(result.podcastId);
  });
  it('refreshes real RSS episodes with usable enclosure and duration', async () => {
    db.insert(podcasts).values({ podcastId: 'local', title: 'Local conversations', feedUrl: feedOrigin + '/rss' }).run();
    const response = await fetch(origin + '/api/podcasts/local/episodes', { headers: { authorization: 'Bearer ' + token() } });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({ podcastId: 'local', title: 'A quiet afternoon', audioUrl: feedOrigin + '/episode.mp3', duration: 12, guid: 'original-episode' })]);
  });
});
