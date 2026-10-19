import { test, expect } from '@playwright/test';
import { audit, checkAccessibility, checkCompactControlSpacing, checkLayout, guard, login } from './helpers';
import { playbackPosition, pointerSeek, seekSeconds } from './player-controls';
import { originalStreamEvidence } from './stream-evidence';

const authenticatedRoutes: Array<[string, RegExp]> = [
  ['/library', /Your library\./], ['/albums', /^Albums/], ['/albums/album-the-distant-sun', /^Monomyth$/],
  ['/artists', /^Artists$/], ['/artists/scott-buckley', /^Scott Buckley$/], ['/genres', /^Genres$/], ['/genres/ambient', /^Ambient$/],
  ['/tracks', /^Tracks$/], ['/playlists', /^Playlists\.?$/], ['/playlists/local-listening', /^Local listening$/],
  ['/discovery', /^Discover/], ['/discovery/local-discoveries', /^Quiet discoveries$/],
  ['/podcasts', /^Podcasts\.?$/], ['/podcasts/listening-notes', /^Listening Notes$/],
  ['/radio', /^Find your frequency\.$/], ['/radio/quiet-hours', /^Quiet hours$/],
  ['/settings', /^Settings\.?$/], ['/settings/radio', /^Your radio stations\.$/], ['/settings/radio/quiet-hours', /^Edit station\.$/],
  ['/explore', /^Explore your music\.$/],
];
test('every route renders real content, accessible controls and responsive layouts', async ({ page }, info) => {
  test.setTimeout(240_000);
  const errors = guard(page);
  const streams = originalStreamEvidence(page);
  for (const path of ['/', '/features', '/self-host', '/login', '/register']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(path === '/' ? '/$' : path + '$'));
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
    await checkLayout(page, true);
    const name = 'route-' + (path === '/' ? 'landing' : path.slice(1));
    await audit(page, info, name);
    await checkAccessibility(page, info, name, true);
  }
  await login(page);
  for (const [path, heading] of authenticatedRoutes) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(path + '$'));
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await checkLayout(page, true);
    const name = 'route-' + path.slice(1).replaceAll('/', '-');
    await audit(page, info, name);
    await checkAccessibility(page, info, name, true);
  }
  // Hold the real response to inspect the actual pending screen without
  // inventing an API payload or reaching into the app's session state.
  let release!: () => void, ready!: () => void, finished!: () => void;
  let intercepted = false;
  const held = new Promise<void>(resolve => { release = resolve; });
  const responseReady = new Promise<void>(resolve => { ready = resolve; });
  const responseFinished = new Promise<void>(resolve => { finished = resolve; });
  await page.route('**/api/auth/logout', async route => {
    intercepted = true;
    try {
      const response = await route.fetch();
      ready();
      await held;
      await route.fulfill({ response });
    } finally {
      finished();
    }
  });
  try {
    await page.goto('/logout');
    await responseReady;
    await expect(page.getByRole('heading', { name: 'Signing you out', exact: true })).toBeVisible();
    await expect(page.getByRole('status')).toHaveText('Returning to the home page.');
    await audit(page, info, 'route-logout');
    await checkLayout(page);
    await checkAccessibility(page, info, 'route-logout', true);
    release();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Log in', exact: true })).toBeVisible();
  } finally {
    release();
    if (intercepted) await responseFinished;
    await page.unroute('**/api/auth/logout');
  }
  if (info.project.name === 'mobile') {
    await page.setViewportSize({ width: 320, height: 800 });
    for (const path of ['/', '/features', '/self-host']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await checkLayout(page);
      const name = path === '/' ? 'home' : path.slice(1);
      await audit(page, info, path === '/' ? 'compact320-public' : 'compact320-public-' + name);
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      expect(await page.locator('body').evaluate(body => getComputedStyle(body).fontSize)).toBe('32px');
      await checkLayout(page);
      if (path === '/' || path === '/features') {
        const cardHeading = page.getByRole('heading', { name: path === '/' ? 'After hours' : 'City Drift Radio', exact: true });
        const cardHeadingBox = await cardHeading.boundingBox();
        expect(cardHeadingBox).not.toBeNull();
        expect(cardHeadingBox!.width, 'Enlarged card text needs readable line width rather than one character per line').toBeGreaterThanOrEqual(120);
      }
      await audit(page, info, 'compact320-public-text200-' + name);
    }
    await login(page);
    for (const [path] of authenticatedRoutes) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await checkLayout(page, true);
      if (path === '/library') {
        await checkCompactControlSpacing(page);
        const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true });
        const explore = page.getByRole('link', { name: 'Explore', exact: true });
        const menuBox = await menu.boundingBox(), exploreBox = await explore.boundingBox();
        expect(menuBox).not.toBeNull();
        expect(exploreBox).not.toBeNull();
        expect(Math.abs(menuBox!.y + menuBox!.height / 2 - exploreBox!.y - exploreBox!.height / 2), 'Compact navigation must not orphan Explore onto another row').toBeLessThanOrEqual(1);
        await menu.click();
        await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).not.toBeVisible();
        await expect(menu).toBeFocused();
      }
      if (path === '/albums/album-the-distant-sun') await checkCompactControlSpacing(page, 'The Distant Sun');
      await audit(page, info, 'compact320-' + path.slice(1).replaceAll('/', '-'));
    }
    await page.goto('/albums/album-the-distant-sun');
    await page.getByRole('button', { name: 'Play album', exact: true }).click();
    await page.getByRole('button', { name: /^Open full screen player:/ }).click();
    const player = page.getByRole('dialog', { name: 'The Distant Sun', exact: true });
    await player.getByRole('button', { name: 'Pause playback', exact: true }).click();
    await checkLayout(page);
    await audit(page, info, 'compact320-player');
    await checkAccessibility(page, info, 'compact320-player');
    const { waveform } = await streams.complete('the-distant-sun', player);
    await pointerSeek(player, 0.5);
    await seekSeconds(player, 3);
    await expect(playbackPosition(player)).toHaveValue('3');
    await expect(player.getByRole('button', { name: 'Play playback', exact: true })).toBeEnabled();
    await waveform.scrollIntoViewIfNeeded();
    await expect(waveform).toBeInViewport({ ratio: 1 });
    await checkLayout(page);
    await audit(page, info, 'compact320-waveform');
    await checkAccessibility(page, info, 'compact320-waveform');
    await player.getByRole('button', { name: 'Close full screen player', exact: true }).click();
    await page.goto('/playlists');
    await page.getByRole('button', { name: 'New Playlist', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Create New Playlist', exact: true });
    await expect(dialog.getByLabel('Playlist Name', { exact: true })).toBeFocused();
    await dialog.getByLabel('Playlist Name', { exact: true }).fill('Readable at 320 pixels');
    await checkLayout(page);
    await audit(page, info, 'compact320-dialog');
    await checkAccessibility(page, info, 'compact320-dialog');
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  }
  streams.assertClean(errors, info.project.name === 'mobile' ? { 'the-distant-sun': 1 } : {});
});
