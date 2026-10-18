import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = new URL('./', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1680 }, deviceScaleFactor: 1 });
  const failures = [], fontResponses = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => {
    if (response.url().includes('fonts.gstatic.com')) fontResponses.push({ url: response.url(), status: response.status() });
    if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
  });
  await page.goto(new URL('brand-board.html', directory).href, { waitUntil: 'networkidle' });
  const evidence = await page.evaluate(async () => {
    const specimens = [
      '700 32px "Barlow Condensed"', '800 32px "Barlow Condensed"',
      '400 32px "Space Grotesk"', '500 32px "Space Grotesk"',
      '600 32px "Space Grotesk"', '700 32px "Space Grotesk"',
    ];
    await Promise.all(specimens.map(font => document.fonts.load(font, 'LYRA0123456789')));
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    const fonts = specimens.map(font => ({ font, loaded: document.fonts.check(font, 'LYRA0123456789') }));
    const images = [...document.images].map(image => ({ src: image.getAttribute('src'), width: image.naturalWidth, height: image.naturalHeight, complete: image.complete }));
    const smallText = [...document.querySelectorAll('*')].filter(element => [...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())).map(element => ({ text: element.textContent.trim().slice(0, 60), size: parseFloat(getComputedStyle(element).fontSize) })).filter(item => item.size < 14);
    const interactive = [...document.querySelectorAll('a,button,input,select,textarea,[tabindex]')].map(element => element.outerHTML);
    const panels = [...document.querySelectorAll('.panel')].map(element => ({ label: element.getAttribute('aria-labelledby') || 'artwork', width: element.clientWidth, height: element.clientHeight, overflowX: element.scrollWidth > element.clientWidth, overflowY: element.scrollHeight > element.clientHeight }));
    return { fonts, images, smallText, interactive, panels, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
  });
  const invalid = failures.length || evidence.fonts.some(font => !font.loaded) || evidence.images.some(image => !image.complete || !image.width) || evidence.smallText.length || evidence.width !== 1440 || evidence.panels.some(panel => panel.overflowX || panel.overflowY);
  await writeFile(new URL('brand-board.verification.json', directory), JSON.stringify({ capturedAt: new Date().toISOString(), url: new URL('brand-board.html', directory).href, failures, fontResponses, ...evidence }, null, 2));
  await page.screenshot({ path: fileURLToPath(new URL('brand-board.png', directory)), fullPage: true });
  console.log(JSON.stringify({ valid: !invalid, width: evidence.width, height: evidence.height, fonts: evidence.fonts, images: evidence.images.length, smallText: evidence.smallText, panels: evidence.panels, failures }, null, 2));
  if (invalid) process.exitCode = 1;
} finally {
  await browser.close();
}
