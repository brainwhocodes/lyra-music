import { chromium, expect } from '@playwright/test';
import fs from 'node:fs/promises';
const root=new URL('./after/',import.meta.url);
const browser=await chromium.launch({headless:true});
const results=[];
const origin='http://127.0.0.1:3000';
const protectedPaths=new Set(['/library','/radio','/explore','/tracks']);
for(const [name,route] of [['home','/'],['features','/features'],['self-host','/self-host']]){
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.goto(origin+route,{waitUntil:'networkidle'});
 const all=await page.getByRole('link').evaluateAll(nodes=>nodes.map(a=>({name:(a.getAttribute('aria-label')||a.textContent).trim(),href:a.getAttribute('href')})));
 const groups=new Map();for(const link of all){const key=JSON.stringify(link);groups.set(key,{...link,count:(groups.get(key)?.count||0)+1});}
 for(const item of groups.values()){
  await page.goto(origin+route,{waitUntil:'networkidle'});
  const matches=page.getByRole('link',{name:item.name,exact:true});
  await expect(matches).toHaveCount(item.count);
  // Repeated header/footer or primary/closing CTAs share exact label and destination.
  // Count all equivalents, then operate a representative accessible-name match.
  const link=matches.first();
  const target=new URL(item.href,origin+route);
  let externalStatus;
  if(item.name==='Skip to content'){await link.focus();await page.keyboard.press('Enter');await expect(page.getByRole('main')).toBeFocused();}
  else if(target.origin!==origin){const [response]=await Promise.all([page.waitForResponse(response=>response.request().resourceType()==='document'&&response.url().split('#')[0]===`${target.origin}${target.pathname}${target.search}`,{timeout:30000}),link.click({noWaitAfter:true})]);externalStatus=response.status();expect(externalStatus).toBe(200);}
  else await link.click({noWaitAfter:true});
  const expected=protectedPaths.has(target.pathname)&&target.origin===origin?`${origin}/login?invalid=true`:target.href;
  await expect(page).toHaveURL(expected,{timeout:20000});
  if(target.origin===origin){await page.waitForLoadState('networkidle');await expect(page.getByRole('heading',{level:1})).toBeVisible();}
  results.push({source:route,element:item.name,href:item.href,equivalentCount:item.count,status:item.count>1?'grouped-covered':'covered',action:item.name==='Skip to content'?'Focus and Enter':'Click accessible-name link',assertion:`URL is ${expected}${item.name==='Skip to content'?' and main receives focus':''}${externalStatus?' and external document returns HTTP 200':''}`,observedURL:page.url(),externalStatus});
 }
 await page.close();
 console.log(`${name}: ${groups.size} unique link groups operated`);
}
await fs.writeFile(new URL('link-journeys.json',root),JSON.stringify({executedAt:new Date().toISOString(),browser:'Chromium',viewport:{width:390,height:844},authenticated:false,notes:'All unique link/name groups are clicked; equivalent repetitions are counted. Protected routes exercise their real login redirect. Authenticated CTA destinations and every FAQ disclosure are separately exercised by tests/e2e/brand-journeys.spec.ts.',results},null,2));
await browser.close();
