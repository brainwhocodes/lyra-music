import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const report = JSON.parse(readFileSync(join(process.env.LYRA_PRIVATE_RUN!, 'import-report.json'), 'utf8'));

// A native codec integration harness, deliberately separate from application UI
// journeys. It uses genuine authenticated production bytes and native media
// events. No application store, capability result or decoder output is replaced.
test('the explicit MP3 fallback has real finite duration and supports near-end native seeking and resume', async ({ page }, info) => {
  test.setTimeout(120_000);
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(report.credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(report.credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  const track = [...report.tracks].sort((a: any, b: any) => b.exactDuration - a.exactDuration)[0];
  const source = `/api/tracks/${track.id}/play?format=mp3`;
  const range = await page.request.get(source, { headers: { Range: 'bytes=0-511' }, timeout: 90_000 });
  expect(range.status()).toBe(206);
  expect(range.headers()['content-type']).toContain('audio/mpeg');
  expect(range.headers()['content-range']).toMatch(/^bytes 0-511\/\d+$/);
  expect((await range.body()).length).toBe(512);

  // Only this separate fixture document is synthetic. Do not write HTML into
  // Chromium's ImageDocument, which can remain blank and never finish load.
  // Same-origin authentication and every production media response stay real.
  const documentUrl = 'http://127.0.0.1:3200/__native-codec-fixture';
  await page.route(documentUrl, route => route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8',
    body: `<!doctype html><html lang="en"><meta charset="utf-8"><title>Native codec verification</title>
    <body><h1>Native codec verification</h1><audio id="media" controls preload="metadata"></audio>
    <button id="play">Play native media</button><button id="pause">Pause native media</button>
    <button id="seek">Seek near the end</button><p id="error" role="alert"></p>
    <script>const media=document.getElementById('media');
    document.getElementById('play').onclick=()=>media.play().catch(error=>document.getElementById('error').textContent=error.message);
    document.getElementById('pause').onclick=()=>media.pause();
    document.getElementById('seek').onclick=()=>{media.currentTime=Math.max(0,media.duration-4)};
    media.addEventListener('error',()=>document.getElementById('error').textContent=media.error?.message||'Native decode failed');
    media.src=${JSON.stringify(source)};</script></body></html>` }));
  await page.goto(documentUrl, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Native codec verification', exact: true })).toBeVisible();
  const audio = page.locator('audio');
  await expect.poll(() => audio.evaluate(media => Number.isFinite(media.duration) && media.duration > 0), { timeout: 30_000 }).toBe(true);
  const duration = await audio.evaluate(media => media.duration);
  expect(Math.abs(duration - track.exactDuration)).toBeLessThan(1);
  await page.getByRole('button', { name: 'Play native media', exact: true }).click();
  await expect.poll(() => audio.evaluate(media => media.currentTime)).toBeGreaterThan(0.2);
  await page.getByRole('button', { name: 'Pause native media', exact: true }).click();
  await expect.poll(() => audio.evaluate(media => media.paused)).toBe(true);
  await page.getByRole('button', { name: 'Seek near the end', exact: true }).click();
  await expect.poll(() => audio.evaluate(media => media.currentTime)).toBeGreaterThan(duration - 5);
  await expect.poll(() => audio.evaluate(media => media.seeking)).toBe(false);
  const position = await audio.evaluate(media => media.currentTime);
  await page.getByRole('button', { name: 'Play native media', exact: true }).click();
  await expect.poll(() => audio.evaluate(media => media.currentTime)).toBeGreaterThan(position + 0.2);
  await page.getByRole('button', { name: 'Pause native media', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('');
  const aggregate = { nativeCodec: 'MP3', originalSeconds: track.exactDuration, decodedSeconds: duration,
    authenticatedRangeBytes: 512, nearEndSeekAndResume: true,
    scope: 'Separate Chromium native-media integration; does not impersonate a Safari engine or replace app capability checks.' };
  await writeFile(info.outputPath('fallback.aggregate.json'), JSON.stringify(aggregate, null, 2));
  await info.attach('private-native-fallback-aggregate', { body: JSON.stringify(aggregate), contentType: 'application/json' });
});
