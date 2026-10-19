import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium, expect } from '@playwright/test';

const directory = path.dirname(fileURLToPath(import.meta.url));
const output = process.env.LYRA_GALLERY_EVIDENCE_DIR
  ? path.resolve(process.env.LYRA_GALLERY_EVIDENCE_DIR)
  : path.join(directory, 'screenshots');
await fs.mkdir(output, { recursive: true });
const concepts = JSON.parse(await fs.readFile(path.join(directory, 'concepts.json'), 'utf8'));
const source = await fs.readFile(path.join(directory, 'index.html'), 'utf8');
const embedded = JSON.parse(source.match(/<script id="concept-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
expect(embedded).toEqual(concepts);
for (const concept of concepts) await fs.access(path.join(directory, concept.image));
const url = pathToFileURL(path.join(directory, 'index.html')).href;
const browser = await chromium.launch({ headless: true });
const assets = await Promise.all(concepts.map(async concept => {
  const bytes = await fs.readFile(path.join(directory, concept.image));
  return { number: concept.number, image: concept.image, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
}));
const evidence = { url, timestamp: new Date().toISOString(), sourceSha256: createHash('sha256').update(source).digest('hex'), assets, viewports: [], journeys: [], inventory: [], consoleErrors: [], failedRequests: [], negativeControl: null };
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
const page = await context.newPage();
page.on('console', message => { if (message.type() === 'error') evidence.consoleErrors.push(message.text()); });
page.on('pageerror', error => evidence.consoleErrors.push(error.message));
page.on('requestfailed', request => evidence.failedRequests.push(`${request.url()} ${request.failure()?.errorText}`));
async function ready() {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('main img')].map(image => image.decode())); });
  expect(await page.evaluate(() => [...document.querySelectorAll('.preview img')].every(image => image.naturalWidth > 0))).toBe(true);
}
async function inventory(label) {
  evidence.inventory.push({ label, controls: await page.locator('button, a[href], [tabindex]').evaluateAll(nodes => nodes.filter(node => node.getClientRects().length).map(node => ({ tag: node.tagName, name: node.getAttribute('aria-label') || node.innerText.trim(), disabled: node.disabled || false }))) });
}
try {
  await page.goto(url); await ready();
  await expect(page.getByRole('heading', { name: /Ten ways to find your frequency/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^View \d/ })).toHaveCount(10);
  await inventory('Desktop gallery');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fontChecks = await page.evaluate(() => ({ display: document.fonts.check('800 48px "Barlow Condensed"'), reading: document.fonts.check('400 14px "Space Grotesk"') }));
  expect(fontChecks).toEqual({ display: true, reading: true });
  await page.screenshot({ path: path.join(output, 'desktop.png'), fullPage: true });
  evidence.viewports.push({ width: 1440, height: 1000, screenshot: 'desktop.png', fontChecks, horizontalOverflow: false });
  for (const concept of concepts) {
    const label = `${String(concept.number).padStart(2, '0')} ${concept.name}`;
    const trigger = page.getByRole('button', { name: `View ${label}`, exact: true });
    await trigger.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close ✕', exact: true })).toBeFocused();
    if (concept.number === 1) await expect(page.getByRole('button', { name: 'Previous concept', exact: true })).toBeDisabled();
    else await expect(page.getByRole('button', { name: 'Previous concept', exact: true })).toBeEnabled();
    if (concept.number === 10) await expect(page.getByRole('button', { name: 'Next concept', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).not.toBeVisible(); await expect(trigger).toBeFocused();
    evidence.journeys.push(`Open ${label}; title matches; close focus; Escape; focus returns`);
  }
  await page.getByRole('button', { name: 'View 01 Rooftop selector', exact: true }).click();
  await inventory('Concept viewer');
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('link', { name: 'Open original 01 Rooftop selector in a new tab', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Zoom in +', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Next concept', exact: true })).toBeFocused();
  evidence.journeys.push('Native modal traps keyboard focus inside viewer');
  await page.getByRole('button', { name: 'Next concept', exact: true }).click();
  await expect(page.getByRole('heading', { name: '02 Record shop', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Previous concept', exact: true }).click();
  await expect(page.getByRole('heading', { name: '01 Rooftop selector', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight'); await expect(page.getByRole('heading', { name: '02 Record shop', exact: true })).toBeVisible();
  await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('heading', { name: '01 Rooftop selector', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zoom in +', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Fit to screen −', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const stage = page.getByLabel('Concept image; scroll to explore when zoomed', { exact: true });
  expect(await stage.evaluate(node => node.scrollWidth > node.clientWidth)).toBe(true);
  await stage.focus(); await page.keyboard.press('ArrowRight');
  await expect.poll(() => stage.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: '01 Rooftop selector', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Fit to screen −', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Zoom in +', exact: true })).toHaveAttribute('aria-pressed', 'false');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'Open original 01 Rooftop selector in a new tab', exact: true }).click();
  const popup = await popupPromise; await popup.waitForLoadState('load');
  expect(popup.url()).toBe(new URL(concepts[0].image, url).href);
  expect(await popup.locator('img').evaluate(image => image.naturalWidth > 0)).toBe(true); await popup.close();
  await page.getByRole('button', { name: 'Close ✕', exact: true }).click(); await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'View 01 Rooftop selector', exact: true })).toBeFocused();
  evidence.journeys.push('Next/previous buttons and arrows change concept; zoom expands image; keyboard scrolls zoomed image; fit restores; original opens decoded local image; close restores focus');
  await page.getByRole('link', { name: 'Compact overview ↗', exact: true }).click(); await ready();
  await expect(page.getByRole('link', { name: 'Detailed gallery ↗', exact: true })).toBeVisible(); expect(new URL(page.url()).search).toBe('?overview=1');
  await page.screenshot({ path: path.join(output, 'overview.png'), fullPage: true });
  await page.getByRole('link', { name: 'Detailed gallery ↗', exact: true }).click(); await ready(); expect(new URL(page.url()).search).toBe('');
  await page.getByRole('link', { name: 'Back to top ↑', exact: true }).click(); await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  evidence.journeys.push('Overview link switches compact mode; detailed link restores full captions; back to top scrolls to start');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 }); await page.goto(url); await ready(); await inventory(`Mobile ${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'View 05 Listening desk', exact: true }).click();
    await expect(page.getByRole('heading', { name: '05 Listening desk', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(output, `viewer-${width}.png`) });
    await page.getByRole('button', { name: 'Zoom in +', exact: true }).click(); await expect(page.getByRole('button', { name: 'Fit to screen −', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Escape'); await expect(page.getByRole('button', { name: 'View 05 Listening desk', exact: true })).toBeFocused();
    evidence.viewports.push({ width, height: 844, screenshot: `mobile-${width}.png`, dialogScreenshot: `viewer-${width}.png`, horizontalOverflow: false });
  }
  // Negative control: remove the first trigger's listener in a disposable browser page.
  // The normal visibility assertion must fail; production source remains untouched.
  const negative = await context.newPage(); await negative.goto(url);
  const first = negative.getByRole('button', { name: 'View 01 Rooftop selector', exact: true });
  await first.evaluate(node => node.replaceWith(node.cloneNode(true))); await first.click();
  let detected = false; try { await expect(negative.getByRole('dialog')).toBeVisible({ timeout: 300 }); } catch { detected = true; }
  expect(detected).toBe(true); evidence.negativeControl = 'Missing open handler detected by visible-dialog assertion; only disposable browser DOM altered'; await negative.close();
  expect(evidence.consoleErrors).toEqual([]); expect(evidence.failedRequests).toEqual([]);
  evidence.passed = true;
} finally {
  await fs.writeFile(path.join(output, 'verification.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  await browser.close();
}
console.log(`Gallery verified: ${concepts.length} concepts; desktop, 390px and 320px; modal, keyboard, zoom, original links, overview and negative control. Evidence: ${output}`);
