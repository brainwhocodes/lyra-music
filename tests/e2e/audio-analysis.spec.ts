import { test, expect, type Locator, type Page, type Request } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { audit, checkAccessibility, checkLayout, guard, login } from './helpers';
import { holdActualResponse } from './held-response';
import { expectTrackWaveform, playbackPosition, pointerSeek, positionValue, seekSeconds } from './player-controls';
import { originalStreamEvidence } from './stream-evidence';

const originalPath = '/api/tracks/the-distant-sun/stream';

async function startPausedTrack(page: Page, artistQueue = false) {
  await page.goto(artistQueue ? '/artists/scott-buckley' : '/albums/album-the-distant-sun');
  const audio = page.waitForResponse(response => new URL(response.url()).pathname === '/api/tracks/the-distant-sun/play' && response.ok());
  await page.getByRole('button', { name: artistQueue ? 'Play The Distant Sun' : 'Play album', exact: true }).click();
  await (await audio).finished();
  await page.getByRole('button', { name: /^Open full screen player:/ }).click();
  const player = page.getByRole('dialog', { name: 'The Distant Sun', exact: true });
  await expect.poll(() => positionValue(playbackPosition(player))).toBeGreaterThan(0);
  await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await seekSeconds(player, 3);
  return player;
}

async function expectPausedAtThree(player: Locator) {
  await expect(player.getByRole('heading', { name: 'The Distant Sun', exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();
  await expect(playbackPosition(player)).toHaveValue('3');
}

async function chooseTrack(page: Page, player: Locator, title: string) {
  await player.getByRole('button', { name: 'Up Next', exact: true }).click();
  const queue = page.getByRole('dialog', { name: 'Playback queue', exact: true });
  await queue.getByRole('button', { name: 'Play ' + title, exact: true }).click();
  await page.keyboard.press('Escape');
  const next = page.getByRole('dialog', { name: title, exact: true });
  await expect(next).toBeVisible();
  await expect.poll(() => positionValue(playbackPosition(next))).toBeGreaterThan(0);
  await next.getByRole('button', { name: 'Pause playback', exact: true }).click();
  return next;
}

async function mutableFixturePath() {
  const descriptor = JSON.parse(await readFile(resolve('.test-data/e2e-audio-fixture.json'), 'utf8'));
  const filePath = resolve(descriptor.filePath);
  const withinTemp = relative(resolve(tmpdir()), filePath);
  expect(isAbsolute(withinTemp)).toBe(false);
  expect(withinTemp.startsWith('..' + sep) || withinTemp === '..').toBe(false);
  expect(basename(dirname(filePath))).toMatch(/^lyra-e2e-/);
  expect(basename(filePath)).toBe('the-distant-sun.mp3');
  return filePath;
}

test('a decoded waveform shares the native seek bar and preserves playback across cached views', async ({ page }, info) => {
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  await login(page);
  const delayed = await holdActualResponse(page, originalPath);
  let originalRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === originalPath) originalRequests++; });
  try {
    const player = await startPausedTrack(page);
    await delayed.ready;
    const position = playbackPosition(player);
    await expect(position).toHaveAttribute('min', '0');
    await expect(position).toHaveAttribute('step', '0.1');
    expect(Number(await position.getAttribute('max'))).toBeGreaterThan(11.9);
    expect(Number(await position.getAttribute('max'))).toBeLessThan(12.2);
    await expect(position).toHaveAttribute('aria-valuetext', /0:03.*0:12/);
    await expect(player.getByRole('status').filter({ hasText: /^Loading waveform$/ })).toHaveCount(1);
    await expect(player.locator('svg[aria-label="Track waveform"]')).toHaveCount(0);
    await expectPausedAtThree(player);
    await audit(page, info, 'waveform-loading-fallback');
    delayed.release(); await delayed.finished;
    const { geometry } = await streams.complete('the-distant-sun', player, 0, await delayed.responseBody());
    await expectPausedAtThree(player);
    await position.focus(); await position.press('End');
    expect(Number(await position.getAttribute('max')) - await positionValue(position)).toBeLessThanOrEqual(0.1);
    await expect(player.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();
    await position.press('Home');
    await expect(position).toHaveValue('0');
    await pointerSeek(player, 0.5);
    await expect(player.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();
    // Exercise the native gesture boundary: release outside the range, then
    // continue with keyboard seeking. No synthetic DOM input is dispatched.
    const rangeBox = await position.boundingBox();
    expect(rangeBox).not.toBeNull();
    await page.mouse.move(rangeBox!.x + rangeBox!.width * 0.25, rangeBox!.y + rangeBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(rangeBox!.x + rangeBox!.width * 0.75, rangeBox!.y + rangeBox!.height / 2, { steps: 4 });
    await page.mouse.move(rangeBox!.x + rangeBox!.width * 0.75, rangeBox!.y + rangeBox!.height + 14);
    await page.mouse.up();
    await expect(player.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();
    await seekSeconds(player, 3);
    await position.press('ArrowLeft');
    await expect(position).toHaveValue('2.9');
    await position.press('ArrowRight');
    await expect(position).toHaveValue('3');
    await checkLayout(page);
    await audit(page, info, 'waveform-seeking-paused');
    await checkAccessibility(page, info, 'waveform-seeking-paused');
    await player.getByRole('button', { name: 'Play playback', exact: true }).click();
    await pointerSeek(player, 0.5);
    const playingPosition = await positionValue(position);
    await expect.poll(() => positionValue(position)).toBeGreaterThan(playingPosition + 0.1);
    await expect(player.getByRole('button', { name: 'Pause playback', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await seekSeconds(player, 3);
    await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
    await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    const reopened = await expectTrackWaveform(player);
    expect(reopened.geometry).toEqual(geometry);
    expect(originalRequests, 'Compact/full player views share one decoded waveform').toBe(1);
    await expectPausedAtThree(player);
    streams.assertClean(errors, { 'the-distant-sun': 1 });
  } finally { await delayed.cleanup(); }
});

test('malformed waveform audio leaves seeking usable and retries when the track is selected again', async ({ page }, info) => {
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  await login(page);
  let ready!: () => void, release!: () => void, finished!: () => void;
  const requested = new Promise<void>(resolve => { ready = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  const completed = new Promise<void>(resolve => { finished = resolve; });
  let originalRequests = 0;
  let malformedRequest!: Request, malformedBody!: Buffer;
  const malformedBytes = Buffer.from('Malformed original audio in the isolated per-run fixture copy.');
  // Delay before fetching so /play buffers real MP3 bytes before the separate
  // waveform source is made malformed. No replacement response is fabricated.
  await page.route('**' + originalPath, async route => {
    originalRequests++; ready(); await held;
    try {
      const response = await route.fetch();
      if (originalRequests === 1) { malformedRequest = route.request(); malformedBody = await response.body(); }
      await route.fulfill({ response });
    }
    finally { finished(); }
  });
  const fixture = await mutableFixturePath(), original = await readFile(fixture);
  try {
    const player = await startPausedTrack(page, true);
    await requested;
    await writeFile(fixture, malformedBytes);
    release(); await completed;
    await expect(player.getByRole('status').filter({ hasText: /^Waveform unavailable\. Seeking is still available\.$/ })).toHaveCount(1);
    await expect(player.locator('svg[aria-label="Track waveform"]')).toHaveCount(0);
    await expectPausedAtThree(player);
    await streams.malformed(malformedRequest, malformedBody, malformedBytes, player);
    await pointerSeek(player, 0.5);
    await seekSeconds(player, 3);
    await audit(page, info, 'waveform-error-fallback');
    await checkAccessibility(page, info, 'waveform-error-fallback');
    await writeFile(fixture, original);
    const other = await chooseTrack(page, player, 'Signal to Noise');
    await streams.complete('signal-to-noise', other);
    const returned = await chooseTrack(page, other, 'The Distant Sun');
    await streams.complete('the-distant-sun', returned, 1);
    expect(originalRequests, 'A failed decode must not poison the success cache').toBe(2);
    await seekSeconds(returned, 3);
    await expectPausedAtThree(returned);
    await audit(page, info, 'waveform-recovered');
    streams.assertClean(errors, { 'the-distant-sun': 2, 'signal-to-noise': 1 });
  } finally {
    await writeFile(fixture, original); release();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});

test('pending waveform survives player closure and aborts when the current track changes', async ({ page }, info) => {
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  await login(page);
  const delayed = await holdActualResponse(page, originalPath);
  let originalRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === originalPath) originalRequests++; });
  try {
    const player = await startPausedTrack(page, true);
    await delayed.ready;
    await player.getByRole('button', { name: 'Play playback', exact: true }).click();
    await expect.poll(() => positionValue(playbackPosition(player))).toBeGreaterThan(3.2);
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await seekSeconds(player, 3);
    await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
    await expect(player).not.toBeVisible();
    await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    await expectPausedAtThree(player);
    await expect(player.getByRole('status').filter({ hasText: /^Loading waveform$/ })).toHaveCount(1);
    expect(originalRequests, 'Closing the full player must not restart the shared decode').toBe(1);
    expect(delayed.abortObserved(), 'Closing a view must retain current-track work').toBe(false);
    await audit(page, info, 'waveform-pending-shared');
    const next = await chooseTrack(page, player, 'Signal to Noise');
    delayed.release(); await delayed.finished; await delayed.expectAborted();
    await streams.cancelled(delayed.request());
    const { geometry } = await streams.complete('signal-to-noise', next);
    await expect(next.getByRole('heading', { name: 'Signal to Noise', exact: true })).toBeVisible();
    await audit(page, info, 'waveform-current-track');
    await checkAccessibility(page, info, 'waveform-current-track');
    await delayed.cleanup();
    const returned = await chooseTrack(page, next, 'The Distant Sun');
    const { geometry: returnedGeometry } = await streams.complete('the-distant-sun', returned, 1);
    expect(returnedGeometry.bars).not.toEqual(geometry.bars);
    expect(originalRequests).toBe(2);
    await checkLayout(page);
    streams.assertClean(errors, { 'the-distant-sun': 2, 'signal-to-noise': 1 });
  } finally { await delayed.cleanup(); await page.unrouteAll({ behavior: 'ignoreErrors' }); }
});
