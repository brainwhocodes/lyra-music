import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import { createApp, createRouter, toNodeListener } from 'h3';
import { db } from '~/server/db';
import { lyrics, tracks, users } from '~/server/db/schema';
import { generateToken } from '~/server/utils/auth';
import auth from '~/server/middleware/auth';
import updateLyrics from '~/server/api/tracks/[trackId]/lyrics/index.put';
import { migrateTestDatabase } from '../helpers/database';

describe('manual lyric payload validation over real HTTP and SQLite', () => {
  let server: ReturnType<typeof createServer>, origin: string;
  let token: string;
  const original = [{ time: '00:01.000', text: 'Existing reviewed words.' }];
  const update = (body: unknown) => fetch(origin + '/api/tracks/track/lyrics', {
    method: 'PUT', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'lyric-edit-integration-secret-not-for-real-accounts' }));
    db.$client.pragma('foreign_keys = ON'); migrateTestDatabase(db.$client);
    db.insert(users).values({ userId: 'listener', name: 'Listener', email: 'listener@example.test', passwordHash: 'unused' }).run();
    db.insert(tracks).values({ trackId: 'track', title: 'Test track', filePath: '/shared/track.mp3' }).run();
    token = generateToken({ userId: 'listener', name: 'Listener', email: 'listener@example.test' });
    server = createServer(toNodeListener(createApp().use(auth).use(createRouter().put('/api/tracks/:trackId/lyrics', updateLyrics))));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port;
  });
  beforeEach(() => {
    db.delete(lyrics).run();
    db.insert(lyrics).values({ trackId: 'track', lyricsJson: original, source: 'whistle_transcription', llmModelUsed: 'Cactus-Compute/whistle', rawLlmOutput: 'original source' }).run();
  });
  afterAll(async () => {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    db.$client.close(); vi.unstubAllGlobals();
  });
  it('rejects malformed direct HTTP payloads while preserving every existing lyric field', async () => {
    const before = db.select().from(lyrics).get();
    const malformed = [
      null, {}, { lyricsJson: {} }, { lyricsJson: 'words' }, { lyricsJson: [null] },
      { lyricsJson: [{ time: 2, text: 'Words' }] }, { lyricsJson: [{ time: '00:02.000', text: 2 }] },
      { lyricsJson: [{ time: 'NaN', text: 'Words' }] }, { lyricsJson: [{ time: '-01:00', text: 'Words' }] },
      { lyricsJson: [{ time: '00:61.000', text: 'Words' }] }, { lyricsJson: [{ time: '1:99:00', text: 'Words' }] },
      { lyricsJson: [{ time: '00:02', text: 'Later' }, { time: '00:01', text: 'Earlier' }] },
    ];
    for (const body of malformed) {
      expect((await update(body)).status, JSON.stringify(body)).toBe(400);
      expect(db.select().from(lyrics).get()).toEqual(before);
    }
  });
  it('accepts minutes past 59 and hour timestamps, preserving line text and one record', async () => {
    const lines = [{ time: '00:00.125', text: ' First line ' }, { time: '60:00.125', text: '' }, { time: '01:00:01.000', text: 'Later line.' }];
    const response = await update({ lyricsJson: lines });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ updatedLyrics: { lyricsJson: lines, source: 'user_edited', llmModelUsed: null, rawLlmOutput: null } });
    expect(db.select().from(lyrics).all()).toHaveLength(1);
  });
  it('allows an explicit empty array to clear lyrics without deleting the row', async () => {
    const id = db.select().from(lyrics).get()!.lyricsId;
    const response = await update({ lyricsJson: [] });
    expect(response.status).toBe(200);
    expect(db.select().from(lyrics).get()).toMatchObject({ lyricsId: id, lyricsJson: [], source: 'user_edited' });
  });
});
