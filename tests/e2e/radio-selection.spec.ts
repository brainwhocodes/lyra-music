import { test, expect, type Locator } from '@playwright/test';
import { audit, checkAccessibility, guard, login } from './helpers';
import { holdActualResponse } from './held-response';
import { playbackPosition, positionValue, seekSeconds } from './player-controls';
import { originalStreamEvidence } from './stream-evidence';

async function queueTitles(queue: Locator) {
  // Read the accessible labels of the real queue controls to retain their order.
  return queue.getByRole('button', { name: /^(Play|Pause) (The Distant Sun|Signal to Noise)$/ })
    .evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')!.replace(/^(Play|Pause) /, '')));
}

test('station artwork can pause independently of audio and respects reduced motion', async ({ page }, info) => {
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await login(page);
  await page.goto('/radio/quiet-hours');
  await page.getByRole('button', { name: 'Play station', exact: true }).click();
  const pauseMotion = page.getByRole('button', { name: 'Pause artwork animation', exact: true });
  await expect(pauseMotion).toBeVisible();
  await pauseMotion.scrollIntoViewIfNeeded();
  const artwork = page.locator('.radio-desk-art .radio-artwork-image');
  await expect.poll(() => artwork.evaluate(element => getComputedStyle(element).animationPlayState)).toBe('running');
  const player = page.getByRole('region', { name: 'Music player', exact: true });
  const progress = playbackPosition(player);
  await expect.poll(() => positionValue(progress)).toBeGreaterThan(0.25);
  await pauseMotion.click();
  const positionWhileArtworkPaused = await positionValue(progress);
  await expect.poll(() => artwork.evaluate(element => getComputedStyle(element).animationPlayState)).toBe('paused');
  await expect.poll(() => positionValue(progress)).toBeGreaterThan(positionWhileArtworkPaused + 0.25);
  await expect(player.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Resume artwork animation', exact: true }).click();
  await expect.poll(() => artwork.evaluate(element => getComputedStyle(element).animationPlayState)).toBe('running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(pauseMotion).toHaveCount(0);
  await expect.poll(() => artwork.evaluate(element => getComputedStyle(element).animationName)).toBe('none');
  await expect(player.getByRole('button', { name: 'Pause playback', exact: true })).toBeVisible();
  await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
  const title = await player.getByRole('button', { name: /^Open full screen player:/ }).getAttribute('aria-label');
  const trackId = title?.includes('The Distant Sun') ? 'the-distant-sun' : 'signal-to-noise';
  await streams.complete(trackId, player);
  await audit(page, info, 'radio-artwork-reduced-motion');
  await checkAccessibility(page, info, 'radio-artwork-reduced-motion');
  streams.assertClean(errors, { [trackId]: 1 });
});

test('choosing the current station cancels a pending station without replacing its queue or playback position', async ({ page }, info) => {
  const allowedAbortPaths: string[] = [];
  const errors = guard(page, [], allowedAbortPaths);
  const streams = originalStreamEvidence(page);
  await login(page);
  const created = await page.request.post('/api/radio-stations', {
    data: { name: 'Pending station ' + info.project.name, artistIds: ['scott-buckley'], genreIds: ['ambient'] },
  });
  expect(created.ok()).toBe(true);
  const station = await created.json();
  const pendingPath = '/api/radio-stations/' + station.channelId + '/tracks';
  allowedAbortPaths.push(pendingPath);
  const delayed = await holdActualResponse(page, pendingPath);
  let currentStationRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/radio-stations/quiet-hours/tracks') currentStationRequests++;
  });
  try {
    await page.goto('/radio');
    await page.getByRole('button', { name: 'Play station Quiet hours', exact: true }).click();
    await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    const player = page.getByRole('dialog', { name: /^(The Distant Sun|Signal to Noise)$/ });
    const retainedTitle = await player.getByRole('heading', { name: /^(The Distant Sun|Signal to Noise)$/ }).innerText();
    const progress = playbackPosition(player);
    await expect.poll(() => positionValue(progress)).toBeGreaterThan(0);
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await seekSeconds(player, 3);
    const trackId = retainedTitle === 'The Distant Sun' ? 'the-distant-sun' : 'signal-to-noise';
    await streams.complete(trackId, player);
    await player.getByRole('button', { name: 'Up Next', exact: true }).click();
    const queue = page.getByRole('dialog', { name: 'Playback queue', exact: true });
    const originalQueue = await queueTitles(queue);
    expect(originalQueue).toHaveLength(2);
    await page.keyboard.press('Escape');
    await player.getByRole('button', { name: 'Play playback', exact: true }).click();
    await expect.poll(() => positionValue(progress)).toBeGreaterThan(3.2);
    const before = await positionValue(progress);
    await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();

    await page.getByRole('button', { name: 'Play station ' + station.name, exact: true }).click();
    await delayed.ready;
    await expect(page.getByRole('status').filter({ hasText: 'Loading station tracks' })).toBeVisible();
    await page.getByRole('button', { name: /^(Play|Pause) station Quiet hours$/ }).click();
    delayed.release();
    await delayed.finished;
    await delayed.expectAborted();
    await expect(page.getByRole('status').filter({ hasText: 'Loading station tracks' })).toHaveCount(0);
    expect(currentStationRequests, 'Toggling the current station must not fetch a new queue').toBe(1);
    await expect(page.getByRole('region', { name: 'Music player', exact: true }).getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();

    await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    await expect(player.getByRole('heading', { name: retainedTitle, exact: true })).toBeVisible();
    const after = await positionValue(progress);
    expect(after).toBeGreaterThanOrEqual(before);
    expect(after).toBeLessThan(before + 5);
    await player.getByRole('button', { name: 'Up Next', exact: true }).click();
    await expect.poll(() => queueTitles(queue)).toEqual(originalQueue);
    await page.keyboard.press('Escape');
    await audit(page, info, 'radio-current-station-preserved');
    await checkAccessibility(page, info, 'radio-current-station-preserved');
    streams.assertClean(errors, { [trackId]: 1 });
  } finally {
    await delayed.cleanup();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    const removed = await page.request.delete('/api/radio-stations/' + station.channelId);
    expect(removed.ok()).toBe(true);
  }
});
