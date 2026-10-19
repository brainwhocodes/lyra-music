<template>
  <div class="album-art" :class="{ 'art-placeholder': !artwork || failed }">
    <ResponsiveArtwork
      v-if="illustration && !failed"
      class="album-art-illustration"
      :name="illustration"
      :alt="alt"
      :sizes="sizes"
      @error="failed = true"
    />
    <img
      v-else-if="artwork && !failed"
      :src="artwork"
      :alt="alt"
      loading="lazy"
      decoding="async"
      @error="failed = true"
    />
    <img v-else src="/images/lyra-radio/mark.webp" alt="" class="album-art-mark" />
  </div>
</template>
<script setup lang="ts">
import manifest from '~/utils/artwork-manifest.json';
const props = withDefaults(
  defineProps<{ src?: string | null; alt?: string; sizes?: string }>(),
  { src: null, alt: "", sizes: '(max-width: 550px) 36vw, 18vw' },
);
const failed = ref(false);
const artwork = computed(() =>
  props.src &&
  !/\/images\/icons\/default-(album|artist)-art\.webp$/.test(props.src)
    ? props.src
    : null,
);
const illustration = computed(() => {
  const genre = artwork.value?.match(/^\/images\/genres\/([a-z-]+)-genre-art\.webp$/)?.[1];
  const name = genre ? `genre-${genre}` : '';
  return Object.hasOwn(manifest, name) ? name as keyof typeof manifest : null;
});
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>
<style scoped>
.album-art {
  aspect-ratio: 1;
  width: 100%;
  overflow: hidden;
  border: 1px solid var(--line, #c9c1b4);
  background: var(--paper, #f4efe5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.album-art > img,
.album-art-illustration {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.album-art > .album-art-mark {
  width: 68%;
  height: 68%;
  object-fit: contain;
  mix-blend-mode: multiply;
}
</style>
