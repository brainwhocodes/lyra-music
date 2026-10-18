import { execFile } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { WHISTLE_PYTHON_RUNNER } from './whistle-runner';

export interface TimestampedLyric { time: string; text: string }
export const WHISTLE_MODEL = 'Cactus-Compute/whistle';
export const WHISTLE_SOURCE = 'whistle_transcription';
const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 4 * 1024 * 1024;
const SAMPLE_RATE = 16_000;

export class WhistleError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'WhistleError';
  }
}

export interface WhistleOptions {
  whistlePython?: string;
  whistleModelPath?: string;
  whistleFfmpegPath?: string;
  whistleTimeoutMs?: number | string;
  whistleMaxDurationSeconds?: number | string;
}

export interface ProcessOptions { timeoutMs: number; maxOutputBytes: number }
export type ProcessRunner = (command: string, args: string[], options: ProcessOptions) => Promise<string>;

/** No shell is involved, including when audio paths contain metacharacters. */
export const runBoundedProcess: ProcessRunner = (command, args, options) => new Promise((resolve, reject) => {
  execFile(command, args, {
    shell: false,
    windowsHide: true,
    encoding: 'utf8',
    timeout: options.timeoutMs,
    killSignal: 'SIGKILL',
    maxBuffer: options.maxOutputBytes,
    env: { ...process.env, NEEDLE_TELEMETRY: '0', DO_NOT_TRACK: '1', HF_HUB_OFFLINE: '1' },
  }, (error, stdout) => {
    if (error) reject(error);
    else resolve(stdout);
  });
});

function boundedNumber(value: number | string | undefined, fallback: number, min: number, max: number): number {
  const number = value === undefined || value === '' ? fallback : Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new WhistleError('Invalid Whistle server configuration.', 503);
  }
  return Math.floor(number);
}

function timestamp(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  // The existing lyric players consume minutes:seconds (including 60+ minutes).
  const minutes = Math.floor(ms / 60_000);
  const remainder = ms % 60_000;
  return `${String(minutes).padStart(2, '0')}:${String(Math.floor(remainder / 1000)).padStart(2, '0')}.${String(remainder % 1000).padStart(3, '0')}`;
}

/** Validate the native engine boundary before turning its words into display lines. */
export function parseWhistleOutput(output: string, durationSeconds: number): TimestampedLyric[] {
  const invalid = () => new WhistleError('Whistle returned invalid timestamped speech.', 502);
  if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES || !Number.isFinite(durationSeconds) || durationSeconds <= 0) throw invalid();
  let response: unknown;
  try { response = JSON.parse(output); } catch { throw invalid(); }
  if (!response || typeof response !== 'object' || Array.isArray(response)) throw invalid();
  const { text, words } = response as { text?: unknown; words?: unknown };
  if (typeof text !== 'string' || !Array.isArray(words) || words.length > 50_000) throw invalid();
  if (!text.trim()) {
    if (words.length) throw invalid();
    return [];
  }
  if (!words.length) throw invalid();

  const result: TimestampedLyric[] = [];
  let line: string[] = [];
  let lineStart = 0;
  let previousStart = -1;
  let previousEnd = 0;
  const flush = () => {
    if (line.length) result.push({ time: timestamp(lineStart), text: line.join(' ').replace(/\s+([,.;:!?])/g, '$1') });
    line = [];
  };
  for (const item of words) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw invalid();
    const { word, start, end, probability } = item;
    if (typeof word !== 'string' || !word.trim() || word.length > 500 ||
        typeof start !== 'number' || !Number.isFinite(start) || start < 0 || start < previousStart ||
        typeof end !== 'number' || !Number.isFinite(end) || end < start || end > durationSeconds + 0.25 ||
        (probability !== undefined && (typeof probability !== 'number' || !Number.isFinite(probability) || probability < 0 || probability > 1))) throw invalid();
    if (line.length && (start - previousEnd >= 1.2 || start - lineStart >= 6 || line.length >= 8)) flush();
    if (!line.length) lineStart = start;
    const cleanWord = word.trim().replace(/\s+/g, ' ');
    line.push(cleanWord);
    previousStart = start;
    previousEnd = end;
    if (/[.!?]$/.test(cleanWord)) flush();
  }
  flush();
  return result;
}

