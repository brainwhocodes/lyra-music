import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, readdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWhistleTranscriber, runBoundedProcess, type ProcessRunner } from '../../server/utils/whistle-service';

let root: string;
let audioPath: string;
const recognized = JSON.stringify({ text: 'Hello world.', words: [{ word: 'Hello', start: 0, end: 0.2 }, { word: 'world.', start: 0.3, end: 0.6 }] });

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'lyra-whistle-test-'));
  audioPath = path.join(root, 'song & $quoted; name.mp3');
  await writeFile(audioPath, 'test audio');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

function fakePipeline(result = recognized): ProcessRunner {
  return vi.fn(async (_command, args) => {
    if (args.includes('-i')) {
      await writeFile(args.at(-1)!, Buffer.alloc(32_000));
      return '';
    }
    return result;
  });
}

describe('bounded local Whistle pipeline', () => {
  it('passes filesystem paths as individual arguments and cleans up on success', async () => {
    const run = fakePipeline();
    const transcribe = createWhistleTranscriber({ run, tempRoot: root });
    expect(await transcribe(audioPath)).toEqual([{ time: '00:00.000', text: 'Hello world.' }]);
    const [command, args] = vi.mocked(run).mock.calls[0];
    expect(command).toBe('ffmpeg');
    expect(args[args.indexOf('-i') + 1]).toBe(audioPath);
    expect(args).toEqual(expect.arrayContaining(['-ac', '1', '-ar', '16000', '-protocol_whitelist', 'file,pipe']));
    const [, pythonArgs] = vi.mocked(run).mock.calls[1];
    expect(pythonArgs[0]).toBe('-I');
    expect(pythonArgs[1]).toBe('-c');
    expect(await readdir(root)).toEqual([path.basename(audioPath)]);
  });

  it.each(['conversion', 'inference', 'malformed'])('cleans temporary audio after %s failure and releases its slot', async (stage) => {
    const run = vi.fn(async (_command: string, args: string[]) => {
      if (args.includes('-i')) {
        if (stage === 'conversion') throw new Error('decoder failed');
        await writeFile(args.at(-1)!, Buffer.alloc(32_000));
        return '';
      }
      if (stage === 'inference') throw new Error('model failed');
      return 'invalid JSON';
    });
    const transcribe = createWhistleTranscriber({ run, tempRoot: root });
    await expect(transcribe(audioPath)).rejects.toThrow();
    expect(await readdir(root)).toEqual([path.basename(audioPath)]);
    await expect(transcribe(audioPath)).rejects.not.toMatchObject({ statusCode: 429 });
  });

  it('rejects concurrent jobs without spawning another process', async () => {
    let release!: () => void;
    let started!: () => void;
    const entered = new Promise<void>(resolve => { started = resolve; });
    const wait = new Promise<void>(resolve => { release = resolve; });
    const run: ProcessRunner = async (_command, args) => {
      if (args.includes('-i')) {
        started(); await wait;
        await writeFile(args.at(-1)!, Buffer.alloc(32_000));
        return '';
      }
      return recognized;
    };
    const transcribe = createWhistleTranscriber({ run, tempRoot: root });
    const first = transcribe(audioPath);
    await entered;
    await expect(transcribe(audioPath)).rejects.toMatchObject({ statusCode: 429 });
    release();
    await first;
    await expect(transcribe(audioPath)).resolves.toHaveLength(1);
  });

  it('rejects long decoded audio without ever invoking the model', async () => {
    const run = vi.fn(async (_command: string, args: string[]) => {
      await writeFile(args.at(-1)!, Buffer.alloc(64_000));
      return '';
    });
    const transcribe = createWhistleTranscriber({ run, tempRoot: root });
    await expect(transcribe(audioPath, { whistleMaxDurationSeconds: 1 })).rejects.toMatchObject({ statusCode: 413 });
    expect(run).toHaveBeenCalledTimes(1);
    expect(await readdir(root)).toEqual([path.basename(audioPath)]);
  });

  it('reports missing files and invalid configuration without acquiring a stuck slot', async () => {
    const transcribe = createWhistleTranscriber({ run: fakePipeline(), tempRoot: root });
    await expect(transcribe(audioPath, { whistleTimeoutMs: 'NaN' })).rejects.toMatchObject({ statusCode: 503 });
    await expect(transcribe(path.join(root, 'missing.mp3'))).rejects.toMatchObject({ statusCode: 404 });
    await expect(transcribe(audioPath)).resolves.toHaveLength(1);
  });

  it('decodes the licensed real MP3 fixture with ffmpeg at 16 kHz mono', async () => {
    await copyFile(path.resolve('tests/fixtures/music/audio/the-distant-sun.mp3'), audioPath);
    const run: ProcessRunner = async (command, args, limits) => {
      if (args.includes('-i')) return runBoundedProcess(command, args, limits);
      return recognized;
    };
    const transcribe = createWhistleTranscriber({ run, tempRoot: root });
    expect(await transcribe(audioPath)).toHaveLength(1);
    expect(await readdir(root)).toEqual([path.basename(audioPath)]);
  });
});

describe('real process boundary', () => {
  it('never interprets shell metacharacters', async () => {
    const payload = 'a & echo injected; $(echo injected) "quoted"';
    const output = await runBoundedProcess(process.execPath, ['-e', 'process.stdout.write(process.argv[1])', payload], { timeoutMs: 5000, maxOutputBytes: 4096 });
    expect(output).toBe(payload);
  });
  it('kills a process that exceeds the deadline', async () => {
    await expect(runBoundedProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { timeoutMs: 150, maxOutputBytes: 4096 }))
      .rejects.toMatchObject({ killed: true });
  });
  it('stops a process that exceeds the output bound', async () => {
    await expect(runBoundedProcess(process.execPath, ['-e', 'process.stdout.write("a".repeat(100000))'], { timeoutMs: 5000, maxOutputBytes: 1000 }))
      .rejects.toMatchObject({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
  });
});
