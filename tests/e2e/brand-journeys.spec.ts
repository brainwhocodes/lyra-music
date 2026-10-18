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
    return !!element.currentSrc && /^\/images\/lyra-radio\/rooftop-dj\.(png|webp)$/.test(new URL(element.currentSrc).pathname) && element.naturalWidth > 0 && element.naturalHeight > 0;
  }))).toBe(true);
  await audit(page, info, 'brand-landing');
  await checkAccessibility(page, info, 'brand-landing');
  await checkLayout(page);

  await page.getByRole('link', { name: 'Tune into radio', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/login');
  await expect(page.getByRole('button', { name: /^(Login|Log in|Sign in)$/ })).toBeVisible();
  await page.goto('/');
  await page.getByRole('link', { name: 'Open your library', exact: true }).click();
  await expect(page).toHaveURL(url => url.pathname === '/login');
  await page.goto('/');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();

  await login(page);
  await page.waitForLoadState('networkidle');
  for (const [name, pathname] of [
    ['Tune into radio', '/radio'],
    ['Open your library', '/library'],
    ['Build a station', '/settings/radio'],
    ['Explore your music', '/explore'],
    ['Browse your library', '/library'],
  ]) {
    await page.goto('/');
    await page.getByRole('link', { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(pathname + '$'));
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('');
    // Let the actual destination finish its data requests before deliberately
    // navigating away, so this journey does not create artificial API aborts.
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});
