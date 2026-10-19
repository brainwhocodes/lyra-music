<template>
  <figure class="lp-search-preview">
    <div class="lp-query"><Icon name="material-symbols:search" aria-hidden="true" /><span>late-night city drive</span></div>
    <ol>
      <li v-for="track in tracks" :key="track.name">
        <ResponsiveArtwork :name="track.art" alt="" sizes="64px" />
        <div><strong>{{ track.name }}</strong><span>{{ track.artist }}</span></div>
        <p v-if="excerpts">{{ track.excerpt }}</p>
        <span class="lp-search-time">{{ track.duration }}</span>
      </li>
    </ol>
    <figcaption>Illustrative library · Semantic search preview</figcaption>
  </figure>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ excerpts?: boolean }>(), { excerpts: false });
const tracks = [
 { name: 'Neon side streets', artist: 'Atlas Lane', art: 'landing-midnight-signals' as const, duration: '3:42', excerpt: 'Streetlights blur as the city keeps moving…' },
 { name: 'Last train home', artist: 'Night Echo', art: 'landing-after-hours' as const, duration: '4:17', excerpt: 'Driving through a different kind of quiet…' },
 { name: 'Blue hour', artist: 'The Monday Club', art: 'landing-open-sky' as const, duration: '5:06', excerpt: 'Same streets, new horizons tonight…' },
];
</script>
<style scoped>
.lp-search-preview { margin: 0; padding: clamp(1.25rem, 2vw, 2.5rem); background: var(--paper); color: var(--ink); border: 1px solid var(--rule); min-width: 0; }
.lp-query { display: flex; gap: .9rem; align-items: center; padding: 1rem; border: 1px solid var(--rule); background: white; font-weight: 600; font-size: clamp(.9375rem, 1.15vw, 1.375rem); }
.lp-query .iconify { width: 1.5rem; height: 1.5rem; flex-shrink: 0; }
ol { list-style: none; padding: 0; margin: 1rem 0 0; }
li { display: flex; align-items: center; gap: 1rem; padding-block: 1rem; }
li + li { border-top: 1px solid #cbd0d8; }
li .responsive-artwork { width: clamp(3rem, 4vw, 4.8rem); aspect-ratio: 1; flex-shrink: 0; }
li > div { min-width: 0; flex: 1; }
li strong { display: block; font-size: clamp(.9375rem, 1.1vw, 1.3rem); line-height: 1.3; }
li div span, .lp-search-time { font-size: .875rem; }
li p { flex: 1; font-size: .875rem; margin: 0; }
.lp-search-time { white-space: nowrap; }
figcaption { margin-top: 1rem; text-align: right; font-size: .875rem; }
@media(max-width: 1100px) { li p { display: none; } }
@media(max-width: 390px) { .lp-search-preview { padding: 1rem; } li { gap: .65rem; } .lp-search-time { display: none; } }
</style>
