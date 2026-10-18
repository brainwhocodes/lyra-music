import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, reactive } from 'vue';
import { useRadioStationEditor } from '../../composables/useRadioStationEditor';
import type { RadioStation } from '../../types/radio';

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));
const settle = async () => { for (let index = 0; index < 5; index++) await Promise.resolve(); };
const station = (name = 'Station A') => ({ channelId: 'a', name, radioChannelArtists: [], radioChannelGenres: [] } as unknown as RadioStation);

function setup(open: boolean) {
  const props = reactive({ open, station: station() as RadioStation | null });
  const requests: { url: string; signal: AbortSignal; resolve: (value: unknown[]) => void }[] = [];
  const fetcher = vi.fn((url: string, options?: { signal?: AbortSignal }) => new Promise<any>(resolve => requests.push({ url, signal: options!.signal!, resolve })));
  const scope = effectScope(); scopes.push(scope);
  const editor = scope.run(() => useRadioStationEditor(props, fetcher, vi.fn(), vi.fn()))!;
  return { props, requests, fetcher, editor, scope };
}

describe('radio editor prop-update batching', () => {
  it('preserves the current draft and pending seed choices when a refreshed object has the same ID', async () => {
    const context = setup(true);
    await settle();
    expect(context.requests).toHaveLength(2);
    context.editor.name.value = 'My unsaved station name';
    context.editor.artistIds.value = ['chosen-artist'];
    context.props.station = station('Server-refreshed station name');
    await settle();
    expect(context.requests).toHaveLength(2);
    expect(context.requests.every(request => !request.signal.aborted)).toBe(true);
    expect(context.editor.name.value).toBe('My unsaved station name');
    expect(context.editor.artistIds.value).toEqual(['chosen-artist']);
    context.requests[0].resolve([{ artistId: 'chosen-artist', name: 'Chosen artist' }]);
    context.requests[1].resolve([]);
    await settle();
    expect(context.editor.artists.value).toEqual([{ artistId: 'chosen-artist', name: 'Chosen artist' }]);
    expect(context.editor.loading.value).toBe(false);
  });

  it('loads seed choices once for the final identity when open and station props change together', async () => {
    const context = setup(false);
    // Vue can assign child props in this order within one parent update.
    // The intermediate old station must never start redundant requests.
    context.props.open = true;
    context.props.station = null;
    await settle();
    expect(context.requests.map(request => request.url)).toEqual(['/api/artists', '/api/genres']);
    expect(context.requests.every(request => !request.signal.aborted)).toBe(true);
    expect(context.editor.name.value).toBe('');
    expect(context.editor.artistIds.value).toEqual([]);
  });

  it('does not start choice requests for an editor closed again before the prop update settles', async () => {
    const context = setup(false);
    context.props.open = true;
    context.props.open = false;
    await settle();
    expect(context.fetcher).not.toHaveBeenCalled();
    expect(context.editor.loading.value).toBe(false);
  });
});
