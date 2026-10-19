import { expect, type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFile } from 'node:fs/promises';

export const credentials = { email: 'listener@example.test', password: 'LocalMusicTest123!' };
export async function login(page: Page) {
  await page.goto('/login');
  if (process.env.LYRA_E2E_DEV === '1') await page.waitForLoadState('networkidle');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: /^(Login|Log in|Sign in)$/ }).click();
  await expect(page).toHaveURL(/\/library$/);
  await expect(page.getByRole('heading', { name: 'Albums', exact: true })).toBeVisible();
}
export async function navigate(page: Page, name: string, _isMobile?: boolean) {
  const toggle = page.getByRole('button', { name: 'Open navigation menu' });
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  await page.getByRole('navigation', { name: 'Main navigation', exact: true }).getByRole('link', { name, exact: true }).click();
  const expected = name === 'Discover' ? 'discovery' : name === 'Radio Stations' ? 'settings/radio' : name.toLowerCase();
  await expect(page).toHaveURL(new RegExp('/' + expected + '$'));
}
export function guard(page: Page, allowedStatuses: Array<{ path: string; status: number }> = [], allowedAbortPaths: string[] = []) {
  const errors: string[] = [];
  page.on('request', request => {
    const host = new URL(request.url()).hostname;
    if (/(^|\.)(iconify\.design|simplesvg\.com|unisvg\.com)$/.test(host)) errors.push('External icon request: ' + request.url());
  });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const expected = allowedStatuses.some(({ path, status }) => message.location().url === 'http://127.0.0.1:3100' + path && message.text().startsWith('Failed to load resource: the server responded with a status of ' + status));
    if (message.type() === 'error' && !expected) errors.push(message.text());
  });
  page.on('requestfailed', request => {
    const expectedAbort = request.failure()?.errorText === 'net::ERR_ABORTED' && (request.isNavigationRequest() || /\/api\/tracks\/[^/]+\/play(?:\?|$)/.test(request.url()) || allowedAbortPaths.some(path => request.url() === 'http://127.0.0.1:3100' + path));
    if (request.url().startsWith('http://127.0.0.1:3100') && !expectedAbort) errors.push(request.method() + ' ' + request.url() + ': ' + request.failure()?.errorText);
  });
  page.on('response', response => {
    const url = new URL(response.url());
    if (url.origin === 'http://127.0.0.1:3100' && response.status() >= 400 && !allowedStatuses.some(({ path, status }) => path === url.pathname && status === response.status())) errors.push(response.status() + ' ' + url.pathname);
  });
  return errors;
}
export async function audit(page: Page, info: TestInfo, name: string) {
  // Opening transitions may have a deliberate opacity delay. Wait for their
  // actual completion before recording the visible state; leave infinite
  // loading indicators running and never disable application animation.
  await page.evaluate(async () => {
    await Promise.allSettled(document.getAnimations().filter(animation => animation.playState === 'running' && Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation => animation.finished));
  });
  // Read-only inventory; never used to operate UI or infer business state.
  const elements = await page.locator('body *').evaluateAll(nodes => nodes.filter(node => {
    const style = getComputedStyle(node), bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height || style.visibility === 'hidden' || style.display === 'none') return false;
    return node.matches('a,button,input,select,textarea,[role],[tabindex],[contenteditable],[onclick],[aria-haspopup],summary') ||
      (style.cursor === 'pointer' && (!node.parentElement || getComputedStyle(node.parentElement).cursor !== 'pointer'));
  }).map((node, index) => ({
    index, tag: node.tagName.toLowerCase(), role: node.getAttribute('role'), pointerCandidate: getComputedStyle(node).cursor === 'pointer',
    name: node.getAttribute('aria-label') || ((node as HTMLInputElement).labels ? [...(node as HTMLInputElement).labels!].map(label => label.textContent?.trim()).join(' ') : '') || node.getAttribute('title') || node.getAttribute('placeholder') || node.textContent?.trim().slice(0, 120),
    href: node.getAttribute('href'), disabled: (node as HTMLButtonElement).disabled ?? false,
  })));
  await info.attach(name + '-interactive-inventory', { body: JSON.stringify(elements, null, 2), contentType: 'application/json' });
  await writeFile(info.outputPath(name + '.inventory.json'), JSON.stringify(elements, null, 2));
  // Full-page mobile capture can move scroll by a pixel, correctly dismissing
  // an anchored menu. Transient/focused states use the actual viewport so
  // collecting evidence cannot change the keyboard behavior being verified.
  const fullPage = ((name.startsWith('route-') || name.startsWith('compact320-')) && !/(player|dialog|analysis|waveform)$/.test(name)) || ['text200-radio', 'text200-radio-detail'].includes(name);
  await page.screenshot({ path: info.outputPath(name + '.png'), fullPage });
}
export async function checkLayout(page: Page, soft = false) {
  // Geometry is a read-only diagnostic for responsive overflow.
  const dimensions = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
  // Mobile browsers can expand innerWidth to fit overflowing content. Compare
  // against the configured device viewport so that shrink-to-fit cannot hide it.
  const viewport = page.viewportSize()?.width ?? dimensions.viewport;
  (soft ? expect.soft : expect)(dimensions.document, JSON.stringify({ ...dimensions, deviceViewport: viewport })).toBeLessThanOrEqual(viewport + 1);
}
export async function checkCompactControlSpacing(page: Page, trackTitle?: string) {
  const search = page.getByRole('textbox', { name: 'Search library', exact: true });
  // The decorative icon has no accessible role. Inspect its adjacent rendered
  // box only to verify that actual text padding reserves the occupied inset.
  const inset = await search.evaluate(input => {
    const bounds = input.getBoundingClientRect();
    const icon = input.nextElementSibling?.getBoundingClientRect();
    return { padding: parseFloat(getComputedStyle(input).paddingRight), occupied: icon ? bounds.right - icon.left : 0, iconWidth: icon?.width || 0 };
  });
  expect.soft(inset.iconWidth, 'The rendered search icon must be measured').toBeGreaterThan(0);
  expect.soft(inset.padding, 'Search text must reserve the full icon inset').toBeGreaterThanOrEqual(inset.occupied);
  if (trackTitle) {
    const row = page.getByRole('row', { name: new RegExp(trackTitle) });
    const title = await row.getByRole('button', { name: 'Play ' + trackTitle, exact: true }).boundingBox();
    const duration = await row.getByRole('cell', { name: '0:12', exact: true }).boundingBox();
    expect(title).not.toBeNull();
    expect(duration).not.toBeNull();
    const separate = title!.x + title!.width <= duration!.x + 1 || duration!.x + duration!.width <= title!.x + 1 || title!.y + title!.height <= duration!.y + 1 || duration!.y + duration!.height <= title!.y + 1;
    expect.soft(separate, 'Track title and duration boxes must not intersect: ' + JSON.stringify({ title, duration })).toBe(true);
  }
}
export async function checkAccessibility(page: Page, info: TestInfo, name: string, soft = false) {
  const result = await new AxeBuilder({ page }).analyze();
  await info.attach(name + '-axe', { body: JSON.stringify(result.violations, null, 2), contentType: 'application/json' });
  (soft ? expect.soft : expect)(result.violations.filter(violation => ['serious', 'critical'].includes(violation.impact ?? '')), name).toEqual([]);
}
