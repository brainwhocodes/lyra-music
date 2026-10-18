import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { cpus, platform, arch } from 'node:os';
import { createWhistleTranscriber, parseWhistleOutput } from '../server/utils/whistle-service';
import { wordErrors } from './metrics';

const exec = promisify(execFile);
const root = resolve(import.meta.dirname, '..');
const whistlePython = process.env.NUXT_WHISTLE_PYTHON || process.env.WHISTLE_PYTHON;
const whistleModelPath = process.env.NUXT_WHISTLE_MODEL_PATH || process.env.WHISTLE_MODEL_PATH;
const whistleFfmpegPath = process.env.NUXT_WHISTLE_FFMPEG_PATH || process.env.WHISTLE_FFMPEG_PATH;
const requested = process.argv.find(argument => argument.startsWith('--models='));
const models = requested ? requested.slice('--models='.length).split(',') : ['whistle', 'faster-whisper-base.en'];
if (!models.length || new Set(models).size !== models.length || models.some(model => !['whistle', 'faster-whisper-base.en', 'gemma-4-E2B-it'].includes(model))) {
  throw new Error('Use --models=whistle,faster-whisper-base.en,gemma-4-E2B-it to select explicit supported candidates.');
}
const data = JSON.parse(await readFile(resolve(root, 'evals/fixtures/transcription.json'), 'utf8'));
const batchMode = models.includes('gemma-4-E2B-it');
const runtimeIdentity: Record<string, unknown> = {};
if (models.includes('whistle') && !batchMode) {
const { stdout: identityJson } = await exec(whistlePython || 'python', ['-I', '-c', String.raw`
import hashlib, importlib.metadata, json, os, pathlib, sys
from needle.agent import fetch
weights = pathlib.Path(sys.argv[1] or os.environ.get('NEEDLE_WHISTLE_WEIGHTS') or pathlib.Path(fetch.cache_dir(fetch.WHISTLE)) / fetch.base_weights(fetch.WHISTLE))
print(json.dumps({'cactusNeedleVersion': importlib.metadata.version('cactus-needle'), 'weightsFile': weights.name, 'weightsBytes': weights.stat().st_size, 'weightsSha256': hashlib.sha256(weights.read_bytes()).hexdigest()}))
`, whistleModelPath || ''], { timeout: 30_000, maxBuffer: 16_384, windowsHide: true, env: { ...process.env, HF_HUB_OFFLINE: '1' } });
runtimeIdentity.whistle = JSON.parse(identityJson);
}
if (models.includes('faster-whisper-base.en')) {
const { stdout: whisperVersion } = await exec(process.env.EVAL_PYTHON || 'python', ['-I', '-c', "import importlib.metadata; print(importlib.metadata.version('faster-whisper'))"], { timeout: 30_000, maxBuffer: 1024, windowsHide: true });
runtimeIdentity.whisper = { package: 'faster-whisper', version: whisperVersion.trim(), model: 'Systran/faster-whisper-base.en', revision: '3d3d5dee26484f91867d81cb899cfcf72b96be6c' };
}
type BatchCase = { id: string; text: string; words?: unknown[]; wordTimestamps: boolean; caseSeconds: number;
  inferenceSeconds: number; generationSeconds?: number; hitTokenLimit: boolean; hitTimeLimit: boolean; generatedTokens?: number };
