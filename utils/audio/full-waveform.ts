import { AudioAnalysisError, type AudioAmplitudeBin } from './types';

export const TRACK_WAVEFORM_LIMITS = Object.freeze({
  seconds: 600,
  bins: 256,
  networkBytes: 16 * 1024 * 1024,
  // Full waveforms consume the complete compressed file. Keep every byte that
  // fits the existing download ceiling so container probes cannot evict early
  // Ogg packets and charge the same audio repeatedly during the decode pass.
  cacheBytes: 16 * 1024 * 1024,
  timeoutMs: 15_000,
  channelSamples: 60_000_000,
  channels: 8,
  sampleRate: 96_000,
  copyFrames: 16_384,
  sampleFrames: 1_048_576,
  samples: 100_000,
});

/** Merges adjacent time intervals; neither normalizes levels nor stretches a prefix. */
export class FullWaveformAccumulator {
  private sums = new Float64Array(TRACK_WAVEFORM_LIMITS.bins);
  private counts = new Uint32Array(TRACK_WAVEFORM_LIMITS.bins);
  private peaks = new Float64Array(TRACK_WAVEFORM_LIMITS.bins);
  private binSeconds = 1 / 64;
  private totalSquares = 0;
  private values = 0;
  private frames = 0;
  private duration = 0;
  private peak = 0;
  private lastEnd = 0;

  constructor(readonly sampleRate: number, readonly channels: number) {
    if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > TRACK_WAVEFORM_LIMITS.sampleRate || !Number.isInteger(channels) || channels < 1 || channels > TRACK_WAVEFORM_LIMITS.channels) {
      throw new AudioAnalysisError('limit', 'This audio format exceeds the waveform resource limits.');
    }
  }

  private merge() {
    const half = TRACK_WAVEFORM_LIMITS.bins / 2;
    for (let index = 0; index < half; index++) {
      this.sums[index] = this.sums[index * 2]! + this.sums[index * 2 + 1]!;
      this.counts[index] = this.counts[index * 2]! + this.counts[index * 2 + 1]!;
      this.peaks[index] = Math.max(this.peaks[index * 2]!, this.peaks[index * 2 + 1]!);
    }
    this.sums.fill(0, half); this.counts.fill(0, half); this.peaks.fill(0, half);
    this.binSeconds *= 2;
  }

  add(pcm: Float32Array, startSeconds: number) {
    const frames = pcm.length / this.channels;
    const end = startSeconds + frames / this.sampleRate;
    if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds < this.lastEnd - 1 / this.sampleRate || !Number.isInteger(frames)) {
      throw new AudioAnalysisError('invalid-audio', 'The decoded waveform has invalid sample timing.');
    }
    if (frames > TRACK_WAVEFORM_LIMITS.copyFrames || end > TRACK_WAVEFORM_LIMITS.seconds + 1e-7 || this.values + pcm.length > TRACK_WAVEFORM_LIMITS.channelSamples) {
      throw new AudioAnalysisError('limit', 'The complete track exceeds the waveform resource limits.');
    }
    for (let frame = 0; frame < frames; frame++) {
      const seconds = startSeconds + frame / this.sampleRate;
      while (seconds >= this.binSeconds * TRACK_WAVEFORM_LIMITS.bins - 1e-9) this.merge();
      // Codec timestamps accumulate floating-point roundoff. A sub-nanosecond
      // boundary error must not move one frame into the preceding interval.
      const bin = Math.floor(seconds / this.binSeconds + 1e-9);
      for (let channel = 0; channel < this.channels; channel++) {
        const value = pcm[frame * this.channels + channel]!;
        if (!Number.isFinite(value)) throw new AudioAnalysisError('invalid-audio', 'The decoded waveform contains invalid amplitudes.');
        const peak = Math.abs(value), square = value * value;
        this.peaks[bin] = Math.max(this.peaks[bin]!, peak);
        this.sums[bin] = this.sums[bin]! + square;
        this.counts[bin] = this.counts[bin]! + 1;
        this.totalSquares += square;
        this.peak = Math.max(this.peak, peak);
      }
    }
    this.frames += frames;
    this.values += pcm.length;
    this.duration = Math.round(Math.max(this.duration, end) * 1e9) / 1e9;
    this.lastEnd = end;
  }

  finish(): { bins: AudioAmplitudeBin[]; durationSeconds: number; peak: number; rms: number; decodedFrames: number } {
    if (!this.values || !this.duration) throw new AudioAnalysisError('invalid-audio', 'No audio samples could be decoded.');
    const bins = Array.from({ length: Math.min(TRACK_WAVEFORM_LIMITS.bins, Math.ceil(this.duration / this.binSeconds)) }, (_, index) => ({
      startSeconds: index * this.binSeconds,
      endSeconds: Math.min(this.duration, (index + 1) * this.binSeconds),
      peak: this.peaks[index]!,
      rms: this.counts[index] ? Math.sqrt(this.sums[index]! / this.counts[index]!) : 0,
    }));
    return { bins, durationSeconds: this.duration, peak: this.peak, rms: Math.sqrt(this.totalSquares / this.values), decodedFrames: this.frames };
  }
}
