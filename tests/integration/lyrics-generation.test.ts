import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp, createRouter, toNodeListener } from 'h3';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { tracks } from '../../server/db/schema';
import { migrateTestDatabase } from '../helpers/database';

const state = vi.hoisted(() => ({ transcribe: vi.fn(), db: undefined as any }));
vi.mock('../../server/db', () => ({ db: state.db }));
vi.mock('../../server/utils/whistle-service', async (original) => ({
  ...await original<typeof import('../../server/utils/whistle-service')>(),
  transcribeAudioWithTimestamps: state.transcribe,
}));

let sqlite: Database.Database;
let server: Server;
let baseURL: string;
const generated = [{ time: '00:00.160', text: 'The music plays.' }];
beforeAll(async () => {
  sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');
  migrateTestDatabase(sqlite);
  state.db = drizzle(sqlite);
  vi.stubGlobal('useRuntimeConfig', () => ({}));
  const handler = (await import('../../server/api/tracks/[trackId]/lyrics/generate.post')).default;
  const app = createApp();
  app.use(createRouter().post('/api/tracks/:trackId/lyrics/generate', handler));
  server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
beforeEach(() => {
  sqlite.exec('DELETE FROM lyrics; DELETE FROM tracks');
  state.db.insert(tracks).values({ trackId: 'track-1', title: 'Speech without artist metadata', filePath: '/music/no-artist.mp3' }).run();
  state.transcribe.mockReset().mockResolvedValue(generated);
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  sqlite.close();
  vi.unstubAllGlobals();
});
const post = () => fetch(`${baseURL}/api/tracks/track-1/lyrics/generate`, { method: 'POST' });

describe('lyrics route with HTTP and real SQLite', () => {
  it('saves the timestamp contract and Whistle provenance even without artist metadata', async () => {
    const response = await post();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ lyricsJson: generated, source: 'whistle_transcription', llmModelUsed: 'Cactus-Compute/whistle' });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM lyrics').get()).toEqual({ count: 1 });
  });
  it('updates existing lyrics atomically without creating duplicates', async () => {
    await post();
    const replacement = [{ time: '00:01.000', text: 'Another line.' }];
    state.transcribe.mockResolvedValue(replacement);
    expect((await post()).status).toBe(200);
    expect(sqlite.prepare('SELECT lyrics_json FROM lyrics').get()).toEqual({ lyrics_json: JSON.stringify(replacement) });
    expect(sqlite.prepare('SELECT COUNT(*) AS count FROM lyrics').get()).toEqual({ count: 1 });
  });
  it('preserves existing lyrics when no speech is recognized', async () => {
    await post();
    const before = sqlite.prepare('SELECT * FROM lyrics').get();
    state.transcribe.mockResolvedValue([]);
    expect((await post()).status).toBe(422);
    expect(sqlite.prepare('SELECT * FROM lyrics').get()).toEqual(before);
  });
  it('preserves lyrics and exposes a useful service status when inference fails', async () => {
    await post();
    const before = sqlite.prepare('SELECT * FROM lyrics').get();
    const { WhistleError } = await import('../../server/utils/whistle-service');
    state.transcribe.mockRejectedValue(new WhistleError('A transcription is already running.', 429));
    expect((await post()).status).toBe(429);
    expect(sqlite.prepare('SELECT * FROM lyrics').get()).toEqual(before);
  });
  it('does not start a model for a missing track', async () => {
    const response = await fetch(`${baseURL}/api/tracks/missing/lyrics/generate`, { method: 'POST' });
    expect(response.status).toBe(404);
    expect(state.transcribe).not.toHaveBeenCalled();
  });
});
