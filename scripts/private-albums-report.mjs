import { readdir, readFile, writeFile, realpath } from 'node:fs/promises';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repository = fileURLToPath(new URL('..', import.meta.url));
const privateRoot = await realpath(resolve(repository, '.test-data/private-albums/runs'));
if (relative(await realpath(repository), privateRoot).replaceAll('\\', '/') !== '.test-data/private-albums/runs') throw new Error('Private root was redirected');
const run = await realpath(process.env.LYRA_PRIVATE_RUN || '');
const relativeRun = relative(privateRoot, run);
if (!relativeRun || relativeRun.startsWith('..') || isAbsolute(relativeRun)) throw new Error('Report must remain within the allocated private workspace');
async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]))).flat();
}
const resultFiles = await files(join(run, 'browser-results'));
const inventories = resultFiles.filter(file => file.endsWith('.inventory.json'));
const result = JSON.parse(await readFile(join(run, 'browser-results.json'), 'utf8'));
const suitePassed = result.stats.unexpected === 0 && result.stats.flaky === 0 && result.stats.skipped === 0;
const elements = [];
for (const path of inventories) {
  const source = relative(run, path).replaceAll('\\', '/');
  const inventory = JSON.parse(await readFile(path, 'utf8'));
  for (const element of inventory) {
    const key = createHash('sha256').update(source + ':' + element.index).digest('hex').slice(0, 20);
    const entry = { ...element, role: element.role || element.tag, name: element.name?.trim() || '(unnamed control)', elementKey: key, sourceInventory: source, status: 'intentional-gap',
      reason: 'Observed repeated application control; not operated in this private-corpus journey. Public-fixture coverage is separate.',
      owner: 'Lyra maintainers', expires: '2027-01-18' };
    const player = /private-player-\d+\.inventory/.test(source);
    const playlist = /private-playlist\.inventory/.test(source);
    const name = element.name;
    let proof;
    if (player && element.tag === 'input' && name === 'Playback position') proof = {
      actions: ['Focus native position range', 'End', 'ArrowLeft', 'Home'],
      assertions: ['Native time approaches the original track duration', 'Position returns to zero', 'Playback resumes and advances'],
      selectorUsed: "getByRole('slider', {name:'Playback position',exact:true})",
    };
    if (player && element.tag === 'button' && ['Play playback', 'Pause playback', 'Close full screen player'].includes(name)) proof = {
      actions: ['Play and pause the imported track', 'Close the full player'],
      assertions: ['Native position advances', 'Playback changes between play/pause controls', 'Dialog closes'],
      selectorUsed: `getByRole('button', {name:${JSON.stringify(name)},exact:true})`,
    };
    if (playlist && element.tag === 'button' && ['Add tracks', 'Rename', 'Delete playlist'].includes(name)) proof = {
      actions: ['Add three imported tracks', 'Rename and reload', 'Delete playlist'],
      assertions: ['Three rows persist', 'Changed heading persists after reload', 'Deletion returns to playlists and removes its link'],
      selectorUsed: `getByRole('button', {name:${JSON.stringify(name)},exact:true})`,
    };
    if (proof && suitePassed) {
      delete entry.reason; delete entry.owner; delete entry.expires;
      Object.assign(entry, { status: 'covered', journey: player ? 'private albums retain Unicode metadata and covers, support search, real Ogg playback and long native seeking' : 'private tracks can be added, reordered, renamed and removed in a persisted playlist', testedBy: 'tests/private/library.spec.ts', ...proof });
    }
    elements.push(entry);
  }
}
const allowed = new Set(['covered', 'grouped-covered', 'state-asserted', 'intentional-gap']);
if (new Set(elements.map(entry => entry.elementKey)).size !== elements.length || elements.some(entry => !allowed.has(entry.status))) throw new Error('Invalid private coverage matrix');
for (const entry of elements) {
  if (!entry.role || !entry.name) throw new Error('Private inventory entry lacks a role or name');
  if (entry.status === 'intentional-gap' ? !(entry.reason && entry.owner && entry.expires) : !(entry.testedBy && entry.actions.length && entry.assertions.length && entry.selectorUsed)) throw new Error('Incomplete private coverage row');
  if (entry.status !== 'intentional-gap' && !(await readFile(join(repository, entry.testedBy), 'utf8')).includes(entry.journey)) throw new Error('Private coverage cites a missing journey');
}
const imported = JSON.parse(await readFile(join(run, 'import-report.json'), 'utf8'));
const coverage = { private: true, createdAt: new Date().toISOString(), inventories: inventories.length, elements };
await writeFile(join(run, 'ui-coverage.json'), JSON.stringify(coverage, null, 2));
const aggregate = { privateMediaExcluded: true, import: imported.aggregate,
  browser: { passed: result.stats.expected, failed: result.stats.unexpected, skipped: result.stats.skipped, flaky: result.stats.flaky, durationMs: result.stats.duration },
  coverage: { inventories: inventories.length, observations: elements.length, directlyCovered: elements.filter(row => row.status === 'covered').length,
    intentionalGaps: elements.filter(row => row.status === 'intentional-gap').length, matrixSchemaVerified: true, browserGatePassed: suitePassed },
  scope: 'Private corpus supplemental Chromium journeys; not complete application coverage or a model accuracy score' };
aggregate.models = {};
for (const model of ['intelligence', 'whistle']) {
  const file = resultFiles.find(file => file.endsWith(`${model}.aggregate.json`));
  if (file) aggregate.models[model] = JSON.parse(await readFile(file, 'utf8'));
}
const fallback = resultFiles.find(file => file.endsWith('fallback.aggregate.json'));
if (fallback) aggregate.nativeCodecFallback = JSON.parse(await readFile(fallback, 'utf8'));
await writeFile(join(run, 'aggregate-verification.json'), JSON.stringify(aggregate, null, 2));
console.log(JSON.stringify(aggregate));
