import { test, expect } from '@playwright/test';
import { audit, checkAccessibility, checkLayout, guard, login } from './helpers';
import { checkRadioBrandFonts, checkRadioBrandHeading } from './brand-assertions';

test('the radio landing loads its real brand fonts and routes every listening CTA', async ({ page }, info) => {
  const errors = guard(page, [{ path: '/api/auth/me', status: 401 }]);
  await page.goto('/');
  await checkRadioBrandHeading(page);
  const fonts = await checkRadioBrandFonts(page);
  await info.attach('rendered-brand-fonts', { body: JSON.stringify(fonts, null, 2), contentType: 'application/json' });
  // Native image state establishes that the generated hero reached the browser
  // and decoded; this read does not drive or infer application state.
  await expect.poll(() => page.getByRole('img').evaluateAll(images => images.some(image => {
    const element = image as HTMLImageElement;
    return !!element.currentSrc && /^\/images\/responsive\/rooftop-dj-\d+\.(avif|webp)$/.test(new URL(element.currentSrc).pathname) && element.naturalWidth > 0 && element.naturalHeight > 0;
  }))).toBe(true);
  await audit(page, info, 'brand-landing');
  await checkAccessibility(page, info, 'brand-landing');
  await checkLayout(page);

  await page.getByRole('link', { name: 'Try a search', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/login');
  await expect(page.getByRole('button', { name: /^(Login|Log in|Sign in)$/ })).toBeVisible();
  await page.goto('/features');
  await page.getByRole('link', { name: 'Open your library', exact: true }).first().click();
  await expect(page).toHaveURL(url => url.pathname === '/login');
  for (const index of [0, 1]) {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create an account', exact: true }).nth(index).click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  }

  await login(page);
  await page.waitForLoadState('networkidle');
  for (const [source, name, pathname] of [
    ['/features', 'Find your station', '/radio'],
    ['/features', 'Open your library', '/library'],
    ['/features', 'Choose a track', '/tracks'],
    ['/features', 'Explore your collection', '/explore'],
    ['/', 'Try a search', '/explore'],
  ]) {
    await page.goto(source);
    const count = await page.getByRole('link', { name, exact: true }).count();
    for (let index = 0; index < count; index++) {
      if (index) await page.goto(source);
      await page.getByRole('link', { name, exact: true }).nth(index).click();
      await expect(page).toHaveURL(new RegExp(pathname + '$'));
      await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
      // Finish real destination requests before deliberately navigating away.
      await page.waitForLoadState('networkidle');
    }
  }
  expect(errors).toEqual([]);
});

test('long landing pages load responsive art and expose keyboard-operable questions', async ({ page }, info) => {
  const errors = guard(page, [{ path: '/api/auth/me', status: 401 }]);
  for (const route of ['/', '/features', '/self-host']) {
    await page.goto(route);
    await expect(page.getByRole('main')).toHaveCount(1);
    const questions = page.locator('details summary');
    expect(await questions.count()).toBeGreaterThanOrEqual(3);
    for (const question of await questions.all()) {
      const details = question.locator('..');
      const wasOpen = await details.getAttribute('open') !== null;
      await question.focus();
      await page.keyboard.press('Enter');
      await expect.poll(async () => await details.getAttribute('open') !== null).toBe(!wasOpen);
      await page.keyboard.press('Space');
      await expect.poll(async () => await details.getAttribute('open') !== null).toBe(wasOpen);
    }
    // Scroll through the real page to exercise lazy decoding before inspecting
    // browser-selected URLs. No mocked assets or app-state injection.
    const images = page.locator('picture.responsive-artwork img');
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    }
    const assets = await images.evaluateAll(nodes => nodes.map(node => {
      const img = node as HTMLImageElement;
      return { url: new URL(img.currentSrc).pathname, width: img.getBoundingClientRect().width, dpr: devicePixelRatio, loading: img.loading, sizes: img.sizes };
    }));
    expect(assets.length).toBeGreaterThan(0);
    expect(assets.every(asset => /\/images\/responsive\/.+-\d+\.(avif|webp)$/.test(asset.url) && asset.sizes)).toBe(true);
    await info.attach('responsive-images-' + (route.slice(1) || 'home'), { body: JSON.stringify(assets, null, 2), contentType: 'application/json' });
    await checkLayout(page);
    await checkAccessibility(page, info, 'landing-' + (route.slice(1) || 'home'));
    await audit(page, info, 'marketing-' + (route.slice(1) || 'home'));
    await page.screenshot({ path: info.outputPath('landing-' + (route.slice(1) || 'home') + '.png'), fullPage: true });
  }
  expect(errors).toEqual([]);
});
