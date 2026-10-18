import { test, expect, type Locator, type Request } from '@playwright/test';
import { audit, checkAccessibility, checkLayout, guard, login } from './helpers';
import { expectTrackWaveform } from './player-controls';

test('lyrics ignore an obsolete real response and queue dialogs support keyboard focus and clearing', async ({ page, isMobile }, info) => {
  test.setTimeout(90_000);
  // The guard only pre-allows deliberately held lyrics. Successful waveform
  // range cleanup requires separate exact-request and decoded-result proof below.
  const errors = guard(page, [], ['/api/tracks/signal-to-noise/lyrics']);
  const waveformRequests: Request[] = [];
  const waveformAborts: Request[] = [];
  const waveformUrls = ['signal-to-noise', 'the-distant-sun'].map(id => 'http://127.0.0.1:3100/api/tracks/' + id + '/stream');
  const completedWaveforms = new Map<string, Request>();
  page.on('request', request => { if (waveformUrls.includes(request.url())) waveformRequests.push(request); });
  page.on('requestfailed', request => { if (waveformUrls.includes(request.url())) waveformAborts.push(request); });
  async function proveCompleteWaveform(trackId: string, player: Locator) {
    const title = trackId === 'signal-to-noise' ? 'Signal to Noise' : 'The Distant Sun';
    await expect(player).toContainText(title);
    await expectTrackWaveform(player);
    await expect(player).toContainText(title);
    const url = 'http://127.0.0.1:3100/api/tracks/' + trackId + '/stream';
    const requests = waveformRequests.filter(request => request.url() === url);
    expect(requests).toHaveLength(1);
    expect((await requests[0].response())?.status()).toBe(206);
    completedWaveforms.set(url, requests[0]);
  }
  await login(page);
  // Original test text is saved through the real API as user-edited lyrics.
  // These lines are UI fixtures, not transcriptions or claims about the songs.
  for (const [trackId, text] of [['signal-to-noise', 'Original fixture line for the first track.'], ['the-distant-sun', 'Original fixture line for the second track.']]) {
    const response = await page.request.put(`/api/tracks/${trackId}/lyrics`, { data: { lyricsJson: [{ time: '00:01.000', text }] } });
    expect(response.ok()).toBe(true);
  }
  let release!: () => void, ready!: () => void, finished!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const responseReady = new Promise<void>(resolve => { ready = resolve; });
  const responseFinished = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/tracks/signal-to-noise/lyrics', async route => {
    const response = await route.fetch(); // Preserve the actual application's response.
    ready();
    await held;
    try { await route.fulfill({ response }); } catch { /* Expected if the real UI aborted this obsolete request. */ }
    finished();
  });
  try {
    await page.goto('/artists/scott-buckley');
    await page.getByRole('button', { name: 'Play Signal to Noise', exact: true }).click();
    if (isMobile) await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    await proveCompleteWaveform('signal-to-noise', isMobile ? page.getByRole('dialog', { name: 'Signal to Noise', exact: true }) : page.getByRole('region', { name: 'Music player', exact: true }));
    await page.getByRole('button', { name: 'Lyrics', exact: true }).click();
    const lyrics = page.getByRole('region', { name: 'Track lyrics', exact: true });
    await responseReady;
    await expect(lyrics.getByText('Loading lyrics…', { exact: true })).toBeVisible();
    // Real audio reaches its end and advances the two-track artist queue while
    // the first lyrics response is delayed; no store or media state is injected.
    await expect(lyrics.getByText('The Distant Sun', { exact: true })).toBeVisible({ timeout: 25_000 });
    await expect(lyrics.getByRole('button', { name: 'Jump to 00:01 Original fixture line for the second track.', exact: true })).toBeVisible();
    release();
    await responseFinished;
    await expect(lyrics).not.toContainText('Original fixture line for the first track.');
    await expect(lyrics).toContainText('Original fixture line for the second track.');
    await lyrics.getByRole('button', { name: 'Auto-scroll on', exact: true }).click();
    await expect(lyrics.getByRole('button', { name: 'Auto-scroll off', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await lyrics.getByRole('button', { name: 'Jump to 00:01 Original fixture line for the second track.', exact: true }).focus();
    await page.keyboard.press('Enter');
    await audit(page, info, 'lyrics-current-track');
    await checkAccessibility(page, info, 'lyrics-current-track');
    await page.keyboard.press('Escape');
    await expect(lyrics).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Lyrics', exact: true })).toBeFocused();
    const playback = isMobile ? page.getByRole('dialog', { name: 'The Distant Sun', exact: true }) : page.getByRole('region', { name: 'Music player', exact: true });
    await playback.getByRole('button', { name: 'Pause playback', exact: true }).click();
    // Mediabunny may cancel a fulfilled range before its reader observes EOF.
    // Prove this exact recording completed before permitting its cleanup below;
    // a missing/partial waveform or another request remains a hard failure.
    await proveCompleteWaveform('the-distant-sun', playback);
    await page.getByRole('button', { name: 'Up Next', exact: true }).click();
    const queue = page.getByRole(isMobile ? 'dialog' : 'complementary', { name: 'Playback queue', exact: true });
    await expect(queue.getByRole('heading', { name: 'Up Next', exact: true })).toBeVisible();
    await queue.getByRole('button', { name: 'Play The Distant Sun', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(queue.getByRole('button', { name: 'Pause The Distant Sun', exact: true })).toBeVisible();
    await queue.getByRole('button', { name: 'Pause The Distant Sun', exact: true }).click();
    await audit(page, info, 'queue-keyboard');
    await checkLayout(page);
    await checkAccessibility(page, info, 'queue-keyboard');
    if (isMobile) {
      await page.keyboard.press('Escape');
      await expect(queue).not.toBeVisible();
      await expect(page.getByRole('button', { name: 'Up Next', exact: true })).toBeFocused();
      await page.getByRole('button', { name: 'Close full screen player', exact: true }).click();
      await expect(page.getByRole('button', { name: /^Open full screen player:/ })).toBeFocused();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Up Next', exact: true }).click();
    }
    await queue.getByRole('button', { name: 'Clear queue', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Music player', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Pause playback', exact: true })).toHaveCount(0);
    expect(completedWaveforms.size).toBe(2);
    for (const url of waveformUrls) {
      expect(waveformRequests.filter(request => request.url() === url)).toEqual([completedWaveforms.get(url)]);
    }
    expect(new Set(waveformAborts).size).toBe(waveformAborts.length);
    expect(waveformAborts.length).toBeLessThanOrEqual(completedWaveforms.size);
    const completedRangeCleanups = new Set<string>();
    for (const request of waveformAborts) {
      expect(request).toBe(completedWaveforms.get(request.url()));
      expect(request.failure()?.errorText).toBe('net::ERR_ABORTED');
      const message = 'GET ' + request.url() + ': net::ERR_ABORTED';
      expect(errors.filter(error => error === message)).toHaveLength(1);
      completedRangeCleanups.add(message);
    }
    expect(errors.filter(error => !completedRangeCleanups.has(error))).toEqual([]);
  } finally {
    release();
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  }
});
