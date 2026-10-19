<template>
  <figure class="lp-collection" :class="{ 'lp-collection--stations': stations }">
    <div class="lp-sleeves">
      <div v-for="sleeve in sleeves" :key="sleeve.name" class="lp-sleeve">
        <ResponsiveArtwork :name="sleeve.art" :alt="sleeve.alt" :sizes="stations ? '(max-width: 500px) 45vw, (max-width: 700px) 29vw, 19vw' : '(max-width: 500px) 84vw, (max-width: 700px) 29vw, 20vw'" />
        <div class="lp-sleeve-copy"><h3>{{ sleeve.name }}</h3><p v-if="sleeve.artist">{{ sleeve.artist }}</p></div>
      </div>
    </div>
    <figcaption class="lp-caption">Illustrative library · Original artwork</figcaption>
  </figure>
</template>
<script setup lang="ts">
const props = withDefaults(defineProps<{ stations?: boolean }>(), { stations: false });
const sleeves = computed(() => props.stations ? [
  { name: 'After hours', art: 'landing-after-hours' as const, alt: 'A listener with orange headphones in a rainy blue city', artist: '' },
  { name: 'Concrete rhythm', art: 'landing-concrete-rhythm' as const, alt: 'An elevated railway beneath an orange sunset', artist: '' },
  { name: 'Open sky', art: 'landing-open-sky' as const, alt: 'A listener looking toward a bright blue summer sky', artist: '' },
] : [
  { name: 'Midnight Signals', artist: 'Atlas Lane', art: 'landing-midnight-signals' as const, alt: 'Railway tracks disappearing into a pink sunset' },
  { name: 'Silhouettes', artist: 'Paper Moon', art: 'landing-silhouettes' as const, alt: 'Orange koi among cobalt lily leaves' },
  { name: 'Stray Light', artist: 'The Monday Club', art: 'landing-stray-light' as const, alt: 'A white painted orbit and orange ink on black' },
]);
</script>
<style scoped>
.lp-collection { margin: 0; min-width: 0; }
.lp-sleeves { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: clamp(.65rem, 1.2vw, 1.5rem); }
.lp-sleeve { min-width: 0; }
.lp-sleeve .responsive-artwork { aspect-ratio: 1; }
.lp-sleeve-copy { padding-top: .75rem; }
.lp-sleeve-copy h3 { font-size: clamp(1.35rem, 1.65vw, 2rem); line-height: 1.12; }
.lp-sleeve-copy p { font-size: clamp(.875rem, 1vw, 1.2rem); margin: .3rem 0 0; }
.lp-collection--stations .lp-sleeve { background: var(--ink); color: var(--paper); border-bottom: .5rem solid var(--acid); }
.lp-collection--stations .lp-sleeve:nth-child(2) { border-color: var(--orange); }
.lp-collection--stations .lp-sleeve:nth-child(3) { border-color: var(--blue); }
.lp-collection--stations .responsive-artwork { aspect-ratio: .72; }
.lp-collection--stations .lp-sleeve-copy { padding: 1rem; }
.lp-collection--stations h3 { font-size: clamp(1.6rem, 2.4vw, 2.9rem); text-transform: uppercase; }
@media(max-width: 500px) {
 .lp-sleeves { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
 .lp-sleeve .responsive-artwork { aspect-ratio: 1.2; }
 .lp-collection--stations .lp-sleeve { display: flex; flex-wrap: wrap; border-bottom-width: .35rem; }
 .lp-collection--stations .responsive-artwork { flex: 1 1 6rem; width: 0; aspect-ratio: .8; }
 .lp-collection--stations .lp-sleeve-copy { flex: 1 1 10rem; min-width: 0; display: flex; align-items: center; padding: .75rem .375rem; }
 .lp-collection--stations h3 { font-size: clamp(1.6rem, 8vw, 2rem); }
}
</style>
