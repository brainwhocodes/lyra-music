import { test, expect, type Page, type Request, type Locator } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { audit, checkAccessibility, checkLayout, navigate } from '../e2e/helpers';
import { playbackPosition, positionValue, expectTrackWaveform } from '../e2e/player-controls';

const report = JSON.parse(readFileSync(join(process.env.LYRA_PRIVATE_RUN!, 'import-report.json'), 'utf8'));
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(report.credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(report.credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: 'Albums', exact: true })).toBeVisible();
}

function guard(page: Page) {
  const errors: string[] = [];
  const streams: Request[] = [];
  const failed: Request[] = [];
  const completed = new Set<Request>();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/\/api\/tracks\/[^/]+\/stream$/.test(request.url())) streams.push(request); });
  page.on('requestfailed', request => {
    if (!request.url().startsWith('http://127.0.0.1:3200')) return;
    if (request.failure()?.errorText === 'net::ERR_ABORTED' && (request.isNavigationRequest() || /\/api\/tracks\/[^/]+\/play$/.test(request.url()))) return;
    failed.push(request);
  });
  page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:3200') && response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
  return {
    async waveform(track: any, player: Locator) {
      await expect(player.getByRole('heading', { name: track.title, exact: true })).toBeVisible();
      const status = player.getByRole('status').filter({ hasText: /^Waveform ready$/ });
      await expect(status).toHaveCount(1, { timeout: 25_000 });
      const matching = streams.filter(request => new URL(request.url()).pathname === `/api/tracks/${track.id}/stream`);
      expect(matching.length).toBeGreaterThan(0);
      // Ogg seeking legitimately opens several range readers, unlike tiny MP3
      // fixtures. Qualify each concrete response against the original file.
      for (const request of matching) {
        const response = await request.response();
        expect(response?.status()).toBe(206);
        const range = response!.headers()['content-range'].match(/^bytes (\d+)-(\d+)\/(\d+)$/);
        expect(range).not.toBeNull();
        expect(Number(range![3])).toBe(statSync(track.filePath).size);
        expect(Number(range![1])).toBeLessThanOrEqual(Number(range![2]));
        expect(Number(range![2])).toBeLessThan(Number(range![3]));
      }
      await expectTrackWaveform(player);
      for (const request of matching) completed.add(request);
      await expect(playbackPosition(player)).toBeEnabled();
      return true;
    },
    finish() {
      // Mediabunny may cancel an already consumed range before reader EOF.
      // Only a specific request with a real complete waveform/206 proof qualifies.
      const unproven = failed.filter(request => !(completed.has(request) && request.failure()?.errorText === 'net::ERR_ABORTED'));
      expect(unproven.map(request => `${request.method()} ${request.url()} ${request.failure()?.errorText}`)).toEqual([]);
      expect(errors).toEqual([]);
    },
  };
}

async function openPlayer(page: Page, title: string) {
  await page.getByRole('button', { name: /^Open full screen player:/ }).click();
  const player = page.getByRole('dialog', { name: title, exact: true });
  await expect(player).toBeVisible();
  return player;
}

