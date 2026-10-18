<template>
  <div class="volume-control">
    <button
      ref="trigger"
      type="button"
      class="btn btn-ghost control-icon"
      aria-label="Volume"
      title="Volume"
      :aria-expanded="open"
      :aria-controls="panelId"
      :popovertarget="panelId"
    >
      <Icon
        :name="
          player.volume === 0
            ? 'material-symbols:volume-off-rounded'
            : 'material-symbols:volume-up-rounded'
        "
        size="24"
        class="w-6 h-6"
      />
    </button>
    <div
      ref="panel"
      :id="panelId"
      popover="auto"
      class="volume-panel"
      :style="position"
      role="group"
      aria-label="Volume controls"
      @beforetoggle="positionPanel"
      @toggle="onToggle"
    >
      <label :for="inputId">Volume</label>
      <div class="volume-row">
        <button
          type="button"
          class="btn btn-ghost control-icon"
          :aria-label="player.volume === 0 ? 'Unmute' : 'Mute'"
          :title="player.volume === 0 ? 'Unmute' : 'Mute'"
          @click="player.toggleMute"
        >
          <Icon
            :name="
              player.volume === 0
                ? 'material-symbols:volume-off-rounded'
                : 'material-symbols:volume-up-rounded'
            "
            size="24"
            class="w-6 h-6"
          /></button
        ><input
          :id="inputId"
          type="range"
          aria-label="Volume level"
          min="0"
          max="100"
          step="1"
          :value="Math.round(player.volume * 100)"
          :aria-valuetext="Math.round(player.volume * 100) + ' percent'"
          @input="setVolume"
        />
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
const player = usePlayerStore();
const panelId = "volume-panel-" + useId();
const inputId = "volume-input-" + useId();
const open = ref(false);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const position = ref<Record<string, string>>({});
function positionPanel(event: Event) {
  if ((event as ToggleEvent).newState !== "open" || !trigger.value) return;
  const rect = trigger.value.getBoundingClientRect();
  const rootSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const width = Math.min(19 * rootSize, window.innerWidth - 32);
  position.value = {
    left:
      Math.max(
        16,
        Math.min(rect.right - width, window.innerWidth - width - 16),
      ) + "px",
    bottom: Math.max(16, window.innerHeight - rect.top + 8) + "px",
  };
}
function onToggle(event: Event) {
  open.value = (event as ToggleEvent).newState === "open";
}
function setVolume(event: Event) {
  player.setVolume((event.target as HTMLInputElement).valueAsNumber / 100);
}
// A popover positioned for the old layout must not linger off screen after reflow.
const closeOnResize = () => panel.value?.hidePopover();
onMounted(() => window.addEventListener("resize", closeOnResize));
onBeforeUnmount(() => window.removeEventListener("resize", closeOnResize));
</script>
<style scoped>
.volume-control {
  position: relative;
}
.volume-panel {
  position: fixed;
  inset: auto auto 5.5rem 1rem;
  margin: 0;
  padding: 1rem;
  width: min(19rem, calc(100vw - 2rem));
  color: var(--ink);
  background: white;
  border: 1px solid #676e78;
  border-radius: 3px;
  box-shadow: 0 8px 24px #17191c20;
}
.volume-panel label {
  display: block;
  font-weight: 600;
  margin-bottom: 0.25rem;
}
.volume-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.volume-row input {
  min-width: 0;
  flex: 1;
  min-height: 44px;
  accent-color: var(--blue);
  cursor: pointer;
}
</style>
