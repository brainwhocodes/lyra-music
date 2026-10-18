import { AudioAnalysisError } from './types';

export const WAVE_PREFIX_BYTES = 64 * 1024;

/** Returns false until enough prefix bytes arrive; never decodes PCM. */
export function validateWaveExtent(prefix: Uint8Array, fileBytes: number | null): boolean {
  if (prefix.length < 12) return false;
  const id = (offset: number) => String.fromCharCode(...prefix.subarray(offset, offset + 4));
  if (id(0) === 'RF64' || id(0) === 'RIFX') throw new AudioAnalysisError('unsupported', 'This WAVE container requires a different extent validator.');
  if (id(0) !== 'RIFF' || id(8) !== 'WAVE') return true;
  if (fileBytes === null) throw new AudioAnalysisError('unsupported', 'The complete WAVE file size is unavailable.');
  const view = new DataView(prefix.buffer, prefix.byteOffset, prefix.byteLength);
  const end = view.getUint32(4, true) + 8;
  if (end < 12 || end > fileBytes) throw new AudioAnalysisError('invalid-audio', 'The WAVE file is shorter than its declared contents.');
  let offset = 12;
  while (offset + 8 <= prefix.length) {
    const size = view.getUint32(offset + 4, true);
    if (offset + 8 + size > end) throw new AudioAnalysisError('invalid-audio', 'A WAVE audio chunk exceeds the declared file extent.');
    if (id(offset) === 'data') return true;
    offset += 8 + size + (size % 2);
    if (offset >= end) throw new AudioAnalysisError('invalid-audio', 'This WAVE file has no audio data chunk.');
  }
  if (prefix.length >= WAVE_PREFIX_BYTES) throw new AudioAnalysisError('limit', 'The WAVE header exceeds the bounded waveform inspection limit.');
  return false;
}
