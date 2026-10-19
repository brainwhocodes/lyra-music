import { readFile, writeFile, mkdir, realpath, lstat, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import Database from 'better-sqlite3';
import { chromium, expect } from '@playwright/test';

// This opt-in harness operates the real local account. All credentials,
// screenshots and track-specific evidence remain in the ignored directory.
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const directory = join(root, '.test-data/local-listener');
const accountPath = join(directory, 'account.json');
async function canonical(path) {
  const actual = await realpath(path);
  const same = process.platform === 'win32' ? actual.toLowerCase() === path.toLowerCase() : actual === path;
  if (!same || (await lstat(path)).isSymbolicLink()) throw new Error('Local verification path was redirected');
  return path;
}
await canonical(join(root, '.test-data'));
await canonical(directory);
await canonical(accountPath);
const account = JSON.parse(await readFile(accountPath, 'utf8'));
async function saveAccount() {
  await canonical(accountPath);
  const temporary = `${accountPath}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify(account, null, 2), { flag: 'wx', mode: 0o600 });
  await rename(temporary, accountPath);
}
const baseURL = process.env.LYRA_LOCAL_URL || 'http://127.0.0.1:3000';
const origin = new URL(baseURL);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname) || origin.username || origin.password) throw new Error('A loopback URL without embedded credentials is required');
const database = new Database(account.databasePath, { readonly: true, fileMustExist: true });
const owned = database.prepare('SELECT t.track_id,t.album_id,t.title,t.file_path,t.duration,a.title album_title FROM tracks t JOIN albums a ON a.album_id=t.album_id WHERE a.user_id=?').all(account.userId);
if (owned.length !== 37) throw new Error('Expected the verified local 37-track library');
const artistSeeds = database.prepare('SELECT DISTINCT ar.artist_id,ar.name FROM artists ar JOIN album_artists aa ON aa.artist_id=ar.artist_id JOIN albums a ON a.album_id=aa.album_id WHERE a.user_id=? ORDER BY ar.name LIMIT 2').all(account.userId);
const report = { startedAt: new Date().toISOString(), baseURL, libraryTracks: owned.length, stations: [], noListeningHistorySeeded: true };
const verification = join(directory, 'verification');
await mkdir(verification).catch(error => { if (error.code !== 'EEXIST') throw error; });
await canonical(verification);
const output = join(verification, `${Date.now()}-${randomBytes(4).toString('hex')}`);
await mkdir(output);
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ baseURL, viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  // Deliberately no tracing/video/screenshot around authentication.
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  const me = await page.request.post('/api/auth/me');
  if (!me.ok()) throw new Error('Actual UI login did not establish a session');

  if (process.argv.includes('--stations')) {
    const response = await page.request.get('/api/radio-stations');
    if (!response.ok()) throw new Error('Station listing failed');
    const stations = await response.json();
    account.stationIds ||= [];
    for (let index = 0; index < artistSeeds.length; index++) {
      const seed = artistSeeds[index];
      const name = `${seed.name} radio`;
      let station;
      if (account.stationIds[index]) {
        station = stations.find(item => item.channelId === account.stationIds[index] && item.userId === account.userId);
        if (!station) throw new Error('A previously created station was removed; refusing to recreate it');
      } else {
        // Recover only this account's identical station after interrupted setup.
        station = stations.find(item => item.userId === account.userId && item.name === name && item.radioChannelArtists.length === 1 && item.radioChannelArtists[0].artistId === seed.artist_id);
        if (!station) {
          const created = await page.request.post('/api/radio-stations', { data: { name, artistIds: [seed.artist_id], genreIds: [] } });
          if (!created.ok()) throw new Error('Artist-seeded station creation failed');
          station = await created.json();
        }
        account.stationIds[index] = station.channelId;
        await saveAccount();
      }
      const queue = await page.request.get(`/api/radio-stations/${station.channelId}/tracks`);
      if (!queue.ok()) throw new Error('Station queue failed');
      const tracks = await queue.json();
      if (!tracks.length || tracks.some(track => !owned.some(local => local.track_id === track.trackId))) throw new Error('Station queue is empty or outside the owned library');
      report.stations.push({ id: station.channelId, tracks: tracks.length });
    }
  }

  if (process.argv.includes('--models')) {
    await page.goto('/explore');
    const index = page.getByRole('region', { name: 'Local music index', exact: true });
    await expect(index).toContainText(/\d+ of 37 tracks indexed/);
    const update = page.getByRole('button', { name: /^(Index your library|Update local index)$/ });
    if (await update.isVisible()) await update.click();
    await expect(index).toContainText('37 of 37 tracks indexed', { timeout: 300000 });
    await expect(index).toHaveAttribute('aria-busy', 'false');
    const status = await (await page.request.get('/api/intelligence/status')).json();
    if (status.indexedTracks !== 37 || status.pendingTracks !== 0 || status.dimensions !== 256) throw new Error('Real local index did not complete');
    const selected = owned[0];
    await page.getByLabel('Describe the music you want', { exact: true }).fill(selected.album_title);
    const searchResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/search', { timeout: 300000 });
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    const search = await searchResponse;
    if (!search.ok()) throw new Error('Semantic search failed');
    const results = await search.json();
    if (!results.tracks.length || results.tracks.some(track => !Number.isFinite(track.score) || !owned.some(local => local.track_id === track.trackId))) throw new Error('Invalid semantic search result');
    const region = page.getByRole('region', { name: 'Search results', exact: true });
    await expect(region.getByRole('article')).toHaveCount(results.tracks.length);
    const first = results.tracks[0];
    const card = region.getByRole('article', { name: first.title, exact: true });
    const tagsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/tags', { timeout: 300000 });
    await card.getByRole('button', { name: `Show suggested tags for ${first.title}`, exact: true }).click();
    const tags = await tagsResponse;
    if (!tags.ok()) throw new Error('Suggested tags failed');
    const tagged = await tags.json();
    if (tagged.trackId !== first.trackId || tagged.tags.some(tag => !Number.isFinite(tag.score) || tag.source !== 'embeddinggemma-taxonomy')) throw new Error('Invalid suggested tags');
    await expect(card).toContainText('Suggestions do not change your library.');
    await page.screenshot({ path: join(output, 'search-tags.png'), fullPage: true });
    report.intelligence = { indexed: 37, dimensions: status.dimensions, searchResults: results.tracks.length, tags: tagged.tags.length };

    const selection = JSON.parse(await readFile(join(root, '.test-data/private-albums/model-selection.json'), 'utf8'));
    const vocal = owned.find(track => resolve(track.file_path) === resolve(selection.sourcePath));
    if (!vocal) throw new Error('Verified vocal candidate is missing from this account');
    report.lyrics = { trackId: vocal.track_id, albumId: vocal.album_id };
    const existing = await page.request.get(`/api/tracks/${vocal.track_id}/lyrics`);
    if (existing.ok()) {
      const saved = await existing.json();
      report.lyrics = { ...report.lyrics, reused: true, source: saved.source, segments: saved.lyricsJson.length };
    } else {
      if (existing.status() !== 404) throw new Error('Existing lyrics could not be checked safely');
      await page.goto(`/albums/${vocal.album_id}`);
      const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: `Play ${vocal.title}`, exact: true }) });
      await row.getByRole('button', { name: 'Open options menu', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Lyrics', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: `Edit Lyrics for ${vocal.title}`, exact: true });
      await expect(dialog.getByRole('button', { name: 'Generate Lyrics', exact: true })).toBeEnabled();
      const generatedResponse = page.waitForResponse(response => new URL(response.url()).pathname === `/api/tracks/${vocal.track_id}/lyrics/generate`, { timeout: 910000 });
      await dialog.getByRole('button', { name: 'Generate Lyrics', exact: true }).click();
      const generated = await generatedResponse;
      if (!generated.ok()) throw new Error(`Whole-track Whistle generation returned ${generated.status()}`);
      const result = await generated.json();
      if (result.source !== 'whistle_transcription' || !result.lyricsJson.length) throw new Error('Whistle did not return a timestamped result');
      await expect(dialog.getByLabel('Lyrics for line 1', { exact: true })).not.toHaveValue('');
      const persisted = await page.request.get(`/api/tracks/${vocal.track_id}/lyrics`);
      if (!persisted.ok() || JSON.stringify((await persisted.json()).lyricsJson) !== JSON.stringify(result.lyricsJson)) throw new Error('Generated lyrics did not persist');
      // Generate already persists the actual source. Cancel closes the editor;
      // a redundant manual Save would relabel this as an edited transcript.
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      report.lyrics = { ...report.lyrics, reused: false, source: result.source, segments: result.lyricsJson.length };
    }
    // Lyrics change the model's metadata fingerprint: refresh through the UI.
    await page.goto('/explore');
    await expect(index).toHaveAttribute('aria-busy', 'false');
    if (await update.isVisible()) {
      await update.click();
      await expect(index).toContainText('37 of 37 tracks indexed', { timeout: 300000 });
      await expect(index).toHaveAttribute('aria-busy', 'false');
    }
  }
  report.completedAt = new Date().toISOString();
  report.status = 'passed';
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, stations: report.stations.length, intelligence: report.intelligence,
    lyrics: report.lyrics && { source: report.lyrics.source, segments: report.lyrics.segments, reused: report.lyrics.reused }, evidence: output }));
} catch (error) {
  await writeFile(join(output, 'failure.json'), JSON.stringify({ ...report, status: 'failed', error: String(error) }, null, 2));
  console.error(`Local verification failed. Private diagnostic: ${join(output, 'failure.json')}`);
  process.exitCode = 1;
} finally { await browser.close(); database.close(); }
