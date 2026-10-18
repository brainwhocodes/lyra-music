import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, reactive } from 'vue';
import { useRadioStationEditor } from '../../composables/useRadioStationEditor';
import type { RadioStation } from '../../types/radio';

const station = (id: string) => ({ channelId: id, name: `Station ${id}`, radioChannelArtists: [{ artist: { artistId: `artist-${id}`, name: id } }], radioChannelGenres: [] } as unknown as RadioStation);
const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => { scopes.splice(0).forEach(scope => scope.stop()); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function setup(open = true) {
  const pending: { url: string; options: any; resolve: (value: any) => void; reject: (error: unknown) => void }[] = [];
  const fetcher = vi.fn((url: string, options?: any) => new Promise<any>((resolve, reject) => pending.push({ url, options, resolve, reject })));
  const props = reactive({ open, station: station('a') as RadioStation | null });
  const saved = vi.fn(), close = vi.fn();
  const scope = effectScope(); scopes.push(scope);
  const editor = scope.run(() => useRadioStationEditor(props, fetcher, saved, close))!;
  return { pending, fetcher, props, editor, saved, close, scope };
}
async function choicesReady(context: ReturnType<typeof setup>, offset = 0) {
  await flush();
  context.pending[offset].resolve([{ artistId: 'choice', name: 'Choice' }]);
  context.pending[offset + 1].resolve([{ genreId: 'ambient', name: 'Ambient' }]);
  await flush();
}

describe('radio station editor request ownership', () => {
  it('initializes a component mounted already open and preserves selected seeds', async () => {
    const context = setup();
    expect(context.editor.name.value).toBe('Station a');
    expect(context.editor.artistIds.value).toEqual(['artist-a']);
    await flush();
    expect(context.pending.map(request => request.url)).toEqual(['/api/artists', '/api/genres']);
    await choicesReady(context);
    expect(context.editor.loading.value).toBe(false);
    expect(context.editor.genres.value[0].genreId).toBe('ambient');
  });

  it('aborts old seed loads and ignores their results after switching station', async () => {
    const context = setup();
    await flush();
    context.props.station = station('b');
    expect(context.pending[0].options.signal.aborted).toBe(true);
    await choicesReady(context, 2);
    context.pending[0].resolve([{ artistId: 'old', name: 'Stale' }]);
    context.pending[1].reject(new Error('Old request failed'));
    await flush();
    expect(context.editor.name.value).toBe('Station b');
    expect(context.editor.artistIds.value).toEqual(['artist-b']);
    expect(context.editor.artists.value.map(artist => artist.artistId)).toEqual(['choice']);
    expect(context.editor.error.value).toBe('');
  });

  it('does not close or replace a reopened editor when a previous save completes', async () => {
    const context = setup(); await choicesReady(context);
    const firstSave = context.editor.submit();
    expect(context.pending[2].url).toBe('/api/radio-stations/a');
    context.props.open = false;
    context.props.station = station('b');
    context.props.open = true;
    await choicesReady(context, 3);
    const secondSave = context.editor.submit();
    context.pending[2].resolve(station('a')); await firstSave;
    expect(context.saved).not.toHaveBeenCalled();
    expect(context.close).not.toHaveBeenCalled();
    expect(context.editor.saving.value).toBe(true);
    context.pending[5].resolve(station('b')); await secondSave;
    expect(context.saved).toHaveBeenCalledExactlyOnceWith(station('b'));
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('retains a failed current form for retry without leaking stale save errors', async () => {
    const context = setup(); await choicesReady(context);
    const save = context.editor.submit();
    context.pending[2].reject({ data: { statusMessage: 'Seed was removed' } }); await save;
    expect(context.editor.error.value).toBe('Seed was removed');
    expect(context.editor.name.value).toBe('Station a');
    expect(context.close).not.toHaveBeenCalled();
    const retry = context.editor.submit();
    context.props.open = false;
    context.props.open = true;
    context.pending[3].reject(new Error('Stale failure')); await retry;
    expect(context.editor.error.value).toBe('');
    expect(context.editor.loading.value).toBe(true);
  });

  it('ignores late save and seed responses after unmount', async () => {
    const context = setup(); await choicesReady(context);
    const save = context.editor.submit();
    context.scope.stop();
    context.pending[2].resolve(station('a')); await save;
    expect(context.saved).not.toHaveBeenCalled();
    expect(context.close).not.toHaveBeenCalled();
    expect(context.pending[0].options.signal.aborted).toBe(true);
  });
});
