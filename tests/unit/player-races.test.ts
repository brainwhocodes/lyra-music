import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { computed, markRaw, nextTick, ref, watch } from 'vue';
import { usePlayerStore } from '../../stores/player';
import type { Track } from '../../types/track';

class DeferredAudio extends EventTarget {
  static instances: DeferredAudio[] = [];
  paused = true;
  volume = 1;
  currentTime = 0;
  duration = 180;
  readyState = 1;
  networkState = 2;
  error: { code: number; message: string } | null = null;
  plays: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];
  constructor(public src: string) {
    super();
    markRaw(this); // Native HTMLAudioElement objects are also excluded from Vue proxying.
    DeferredAudio.instances.push(this);
  }
  play() {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return new Promise<void>((resolve, reject) => {
      this.plays.push({ resolve: () => { this.dispatchEvent(new Event('playing')); resolve(); }, reject });
    });
  }
  pause() {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
}

let store: ReturnType<typeof usePlayerStore>;
let errors: ReturnType<typeof vi.spyOn>;
let playRequests: ReturnType<typeof vi.fn>;
const track = (id: string) => ({ trackId: id, title: `Track ${id}` } as Track);
const abort = () => new DOMException('Playback was deliberately interrupted', 'AbortError');
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await nextTick(); };

beforeEach(() => {
  DeferredAudio.instances = [];
  setActivePinia(createPinia());
  vi.stubGlobal('ref', ref);
  vi.stubGlobal('computed', computed);
  vi.stubGlobal('watch', watch);
  vi.stubGlobal('Audio', DeferredAudio);
  playRequests = vi.fn(async () => ({}));
  vi.stubGlobal('$fetch', playRequests);
  errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  store = usePlayerStore();
});
afterEach(() => {
  store.clearQueue();
  store.$dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

async function playingA() {
  store.playTrack(track('a'));
  const element = DeferredAudio.instances[0];
  element.dispatchEvent(new Event('loadedmetadata'));
  element.plays[0].resolve();
  await flush();
  return element;
}

describe('media promise ownership and deliberate pause', () => {
  it('changes playback ownership on same-track reload and disposal, but not pause or volume', async () => {
    const initialRevision = store.playbackRevision;
    expect(Number.isSafeInteger(initialRevision)).toBe(true);
    const first = await playingA();
    const loadedRevision = store.playbackRevision;
    expect(loadedRevision).toBeGreaterThan(initialRevision);
    store.togglePlayPause();
    store.setVolume(0.25);
    store.toggleMute();
    store.toggleMute();
    store.togglePlayPause();
    expect(store.playbackRevision).toBe(loadedRevision);

    store.playFromQueue(0);
    expect(store.currentTrack?.trackId).toBe('a');
    expect(DeferredAudio.instances.at(-1)).not.toBe(first);
    expect(store.playbackRevision).toBeGreaterThan(loadedRevision);
    const reloadedRevision = store.playbackRevision;
    store.playTrack(track('b'));
    expect(store.playbackRevision).toBeGreaterThan(reloadedRevision);
    const replacedRevision = store.playbackRevision;
    store.clearQueue();
    expect(store.playbackRevision).toBeGreaterThan(replacedRevision);
  });

  it('clears queue-owned overlays before starting a new listening session', async () => {
    await playingA();
    store.showQueueSidebar();
    store.showFullScreenQueue();
    store.toggleFullScreenPlayer();
    store.showFullScreenLyrics();
    store.showLyricsModal();
    store.setVolume(0.4);
    store.clearQueue();
    store.playTrack(track('b'));
    expect(store.isQueueSidebarVisible).toBe(false);
    expect(store.isFullScreenQueueVisible).toBe(false);
    expect(store.isFullScreenPlayerVisible).toBe(false);
    expect(store.isFullScreenLyricsVisible).toBe(false);
    expect(store.isLyricsModalVisible).toBe(false);
    expect(store.volume).toBe(0.4);
  });
  it('does not restart a user-paused initial play', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    store.playTrack(track('a'));
    const element = DeferredAudio.instances[0];
    store.togglePlayPause();
    element.plays[0].reject(abort());
    await flush();
    // Catch the previous delayed auto-retry behavior without a real wall-clock wait.
    await vi.advanceTimersByTimeAsync(200);
    expect(element.src).toBe('/api/tracks/a/play');
    expect(element.paused).toBe(true);
    expect(element.plays).toHaveLength(1);
    expect(store.isPlaying).toBe(false);
    expect(errors).not.toHaveBeenCalled();
  });

  it('keeps the current element after a resumed play is deliberately paused', async () => {
    const element = await playingA();
    store.togglePlayPause();
    store.togglePlayPause();
    store.togglePlayPause();
    element.plays[1].reject(abort());
    await flush();
    expect(element.src).toBe('/api/tracks/a/play');
    expect(element.paused).toBe(true);
    expect(element.plays).toHaveLength(2);
    expect(store.isPlaying).toBe(false);
    expect(errors).not.toHaveBeenCalled();
  });

  it.each(['initial', 'resume', 'previous', 'repeat', 'seek'])('ignores a stale %s play rejection after switching tracks', async (action) => {
    let old: DeferredAudio;
    if (action === 'initial') {
      store.playTrack(track('a'));
      old = DeferredAudio.instances[0];
    } else {
      old = await playingA();
      if (action === 'resume') { store.togglePlayPause(); store.togglePlayPause(); }
      if (action === 'previous') { store.togglePlayPause(); store.playPrevious(); }
      if (action === 'repeat') { store.toggleRepeatMode(); store.toggleRepeatMode(); old.dispatchEvent(new Event('ended')); }
      if (action === 'seek') { store.startSeeking(); store.updateSeekPosition(2); store.endSeeking(); }
    }
    const pending = old.plays.at(-1)!;
    store.playTrack(track('b'));
    const current = DeferredAudio.instances.at(-1)!;
    current.plays[0].resolve();
    pending.reject(abort());
    await flush();
    expect(current.src).toBe('/api/tracks/b/play');
    expect(current.paused).toBe(false);
    expect(current.plays).toHaveLength(1);
    expect(store.currentTrack?.trackId).toBe('b');
    expect(store.isPlaying).toBe(true);
    expect(errors).not.toHaveBeenCalled();
  });

  it('reports a genuine failure of the currently requested play', async () => {
    const element = await playingA();
    store.togglePlayPause();
    store.togglePlayPause();
    element.plays[1].reject(new DOMException('Unsupported audio codec', 'NotSupportedError'));
    await flush();
    expect(store.isPlaying).toBe(false);
    expect(errors).toHaveBeenCalled();
    expect(errors.mock.calls.flat().map(String).join(' ')).toContain('Unsupported audio codec');
  });

  it('does not let an older rejection overwrite a newer request on the same element', async () => {
    store.playTrack(track('a'));
    const element = DeferredAudio.instances[0];
    store.togglePlayPause();
    store.togglePlayPause();
    element.dispatchEvent(new Event('waiting'));
    element.plays[0].reject(abort());
    await flush();
    expect(element.src).toBe('/api/tracks/a/play');
    expect(element.paused).toBe(false);
    expect(store.isPlaying).toBe(true);
    expect(store.isLoading).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    element.plays[1].resolve();
    await flush();
    expect(store.isLoading).toBe(false);
  });

  it('reports an active decoder error even when the play promise rejects afterwards', async () => {
    store.playTrack(track('a'));
    const element = DeferredAudio.instances[0];
    element.error = { code: 3, message: 'Audio data could not be decoded' };
    element.dispatchEvent(new Event('error'));
    element.plays[0].reject(new DOMException('Unsupported audio', 'NotSupportedError'));
    await flush();
    expect(store.isPlaying).toBe(false);
    expect(errors).toHaveBeenCalled();
    expect(errors.mock.calls.flat().map(String).join(' ')).toContain('Audio data could not be decoded');
  });
});

describe('shared player volume and buffering controls', () => {
  it('restores the compact player volume when unmuting from the full player', async () => {
    const element = await playingA();
    const compactPlayer = usePlayerStore();
    compactPlayer.setVolume(0.2);
    compactPlayer.toggleMute();
    expect(element.volume).toBe(0);

    const fullPlayer = usePlayerStore();
    expect(fullPlayer).toBe(compactPlayer);
    fullPlayer.toggleMute();
    expect(fullPlayer.volume).toBe(0.2);
    expect(element.volume).toBe(0.2);
    expect(element.plays).toHaveLength(1);
  });

  it('remembers the latest audible slider value when the slider reaches zero', async () => {
    const element = await playingA();
    store.setVolume(0.2);
    store.toggleMute();
    store.setVolume(0.45);
    store.setVolume(0);
    store.toggleMute();
    expect(store.volume).toBe(0.45);
    expect(element.volume).toBe(0.45);
  });

  it('preserves mute and its restoration volume when replacing the listening queue', async () => {
    await playingA();
    store.setVolume(0.3);
    store.toggleMute();
    store.clearQueue();
    store.playTrack(track('b'));
    const current = DeferredAudio.instances.at(-1)!;
    expect(current.volume).toBe(0);
    usePlayerStore().toggleMute();
    expect(current.volume).toBe(0.3);
    expect(store.currentTrack?.trackId).toBe('b');
  });

  it('can mute before a track loads and restore the initial full volume', () => {
    store.toggleMute();
    expect(store.volume).toBe(0);
    store.playTrack(track('a'));
    const element = DeferredAudio.instances[0];
    expect(element.volume).toBe(0);
    store.toggleMute();
    expect(element.volume).toBe(1);
  });

  it.each([NaN, Infinity, -Infinity])('ignores a non-finite volume %s', async (invalid) => {
    const element = await playingA();
    store.setVolume(0.35);
    store.setVolume(invalid);
    expect(store.volume).toBe(0.35);
    expect(element.volume).toBe(0.35);
    store.toggleMute();
    store.toggleMute();
    expect(store.volume).toBe(0.35);
  });

  it('allows a playing but buffering element to be paused without restarting it', async () => {
    const element = await playingA();
    element.dispatchEvent(new Event('waiting'));
    expect(store.isPlaying).toBe(true);
    expect(store.isLoading).toBe(true);
    store.togglePlayPause();
    await flush();
    expect(element.paused).toBe(true);
    expect(store.isPlaying).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(element.plays).toHaveLength(1);
  });
});

describe('local track play history', () => {
  it.each(['podcast', 'direct audio'] as const)('does not submit %s playback to local track history', async (source) => {
    const audioUrl = 'https://publisher.example/episode.mp3';
    if (source === 'podcast') {
      store.playPodcastEpisode({
        episodeId: 'episode-1', podcastId: 'feed-1', title: 'An external episode',
        audioUrl, duration: 12, createdAt: '', updatedAt: '',
      }, 'A podcast', 'feed-1');
    } else {
      store.playTrack({ ...track('external-1'), audioUrl });
    }
    const element = DeferredAudio.instances.at(-1)!;
    expect(element.src).toBe(audioUrl);
    element.duration = 12;
    element.dispatchEvent(new Event('loadedmetadata'));
    element.plays[0].resolve();
    await flush();
    store.togglePlayPause();
    // Reproduce the browser failure: seeking a paused episode to halfway.
    store.seek(6);
    element.dispatchEvent(new Event('timeupdate'));
    await flush();
    expect(store.currentTime).toBe(6);
    expect(element.paused).toBe(true);
    expect(playRequests).not.toHaveBeenCalled();
    // Also exercise an external recording crossing the fixed 30-second limit.
    element.duration = 180;
    element.dispatchEvent(new Event('loadedmetadata'));
    element.currentTime = 31;
    element.dispatchEvent(new Event('timeupdate'));
    await flush();
    expect(store.currentTime).toBe(31);
    expect(playRequests).not.toHaveBeenCalled();
    expect(errors).not.toHaveBeenCalled();

    // Excluding an episode must not disable subsequent local track history.
    store.playTrack(track('a'));
    const local = DeferredAudio.instances.at(-1)!;
    local.dispatchEvent(new Event('loadedmetadata'));
    local.plays[0].resolve();
    await flush();
    local.currentTime = 30;
    local.dispatchEvent(new Event('timeupdate'));
    await flush();
    expect(playRequests).toHaveBeenCalledExactlyOnceWith('/api/plays', {
      method: 'POST', body: { trackId: 'a', playDurationMs: 30000, source: 'web-player' },
    });
  });

  it.each([{ duration: 12, threshold: 6 }, { duration: 180, threshold: 30 }])(
    'records a local $duration-second track exactly once at its $threshold-second threshold',
    async ({ duration, threshold }) => {
      // The source determines eligibility, not a heuristic on the track ID.
      const trackId = 'podcast-local-song';
      store.playTrack(track(trackId));
      const element = DeferredAudio.instances.at(-1)!;
      expect(element.src).toBe(`/api/tracks/${trackId}/play`);
      element.duration = duration;
      element.dispatchEvent(new Event('loadedmetadata'));
      element.plays[0].resolve();
      await flush();
      element.currentTime = threshold - 0.1;
      element.dispatchEvent(new Event('timeupdate'));
      await flush();
      expect(playRequests).not.toHaveBeenCalled();
      element.currentTime = threshold;
      element.dispatchEvent(new Event('timeupdate'));
      await flush();
      element.currentTime = threshold + 1;
      element.dispatchEvent(new Event('timeupdate'));
      await flush();
      expect(playRequests).toHaveBeenCalledExactlyOnceWith('/api/plays', {
        method: 'POST', body: { trackId, playDurationMs: threshold * 1000, source: 'web-player' },
      });
    },
  );
});
