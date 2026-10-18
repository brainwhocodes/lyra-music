import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EMBEDDING_PYTHON_RUNNER } from './embedding-runner';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL, EMBEDDING_REVISION, IntelligenceError, type EmbeddingInput, type EmbeddingOptions } from './types';
import { normalizeVector } from './math';

const MAX_OUTPUT = 2 * 1024 * 1024;
let worker: ChildProcessWithoutNullStreams | undefined;
let workerKey = '';
let busy = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let ready = false;

export function embeddingConfig(options: EmbeddingOptions = {}) {
  const dimensions = Number(options.embeddingDimensions ?? EMBEDDING_DIMENSIONS);
  const timeoutMs = Number(options.embeddingTimeoutMs ?? 300_000);
  const maxTracks = Number(options.embeddingMaxTracks ?? 2000);
  if (![128, 256, 512, 768].includes(dimensions) || !Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 900_000 ||
      !Number.isInteger(maxTracks) || maxTracks < 1 || maxTracks > 20_000) throw new IntelligenceError('Invalid embedding server configuration.', 503);
  return {
    python: options.embeddingPython || process.env.NUXT_EMBEDDING_PYTHON || 'python',
    model: options.embeddingModel || EMBEDDING_MODEL,
    revision: options.embeddingRevision || EMBEDDING_REVISION,
    dimensions, timeoutMs, maxTracks,
  };
}

export function closeEmbeddingWorker() {
  clearTimeout(idleTimer);
  const current = worker;
  worker = undefined;
  workerKey = '';
  ready = false;
  current?.kill('SIGKILL');
}

export function embeddingRuntimeState() { return { loaded: ready, busy }; }

export function prepareEmbeddingText(input: EmbeddingInput): string {
  if (!input || typeof input.text !== 'string' || !input.text.trim() || input.text.length > 16_000) throw new IntelligenceError('Embedding input must contain 1–16000 characters.', 400);
  switch (input.task) {
    // Documents arrive with an explicit title; the default named prompt would replace it with none.
    case 'document': return input.text;
    case 'query': return `task: search result | query: ${input.text}`;
    // Google's custom-label guidance recommends Clustering rather than sentiment Classification.
    case 'classification': return `task: clustering | query: ${input.text}`;
    case 'similarity': return `task: sentence similarity | query: ${input.text}`;
    default: throw new IntelligenceError('Unknown embedding task.', 400);
  }
}

export function parseEmbeddingOutput(output: string, count: number, dimensions: number): number[][] {
  try {
    const value = JSON.parse(output);
    if (!Array.isArray(value.vectors) || value.vectors.length !== count) throw new Error();
    return value.vectors.map((vector: unknown) => {
      if (!Array.isArray(vector) || vector.length !== dimensions || vector.some(v => typeof v !== 'number' || !Number.isFinite(v))) throw new Error();
      const norm = Math.hypot(...vector);
      if (Math.abs(norm - 1) > 0.01) throw new Error();
      return normalizeVector(vector);
    });
  } catch { throw new IntelligenceError('The local embedding model returned invalid vectors.', 502); }
}

/** One persistent local CPU worker; concurrent work is rejected rather than building an unbounded queue. */
export async function embedTexts(inputs: EmbeddingInput[], options: EmbeddingOptions = {}): Promise<number[][]> {
  const config = embeddingConfig(options);
  if (!Array.isArray(inputs) || inputs.length < 1 || inputs.length > 64) throw new IntelligenceError('An embedding batch must contain 1–64 inputs.', 400);
  const texts = inputs.map(prepareEmbeddingText);
  if (Buffer.byteLength(JSON.stringify(texts), 'utf8') > 1024 * 1024) throw new IntelligenceError('Embedding batch is too large.', 413);
  if (busy) throw new IntelligenceError('The local embedding model is busy. Retry shortly.', 429);
  busy = true;
  clearTimeout(idleTimer);
  const key = JSON.stringify([config.python, config.model, config.revision, config.dimensions]);
  try {
  if (workerKey !== key || !worker || worker.exitCode !== null || worker.killed) {
    closeEmbeddingWorker();
    worker = spawn(config.python, ['-I', '-u', '-c', EMBEDDING_PYTHON_RUNNER, config.model, config.revision, String(config.dimensions)], {
      shell: false, windowsHide: true, stdio: 'pipe',
      env: { ...process.env, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1', TOKENIZERS_PARALLELISM: 'false' },
    });
    workerKey = key;
    // Keep process error events handled even while idle.
    worker.on('error', () => {});
    worker.on('exit', () => { if (worker?.exitCode !== null) ready = false; });
    worker.stdin.on('error', () => {});
    // Loader diagnostics may continue outside the active response. Drain but never expose private input.
    worker.stderr.on('data', () => {});
  }
  const current = worker;
    const output = await new Promise<string>((resolve, reject) => {
      let stdout = '';
      let stderrBytes = 0;
      const finish = (error?: Error, result?: string) => {
        clearTimeout(timer);
        current.stdout.off('data', onData);
        current.stderr.off('data', onErrorData);
        current.off('error', onError);
        current.off('exit', onExit);
        current.stdin.off('error', onError);
        if (error) reject(error); else resolve(result!);
      };
      const onError = () => finish(new IntelligenceError('Local EmbeddingGemma is unavailable. Install the Python requirements and download the model before indexing.', 503));
      const onExit = () => onError();
      const onData = (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
        if (Buffer.byteLength(stdout) > MAX_OUTPUT) return finish(new IntelligenceError('Embedding output exceeded its limit.', 502));
        if (stdout.includes('\n')) finish(undefined, stdout.trim());
      };
      const onErrorData = (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > MAX_OUTPUT) finish(new IntelligenceError('Embedding diagnostics exceeded their limit.', 502));
      };
      const timer = setTimeout(() => finish(new IntelligenceError('Local embedding inference timed out.', 504)), config.timeoutMs);
      current.stdout.on('data', onData);
      current.stderr.on('data', onErrorData);
      current.on('error', onError);
      current.on('exit', onExit);
      current.stdin.on('error', onError);
      current.stdin.write(`${JSON.stringify({ texts })}\n`);
    });
    const vectors = parseEmbeddingOutput(output, inputs.length, config.dimensions);
    ready = true;
    return vectors;
  } catch (error) {
    closeEmbeddingWorker();
    if (error instanceof IntelligenceError) throw error;
    throw new IntelligenceError('Unable to start the local embedding runtime. Check the Python executable configuration.', 503);
  } finally {
    busy = false;
    // Release model RAM after inactivity; unref prevents this timer keeping a CLI alive.
    if (worker) idleTimer = setTimeout(closeEmbeddingWorker, 60_000).unref();
  }
}
