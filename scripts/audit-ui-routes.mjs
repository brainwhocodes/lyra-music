import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const label = process.argv.includes('--after') ? 'after' : 'before';
const output = resolve(`.test-data/ui-${label}`);
const audit = JSON.parse(await readFile('docs/ui-route-audit.json', 'utf8'));
await mkdir(output, { recursive: true });
const origin = 'http://127.0.0.1:3100';
const browser = await chromium.launch();
const observations = [];
try {
  for (const [viewportName, viewport] of Object.entries(audit.viewports)) {
    const context = await browser.newContext({ viewport, isMobile: viewportName === 'mobile', hasTouch: viewportName !== 'desktop' });
    const page = await context.newPage();
    let errors = [];
    page.on('pageerror', (error) => errors.push({ kind: 'exception', message: error.message }));
    page.on('console', (message) => { if (message.type() === 'error') errors.push({ kind: 'console', message: message.text() }); });
    page.on('response', (response) => {
      if (response.url().startsWith(origin) && response.status() >= 400) errors.push({ kind: 'http', url: response.url(), status: response.status() });
    });
    page.on('requestfailed', (request) => {
      if (request.url().startsWith(origin)) errors.push({ kind: 'request', url: request.url(), message: request.failure()?.errorText });
    });
    const capture = async (route) => {
      errors = [];
      let failure;
      try {
        await page.goto(`${origin}${route.examplePath}`, { waitUntil: 'load', timeout: 30_000 });
        await page.waitForLoadState('networkidle', { timeout: 15_000 });
      } catch (error) { failure = String(error); }
      const slug = route.route === '/' ? 'landing' : route.route.replaceAll('/', '_').replaceAll(/[\[\]]/g, '').replace(/^_/, '');
      const filename = `${viewportName}-${slug}`;
      const headings = await page.getByRole('heading').allTextContents();
      const dimensions = await page.evaluate(() => ({ viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }));
      const controls = await page.locator('body *').evaluateAll((nodes) => nodes.filter((node) => {
        const style = getComputedStyle(node);
        const bounds = node.getBoundingClientRect();
        if (!bounds.width || !bounds.height || style.visibility === 'hidden' || style.display === 'none') return false;
        return node.matches('a,button,input,select,textarea,[role],[tabindex],[contenteditable],[onclick],[aria-haspopup],summary') ||
          (style.cursor === 'pointer' && (!node.parentElement || getComputedStyle(node.parentElement).cursor !== 'pointer'));
      }).map((node, index) => ({ index, tag: node.tagName.toLowerCase(), role: node.getAttribute('role'), name: node.getAttribute('aria-label') || node.getAttribute('title') || node.getAttribute('placeholder') || node.textContent?.trim().slice(0, 120), href: node.getAttribute('href'), disabled: node.disabled ?? false })));
      await page.screenshot({ path: join(output, `${filename}.png`), fullPage: true });
      await writeFile(join(output, `${filename}.inventory.json`), JSON.stringify(controls, null, 2));
      const observation = { route: route.route, viewport: viewportName, url: page.url(), headings, dimensions, horizontalOverflow: dimensions.documentWidth > dimensions.viewportWidth + 1, controlCount: controls.length, errors, failure, screenshot: `${filename}.png`, inventory: `${filename}.inventory.json` };
      observations.push(observation);
      console.log(`${viewportName} ${route.route}: ${controls.length} controls, ${errors.length} errors, overflow=${observation.horizontalOverflow}`);
    };
    for (const route of audit.routes.filter(({ route }) => ['/', '/login', '/register'].includes(route))) await capture(route);
    await page.goto(`${origin}/login`);
    await page.getByLabel('Email', { exact: true }).fill('listener@example.test');
    await page.getByLabel(/^Password/).fill('LocalMusicTest123!');
    await page.getByRole('button', { name: /^(Login|Log in|Sign in)$/ }).click();
    await page.waitForURL('**/library');
    for (const route of audit.routes.filter(({ route }) => !['/', '/login', '/register', '/logout'].includes(route))) await capture(route);
    await capture(audit.routes.find(({ route }) => route === '/logout'));
    await context.close();
  }
} finally {
  await browser.close();
  await writeFile(join(output, 'report.json'), JSON.stringify({ capturedOn: new Date().toISOString(), phase: label, source: 'Actual Chromium navigation against isolated production server; inventory is observation, not full journey proof.', observations }, null, 2));
}
