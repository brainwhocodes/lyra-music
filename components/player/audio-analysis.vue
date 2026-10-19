<template>
  <section class="audio-analysis" aria-labelledby="audio-analysis-title">
    <div class="analysis-content">
      <h3 id="audio-analysis-title">Audio analysis</h3>
      <p>A waveform from the first 30 seconds of this track.</p>
      <template v-if="eligibleTrackId">
        <div v-if="result" class="analysis-result">
          <svg
            class="amplitude-waveform"
            viewBox="0 0 600 160"
            role="img"
            aria-label="Decoded audio waveform"
            preserveAspectRatio="none"
          >
            <title>Decoded audio waveform</title>
            <desc>
              Peak sample amplitude over
              {{ result.analyzedDurationSeconds.toFixed(1) }} seconds. This is a
              visual preview, not a seek control.
            </desc>
            <line
              x1="0"
              x2="600"
              y1="80"
              y2="80"
              stroke="currentColor"
              opacity="0.3"
            />
            <rect
              v-for="(bin, index) in result.bins"
              :key="index"
              :x="(index * 600) / result.bins.length"
              :y="80 - barHeight(bin.peak) / 2"
              :width="Math.max(1, 600 / result.bins.length - 2)"
              :height="barHeight(bin.peak)"
              fill="currentColor"
            />
          </svg>
          <div class="waveform-axis" aria-hidden="true">
            <span>0s</span
            ><span>{{ result.analyzedDurationSeconds.toFixed(1) }}s</span>
          </div>
          <p class="analysis-summary">
            {{ result.codec.toUpperCase() }} ·
            {{ result.sampleRate.toLocaleString("en-US") }} Hz ·
            {{ result.channels }}
            {{ result.channels === 1 ? "channel" : "channels" }}
          </p>
          <dl class="amplitude-values">
            <div>
              <dt>Analyzed</dt>
              <dd>
                {{ result.analyzedDurationSeconds.toFixed(1) }}s{{
                  result.truncated ? " preview" : ""
                }}
              </dd>
            </div>
            <div>
              <dt>Peak amplitude</dt>
              <dd>{{ result.peak.toFixed(4) }}</dd>
            </div>
            <div>
              <dt>RMS amplitude</dt>
              <dd>{{ result.rms.toFixed(4) }}</dd>
            </div>
          </dl>
          <p class="analysis-note">
            Amplitude preview, not a loudness score. The waveform is scaled to
            this preview’s peak.
          </p>
        </div>
        <p v-if="state === 'error'" role="alert" class="analysis-error">
          {{ error }}
        </p>
        <p role="status" class="analysis-status">{{ statusText }}</p>
        <button
          class="btn"
          :class="running || result ? 'btn-outline' : 'btn-primary'"
          @click="running ? cancel() : start()"
        >
          {{
            running
              ? "Cancel analysis"
              : state === "error"
                ? "Retry analysis"
                : result
                  ? "Analyze again"
                  : "Analyze audio"
          }}
        </button>
        <p class="analysis-note">
          Runs on your device. Playback keeps its place.
        </p>
      </template>
      <p v-else class="analysis-note">
        Audio analysis is available for tracks in your library. Podcast playback
        continues as usual.
      </p>
    </div>
    <ResponsiveArtwork
      class="analysis-art"
      name="platform-session"
      alt=""
      sizes="(max-width: 700px) calc(100vw - 48px), 32vw"
    />
  </section>
</template>
<script setup lang="ts">
import { useAudioAnalysis } from "~/composables/useAudioAnalysis";
const props = defineProps<{ trackId: string | null; external?: boolean }>();
const eligibleTrackId = computed(() => (props.external ? null : props.trackId));
const { result, progress, state, error, running, start, cancel } =
  useAudioAnalysis(eligibleTrackId);
const statusText = computed(() => {
  if (state.value === "running")
    return progress.value?.phase === "decoding"
      ? `Analyzing audio… ${Math.min(30, progress.value.decodedSeconds).toFixed(0)} seconds decoded.`
      : "Opening audio for analysis…";
  if (state.value === "cancelled") return "Analysis cancelled.";
  if (state.value === "complete") return "Audio analysis complete.";
  return "";
});
function barHeight(peak: number) {
  return Math.max(1, Math.min(1, peak / (result.value?.peak || 1)) * 150);
}
</script>
<style scoped>
.audio-analysis {
  min-width: 0;
  border: 2px solid var(--ink);
  border-top: 10px solid var(--acid);
  background: var(--paper);
  align-self: start;
}
.analysis-content {
  padding: clamp(1rem, 2.4vw, 2rem);
}
h3 {
  font-size: clamp(2rem, 3.2vw, 3rem);
  line-height: 1;
  margin: 0 0 0.75rem;
  text-transform: uppercase;
}
p {
  margin: 0 0 1rem;
  line-height: 1.5;
}
.amplitude-waveform {
  display: block;
  width: 100%;
  height: 150px;
  margin-top: 1.5rem;
  color: var(--blue);
}
.waveform-axis {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
  margin: 0.5rem 0 1rem;
}
.analysis-summary {
  border-top: 1px solid var(--rule);
  padding-top: 1rem;
}
.amplitude-values {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  margin: 0 0 1rem;
}
.amplitude-values dt {
  font-size: 0.875rem;
  color: var(--muted);
}
.amplitude-values dd {
  margin: 0.2rem 0 0;
  font-variant-numeric: tabular-nums;
}
.analysis-note {
  color: var(--muted);
  font-size: 0.875rem;
  margin: 1rem 0 0;
}
.analysis-status:empty {
  display: none;
}
.analysis-status {
  margin-top: 1rem;
}
.analysis-error {
  margin-top: 1rem;
  padding: 0.75rem;
  border-left: 3px solid var(--ink);
  background: var(--orange);
  color: var(--ink);
}
.analysis-art {
  width: 100%;
  height: clamp(9rem, 20vw, 15rem);
  object-fit: cover;
  object-position: 70% 28%;
  border-top: 2px solid var(--ink);
}
.btn {
  height: auto;
  white-space: normal;
  min-height: 44px;
  max-width: 100%;
}
@media (max-width: 800px) {
  .analysis-art {
    height: 9rem;
  }
}
</style>
