import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes, scryptSync } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { parseFile } from 'music-metadata';
import { startPodcastFixtureServer } from './podcast-fixture-server.mjs';

// Only a newly allocated temporary database is seeded; never use DATABASE_URL from .env.
const directory = await mkdtemp(join(tmpdir(), 'lyra-e2e-'));
const databasePath = join(directory, 'library.sqlite');
const sqlite = new Database(databasePath);
migrate(drizzle(sqlite), { migrationsFolder: resolve('server/db/migrations') });
const now = new Date().toISOString();
const podcastPublisher = await startPodcastFixtureServer();
const salt = randomBytes(16);
const passwordHash = `$scrypt$ln=14,r=8,p=1$${salt.toString('base64')}$${scryptSync('LocalMusicTest123!', salt, 64).toString('base64')}`;
sqlite.prepare('INSERT INTO users (user_id,name,email,verified,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run('e2e-listener', 'Local listener', 'listener@example.test', 1, passwordHash, now, now);
sqlite.prepare('INSERT INTO artists (artist_id,name,created_at,updated_at) VALUES (?,?,?,?)').run('scott-buckley', 'Scott Buckley', now, now);
sqlite.prepare('INSERT INTO artist_users (artist_user_id,artist_id,user_id,created_at) VALUES (?,?,?,?)').run('e2e-artist-user', 'scott-buckley', 'e2e-listener', now);
sqlite.prepare('INSERT INTO genres (genre_id,name,created_at,updated_at) VALUES (?,?,?,?)').run('ambient', 'Ambient', now, now);
sqlite.prepare('INSERT INTO playlists (playlist_id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)').run('local-listening', 'e2e-listener', 'Local listening', now, now);
sqlite.prepare('INSERT INTO discovery_playlists (discovery_playlist_id,user_id,title,type,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('local-discoveries', 'e2e-listener', 'Quiet discoveries', 'new_discoveries', now, now);
sqlite.prepare('INSERT INTO radio_channels (channel_id,user_id,name,dynamic,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('quiet-hours', 'e2e-listener', 'Quiet hours', 1, now, now);
sqlite.prepare('INSERT INTO radio_channel_artists (channel_id,artist_id) VALUES (?,?)').run('quiet-hours', 'scott-buckley');
sqlite.prepare('INSERT INTO radio_channel_genres (channel_id,genre_id) VALUES (?,?)').run('quiet-hours', 'ambient');
sqlite.prepare('INSERT INTO podcasts (podcast_id,feed_url,title,description,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('listening-notes', `${podcastPublisher.origin}/feed.xml`, 'Listening Notes', 'An original local podcast fixture for listening tests.', now, now);
sqlite.prepare('INSERT INTO podcast_subscriptions (subscription_id,user_id,podcast_id,created_at) VALUES (?,?,?,?)').run('local-podcast-subscription', 'e2e-listener', 'listening-notes', now);
const manifest = JSON.parse(await readFile('tests/fixtures/music/manifest.json', 'utf8'));
// The analysis failure journey mutates only this per-run copy. The production
// stream handler still reads a real file, and checked-in audio stays untouched.
const analysisFixturePath = join(directory, 'the-distant-sun.mp3');
const analysisFixtureDescriptor = resolve('.test-data/e2e-audio-fixture.json');
await copyFile(resolve('tests/fixtures/music/audio/the-distant-sun.mp3'), analysisFixturePath);
await mkdir(resolve('.test-data'), { recursive: true });
await writeFile(analysisFixtureDescriptor, JSON.stringify({ filePath: analysisFixturePath }));
for (const [index, track] of manifest.tracks.entries()) {
  const filePath = track.id === 'the-distant-sun' ? analysisFixturePath : resolve('tests/fixtures/music', track.file);
  const metadata = await parseFile(filePath, { duration: true });
  const albumId = `album-${track.id}`;
  sqlite.prepare('INSERT INTO albums (album_id,title,user_id,year,processed_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(albumId, metadata.common.album, 'e2e-listener', metadata.common.year, 1, now, now);
  sqlite.prepare('INSERT INTO album_artists (album_artist_id,album_id,artist_id,is_primary_artist,created_at) VALUES (?,?,?,?,?)').run(`album-artist-${track.id}`, albumId, 'scott-buckley', 1, now);
  sqlite.prepare('INSERT INTO tracks (track_id,title,album_id,track_number,duration,file_path,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').run(track.id, metadata.common.title, albumId, metadata.common.track.no, Math.round(metadata.format.duration), filePath, now, now);
  sqlite.prepare('INSERT INTO artists_tracks (artists_tracks_id,artist_id,track_id,is_primary_artist,created_at,updated_at) VALUES (?,?,?,?,?,?)').run(`artist-track-${track.id}`, 'scott-buckley', track.id, 1, now, now);
  sqlite.prepare('INSERT INTO album_genres (album_genre_id,album_id,genre_id,created_at,updated_at) VALUES (?,?,?,?,?)').run(`album-genre-${track.id}`, albumId, 'ambient', now, now);
  sqlite.prepare('INSERT INTO playlist_tracks (playlist_tracks_id,playlist_id,track_id,"order",added_at,updated_at) VALUES (?,?,?,?,?,?)').run(`playlist-track-${track.id}`, 'local-listening', track.id, index, now, now);
  sqlite.prepare('INSERT INTO discovery_playlist_tracks (discovery_playlist_track_id,discovery_playlist_id,track_id,"order",added_at) VALUES (?,?,?,?,?)').run(`discovery-track-${track.id}`, 'local-discoveries', track.id, index, now);
}
sqlite.prepare('INSERT INTO tracks (track_id,title,duration,file_path,created_at,updated_at) VALUES (?,?,?,?,?,?)').run('spoken-test', 'Original speech test', 4, resolve('tests/fixtures/music/audio/spoken-test.wav'), now, now);
sqlite.close();
console.log(`E2E database: ${databasePath}`);
const development = process.env.LYRA_E2E_DEV === '1';
const command = development
  ? ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', '3100']
  : ['.output/server/index.mjs'];
const child = spawn(process.execPath, command, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: development ? 'development' : 'production', DATABASE_URL: databasePath,
    HOST: '127.0.0.1', PORT: process.env.E2E_PORT || '3100',
    NUXT_JWT_SECRET: 'isolated-e2e-secret-no-real-account',
    NUXT_SECRET_ACCESS_CODE: 'e2e-access',
    NUXT_SCANNER_DISABLE_GENIUS: 'true', SCANNER_DISABLE_GENIUS: 'true',
    GEMINI_API_KEY: '', NUXT_GEMINI_API_KEY: '',
    GENIUS_API_CLIENT_ID: '', GENIUS_API_CLIENT_SECRET: '',
    NUXT_GENIUS_API_CLIENT_ID: '', NUXT_GENIUS_API_CLIENT_SECRET: '',
    RESEND_API_KEY: '',
  },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error); process.exitCode = 1; });
child.on('close', async (code) => {
  // This path comes exclusively from mkdtemp above, never from user configuration.
  await podcastPublisher.close();
  await rm(directory, { recursive: true, force: true });
  await rm(analysisFixtureDescriptor, { force: true });
  process.exitCode = code ?? 0;
});
