import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const root = new URL('./after/', import.meta.url);
const browser = await chromium.launch({ headless: true });
const records = [];
for (const [name, route] of [['home','/'],['features','/features'],['self-host','/self-host']]) {
 for (const [device,width,height,textScale] of [['desktop',1920,1080,1],['tablet-wide',1024,900,1],['tablet',768,1024,1],['mobile',390,844,1],['narrow',320,800,1],['narrow-large-text',320,800,2]]) {
  const page = await browser.newPage({ viewport:{width,height},deviceScaleFactor:1,reducedMotion:'reduce' });
  const errors=[];const failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1:3000'))failures.push({url:r.url(),error:r.failure()?.errorText});});
  await page.goto(`http://127.0.0.1:3000${route}`,{waitUntil:'networkidle'});
  if(textScale===2)await page.addStyleTag({content:'html { font-size: 200% !important; }'});
  await page.evaluate(()=>document.fonts.ready);
  // Scroll each actual image into view so native lazy loading runs before capture.
  // Structural locator is intentional: decorative alt="" artwork must also load.
  for(const img of await page.locator('img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(async i=>{try{await i.decode();}catch{}});}
  await page.evaluate(async()=>{await Promise.all([...document.images].filter(i=>i.loading!=='lazy'||i.complete).map(i=>i.decode().catch(()=>{})));window.scrollTo(0,0);});
  const observation=await page.evaluate(()=>{
   const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};};
   const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};
   const elements=[...document.querySelectorAll('a,summary,button,input,select,textarea')].filter(visible);
   const textElements=[...document.querySelectorAll('h1,h2,h3,h4,p,dt,dd,summary,a,figcaption,code')].filter(visible);
   return {pageHeight:document.documentElement.scrollHeight,viewportWidth:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,
    mainCount:document.querySelectorAll('main').length,
    headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>({text:e.textContent.trim(),bounds:rect(e),font:getComputedStyle(e).fontFamily,fontSize:getComputedStyle(e).fontSize})),
    elements:elements.map(e=>({tag:e.tagName,role:e.getAttribute('role'),name:e.getAttribute('aria-label')||e.textContent.trim(),href:e.getAttribute('href'),bounds:rect(e)})),
    textBelow14:textElements.filter(e=>parseFloat(getComputedStyle(e).fontSize)<14).map(e=>({text:e.textContent.slice(0,80),fontSize:getComputedStyle(e).fontSize})),
    overflow:textElements.filter(e=>{const r=e.getBoundingClientRect();return r.right>document.documentElement.clientWidth+1||r.left< -1;}).map(e=>({text:e.textContent.slice(0,80),bounds:rect(e)})),
    stationReadability:[...document.querySelectorAll('.lp-collection--stations h3, .features-station h3')].map(e=>{const bounds=rect(e),fontSize=parseFloat(getComputedStyle(e).fontSize);return {text:e.textContent.trim(),bounds,fontSize,widthInEm:bounds.width/fontSize,readable:bounds.width>=fontSize*2.5};}),
    images:[...document.images].map(i=>({alt:i.alt,currentSrc:i.currentSrc,complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight,loading:i.loading,priority:i.fetchPriority,bounds:rect(i)}))};
  });
  const out=new URL(`${name}-${device}.png`,root).pathname.replace(/^\/(\w:)/,'$1');
  await page.screenshot({path:out,fullPage:true});
  records.push({name,route,device,width,height,textScale,url:page.url(),capturedAt:new Date().toISOString(),errors,failures,...observation});
  console.log(JSON.stringify({page:name,device,height:observation.pageHeight,overflow:observation.overflow.length,horizontalOverflow:observation.scrollWidth>observation.clientWidth+1,minFontIssues:observation.textBelow14.length,stationReadabilityIssues:observation.stationReadability.filter(item=>!item.readable).length,errors:errors.length,failures:failures.length}));
  await page.close();
 }
}
await fs.writeFile(new URL('visual-observations.json',root),JSON.stringify(records,null,2));
await browser.close();
if(records.some(record=>record.stationReadability.some(item=>!item.readable)))throw new Error('Station preview text columns are too narrow to read; inspect the saved observations and screenshots.');
