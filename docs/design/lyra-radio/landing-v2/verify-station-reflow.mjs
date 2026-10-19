import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import { compileStyle } from 'vue/compiler-sfc';
import sharp from 'sharp';

// A targeted readability regression complements document-width checks.
// A heading needs at least 2.5em of usable width; the failed design gave
// Features about 0.3em at 200% text, creating single-character vertical strips.
const candidate = process.argv.includes('--candidate');
const negativeControl = process.argv.includes('--negative-control');
const output = new URL(candidate ? './iterations/station-candidate/' : negativeControl ? './iterations/station-negative-control/' : './after/station-reflow/', import.meta.url);
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];
for (const [name, route, selector, source] of [
  ['home', '/', '.lp-collection--stations', '../../../../components/marketing-collection-preview.vue'],
  ['features', '/features', '.features-stations', '../../../../pages/features.vue'],
]) {
  for (const [width, textScale] of [[390, 1], [320, 1], [320, 2]]) {
    const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
    await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil: 'networkidle' });
    if (textScale === 2) await page.addStyleTag({ content: 'html { font-size:200% !important; }' });
    if (candidate) {
      const file = await fs.readFile(new URL(source, import.meta.url), 'utf8');
      const css = file.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1];
      if (!css) throw new Error(`No scoped CSS found in ${source}`);
      // The exact pending component stylesheet is injected only for this
      // explicitly labeled pre-build experiment, never final production proof.
      const scopeId = await page.locator(`${selector} > div`).first().evaluate(node => node.getAttributeNames().find(attribute => attribute.startsWith('data-v-')));
      if (!scopeId) throw new Error('Missing observed Vue scope attribute');
      const compiled = compileStyle({ source: css, filename: source, id: scopeId, scoped: true });
      if (compiled.errors.length) throw new Error(compiled.errors.join('\n'));
      await page.addStyleTag({ content: compiled.code });
    }
    await page.evaluate(() => document.fonts.ready);
    const panel = page.locator(selector);
    await panel.scrollIntoViewIfNeeded();
    for (const img of await panel.locator('img').all()) await img.evaluate(i => i.decode().catch(() => {}));
    const headings = await panel.locator('h3').evaluateAll(nodes => nodes.map(node => {
      const width = node.getBoundingClientRect().width;
      const fontSize = parseFloat(getComputedStyle(node).fontSize);
      return { text: node.textContent.trim(), width, fontSize, widthInEm: width / fontSize, readable: width >= fontSize * 2.5 };
    }));
    // Crop an actual full-page capture. Chromium's very tall element capture
    // can pull a fixed, offscreen skip-link into its expanded clip.
    const bounds = await panel.evaluate(node => { const r = node.getBoundingClientRect(); return { left: Math.floor(r.left + scrollX), top: Math.floor(r.top + scrollY), width: Math.ceil(r.width), height: Math.ceil(r.height) }; });
    await page.evaluate(() => scrollTo(0, 0));
    const screenshot = await page.screenshot({ fullPage: true });
    await sharp(screenshot).extract(bounds).toFile(new URL(`${name}-${width}-text${textScale * 100}.png`, output).pathname.replace(/^\/(\w:)/, '$1'));
    const skipLink = await page.locator('.marketing-skip').evaluate(node => ({ focused: node === document.activeElement, transform: getComputedStyle(node).transform, rect: node.getBoundingClientRect().toJSON() }));
    results.push({ name, route, width, textScale, injectedCandidateCss: candidate, headings, skipLink });
    await page.close();
  }
}
await browser.close();
await fs.writeFile(new URL('results.json', output), JSON.stringify({ executedAt: new Date().toISOString(), candidate, negativeControl, results }, null, 2));
console.log(JSON.stringify(results));
if (results.some(result => result.headings.some(heading => !heading.readable))) throw new Error('Station heading readability regression');