test('private albums retain Unicode metadata and covers, support search, real Ogg playback and long native seeking', async ({ page }, info) => {
  const checks = guard(page);
  await login(page);
  // Exercise authenticated original-file transport for the whole corpus, not
  // only the four representative native-player journeys below.
  for (const track of report.tracks) {
    const original = readFileSync(track.filePath);
    const response = await page.request.get(`/api/tracks/${track.id}/stream`, { headers: { Range: 'bytes=0-255' } });
    expect(response.status()).toBe(206);
    expect(await response.body()).toEqual(original.subarray(0, 256));
    expect(response.headers()['content-type']).toContain('audio/ogg');
  }
  const invalidRange = await page.request.get(`/api/tracks/${report.tracks[0].id}/stream`, { headers: { Range: 'bytes=999999999-' } });
  expect(invalidRange.status()).toBe(416);
  await navigate(page, 'Albums');
  for (const album of report.albums) await expect(page.getByRole('heading', { name: album.title, exact: true })).toBeVisible();
  await audit(page, info, 'private-albums');
  const results = [];
  for (const album of report.albums) {
    const tracks = report.tracks.filter((track: any) => track.albumId === album.id);
    const track = [...tracks].sort((a: any, b: any) => b.exactDuration - a.exactDuration)[0];
    await page.goto('/library');
    await page.getByRole('textbox', { name: 'Search library', exact: true }).fill(album.title);
    const search = page.getByRole('region', { name: 'Library search results', exact: true });
    await search.getByRole('link', { name: album.title, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/albums/${album.id}$`));
    await expect(page.getByRole('heading', { name: album.title, exact: true })).toBeVisible();
    for (const item of tracks) await expect(page.getByRole('button', { name: `Play ${item.title}`, exact: true })).toBeVisible();
    // Cover selector is grounded in the imported public URL; read decoded pixels,
    // not just HTTP existence. All private art evidence remains in ignored output.
    const cover = page.getByRole('img', { name: album.title + ' cover', exact: true });
    await expect(cover).toHaveCount(1);
    await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(10);
    const bytes = readFileSync(track.filePath);
    const range = await page.request.get(`/api/tracks/${track.id}/stream`, { headers: { Range: 'bytes=0-255' } });
    expect(range.status()).toBe(206);
    expect(await range.body()).toEqual(bytes.subarray(0, 256));
    expect(range.headers()['content-type']).toContain('audio/ogg');
    const audio = page.waitForResponse(response => new URL(response.url()).pathname === `/api/tracks/${track.id}/play` && response.ok());
    await page.getByRole('button', { name: `Play ${track.title}`, exact: true }).click();
    expect((await audio).headers()['content-type']).toContain('audio/');
    const player = await openPlayer(page, track.title);
    const position = playbackPosition(player);
    await expect.poll(() => positionValue(position)).toBeGreaterThan(0.2);
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    const nativeDuration = Number(await position.getAttribute('max'));
    expect(Math.abs(nativeDuration - track.exactDuration)).toBeLessThan(1);
    const ready = await checks.waveform(track, player);
    await position.focus();
    await position.press('End');
    await position.press('ArrowLeft');
    await expect.poll(() => positionValue(position)).toBeGreaterThan(track.exactDuration - 2);
    await position.press('Home');
    await expect(position).toHaveValue('0');
    await player.getByRole('button', { name: 'Play playback', exact: true }).click();
    await expect.poll(() => positionValue(position)).toBeGreaterThan(0.2);
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await checkLayout(page);
    await checkAccessibility(page, info, `private-player-${results.length + 1}`);
    await audit(page, info, `private-player-${results.length + 1}`);
    results.push({ album: results.length + 1, nativeDecoded: true, waveformReady: ready, seconds: nativeDuration });
    await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
    await expect(player).not.toBeVisible();
  }
  await info.attach('aggregate-codec-results', { body: JSON.stringify(results), contentType: 'application/json' });
  checks.finish();
});

test('private tracks can be added, reordered, renamed and removed in a persisted playlist', async ({ page }, info) => {
  const checks = guard(page);
  await login(page);
  const selection = report.albums.slice(0, 3).map((album: any) => report.tracks.find((track: any) => track.albumId === album.id));
  const name = 'Private test playlist ' + info.project.name + ' ' + Date.now();
  await navigate(page, 'Playlists');
  await page.getByRole('button', { name: 'New Playlist', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Create New Playlist', exact: true });
  await create.getByLabel('Playlist Name', { exact: true }).fill(name);
  await create.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(create).not.toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await page.getByRole('button', { name: 'Add tracks', exact: true }).click();
  const add = page.getByRole('dialog', { name: 'Add tracks to playlist', exact: true });
  for (const track of selection) await add.getByRole('checkbox', { name: new RegExp('^' + escaped(track.title) + '(?:\\s|$)') }).check();
  await add.getByRole('button', { name: 'Add selected tracks (3)', exact: true }).click();
  await expect(add).not.toBeVisible();
  await expect(page.getByRole('row')).toHaveCount(3);
  const originalFirst = await page.getByRole('row').first().getByRole('button', { name: /^Play / }).getAttribute('aria-label');
  const title = originalFirst!.replace(/^Play /, '');
  await page.getByRole('button', { name: `Move down ${title}`, exact: true }).click();
  await expect(page.getByRole('row').nth(1)).toContainText(title);
  await page.getByRole('button', { name: 'Rename', exact: true }).click();
  const rename = page.getByRole('dialog', { name: 'Rename Playlist', exact: true });
  await rename.getByLabel('Playlist Name', { exact: true }).fill(name + ' edited');
  await rename.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(rename).not.toBeVisible();
  await expect(page.getByRole('heading', { name: name + ' edited', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: name + ' edited', exact: true })).toBeVisible();
  await expect(page.getByRole('row').nth(1)).toContainText(title);
  await audit(page, info, 'private-playlist');
  await checkAccessibility(page, info, 'private-playlist');
  await page.getByRole('row').filter({ has: page.getByRole('button', { name: `Play ${title}`, exact: true }) }).getByRole('button', { name: 'Open options menu', exact: true }).click();
  await page.getByRole('button', { name: 'Remove from Playlist', exact: true }).click();
  const remove = page.getByRole('dialog', { name: 'Remove track', exact: true });
  await remove.getByRole('button', { name: 'Remove', exact: true }).click();
  await expect(page.getByRole('row')).toHaveCount(2);
  await page.getByRole('button', { name: 'Delete playlist', exact: true }).click();
  await page.getByRole('dialog', { name: 'Delete Playlist', exact: true }).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/playlists$/);
  await expect(page.getByRole('link', { name: name + ' edited', exact: true })).toHaveCount(0);
  checks.finish();
});

test('private artist seeds create a playable radio station with real library queue and persisted settings', async ({ page }, info) => {
  const checks = guard(page);
  await login(page);
  await navigate(page, 'Radio Stations');
  await page.getByRole('button', { name: 'Add Radio Station', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Add Radio Station', exact: true });
  const name = 'Private radio ' + info.project.name + ' ' + Date.now();
  await create.getByLabel('Station Name', { exact: true }).fill(name);
  await create.getByRole('checkbox', { name: report.artists[0].name, exact: true }).check();
  await create.getByRole('button', { name: 'Create Station', exact: true }).click();
  await expect(create).not.toBeVisible();
  await page.getByRole('link', { name, exact: true }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  const response = page.waitForResponse(response => /\/api\/radio-stations\/[^/]+\/tracks$/.test(new URL(response.url()).pathname) && response.ok());
  await page.getByRole('button', { name: 'Play station', exact: true }).click();
  const body = await (await response).json();
  const queue = Array.isArray(body) ? body : body.tracks;
  expect(queue.length).toBeGreaterThan(0);
  const track = report.tracks.find((track: any) => track.id === queue[0].trackId);
  expect(track).toBeDefined();
  const player = await openPlayer(page, track.title);
  await expect.poll(() => positionValue(playbackPosition(player))).toBeGreaterThan(0.2);
  await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await checks.waveform(track, player);
  await player.getByRole('button', { name: 'Up Next', exact: true }).click();
  const queued = page.getByRole('dialog', { name: 'Playback queue', exact: true });
  await expect(queued).toBeVisible();
  await expect(queued.getByRole('button', { name: /^Play / })).toHaveCount(queue.length);
  await audit(page, info, 'private-radio-queue');
  await page.keyboard.press('Escape');
  await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await audit(page, info, 'private-radio');
  await checkAccessibility(page, info, 'private-radio');
  checks.finish();
});

test('private Unicode metadata and original editor text survive real save and reload', async ({ page }, info) => {
  const checks = guard(page);
  const original = report.tracks.find((track: any) => /[^\x00-\x7f]/.test(track.title));
  await login(page);
  await page.goto(`/albums/${original.albumId}`);
  async function action(title: string, name: string) {
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Play ' + title, exact: true }) });
    await row.getByRole('button', { name: 'Open options menu', exact: true }).click();
    await page.getByRole('button', { name, exact: true }).click();
  }
  let current = original.title;
  for (const title of [original.title + ' local edit', original.title]) {
    await action(current, 'Edit Track');
    const editor = page.getByRole('dialog', { name: 'Edit Track Details', exact: true });
    await expect(editor.getByLabel('Title', { exact: true })).toBeFocused();
    await editor.getByLabel('Title', { exact: true }).fill(title);
    await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(editor).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Play ' + title, exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Play ' + title, exact: true })).toBeVisible();
    current = title;
  }
  // This is original test text, explicitly not claimed to be the song's lyrics.
  expect((await page.request.put(`/api/tracks/${original.id}/lyrics`, { data: { lyricsJson: [] } })).ok()).toBe(true);
  await action(original.title, 'Edit Lyrics');
  const editor = page.getByRole('dialog', { name: 'Edit Lyrics for ' + original.title, exact: true });
  await editor.getByRole('button', { name: 'Add First Line', exact: true }).click();
  await editor.getByLabel('Time for line 1', { exact: true }).fill('00:02.000');
  await editor.getByLabel('Lyrics for line 1', { exact: true }).fill('Original local editor verification text.');
  await audit(page, info, 'private-lyrics-editor');
  await checkAccessibility(page, info, 'private-lyrics-editor');
  await editor.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(editor).not.toBeVisible();
  await page.reload();
  await action(original.title, 'Edit Lyrics');
  await expect(editor.getByLabel('Lyrics for line 1', { exact: true })).toHaveValue('Original local editor verification text.');
  await expect(editor.getByLabel('Time for line 1', { exact: true })).toHaveValue('00:02.000');
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
  expect((await page.request.put(`/api/tracks/${original.id}/lyrics`, { data: { lyricsJson: [] } })).ok()).toBe(true);
  checks.finish();
});
