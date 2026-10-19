import sharp from 'sharp';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('./',import.meta.url);
const records=JSON.parse(await fs.readFile(new URL('generation-records.json',root),'utf8'));
const comparisons=[];
for(const record of records){
 const reference=await fs.readFile(new URL(record.export,root));
 if(createHash('sha256').update(reference).digest('hex')!==record.exportSha256)throw new Error(`Frozen reference changed: ${record.key}`);
 const actual=await fs.readFile(new URL(`after/${record.key}-desktop.png`,root));
 const am=await sharp(actual).metadata();
 const height=Math.max(5000,am.height);
 const refAligned=await sharp(reference).extend({bottom:height-5000,background:'#f3f4f6'}).png().toBuffer();
 const actualAligned=await sharp(actual).extend({bottom:height-am.height,background:'#f3f4f6'}).png().toBuffer();
 // Materialize RGB first: Sharp can otherwise reorder removeAlpha after the
 // channel join, silently producing an opaque image instead of an overlay.
 const rgb=await sharp(actualAligned).removeAlpha().raw().toBuffer();
 const right=await sharp(rgb,{raw:{width:1920,height,channels:3}}).joinChannel(Buffer.alloc(1920*height,128),{raw:{width:1920,height,channels:1}}).png().toBuffer();
 const rgba=await sharp(right).raw().toBuffer({resolveWithObject:true});
 if(rgba.info.channels!==4||rgba.data[3]!==128)throw new Error('Comparison overlay must retain its 50% alpha channel');
 await sharp(refAligned).composite([{input:right}]).webp({quality:82}).toFile(new URL(`after/${record.key}-overlay.webp`,root).pathname.replace(/^\/(\w:)/,'$1'));
 const panelWidth=576,scaledHeight=Math.round(height*panelWidth/1920);
 const leftPanel=await sharp(refAligned).resize({width:panelWidth}).toBuffer();
 const rightPanel=await sharp(actualAligned).resize({width:panelWidth}).toBuffer();
 const label=Buffer.from(`<svg width="1152" height="64"><rect width="1152" height="64" fill="#17191c"/><g fill="#f3f4f6" font-family="Arial,sans-serif" font-size="19"><text x="20" y="39">${record.key} · Generated reference</text><text x="596" y="39">Implemented · 1920px viewport</text></g></svg>`);
 await sharp({create:{width:1152,height:scaledHeight+64,channels:3,background:'#f3f4f6'}}).composite([{input:label,left:0,top:0},{input:leftPanel,left:0,top:64},{input:rightPanel,left:576,top:64}]).webp({quality:85}).toFile(new URL(`after/${record.key}-comparison.webp`,root).pathname.replace(/^\/(\w:)/,'$1'));
 comparisons.push({page:record.key,referenceDimensions:{width:1920,height:5000},actualDimensions:{width:am.width,height:am.height},alignment:'Same width, top aligned, cool-gray padding below shorter image. No crop or nonuniform stretching.',comparison:`after/${record.key}-comparison.webp`,overlay:`after/${record.key}-overlay.webp`,actualSha256:createHash('sha256').update(actual).digest('hex'),method:'Sharp side-by-side and 50% alpha overlay; ODiff executable unavailable.'});
}
await fs.writeFile(new URL('after/comparison-records.json',root),JSON.stringify({createdAt:new Date().toISOString(),comparisons},null,2));
