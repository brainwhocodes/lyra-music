import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';
import { useRadioPlayback } from '../../composables/useRadioPlayback';
import type { Track } from '../../types/track';

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); });
const station = (id: string) => ({ channelId: id, name: `Station ${id}` });
const tracks = (id: string): Track[] => [{ trackId: id, title: id } as Track];

function setup() {
  // Deliberately resolve requests even after abort: cancellation alone must not
  // permit an obsolete network completion to replace newer user intent.
  const pending: { url: string; signal: AbortSignal; resolve: (tracks: Track[]) => void; reject: (error: unknown) => void }[] = [];
  const fetcher = vi.fn((url: string, { signal }: { signal: AbortSignal }) =>
    new Promise<Track[]>((resolve, reject) => pending.push({ url, signal, resolve, reject })));
  const loadQueue = vi.fn();
  const scope = effectScope(); scopes.push(scope);
  const playback = scope.run(() => useRadioPlayback(fetcher, loadQueue))!;
  return { playback, pending, loadQueue, scope };
}

describe('radio selection request ownership', () => {
  it('keeps the latest selected station when an earlier response arrives last', async () => {
    const context = setup();
    const first = context.playback.playStation(station('a'));
    const second = context.playback.playStation(station('b'));
    expect(context.pending[0].signal.aborted).toBe(true);
    context.pending[1].resolve(tracks('b-track')); await second;
    context.pending[0].resolve(tracks('a-track')); await first;
    expect(context.loadQueue).toHaveBeenCalledExactlyOnceWith(tracks('b-track'), { type: 'radio', id: 'radio-b', name: 'Station b' });
    expect(context.playback.busyId.value).toBe('');
  });

  it('does not clear the new loading state or show an obsolete failure', async () => {
    const context = setup();
    const first = context.playback.playStation(station('a'));
    const second = context.playback.playStation(station('b'));
    context.pending[0].reject(new Error('Old failed request')); await first;
    expect(context.playback.busyId.value).toBe('b');
    expect(context.playback.playError.value).toBe('');
    context.pending[1].resolve(tracks('b-track')); await second;
    expect(context.loadQueue).toHaveBeenCalledTimes(1);
  });

  it('ignores completion after route identity changes and preserves the new request', async () => {
    const context = setup();
    const first = context.playback.playStation(station('a'));
    context.playback.cancel();
    const second = context.playback.playStation(station('b'));
    context.pending[0].resolve(tracks('a-track')); await first;
    expect(context.loadQueue).not.toHaveBeenCalled();
    expect(context.playback.busyId.value).toBe('b');
    context.pending[1].resolve(tracks('b-track')); await second;
    expect(context.loadQueue).toHaveBeenCalledExactlyOnceWith(tracks('b-track'), { type: 'radio', id: 'radio-b', name: 'Station b' });
  });

  it('does not start audio or expose a late failure after the page is unmounted', async () => {
    for (const outcome of ['success', 'failure'] as const) {
      const context = setup();
      const request = context.playback.playStation(station('a'));
      context.scope.stop();
      expect(context.pending[0].signal.aborted).toBe(true);
      if (outcome === 'success') context.pending[0].resolve(tracks('a-track'));
      else context.pending[0].reject(new Error('Late error'));
      await request;
      expect(context.loadQueue).not.toHaveBeenCalled();
      expect(context.playback.playError.value).toBe('');
      expect(context.playback.busyId.value).toBe('');
    }
  });

  it('uses the station identity selected before the asynchronous fetch', async () => {
    const context = setup(), selected = station('a');
    const request = context.playback.playStation(selected);
    selected.channelId = 'b'; selected.name = 'Station b';
    context.pending[0].resolve(tracks('a-track')); await request;
    expect(context.pending[0].url).toBe('/api/radio-stations/a/tracks');
    expect(context.loadQueue).toHaveBeenCalledExactlyOnceWith(tracks('a-track'), { type: 'radio', id: 'radio-a', name: 'Station a' });
  });

  it('preserves existing playback on empty/error responses and permits a successful retry', async () => {
    const context = setup();
    const empty = context.playback.playStation(station('a'));
    context.pending[0].resolve([]); await empty;
    expect(context.playback.playError.value).toContain('No library tracks');
    expect(context.loadQueue).not.toHaveBeenCalled();
    const failure = context.playback.playStation(station('a'));
    context.pending[1].reject(new Error('Network unavailable')); await failure;
    expect(context.playback.playError.value).toContain('Please try again');
    expect(context.loadQueue).not.toHaveBeenCalled();
    const retry = context.playback.playStation(station('a'));
    expect(context.playback.playError.value).toBe('');
    context.pending[2].resolve(tracks('a-track')); await retry;
    expect(context.loadQueue).toHaveBeenCalledTimes(1);
  });
});