function processFailure(error: unknown, stage: 'ffmpeg' | 'Whistle'): WhistleError {
  const failure = error as NodeJS.ErrnoException & { killed?: boolean };
  if (failure?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return new WhistleError('Audio transcription exceeded its output limit.', 502);
  if (failure?.killed || failure?.code === 'ETIMEDOUT') return new WhistleError('Audio transcription exceeded its time limit.', 504);
  return stage === 'ffmpeg'
    ? new WhistleError('Audio conversion failed. Check the audio file and server ffmpeg installation.', 422)
    : new WhistleError('Whistle is unavailable. Install the Python runtime and pre-download its model and engine; see docs/whistle.md.', 503);
}

/** One job per server process, with no unbounded in-memory waiting queue. */
export function createWhistleTranscriber(dependencies: { run?: ProcessRunner; tempRoot?: string } = {}) {
  const run = dependencies.run ?? runBoundedProcess;
  let active = false;
  return async (filePath: string, config: WhistleOptions = {}): Promise<TimestampedLyric[]> => {
    if (active) throw new WhistleError('A transcription is already running. Try again after it completes.', 429);
    const timeoutMs = boundedNumber(config.whistleTimeoutMs, 300_000, 100, 900_000);
    const maxDuration = boundedNumber(config.whistleMaxDurationSeconds, 1200, 1, 3600);
    const python = config.whistlePython || (process.platform === 'win32' ? 'python' : 'python3');
    const ffmpeg = config.whistleFfmpegPath || 'ffmpeg';
    active = true;
    let temporaryDirectory: string | undefined;
    try {
      const source = path.resolve(filePath);
      const file = await stat(source).catch(() => { throw new WhistleError('Track audio file is unavailable.', 404); });
      if (!file.isFile() || !file.size) throw new WhistleError('Track audio file is empty or invalid.', 422);
      if (file.size > MAX_INPUT_BYTES) throw new WhistleError('Track audio exceeds the 512 MiB transcription limit.', 413);
      temporaryDirectory = await mkdtemp(path.join(dependencies.tempRoot ?? tmpdir(), 'lyra-whistle-'));
      const pcmPath = path.join(temporaryDirectory, 'audio.pcm');
      const deadline = Date.now() + timeoutMs;
      const limits = () => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new WhistleError('Audio transcription exceeded its time limit.', 504);
        return { timeoutMs: remaining, maxOutputBytes: MAX_OUTPUT_BYTES };
      };
      try {
        await run(ffmpeg, [
          '-nostdin', '-hide_banner', '-loglevel', 'error', '-threads', '1',
          '-protocol_whitelist', 'file,pipe', '-i', source, '-map', '0:a:0', '-vn',
          '-t', String(maxDuration + 0.1), '-ac', '1', '-ar', String(SAMPLE_RATE),
          '-c:a', 'pcm_s16le', '-f', 's16le', '-y', pcmPath,
        ], limits());
      } catch (error) {
        if (error instanceof WhistleError) throw error;
        throw processFailure(error, 'ffmpeg');
      }
      const pcm = await stat(pcmPath);
      const duration = pcm.size / (SAMPLE_RATE * 2);
      if (duration > maxDuration) throw new WhistleError(`Track audio exceeds the ${maxDuration} second transcription limit.`, 413);
      if (!pcm.size || pcm.size % 2) throw new WhistleError('Audio conversion produced no usable samples.', 422);
      let output: string;
      try {
        output = await run(python, ['-I', '-c', WHISTLE_PYTHON_RUNNER, pcmPath, config.whistleModelPath ? path.resolve(config.whistleModelPath) : ''], limits());
      } catch (error) {
        if (error instanceof WhistleError) throw error;
        throw processFailure(error, 'Whistle');
      }
      return parseWhistleOutput(output, duration);
    } finally {
      try {
        if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      } finally {
        active = false;
      }
    }
  };
}

export const transcribeAudioWithTimestamps = createWhistleTranscriber();
