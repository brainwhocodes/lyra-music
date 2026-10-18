<template>
  <div class="album-art" :class="{ 'art-placeholder': !artwork || failed }">
    <img
      v-if="artwork && !failed"
      :src="artwork"
      :alt="alt"
      loading="lazy"
      @error="failed = true"
    />
    <img v-else src="/images/lyra-radio/mark.webp" alt="" class="album-art-mark" />
  </div>
</template>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ src?: string | null; alt?: string }>(),
  { src: null, alt: "" },
);
const failed = ref(false);
const artwork = computed(() =>
  props.src &&
  !/\/images\/icons\/default-(album|artist)-art\.webp$/.test(props.src)
    ? props.src
    : null,
);
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
.album-art > img {
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
