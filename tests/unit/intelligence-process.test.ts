import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

const state = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: state.spawn }));
import { closeEmbeddingWorker, embedTexts } from '../../server/services/intelligence/embedding-service';

let child: ReturnType<typeof makeChild>;
function makeChild() {
  const instance = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(),
    killed: false, exitCode: null as number | null,
    kill: vi.fn(() => { instance.killed = true; instance.emit('exit', 1); return true; }),
  });
  return instance;
}
const input = [{ text: 'Quiet music', task: 'query' as const }];
const validOutput = () => JSON.stringify({ vectors: [Array.from({ length: 256 }, (_, i) => i === 0 ? 1 : 0)] }) + '\n';
beforeEach(() => { state.spawn.mockReset().mockImplementation(() => { child = makeChild(); return child; }); });
afterEach(() => { closeEmbeddingWorker(); vi.useRealTimers(); });

describe('bounded offline model subprocess boundary', () => {
  it('passes executable/model as arguments without a shell and forces offline execution', async () => {
    const pending = embedTexts(input, { embeddingPython: 'C:/Python & tools/python.exe' });
    const [executable, args, options] = state.spawn.mock.calls[0]!;
    expect(executable).toBe('C:/Python & tools/python.exe');
    expect(args).toEqual(expect.arrayContaining(['-I', '-u', 'google/embeddinggemma-2']));
    expect(options).toMatchObject({ shell: false, windowsHide: true, env: { HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' } });
    child.stdout.write(validOutput());
    expect(await pending).toHaveLength(1);
  });
  it('rejects concurrency without spawning another model and reuses the idle worker', async () => {
    const pending = embedTexts(input);
    await expect(embedTexts(input)).rejects.toMatchObject({ statusCode: 429 });
    child.stdout.write(validOutput()); await pending;
    const next = embedTexts(input); child.stdout.write(validOutput()); await next;
    expect(state.spawn).toHaveBeenCalledTimes(1);
  });
  it('kills a timed out model and permits a later retry', async () => {
    vi.useFakeTimers();
    const pending = embedTexts(input, { embeddingTimeoutMs: 100 });
    const assertion = expect(pending).rejects.toMatchObject({ statusCode: 504 });
    await vi.advanceTimersByTimeAsync(101); await assertion;
    expect(child.kill).toHaveBeenCalled();
    const retry = embedTexts(input); child.stdout.write(validOutput()); await retry;
    expect(state.spawn).toHaveBeenCalledTimes(2);
  });
  it('caps stdout and stderr and kills the failed model', async () => {
    for (const channel of ['stdout', 'stderr'] as const) {
      const pending = embedTexts(input);
      child[channel].write('x'.repeat(2 * 1024 * 1024 + 1));
      await expect(pending).rejects.toMatchObject({ statusCode: 502 });
      expect(child.kill).toHaveBeenCalled();
    }
  });
  it('rejects malformed output, missing runtime, and synchronous spawn errors without sticking busy', async () => {
    const malformed = embedTexts(input); child.stdout.write('{"vectors":[]}\n');
    await expect(malformed).rejects.toMatchObject({ statusCode: 502 });
    const missing = embedTexts(input); child.emit('error', new Error('ENOENT'));
    await expect(missing).rejects.toMatchObject({ statusCode: 503 });
    state.spawn.mockImplementationOnce(() => { throw new TypeError('Invalid executable'); });
    await expect(embedTexts(input)).rejects.toMatchObject({ statusCode: 503 });
    const retry = embedTexts(input); child.stdout.write(validOutput()); await retry;
  });
  it('caps input before model startup and releases the worker after inactivity', async () => {
    await expect(embedTexts(Array.from({ length: 65 }, () => input[0]!))).rejects.toMatchObject({ statusCode: 400 });
    await expect(embedTexts(Array.from({ length: 64 }, () => ({ text: '界'.repeat(16000), task: 'query' as const })))).rejects.toMatchObject({ statusCode: 413 });
    expect(state.spawn).not.toHaveBeenCalled();
    vi.useFakeTimers();
    const pending = embedTexts(input); child.stdout.write(validOutput()); await pending;
    await vi.advanceTimersByTimeAsync(60_001);
    expect(child.kill).toHaveBeenCalled();
  });
});
