export const AUDIO_ANALYSIS_LIMITS = Object.freeze({
  seconds: 30,
  binSeconds: 0.25,
  networkBytes: 16 * 1024 * 1024,
  cacheBytes: 4 * 1024 * 1024,
  timeoutMs: 20_000,
  channels: 8,
  sampleRate: 192_000,
  copyFrames: 16_384,
  sampleFrames: 1_048_576,
});

export type AudioAnalysisErrorCode = 'cancelled' | 'busy' | 'unsupported' | 'network' | 'invalid-audio' | 'limit' | 'timeout';

export class AudioAnalysisError extends Error {
  readonly name = 'AudioAnalysisError';
  constructor(readonly code: AudioAnalysisErrorCode, message: string) { super(message); }
}

export interface AudioAnalysisProgress {
  phase: 'opening' | 'decoding';
  decodedSeconds: number;
  limitSeconds: number;
  receivedBytes: number;
}

export interface AudioAnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AudioAnalysisProgress) => void;
}

/** Amplitudes are linear PCM levels, not perceived loudness or LUFS. */
export interface AudioAmplitudeBin {
  startSeconds: number;
  endSeconds: number;
  peak: number;
  rms: number;
}

export interface AudioAnalysis {
  trackId: string;
  source: 'mediabunny';
  codec: string;
  sampleRate: number;
  channels: number;
  analyzedDurationSeconds: number;
  previewLimitSeconds: number;
  truncated: boolean;
  bins: AudioAmplitudeBin[];
  peak: number;
  rms: number;
  decodedFrames: number;
  receivedBytes: number;
}
