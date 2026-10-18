import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname, extname } from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const directory = dirname(fileURLToPath(import.meta.url));
const output = resolve(directory, 'after');
await mkdir(output, { recursive: true });
const root = resolve(directory, '../../../..');
const server = createServer(async (request, response) => {
  try {
    let path = new URL(request.url, 'http://127.0.0.1:3210').pathname;
    if (path.startsWith('/fonts/')) path = '/public' + path;
    const allowed = path === '/docs/design/lyra-radio/controls-v3/control-kit.html' || ['/assets/fonts.css','/assets/control-kit.css','/tests/fixtures/music/README.md','/tests/fixtures/music/audio/the-distant-sun.mp3'].includes(path) || path.startsWith('/public/fonts/lyra-radio/') || path.startsWith('/public/images/lyra-radio/');
    if (!allowed || path.includes('..')) { response.writeHead(404); response.end(); return; }
    const bytes = await readFile(resolve(root, '.' + path));
    const types = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.md':'text/plain; charset=utf-8', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.mp3':'audio/mpeg' };
    const headers = { 'Content-Type': types[extname(path)] ?? 'application/octet-stream', 'Accept-Ranges':'bytes' };
    const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? '');
    if (range) {
      const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end || start >= bytes.length) { response.writeHead(416); response.end(); return; }
      response.writeHead(206, { ...headers, 'Content-Length':end-start+1, 'Content-Range':`bytes ${start}-${end}/${bytes.length}` }); response.end(bytes.subarray(start,end+1));
    } else { response.writeHead(200, { ...headers, 'Content-Length':bytes.length }); response.end(bytes); }
  } catch { response.writeHead(404); response.end(); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3210, '127.0.0.1', resolve); });
