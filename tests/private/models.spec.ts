import { test, expect, type Page } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { audit, checkAccessibility, checkLayout, navigate } from '../e2e/helpers';

const report = JSON.parse(readFileSync(join(process.env.LYRA_PRIVATE_RUN!, 'import-report.json'), 'utf8'));
const ids = new Set(report.tracks.map((track: any) => track.id));
async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(report.credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(report.credentials.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
}

test('real local intelligence indexes the private corpus and exposes actual search, tags and recommendations', async ({ page }, info) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.url().startsWith('http://127.0.0.1:3200') && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await login(page);
  await navigate(page, 'Explore');
  const index = page.getByRole('region', { name: 'Local music index', exact: true });
  await expect(index).toContainText(new RegExp(`\\d+ of ${report.tracks.length} tracks indexed`));
  const update = page.getByRole('button', { name: /^(Index your library|Update local index)$/ });
  if (await update.isVisible()) {
    await update.click();
    await expect(index).toHaveAttribute('aria-busy', 'true');
    await audit(page, info, 'private-model-indexing');
  }
  await Promise.race([
    expect(index).toContainText(`${report.tracks.length} of ${report.tracks.length} tracks indexed`, { timeout: 300_000 }),
    index.getByRole('alert').waitFor({ state: 'visible', timeout: 300_000 }).then(async () => {
      throw new Error(`Local index failed: ${await index.getByRole('alert').textContent()}`);
    }),
  ]);
  await expect(index).toHaveAttribute('aria-busy', 'false');
  const status = await page.request.get('/api/intelligence/status');
  expect(status.ok()).toBe(true);
  const indexed = await status.json();
  expect(indexed.indexedTracks).toBe(report.tracks.length);
  expect(indexed.pendingTracks).toBe(0);
  expect(indexed.dimensions).toBe(256);

  const selected = report.tracks[0];
  await page.getByLabel('Describe the music you want', { exact: true }).fill(`${selected.artist} ${selected.album}`);
  const searchResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/search');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = await searchResponse;
  expect(search.ok()).toBe(true);
  const results = await search.json();
  expect(results.tracks.length).toBeGreaterThan(0);
  for (const track of results.tracks) {
    expect(ids.has(track.trackId)).toBe(true);
    expect(Number.isFinite(track.score)).toBe(true);
    expect(track.reason.length).toBeGreaterThan(0);
  }
  const region = page.getByRole('region', { name: 'Search results', exact: true });
  await expect(region.getByRole('article')).toHaveCount(results.tracks.length);
  const first = results.tracks[0];
  const result = region.getByRole('article', { name: first.title, exact: true });
  const tagsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/tags');
  await result.getByRole('button', { name: `Show suggested tags for ${first.title}`, exact: true }).click();
  const tags = await tagsResponse;
  expect(tags.ok()).toBe(true);
  const tagged = await tags.json();
  expect(tagged.trackId).toBe(first.trackId);
  expect(Array.isArray(tagged.tags)).toBe(true);
  for (const tag of tagged.tags) {
    expect(tag.source).toBe('embeddinggemma-taxonomy');
    expect(Number.isFinite(tag.score)).toBe(true);
    expect(tag.evidence.every((item: string) => ['metadata', 'lyrics'].includes(item))).toBe(true);
  }
  await expect(result).toContainText('Suggestions do not change your library.');
  await audit(page, info, 'private-model-search-tags');
  await result.getByRole('button', { name: `Hide suggested tags for ${first.title}`, exact: true }).click();

  const recommendationsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/recommendations');
  await page.getByRole('button', { name: 'For you', exact: true }).click();
  const recommendations = await recommendationsResponse;
  expect(recommendations.ok()).toBe(true);
  const recommended = await recommendations.json();
  expect(['history', 'cold-start']).toContain(recommended.basis);
  expect(recommended.tracks.length).toBeGreaterThan(0);
  for (const track of recommended.tracks) expect(ids.has(track.trackId)).toBe(true);
  await expect(page.getByRole('region', { name: 'For you recommendations', exact: true }).getByRole('article')).toHaveCount(recommended.tracks.length);
  await audit(page, info, 'private-model-recommendations');
  await checkAccessibility(page, info, 'private-model-recommendations');
  await checkLayout(page);
  await page.getByRole('button', { name: 'Search results', exact: true }).click();
  await result.getByRole('link', { name: `Open album ${first.albumTitle}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/albums/${first.albumId}$`));
  const aggregate = { indexed: indexed.indexedTracks, dimensions: indexed.dimensions,
    searchResults: results.tracks.length, tags: tagged.tags.length, recommendations: recommended.tracks.length, basis: recommended.basis,
    interpretation: 'Runtime and application wiring only; no relevance or audio-classification accuracy score.' };
  await writeFile(info.outputPath('intelligence.aggregate.json'), JSON.stringify(aggregate, null, 2));
  await info.attach('private-model-aggregate', { body: JSON.stringify(aggregate), contentType: 'application/json' });
  expect(errors).toEqual([]);
});

