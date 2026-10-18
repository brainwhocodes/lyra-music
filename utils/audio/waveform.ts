import { AUDIO_ANALYSIS_LIMITS, AudioAnalysisError, type AudioAmplitudeBin } from './types';

/** A streaming reduction: PCM is never retained after its current copy block. */
export class AmplitudeAccumulator {
  private sums = new Float64Array(Math.ceil(AUDIO_ANALYSIS_LIMITS.seconds / AUDIO_ANALYSIS_LIMITS.binSeconds));
  private counts = new Uint32Array(this.sums.length);
  private peaks = new Float64Array(this.sums.length);
  private totalSquares = 0;
  private values = 0;
  private peak = 0;
  private frames = 0;
  private duration = 0;
  private lastTimestamp = -Infinity;

  constructor(readonly sampleRate: number, readonly channels: number) {
    if (!Number.isInteger(sampleRate) || sampleRate < 1 || sampleRate > AUDIO_ANALYSIS_LIMITS.sampleRate || !Number.isInteger(channels) || channels < 1 || channels > AUDIO_ANALYSIS_LIMITS.channels) {
      throw new AudioAnalysisError('limit', 'Audio analysis supports up to 8 channels at 192 kHz.');
    }
  }

  add(interleaved: Float32Array, startSeconds: number): void {
    if (!Number.isFinite(startSeconds) || startSeconds < 0 || startSeconds < this.lastTimestamp - 1 / this.sampleRate || interleaved.length % this.channels) {
      throw new AudioAnalysisError('invalid-audio', 'The decoded audio has invalid sample timing.');
    }
    const frames = interleaved.length / this.channels;
    if (frames > AUDIO_ANALYSIS_LIMITS.copyFrames || this.frames + frames > this.sampleRate * AUDIO_ANALYSIS_LIMITS.seconds + 1) {
      throw new AudioAnalysisError('limit', 'The decoded audio exceeds the analysis limit.');
    }
    for (let frame = 0; frame < frames; frame++) {
      const seconds = startSeconds + frame / this.sampleRate;
      if (seconds >= AUDIO_ANALYSIS_LIMITS.seconds) break;
      const bin = Math.floor(seconds / AUDIO_ANALYSIS_LIMITS.binSeconds);
      for (let channel = 0; channel < this.channels; channel++) {
        const value = interleaved[frame * this.channels + channel]!;
        if (!Number.isFinite(value)) throw new AudioAnalysisError('invalid-audio', 'The decoded audio contains invalid amplitudes.');
        const peak = Math.abs(value), square = value * value;
        this.peaks[bin] = Math.max(this.peaks[bin]!, peak);
        this.sums[bin] = this.sums[bin]! + square;
        this.counts[bin] = this.counts[bin]! + 1;
        this.peak = Math.max(this.peak, peak);
        this.totalSquares += square;
        this.values++;
      }
      this.frames++;
      this.duration = Math.min(AUDIO_ANALYSIS_LIMITS.seconds, Math.max(this.duration, seconds + 1 / this.sampleRate));
    }
    this.lastTimestamp = startSeconds + frames / this.sampleRate;
  }

  finish(): { bins: AudioAmplitudeBin[]; peak: number; rms: number; decodedFrames: number; analyzedDurationSeconds: number } {
    if (!this.values) throw new AudioAnalysisError('invalid-audio', 'No audio samples could be decoded.');
    const bins = Array.from({ length: Math.min(this.sums.length, Math.ceil(this.duration / AUDIO_ANALYSIS_LIMITS.binSeconds)) }, (_, index) => ({
      startSeconds: index * AUDIO_ANALYSIS_LIMITS.binSeconds,
      endSeconds: Math.min(this.duration, (index + 1) * AUDIO_ANALYSIS_LIMITS.binSeconds),
      peak: this.peaks[index]!,
      rms: this.counts[index] ? Math.sqrt(this.sums[index]! / this.counts[index]!) : 0,
    }));
    return { bins, peak: this.peak, rms: Math.sqrt(this.totalSquares / this.values), decodedFrames: this.frames, analyzedDurationSeconds: this.duration };
  }
}