type Batch = { results: BatchCase[]; artifactVerificationSeconds: number; modelLoadSeconds: number; processMs: number };
const batches = new Map<string, Batch>();
if (batchMode) {
  const state = JSON.parse(await readFile(resolve(root, '.tools/models/setup-state.json'), 'utf8'));
  for (const name of models.filter(name => name !== 'faster-whisper-base.en')) {
    const profile = name === 'whistle' ? 'whistle' : 'gemma-audio';
    const model = state.models[profile];
    if (!model) throw new Error(`Provision the ${profile} profile before comparing it.`);
    const start = performance.now();
    console.log(`Loading ${name} once for the fixed eight-control batch...`);
    const { stdout } = await exec(model.python, ['-I', resolve(root, 'evals/local-asr-batch.py'), profile], {
      timeout: 1_800_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
      env: { ...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' },
    });
    const batch: Batch = { ...JSON.parse(stdout), processMs: Math.round(performance.now() - start) };
    if (batch.results.length !== data.cases.length || new Set(batch.results.map(row => row.id)).size !== data.cases.length
      || data.cases.some((example: { id: string }) => !batch.results.some(row => row.id === example.id && typeof row.text === 'string'))) {
      throw new Error(`Incomplete or malformed ${name} fixed-control batch.`);
    }
    batches.set(name, batch);
    runtimeIdentity[name] = { model: model.repo, revision: model.revision, weightsBytes: model.bytes, weightsSha256: model.sha256,
      runtime: name === 'whistle' ? 'Needle CPU, one model instance for the batch' : 'Transformers CPU float32, 4 threads, greedy decoding, 192 new tokens, 120 second generation budget',
      wordTimestamps: name === 'whistle' };
  }
}
const whistle = createWhistleTranscriber();
const results: any[] = [];
for (const example of data.cases) {
  const file = resolve(root, example.file);
  if (createHash('sha256').update(await readFile(file)).digest('hex') !== example.sha256) throw new Error(`Fixture checksum mismatch: ${example.id}`);
  for (const model of models) {
    const start = performance.now();
    let lines: { time: string; text: string }[] = [];
    const cached = batches.get(model)?.results.find(row => row.id === example.id);
    if (cached) {
      if (cached.wordTimestamps) lines = parseWhistleOutput(JSON.stringify({ words: cached.words, text: cached.text }), example.durationSeconds);
    } else if (model === 'whistle') {
      lines = await whistle(file, { whistlePython, whistleFfmpegPath, whistleModelPath });
    } else {
      const { stdout } = await exec(process.env.EVAL_PYTHON || 'python', [
        '-I', resolve(root, 'evals/faster-whisper-runner.py'), file,
      ], { timeout: 300_000, maxBuffer: 4 * 1024 * 1024, windowsHide: true,
        env: { ...process.env, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' } });
      lines = parseWhistleOutput(stdout, example.durationSeconds);
    }
    const text = cached?.text ?? lines.map(line => line.text).join(' ');
    const hasTimes = cached?.wordTimestamps ?? true;
    const result = { id: example.id, kind: example.kind, model,
      fixtureSha256: example.sha256, durationSeconds: example.durationSeconds,
      pipelineMs: cached ? Math.round(cached.caseSeconds * 1000) : Math.round(performance.now() - start),
      pipelineMode: cached ? 'warm-batch-case' : 'fresh-process-case', text, lines: hasTimes ? lines : null,
      wordTimestamps: hasTimes, ...(cached ? { hitTokenLimit: cached.hitTokenLimit, hitTimeLimit: cached.hitTimeLimit,
        generatedTokens: cached.generatedTokens, inferenceMs: Math.round(cached.inferenceSeconds * 1000),
        ...(cached.generationSeconds === undefined ? {} : { generationMs: Math.round(cached.generationSeconds * 1000) }) } : {}),
      ...wordErrors(example.reference, text) };
    results.push(result);
    console.log(`${model} / ${example.id}: WER ${result.wer ?? 'n/a'}, words ${result.hypothesisWords}, ${result.pipelineMs}ms`);
  }
}
const summary = Object.fromEntries(models.map(model => {
  const rows = results.filter(result => result.model === model);
  const human = rows.filter(row => row.kind === 'human-speech');
  const speech = rows.filter(row => row.referenceWords > 0);
  const batch = batches.get(model);
  return [model, {
    humanSpeechWer: human.reduce((sum, row) => sum + row.errors, 0) / human.reduce((sum, row) => sum + row.referenceWords, 0),
    humanReferenceWords: human.reduce((sum, row) => sum + row.referenceWords, 0),
    allSpeechWer: speech.reduce((sum, row) => sum + row.errors, 0) / speech.reduce((sum, row) => sum + row.referenceWords, 0),
    allSpeechErrors: speech.reduce((sum, row) => sum + row.errors, 0),
    allSpeechReferenceWords: speech.reduce((sum, row) => sum + row.referenceWords, 0),
    nonspeechHallucinatedWords: rows.filter(row => !row.referenceWords).reduce((sum, row) => sum + row.hypothesisWords, 0),
    totalPipelineMs: batch?.processMs ?? rows.reduce((sum, row) => sum + row.pipelineMs, 0),
    ...(batch ? { warmCaseMs: rows.reduce((sum, row) => sum + row.pipelineMs, 0),
      artifactVerificationMs: Math.round(batch.artifactVerificationSeconds * 1000), modelLoadMs: Math.round(batch.modelLoadSeconds * 1000) } : {}),
  }];
}));
const report = { createdAt: new Date().toISOString(), system: { platform: platform(), architecture: arch(), cpu: cpus()[0]?.model },
  protocol: batchMode
    ? 'Eight fixed clips. Whistle and Gemma each load once in a separate bounded process; artifact verification, cold load, warm cases and total process wall time are separate. Any optional Whisper result still uses fresh processes per case. Gemma CPU float32,4threads, official transcription-only prompt, greedy decoding, at most192 new tokens and120 generation seconds per case. No invented word times. Lexical WER is not capped at1.'
    : 'Eight fixed clips. Each model uses a fresh process with cached weights; end-to-end wall time includes startup. Whisper CPU int8, 4 threads, beam5, English, VAD off. Whistle production adapter. No lyric prompt. Lexical WER is not capped at1.',
  limitations: ['Three human speech clips share one narrator.', 'No verified sung-lyric corpus. Speech mixed with music is not singing.', 'Latency is a local single-run pipeline comparison, not a model benchmark.'],
  decision: 'Retain Whistle in production. This small diagnostic set cannot establish superiority for sung lyrics.',
  runtimeIdentity, summary, results };
await mkdir(resolve(root, 'evals/results'), { recursive: true });
await writeFile(resolve(root, `evals/results/${models.includes('gemma-4-E2B-it') ? 'transcription.with-gemma' : 'transcription'}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