const origin = 'http://127.0.0.1:3210';
const browser = await chromium.launch();
const report = { artifact: 'control-kit.html', sourceStyles: ['assets/fonts.css', 'assets/control-kit.css'], browser: await browser.version(), viewports: [], coverage: [], negativeControl: null };
const cover = (names, actions, assertions) => names.forEach(name => report.coverage.push({ name, status: 'covered', testedBy: 'render-control-kit.mjs', actions, assertions }));
try {
  for (const [name, width] of [['desktop',1440], ['mobile',390], ['compact',320]]) {
    const context = await browser.newContext({ viewport: { width, height: 960 } });
    const page = await context.newPage();
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()} ${request.failure()?.errorText}`));
    page.on('request', request => requests.push(request.url()));
    await page.goto(origin + '/docs/design/lyra-radio/controls-v3/control-kit.html');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { name: 'Forms & listening controls' })).toBeVisible();
    const assets = await page.evaluate(() => ({
      fonts: [['Barlow Condensed',700],['Barlow Condensed',800],['Space Grotesk',400],['Space Grotesk',700]].map(([family,weight]) => ({ family, weight, loaded: [...document.fonts].some(face => { const [min,max=min] = face.weight.split(' ').map(Number); return face.family === family && face.status === 'loaded' && weight >= min && weight <= max; }) })),
      images: [...document.images].map(image => ({ src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight })),
      loadedFaces: [...document.fonts].filter(font => font.status === 'loaded').map(font => ({ family: font.family, weight: font.weight })),
    }));
    assert.ok(assets.fonts.every(font => font.loaded));
    assert.ok(assets.images.every(image => image.width > 0));
    if (name !== 'compact') {
      await page.getByLabel('Default text', { exact: true }).fill('Late night');
      await expect(page.getByLabel('Default text', { exact: true })).toHaveValue('Late night');
      await page.getByLabel('Search', { exact: true }).fill('Ambient');
      await page.getByRole('button', { name: 'Clear search' }).click();
      await expect(page.getByLabel('Search', { exact: true })).toHaveValue('');
      await expect(page.getByLabel('Search', { exact: true })).toBeFocused();
      if (name === 'desktop') {
        try { assert.equal(await page.getByLabel('Search', { exact: true }).inputValue(), 'Ambient'); throw new Error('Negative control unexpectedly passed'); }
        catch (error) { assert.equal(error.code, 'ERR_ASSERTION'); report.negativeControl = 'Deliberately expecting the old Ambient value after Clear failed with actual empty value.'; }
      }
      await page.getByLabel('Genre', { exact: true }).selectOption('Rock');
      await expect(page.getByLabel('Genre', { exact: true })).toHaveValue('Rock');
      await page.getByLabel('Description', { exact: true }).fill('A late-night selection for quiet listening.');
      await expect(page.getByLabel('Description', { exact: true })).toHaveValue('A late-night selection for quiet listening.');
      await page.getByLabel('Year', { exact: true }).fill('2020'); await page.getByLabel('Year', { exact: true }).press('ArrowUp');
      await expect(page.getByLabel('Year', { exact: true })).toHaveValue('2021');
      await page.getByLabel('Track number', { exact: true }).fill('1'); await page.getByLabel('Track number', { exact: true }).press('ArrowUp');
      await expect(page.getByLabel('Track number', { exact: true })).toHaveValue('2');
      await page.getByLabel('Album cover', { exact: true }).setInputFiles(resolve(directory, '../../../../public/images/lyra-radio/mark.png'));
      await expect(page.getByText('Selected: mark.png')).toBeVisible();
      await page.getByLabel('Focus appearance', { exact: true }).fill('Late night');
      await expect(page.getByLabel('Focus appearance', { exact: true })).toBeFocused();
      assert.equal(await page.getByLabel('Focus appearance', { exact: true }).evaluate(element => getComputedStyle(element).outlineWidth), '3px');
      await page.getByLabel('Validation error', { exact: true }).fill('A name');
      await expect(page.getByLabel('Validation error', { exact: true })).toHaveAttribute('aria-invalid','false');
      await page.getByLabel('Validation error', { exact: true }).fill('');
      await expect(page.getByText('Enter a name.', { exact: true })).toBeVisible();
      await expect(page.getByLabel('Disabled field', { exact: true })).toBeDisabled();
      await expect(page.getByLabel('Disabled choice', { exact: true })).toBeDisabled();
      await page.getByLabel('Explicit', { exact: true }).check(); await expect(page.getByLabel('Explicit', { exact: true })).toBeChecked();
      await page.getByRole('radio', { name: 'Option two' }).check(); await expect(page.getByRole('radio', { name: 'Option two' })).toBeChecked();
      await page.getByRole('radio', { name: 'Option one' }).check(); await expect(page.getByRole('radio', { name: 'Option one' })).toBeChecked();
      await page.getByRole('switch', { name: 'Toggle example' }).press('Space'); await expect(page.getByRole('switch', { name: 'Toggle example' })).toBeChecked();
      const actions = page.getByRole('region', { name: 'Action states' });
      for (const action of ['Save','Cancel','Clear','Delete']) { await actions.getByRole('button', { name: action, exact: true }).click(); await expect(actions.getByRole('status')).toContainText(`${action} activated`); }
      await expect(actions.getByRole('button', { name: 'Disabled', exact: true })).toBeDisabled();
      await expect(actions.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled();
      const playlist = page.getByRole('form', { name: 'Create playlist specimen' });
      await expect(playlist.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
      await playlist.getByLabel('Playlist Name', { exact: true }).fill('Late night');
      await playlist.getByRole('button', { name: 'Create', exact: true }).press('Enter');
      await expect(playlist.getByRole('status')).toContainText('Late night');
      await playlist.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(playlist.getByLabel('Playlist Name', { exact: true })).toHaveValue('');
      await expect(playlist.getByRole('button', { name: 'Create', exact: true })).toBeDisabled();
      const login = page.getByRole('form', { name: 'Login specimen' });
      await login.getByRole('button', { name: 'Login', exact: true }).click(); await expect(login.getByRole('status')).toHaveText('Enter a valid email address.');
      await login.getByLabel('Email', { exact: true }).fill('listener@example.com');
      await login.getByRole('button', { name: 'Login', exact: true }).click(); await expect(login.getByRole('status')).toHaveText('Password must be at least 8 characters.');
      await login.getByLabel('Password', { exact: true }).fill('specimen-only');
      await login.getByRole('button', { name: 'Show password' }).click(); await expect(login.getByLabel('Password', { exact: true })).toHaveAttribute('type','text');
      await login.getByRole('button', { name: 'Hide password' }).click(); await expect(login.getByLabel('Password', { exact: true })).toHaveAttribute('type','password');
      await login.getByRole('button', { name: 'Login', exact: true }).click(); await expect(login.getByRole('status')).toHaveText('Preview only. No sign-in request was sent.');
      const player = page.getByRole('region', { name: 'Listening controls' });
      await player.getByRole('button', { name: 'Play demo audio' }).click();
      // Native audio has no accessible role; read-only media state proves actual decoding.
      await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(.1);
      await player.getByRole('button', { name: 'Pause demo audio' }).click();
      const seek = player.getByRole('slider', { name: 'Seek demo audio' });
      await seek.focus(); await seek.press('Home'); await seek.press('ArrowRight');
      await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(0);
      const rect = await seek.boundingBox(); await seek.click({ position: { x: rect.width / 4, y: rect.height / 2 } });
      await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeGreaterThan(2);
      await expect.poll(() => page.locator('audio').evaluate(audio => audio.currentTime)).toBeLessThan(4);
      await expect(player.getByRole('button', { name: 'Shuffle', exact: true })).toBeDisabled(); await expect(player.getByRole('button', { name: 'Previous track' })).toBeDisabled(); await expect(player.getByRole('button', { name: 'Next track' })).toBeDisabled();
      const repeat = player.getByRole('button', { name: 'Repeat demo audio' }); await repeat.press('Space'); await expect(repeat).toHaveAttribute('aria-pressed','true');
      const volumeToggle = player.getByRole('button', { name: 'Volume', exact: true });
      const volume = player.getByRole('slider', { name: 'Volume', exact: true });
      await expect(volume).toBeHidden(); await volumeToggle.press('Enter'); await expect(volume).toBeVisible();
      await volume.focus(); await volume.press('Home');
      await expect(player.getByRole('button', { name: 'Unmute', exact: true })).toBeVisible();
      await player.getByRole('button', { name: 'Unmute', exact: true }).click(); await expect(volume).toHaveValue('1');
      await volume.press('ArrowLeft'); await expect(volume).toHaveValue('0.95');
      await player.getByRole('button', { name: 'Mute', exact: true }).click(); await expect(volume).toHaveValue('0');
      await player.getByRole('button', { name: 'Unmute', exact: true }).click(); await expect(volume).toHaveValue('0.95');
      await volume.focus(); await volume.press('Escape'); await expect(volume).toBeHidden(); await expect(volumeToggle).toBeFocused();
      const [credits] = await Promise.all([page.waitForEvent('popup'), page.getByRole('link', { name: 'Music credits & license' }).click()]);
      await credits.waitForLoadState(); await expect(credits.locator('body')).toContainText('CC BY 4.0'); await credits.close();
      if (name === 'desktop') {
        cover(['Default text','Search','Clear search','Genre','Description','Year','Track number','Album cover','Focus appearance','Validation error'], ['fill, clear, select, increment, choose local file, focus'], ['native values change; error/focus/file feedback matches']);
        cover(['Explicit','Option one','Option two','Toggle example'], ['check or keyboard Space'], ['native checked state matches']);
        cover(['Save','Cancel (action)','Clear','Delete'], ['activate each action'], ['local-only feedback names activated action']);
        cover(['Playlist Name','Create','Cancel (playlist)'], ['empty disabled, fill, Enter submit, reset'], ['preview names input; reset clears field and disables Create']);
        cover(['Email','Password','Show/Hide password','Login'], ['invalid submits, valid fill, toggle visibility, submit'], ['validation messages and input types; no sign-in request']);
        cover(['Play/Pause demo audio','Seek demo audio','Repeat demo audio','Volume range','Mute/Unmute'], ['play actual MP3; pause; keyboard/pointer seek; repeat; range and mute'], ['native media currentTime/volume and pressed state match controls']);
        cover(['Volume disclosure'], ['Enter opens; Escape from range closes'], ['range initially hidden; panel visible; focus returns to Volume']);
        cover(['Music credits & license'], ['open local credits link'], ['existing attribution document contains CC BY 4.0']);
        for (const control of ['Disabled field','Disabled choice','Disabled','Saving…','Shuffle','Previous track','Next track']) report.coverage.push({ name: control, status: 'state-asserted', testedBy: 'render-control-kit.mjs', actions: ['inspect intentionally disabled state'], assertions: ['native disabled is true'] });
      }
    }
    const accessibility = await new AxeBuilder({ page }).analyze();
    assert.deepEqual(accessibility.violations, [], JSON.stringify(accessibility.violations.map(value => ({ id:value.id, nodes:value.nodes.map(node=>node.target) }))));
    // Include controls inside the closed native disclosure; they were operated above.
    const inventory = await page.locator('a[href],button,input,textarea,select,summary').evaluateAll(elements => elements.map(element => ({ tag: element.tagName.toLowerCase(), type: element.getAttribute('type'), name: element.getAttribute('aria-label') || element.labels?.[0]?.textContent?.trim() || element.textContent?.trim(), disabled: element.disabled })));
    const geometry = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, textMinimum: Math.min(...[...document.querySelectorAll('label,p,button,input,select,textarea,footer')].filter(element => element.getBoundingClientRect().width).map(element => parseFloat(getComputedStyle(element).fontSize))) }));
    assert.ok(geometry.width <= width, JSON.stringify(geometry)); assert.ok(geometry.textMinimum >= 14);
    assert.deepEqual(errors, []); assert.ok(requests.every(url => url.startsWith(origin)));
    const png = await page.screenshot({ path: resolve(output, `control-kit-${name}.png`), fullPage: true });
    let volumeScreenshot = null;
    if (name !== 'compact') {
      const player = page.getByRole('region', { name: 'Listening controls' });
      await player.getByRole('button', { name: 'Volume', exact: true }).click();
      await expect(player.getByRole('slider', { name: 'Volume', exact: true })).toBeVisible();
      const volumeAxe = await new AxeBuilder({page}).analyze(); assert.deepEqual(volumeAxe.violations, []);
      const volumePng = await player.screenshot({ path:resolve(output,`control-kit-volume-${name}.png`) });
      volumeScreenshot = { path:`after/control-kit-volume-${name}.png`, sha256:createHash('sha256').update(volumePng).digest('hex') };
    }
    report.viewports.push({ name, width, screenshot: `after/control-kit-${name}.png`, sha256:createHash('sha256').update(png).digest('hex'), volumeScreenshot, assets, geometry, inventory, accessibilityViolations:0, errors, externalRequests:0 });
    await context.close();
  }
  await writeFile(resolve(output, 'control-kit-verification.json'), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify({ viewports: report.viewports.map(({ name, geometry, screenshot })=>({name,geometry,screenshot})), coverage:report.coverage.length, negativeControl:report.negativeControl, errors:0 },null,2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
