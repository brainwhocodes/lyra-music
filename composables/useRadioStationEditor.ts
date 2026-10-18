import { onScopeDispose, ref, watch } from 'vue';
import type { RadioStation } from '../types/radio';

type EditorFetch = <T>(url: string, options?: { signal?: AbortSignal; method?: 'POST' | 'PUT'; body?: unknown }) => Promise<T>;

export function useRadioStationEditor(
  props: { open: boolean; station: RadioStation | null },
  fetcher: EditorFetch,
  saved: (station: RadioStation) => void,
  close: () => void,
) {
  const name = ref('');
  const artistIds = ref<string[]>([]), genreIds = ref<string[]>([]);
  const artists = ref<{ artistId: string; name: string }[]>([]);
  const genres = ref<{ genreId: string; name: string }[]>([]);
  const error = ref(''), loading = ref(false), saving = ref(false);
  let generation = 0;

  watch([() => props.open, () => props.station?.channelId] as const, async ([open], _old, onCleanup) => {
    const current = ++generation;
    const controller = new AbortController();
    onCleanup(() => controller.abort());
    loading.value = false;
    saving.value = false;
    if (!open) return;
    name.value = props.station?.name || '';
    artistIds.value = props.station?.radioChannelArtists.map(seed => seed.artist.artistId) || [];
    genreIds.value = props.station?.radioChannelGenres.map(seed => seed.genre.genreId) || [];
    artists.value = [];
    genres.value = [];
    error.value = '';
    loading.value = true;
    // Child props can change one at a time during a parent update. Invalidate
    // old work synchronously, but fetch only for the final open/identity pair.
    await Promise.resolve();
    if (current !== generation || controller.signal.aborted) return;
    try {
      const [artistChoices, genreChoices] = await Promise.all([
        fetcher<{ artistId: string; name?: string; artistName?: string }[]>('/api/artists', { signal: controller.signal }),
        fetcher<{ genreId: string; name: string }[]>('/api/genres', { signal: controller.signal }),
      ]);
      if (current !== generation) return;
      artists.value = artistChoices.map(artist => ({ artistId: artist.artistId, name: artist.name || artist.artistName || 'Unknown artist' }));
      genres.value = genreChoices;
    } catch {
      if (current === generation) error.value = 'Could not load seed choices. Close this form and try again.';
    } finally {
      if (current === generation) loading.value = false;
    }
  }, { immediate: true, flush: 'sync' });

  onScopeDispose(() => { generation++; });

  async function submit() {
    if (!props.open || saving.value || loading.value || !name.value.trim()) return;
    const current = generation;
    const stationId = props.station?.channelId;
    saving.value = true;
    error.value = '';
    try {
      const station = await fetcher<RadioStation>(stationId ? `/api/radio-stations/${stationId}` : '/api/radio-stations', {
        method: stationId ? 'PUT' : 'POST',
        body: { name: name.value.trim(), artistIds: [...artistIds.value], genreIds: [...genreIds.value] },
      });
      if (current !== generation) return;
      saved(station);
      close();
    } catch (err: any) {
      if (current === generation) error.value = err?.data?.statusMessage || 'Could not save the station. Please try again.';
    } finally {
      if (current === generation) saving.value = false;
    }
  }

  return { name, artistIds, genreIds, artists, genres, error, loading, saving, submit };
}
