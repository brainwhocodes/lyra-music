import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const root = new URL('./before/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const records = [];
for (const [name, route] of [['home','/'],['features','/features'],['self-host','/self-host']]) {
  for (const [device,width,height] of [['desktop',1920,1080],['mobile',390,844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    const errors=[]; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`http://127.0.0.1:3000${route}`, { waitUntil:'networkidle' });
    await page.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.images].map(i => i.decode().catch(()=>{}))); });
    await page.screenshot({ path:new URL(`${name}-${device}.png`,root).pathname.replace(/^\/(\w:)/,'$1'), fullPage:true });
    records.push({ name,route,device,width,height,url:page.url(),title:await page.title(), headings:await page.getByRole('heading').allTextContents(),links:await page.getByRole('link').evaluateAll(a=>a.map(x=>({name:x.textContent?.trim(),href:x.getAttribute('href')}))),errors });
    await page.close();
  }
}
await fs.writeFile(new URL('inventory.json',root),JSON.stringify({capturedAt:new Date().toISOString(),records},null,2));
await browser.close();
