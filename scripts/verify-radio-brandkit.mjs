import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const directory = path.join(root, 'docs/design/lyra-radio');
const archive = path.join(directory, 'lyra-radio-brandkit.zip');
const temporary = await mkdtemp(path.join(tmpdir(), 'lyra-brandkit-'));
const python = process.env.BRANDKIT_PYTHON || 'python';
let browser;
try {
  // Python's ZIP parser handles the archive; the name check keeps extraction
  // within this fresh temporary directory, even if an archive was replaced.
  const extraction = String.raw`import json, pathlib, sys, zipfile
destination = pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(sys.argv[1]) as archive:
    for item in archive.infolist():
        name = pathlib.PurePosixPath(item.filename)
        if name.is_absolute() or '..' in name.parts or '\\' in item.filename or ':' in item.filename:
            raise ValueError('Unsafe archive path')
        if not (destination / item.filename).resolve().is_relative_to(destination):
            raise ValueError('Archive path escapes target')
    archive.extractall(destination)
    print(json.dumps({'files': len(archive.namelist()), 'names': archive.namelist()}))`;
  const extracted = JSON.parse(execFileSync(python, ['-c', extraction, archive, temporary], { encoding: 'utf8', timeout: 30_000 }));
  if (extracted.names.some(name => /(^|\/)(?:tests|test-results|node_modules|\.cache|\.venv[^/]*)(\/|$)/.test(name))) throw new Error('Unexpected non-brand payload');
  browser = await chromium.launch();
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1680 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const failures = [], requests = [];
  page.on('pageerror', error => failures.push(error.message));
  page.on('requestfailed', request => failures.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('request', request => requests.push(request.url()));
  await page.goto(pathToFileURL(path.join(temporary, 'docs/design/lyra-radio/brand-board.offline.html')).href);
  const evidence = await page.evaluate(async () => {
    const specimens = ['700 32px "Barlow Condensed"', '800 32px "Barlow Condensed"', '400 32px "Space Grotesk"', '500 32px "Space Grotesk"', '600 32px "Space Grotesk"', '700 32px "Space Grotesk"'];
    const fonts = await Promise.all(specimens.map(async font => ({ font, faces: (await document.fonts.load(font, 'LYRA0123456789')).map(face => ({ family: face.family, weight: face.weight, status: face.status })) })));
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
    const images = [...document.images].map(image => ({ path: image.getAttribute('src'), complete: image.complete, width: image.naturalWidth, height: image.naturalHeight }));
    const panels = [...document.querySelectorAll('.panel')].map(panel => ({ label: panel.getAttribute('aria-labelledby') || 'artwork', overflowX: panel.scrollWidth > panel.clientWidth, overflowY: panel.scrollHeight > panel.clientHeight }));
    return { fonts, images, panels, width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight };
  });
  const network = requests.filter(url => !url.startsWith('file:'));
  const valid = !failures.length && !network.length && evidence.width === 1440 && evidence.fonts.every(font => font.faces.length && font.faces.every(face => face.status === 'loaded')) && evidence.images.every(image => image.complete && image.width > 0) && evidence.panels.every(panel => !panel.overflowX && !panel.overflowY);
  const archiveHash = createHash('sha256').update(await readFile(archive)).digest('hex');
  const report = { capturedAt: new Date().toISOString(), valid, archive: 'lyra-radio-brandkit.zip', archiveSha256: archiveHash, extractedFiles: extracted.files, offlineContext: true, externalRequests: network, failures, ...evidence };
  await page.screenshot({ path: path.join(directory, 'brand-board.offline.png'), fullPage: true });
  await writeFile(path.join(directory, 'brandkit-offline.verification.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  if (!valid) process.exitCode = 1;
} finally {
  await browser?.close();
  const resolved = path.resolve(temporary);
  if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('lyra-brandkit-')) throw new Error('Unexpected verification cleanup target');
  await rm(resolved, { recursive: true, force: true });
}
