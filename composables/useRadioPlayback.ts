import { onScopeDispose, ref } from 'vue';
import type { Track } from '../types/track';

type StationSelection = { channelId: string; name: string };
type RadioFetcher = (url: string, options: { signal: AbortSignal }) => Promise<Track[]>;
type QueueLoader = (tracks: Track[], context: { type: 'radio'; id: string; name: string }) => void;

/** A station response may replace playback only while its selection is current. */
export function useRadioPlayback(fetcher: RadioFetcher, loadQueue: QueueLoader) {
  const busyId = ref('');
  const playError = ref('');
  let generation = 0;
  let controller: AbortController | undefined;
  let disposed = false;

  function cancel() {
    generation++;
    controller?.abort();
    controller = undefined;
    busyId.value = '';
    playError.value = '';
  }

  async function playStation(station: StationSelection) {
    if (disposed) return;
    const { channelId, name } = station;
    const current = ++generation;
    controller?.abort();
    const request = new AbortController();
    controller = request;
    busyId.value = channelId;
    playError.value = '';
    try {
      const tracks = await fetcher(`/api/radio-stations/${channelId}/tracks`, {
        signal: request.signal,
      });
      if (current !== generation || request.signal.aborted) return;
      if (!tracks.length) {
        playError.value = 'No library tracks match this station yet. Try editing its seeds.';
        return;
      }
      loadQueue(tracks, { type: 'radio', id: `radio-${channelId}`, name });
    } catch {
      if (current === generation && !request.signal.aborted) {
        playError.value = 'Could not load this station’s tracks. Please try again.';
      }
    } finally {
      if (current === generation) {
        busyId.value = '';
        controller = undefined;
      }
    }
  }

  onScopeDispose(() => {
    disposed = true;
    cancel();
  });

  return { busyId, playError, playStation, cancel };
}
