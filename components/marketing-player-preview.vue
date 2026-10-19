<template>
  <figure class="lp-player-preview" :class="{ 'lp-player-preview--transport': transport, 'lp-player-preview--editor': editor }">
    <div class="lp-preview-top">
      <ResponsiveArtwork name="landing-midnight-signals" alt="Railway tracks under a pink sunset" sizes="80px" />
      <div><strong>Last train home</strong><span>Atlas Lane</span></div>
      <span v-if="editor" class="lp-edit-label"><Icon name="material-symbols:edit-outline" aria-hidden="true" />Editable lyrics</span>
    </div>
    <div v-if="!transport" class="lp-preview-lyrics">
      <p><span v-if="editor">00:12</span>The city never really sleeps</p>
      <p class="lp-active-line"><span v-if="editor">00:28</span>We take the long way home</p>
      <p><span v-if="editor">00:43</span>And watch the lights go by</p>
    </div>
    <div class="lp-preview-transport" aria-hidden="true">
      <span v-if="transport" class="lp-preview-skip"><Icon name="material-symbols:skip-previous-rounded" /></span>
      <span class="lp-preview-play"><Icon name="material-symbols:play-arrow-rounded" /></span>
      <span v-if="transport" class="lp-preview-skip"><Icon name="material-symbols:skip-next-rounded" /></span>
      <div class="lp-preview-wave"><span v-for="(height, index) in wave" :key="index" :style="{ height: `${height}%` }" :class="{ heard: index < 38 }"></span></div>
      <span class="lp-preview-time">1:24 / 4:06</span>
    </div>
    <figcaption>{{ transport ? 'Illustrative library · Player preview, no audio' : 'Illustrative lyrics · Original sample text' }}</figcaption>
  </figure>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ transport?: boolean; editor?: boolean }>(), { transport: false, editor: false });
// A deterministic graphic, not an audio analysis or functional seek control.
const wave = Array.from({ length: 72 }, (_, index) => 18 + ((index * 17 + index % 7 * 9) % 75));
</script>
<style scoped>
.lp-player-preview { color: var(--ink); background: var(--paper); padding: clamp(1.25rem, 2vw, 2.5rem); border: 1px solid var(--rule); margin: 0; min-width: 0; }
.lp-preview-top { display: flex; align-items: center; gap: 1rem; min-width: 0; }
.lp-preview-top .responsive-artwork { width: clamp(3.5rem, 5vw, 5.5rem); aspect-ratio: 1; flex-shrink: 0; }
.lp-preview-top > div { min-width: 0; flex: 1 1 8rem; }
.lp-preview-top strong { display: block; font-size: clamp(1rem, 1.15vw, 1.375rem); line-height: 1.3; }
.lp-preview-top > div > span { display: block; font-size: .875rem; margin-top: .25rem; }
.lp-edit-label { display: inline-flex; gap: .5rem; align-items: center; font-size: .875rem; font-weight: 600; }
.lp-preview-lyrics { margin-block: 1.5rem; }
.lp-preview-lyrics p { display: flex; gap: 1rem; font-size: clamp(.9375rem, 1.25vw, 1.5rem); padding: .4rem .65rem; margin: 0; color: #4f5661; }
.lp-preview-lyrics p span { font-size: .875rem; min-width: 3rem; padding-top: .2rem; }
.lp-preview-lyrics .lp-active-line { color: var(--ink); background: var(--acid); }
.lp-preview-transport { display: flex; gap: 1rem; align-items: center; margin-top: 1rem; min-width: 0; }
.lp-preview-play { display: flex; align-items: center; justify-content: center; background: var(--ink); color: white; width: 3rem; height: 3rem; flex-shrink: 0; border-radius: 50%; }
.lp-preview-play .iconify { width: 1.75rem; height: 1.75rem; }
.lp-preview-wave { display: flex; flex: 1; align-items: center; justify-content: space-between; height: 2.75rem; gap: clamp(0px, .09vw, 1.5px); min-width: 0; }
.lp-preview-wave span { flex: 1 1 0; min-width: 0; background: #9ca1aa; }
.lp-preview-wave span.heard { background: var(--ink); }
.lp-preview-time { font-size: .875rem; white-space: nowrap; }
figcaption { text-align: right; font-size: .875rem; margin-top: 1rem; }
.lp-player-preview--transport { display: grid; grid-template-columns: minmax(12rem,.7fr) minmax(0,1.7fr); column-gap: 2rem; color: var(--paper); background: var(--ink); }
.lp-player-preview--transport .lp-preview-transport { margin: 0; }
.lp-player-preview--transport .lp-preview-play { background: var(--acid); color: var(--ink); }
.lp-player-preview--transport .lp-preview-wave span.heard { background: var(--acid); }
.lp-player-preview--transport figcaption { grid-column: 1/-1; text-align: left; }
.lp-preview-skip { display: flex; }
.lp-preview-skip .iconify { width: 1.5rem; height: 1.5rem; }
@media(max-width: 1000px) { .lp-player-preview--transport { grid-template-columns: minmax(0, 1fr); row-gap: 1rem; } }
@media(max-width: 480px) { .lp-preview-time { display: none; } .lp-preview-top { flex-wrap: wrap; } .lp-edit-label { flex: 1 0 100%; line-height: 1.3; } .lp-preview-lyrics p { display: block; padding-inline: .35rem; } .lp-preview-lyrics p span { display: block; min-width: 0; padding: 0; margin-bottom: .25rem; } .lp-preview-transport { gap: .5rem; } .lp-preview-skip { display: none; } }
</style>