test('the production Whistle route processes a private whole track and preserves its real persisted result', async ({ request }, info) => {
  test.setTimeout(360_000);
  const selectionPath = resolve('.test-data/private-albums/model-selection.json');
  const selection = existsSync(selectionPath) ? JSON.parse(readFileSync(selectionPath, 'utf8')) : null;
  const selected = report.tracks.find((track: any) => track.filePath === selection?.sourcePath)
    || [...report.tracks].sort((a: any, b: any) => a.exactDuration - b.exactDuration)[0];
  const login = await request.post('/api/auth/login', { data: report.credentials });
  expect(login.status()).toBe(200);
  const headers = { authorization: `Bearer ${(await login.json()).token}` };
  const original = [{ time: '00:00.000', text: 'Original verification text; not a song transcript.' }];
  expect((await request.put(`/api/tracks/${selected.id}/lyrics`, { headers, data: { lyricsJson: original } })).ok()).toBe(true);
  const response = await request.post(`/api/tracks/${selected.id}/lyrics/generate`, { headers, timeout: 310_000 });
  const generated = await response.json();
  await info.attach('private-real-whistle-result', { body: JSON.stringify(generated), contentType: 'application/json' });
  expect([200, 422]).toContain(response.status());
  const saved = await request.get(`/api/tracks/${selected.id}/lyrics`, { headers });
  expect(saved.status()).toBe(200);
  const persisted = await saved.json();
  if (response.status() === 200) {
    expect(generated.source).toBe('whistle_transcription');
    expect(generated.llmModelUsed).toContain('whistle');
    expect(generated.lyricsJson.length).toBeGreaterThan(0);
    let previous = -1;
    for (const line of generated.lyricsJson) {
      expect(line.time).toMatch(/^\d{2}:\d{2}\.\d{3}$/);
      const [minutes, seconds] = line.time.split(':').map(Number);
      const time = minutes * 60 + seconds;
      expect(time).toBeGreaterThanOrEqual(previous);
      expect(time).toBeLessThanOrEqual(selected.exactDuration + 1);
      expect(line.text.trim().length).toBeGreaterThan(0);
      previous = time;
    }
    expect(persisted.lyricsJson).toEqual(generated.lyricsJson);
    expect(persisted.source).toBe('whistle_transcription');
  } else {
    expect(generated.statusMessage || generated.message).toContain('No speech was detected');
    expect(persisted.lyricsJson).toEqual(original);
  }
  const aggregate = { status: response.status(), seconds: selected.exactDuration,
    savedSegments: response.status() === 200 ? generated.lyricsJson.length : 0, originalPreservedOnNoSpeech: response.status() === 422,
    interpretation: 'Whole-track local inference and persistence only; no reference transcript or song accuracy score.' };
  await writeFile(info.outputPath('whistle.aggregate.json'), JSON.stringify(aggregate, null, 2));
  await info.attach('private-whistle-aggregate', { body: JSON.stringify(aggregate), contentType: 'application/json' });
});
