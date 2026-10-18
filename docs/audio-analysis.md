# Local audio analysis with Mediabunny

The current seek-bar integration uses the **complete-track waveform API**, documented in [track-waveform.md](track-waveform.md). The original explicit 30-second analysis API below remains available and tested as a separate utility; it must never be stretched across a full-track seek bar. The Analyze panel and metrics described below belong to the historical UX-v2 interface and are no longer mounted in the player.

Lyra uses **Mediabunny 1.61.6**, by Vanilagy, under the Mozilla Public License 2.0 for an explicit, browser-side amplitude preview. The dependency is unmodified; its source notice is “Copyright (c) 2026-present, Vanilagy and contributors.” Its source ships in the npm package under `node_modules/mediabunny/src`; the [upstream repository](https://github.com/Vanilagy/mediabunny) and [bundled license copy](licenses/mediabunny-MPL-2.0.txt) provide source and license attribution. Native streaming playback continues through the existing player. Analysis neither replaces its decoder nor changes the playback queue, play/pause state, or seek position.

The user chooses **Analyze audio**. The decoder reads the existing same-origin `/api/tracks/:trackId/stream` endpoint and reduces actual PCM samples from the first **30 seconds** into quarter-second bins. MP3, WAVE, FLAC, OGG, MP4, ADTS, and Matroska containers are accepted when Mediabunny and the browser can decode their audio codec. There is no API key, cloud service, codec polyfill, external podcast fetch, or automatic analysis request. Unsupported analysis does not imply that native playback is unsupported.

Peak and RMS are **linear PCM amplitudes**, combined across channels without phase cancellation. RMS is the square root of the mean squared channel samples. These are not LUFS, perceived loudness, BPM, music tags, or a loudness-normalization recommendation. Quiet audio stays quiet in the data; silence stays zero. The UI scales waveform bar heights to the preview's own peak and explicitly labels that scaling; the numerical peak/RMS remain unscaled. Floating-point audio can have amplitudes above 1. MP3 encoder delay/padding can make the analyzed duration slightly longer than a file's nominal duration.

## API

`utils/audio/track-analysis.ts` exports `analyzeTrackAudio(trackId, { signal?, onProgress? })`. It dynamically imports Mediabunny only when requested. `analyzeAudioBlob(blob, options)` uses exactly the same decoder for local-file and codec verification.

The result includes `source: 'mediabunny'`, `trackId`, `codec`, `sampleRate`, `channels`, `analyzedDurationSeconds`, `previewLimitSeconds: 30`, `truncated`, `decodedFrames`, `receivedBytes`, aggregate `peak`/`rms`, and `bins` with `startSeconds`, `endSeconds`, `peak`, and `rms`. A local Blob reports zero network bytes. Progress contains `phase: 'opening' | 'decoding'`, `decodedSeconds`, `limitSeconds`, and `receivedBytes`.

`AudioAnalysisError.code` distinguishes `cancelled`, `busy`, `unsupported`, `network`, `invalid-audio`, `limit`, and `timeout`. Cancelled or stale requests must not publish their result in the UI. The caller owns an AbortController and cancels on track replacement, dialog close, or component disposal. Only one analysis runs at a time.

## Resource and lifecycle limits

- At most 30 seconds, 8 channels, 192 kHz, and 120 amplitude bins. PCM copies contain at most 16,384 frames; each decoded sample is limited to 1,048,576 frames and at most 100,000 sample objects are processed. No complete decoded track is retained.
- The source cache is 4 MiB, range-fetch parallelism is 1, and automatic retries are disabled. A shared byte counter stops all analysis after 16 MiB of received response-body data. The chunk that crosses this limit has already arrived from Fetch; this is a stop threshold, not a guarantee that wire traffic cannot exceed 16 MiB by one incoming chunk. Browser and native-codec buffers exist outside the JavaScript copy budget.
- A 20-second operation timeout covers opening and decoding. Work yields during reduction to keep cancellation and the UI responsive. The timer cannot interrupt synchronous work already executing inside a browser/native codec.
- Same-origin credentials are used, redirects and alternate source URLs are rejected, and input disposal aborts all range requests. Mediabunny overrides `requestInit.signal`, so disposal and a custom bounded Fetch wrapper handle cancellation. Background source failures enter the same operation error path.
- Every yielded `AudioSample` is closed in `finally`; every `Input` is disposed on success, cancellation, timeout, or failure.

## Verification

Run `pnpm exec vitest run tests/unit/audio-analysis.test.ts tests/unit/audio-analysis-races.test.ts tests/integration/audio-analysis.test.ts`. All 27 cases passed: known sine-wave RMS/peak, stereo phase independence, silence, the real speech WAV, exclusion of a loud 31st-second tail, malformed data and successful retry, bounded fetch/cancellation/concurrency/capability/timeout behavior, and eight reactive request-ownership cases. Capability and stalled-codec tests replace only that failure boundary; the normal PCM paths use the real Mediabunny decoder. The Vue cases deliberately deliver late success, error, and progress after abort to prove that cancelled, replaced, and disposed requests cannot overwrite current UI state.

Run `pnpm test:audio-codecs` with Playwright Chromium and FFmpeg installed. This bundles the production module into an isolated `file://` page; it does not build or start Lyra. It uses the actual browser `AudioDecoder` and both licensed MP3 fixtures, then compares their output with independently decoded FFmpeg PCM. The report is written to `.test-data/audio-analysis/real-codec-report.json`.

On Chromium 156.0.8078.4, both 12-second 44.1 kHz stereo fixtures produced 12.04244898 seconds and 49 bins. *The Distant Sun* measured peak 0.1050867811/RMS 0.0188685479; *Signal to Noise* measured peak 0.4651760459/RMS 0.0691796540. FFmpeg peaks agreed within 0.00000004 and RMS differed by 0.1764%, consistent with decoder padding. These results prove real PCM decoding; they do not establish every browser/codec combination.

The subsequent production application gate passed all **61 runtime-free Chromium cases** across desktop, tablet and mobile, including nine new audio-analysis cases. These exercise real authenticated `/stream` requests, native playback coexistence, malformed-file recovery, cancellation, track replacement and podcast ineligibility. The combined 320px/200% text journey also passed. See the [browser verification record](design/lyra-radio/ux-v2/browser-verification.md); final raw evidence is preserved in `.test-data/ux-v2-build5-production`.

## Primary references

- [Mediabunny decoded-media sinks](https://mediabunny.dev/guide/media-sinks): sample iteration, codec capability checks, and sample disposal.
- [UrlSourceOptions](https://mediabunny.dev/api/UrlSourceOptions): cache, parallelism, retry, custom Fetch, and background-error controls.
- [Input](https://mediabunny.dev/api/Input): input lifecycle and disposal.
- [AudioSample](https://mediabunny.dev/api/AudioSample): decoded samples and PCM copying.
- [Supported formats and codecs](https://mediabunny.dev/guide/supported-formats-and-codecs): container and browser codec availability.
