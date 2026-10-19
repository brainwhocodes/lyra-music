import sharp from 'sharp';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('./',import.meta.url);
const records=JSON.parse(await fs.readFile(new URL('generation-records.json',root),'utf8'));
for(const r of records){
 const input=await fs.readFile(new URL(r.original,root));
 const meta=await sharp(input).metadata();
 r.nativeDimensions={width:meta.width,height:meta.height};
 r.originalSha256=createHash('sha256').update(input).digest('hex');
 const output=await sharp(input).resize(1920,5000,{fit:'contain',background:'#f3f4f6'}).png().toBuffer();
 await fs.writeFile(new URL(r.export,root),output);
 r.exportDimensions={width:1920,height:5000};
 r.exportSha256=createHash('sha256').update(output).digest('hex');
 r.exportMethod='Aspect-preserving contain resize, cool-gray padding if needed. Untouched original retained; no crop or nonuniform stretch.';
 r.references=[];
 for(const ref of r.args.referenced_image_paths){const bytes=await fs.readFile(ref);r.references.push({path:ref,sha256:createHash('sha256').update(bytes).digest('hex')});}
}
await fs.writeFile(new URL('generation-records.json',root),JSON.stringify(records,null,2));
console.log(records.map(r=>({page:r.key,native:r.nativeDimensions,export:r.exportDimensions})));
