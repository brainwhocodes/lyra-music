import { test, expect } from '@playwright/test';
import { audit, checkAccessibility, checkLayout, guard, login, navigate } from './helpers';
import { originalStreamEvidence } from './stream-evidence';

// Requires LYRA_EMBEDDING_E2E=1 and a cached official model; all inference is real and local.
test('local semantic discovery indexes, searches, explains suggestions and plays the collection', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  await login(page);
  await navigate(page, 'Explore');
  await expect(page.getByRole('heading', { name: 'Explore your music.', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Local music index' })).toContainText(/\d+ of \d+ tracks indexed/);
  const initialIndex = page.getByRole('button', { name: /^(Index your library|Update local index)$/ });
  if (await initialIndex.isVisible()) {
    await expect(page.getByRole('button', { name: 'Search', exact: true })).toBeDisabled();
    await audit(page, info, 'explore-unindexed');
    await initialIndex.click();
    const stop = page.getByRole('button', { name: 'Stop after this batch', exact: true });
    await expect(stop).toBeVisible();
    await stop.click({ timeout: 10_000 });
    await expect(page.getByRole('region', { name: 'Local music index' })).toContainText('Stopping after the current batch');
    await audit(page, info, 'explore-indexing');
    await expect(page.getByRole('button', { name: 'Check for changes', exact: true })).toBeVisible({ timeout: 180_000 });
  }
  await page.getByRole('button', { name: 'Check for changes', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Local music index' })).toContainText('2 of 2 tracks indexed');
  await page.getByLabel('Describe the music you want', { exact: true }).fill('Scott Buckley');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const result = page.getByRole('article', { name: 'The Distant Sun', exact: true });
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole('region', { name: 'Search results', exact: true })).toContainText('Closest matches for');
  await result.getByRole('button', { name: 'Show suggested tags for The Distant Sun', exact: true }).click();
  await expect(result).toContainText('Suggested by EmbeddingGemma', { timeout: 90_000 });
  await expect(result).toContainText('Suggestions do not change your library.');
  await audit(page, info, 'explore-tags');
  await result.getByRole('button', { name: 'Hide suggested tags for The Distant Sun', exact: true }).click();
  await expect(result.getByText('Suggested by EmbeddingGemma', { exact: false })).toHaveCount(0);
  const audio = page.waitForResponse(response => /\/api\/tracks\/the-distant-sun\/play/.test(response.url()) && response.ok());
  await result.getByRole('button', { name: 'Play The Distant Sun', exact: true }).click();
  expect((await audio).headers()['content-type']).toContain('audio/');
  await expect(result.getByRole('button', { name: 'Pause The Distant Sun', exact: true })).toBeVisible();
  await result.getByRole('button', { name: 'Pause The Distant Sun', exact: true }).click();
  await expect(result.getByRole('button', { name: 'Play The Distant Sun', exact: true })).toBeVisible();
  await streams.complete('the-distant-sun', page.getByRole('region', { name: 'Music player', exact: true }));
  const recommendationsResponse = page.waitForResponse(response => new URL(response.url()).pathname === '/api/intelligence/recommendations' && response.ok());
  await page.getByRole('button', { name: 'For you', exact: true }).click();
  await expect(page.getByRole('button', { name: 'For you', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const recommendations = await (await recommendationsResponse).json();
  expect(['history', 'cold-start']).toContain(recommendations.basis);
  // The first desktop run proves populated recommendations. Later projects
  // share this isolated library: after both short fixtures have been heard,
  // excluding recent listening can correctly leave no recommendation.
  if (info.project.name === 'desktop') expect(recommendations.tracks.length).toBeGreaterThan(0);
  expect(recommendations.tracks.length).toBeLessThanOrEqual(2);
  const recommendationCards = page.getByRole('region', { name: 'For you recommendations', exact: true }).getByRole('article');
  await expect(recommendationCards).toHaveCount(recommendations.tracks.length);
  if (recommendations.tracks.length === 0) {
    expect(recommendations.basis).toBe('history');
    await expect(page.getByRole('heading', { name: 'More listening, more connections.', exact: true })).toBeVisible();
    await expect(page.getByText('Play a few tracks, or explore with a search while your listening history grows.', { exact: true })).toBeVisible();
  }
  for (const track of recommendations.tracks) {
    expect(['the-distant-sun', 'signal-to-noise']).toContain(track.trackId);
    await expect(page.getByRole('region', { name: 'For you recommendations', exact: true }).getByRole('article', { name: track.title, exact: true })).toBeVisible();
  }
  await audit(page, info, 'explore-recommendations');
  await page.getByRole('button', { name: 'Search results', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Search results', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await checkAccessibility(page, info, 'explore-results');
  await checkLayout(page);
  await result.getByRole('link', { name: 'Open album Monomyth', exact: true }).click();
  await expect(page).toHaveURL(/\/albums\/album-the-distant-sun$/);
  streams.assertClean(errors, { 'the-distant-sun': 1 });
});
