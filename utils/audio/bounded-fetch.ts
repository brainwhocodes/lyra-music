import { AUDIO_ANALYSIS_LIMITS, AudioAnalysisError } from './types';

/** Counts received body bytes across all range requests, including decoder prefetch. */
export function createBoundedAudioFetch(
  expectedUrl: string,
  signal: AbortSignal,
  onFatal: (error: AudioAnalysisError) => void,
  fetchImpl: typeof fetch = globalThis.fetch,
  inspect?: { prefixBytes: number; validate: (prefix: Uint8Array, fileBytes: number | null) => boolean },
) {
  let receivedBytes = 0;
  const fetchFn: typeof fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url !== expectedUrl) throw new AudioAnalysisError('network', 'Audio analysis can only read this library track.');
    const requestSignal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    const combined = requestSignal ? AbortSignal.any([signal, requestSignal]) : signal;
    let response: Response;
    try {
      response = await fetchImpl(input, { ...init, signal: combined, credentials: 'same-origin', redirect: 'error' });
    } catch (error) {
      if (combined.aborted) throw combined.reason;
      throw new AudioAnalysisError('network', 'The audio could not be downloaded. Try again.');
    }
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new AudioAnalysisError('network', `The audio request failed (${response.status}). Try again.`);
    }
    const reader = response.body.getReader();
    const range = /^bytes (\d+)-\d+\/(\d+)$/.exec(response.headers.get('Content-Range') ?? '');
    const fullSize = range ? Number(range[2]) : response.status === 200 && response.headers.has('Content-Length') ? Number(response.headers.get('Content-Length')) : null;
    let prefix = inspect && (!range || Number(range[1]) === 0) ? new Uint8Array(inspect.prefixBytes) : undefined;
    let prefixLength = 0;
    const cleanup = () => combined.removeEventListener('abort', onAbort);
    const onAbort = () => { void reader.cancel(combined.reason).catch(() => {}); cleanup(); };
    combined.addEventListener('abort', onAbort, { once: true });
    if (combined.aborted) onAbort();
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          if (combined.aborted) throw combined.reason;
          const chunk = await reader.read();
          if (combined.aborted) throw combined.reason;
          if (chunk.done) {
            if (prefix && !inspect!.validate(prefix.subarray(0, prefixLength), fullSize)) throw new AudioAnalysisError('invalid-audio', 'The audio header is incomplete.');
            cleanup(); controller.close(); return;
          }
          receivedBytes += chunk.value.byteLength;
          if (receivedBytes > AUDIO_ANALYSIS_LIMITS.networkBytes) {
            const error = new AudioAnalysisError('limit', 'This preview reached the 16 MiB download limit. Playback is still available.');
            throw error;
          }
          if (prefix) {
            const copied = Math.min(chunk.value.length, prefix.length - prefixLength);
            prefix.set(chunk.value.subarray(0, copied), prefixLength);
            prefixLength += copied;
            if (inspect!.validate(prefix.subarray(0, prefixLength), fullSize)) prefix = undefined;
          }
          controller.enqueue(chunk.value);
        } catch (error) {
          cleanup();
          const failure = combined.aborted ? combined.reason : error instanceof AudioAnalysisError ? error : new AudioAnalysisError('network', 'The audio download was interrupted. Try again.');
          if (!combined.aborted) onFatal(failure);
          await reader.cancel(failure).catch(() => {});
          controller.error(failure);
        }
      },
      async cancel(reason) { cleanup(); await reader.cancel(reason); },
    }, { highWaterMark: 0 });
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
  return { fetchFn, get receivedBytes() { return receivedBytes; } };
}
