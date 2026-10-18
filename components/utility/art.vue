<template>
  <div v-if="!src || failed" class="art-placeholder utility-art">
    <img src="/images/lyra-radio/mark.webp" alt="" />
  </div>
  <img
    v-else
    :src="src"
    :alt="alt"
    class="utility-art"
    @error="failed = true"
  />
</template>
<script setup lang="ts">
const props = withDefaults(
  defineProps<{ src?: string | null; alt?: string }>(),
  { alt: "" },
);
const failed = ref(false);
watch(
  () => props.src,
  () => {
    failed.value = false;
  },
);
</script>
<style scoped>
.utility-art {
  aspect-ratio: 1;
  width: 100%;
  object-fit: cover;
}
.art-placeholder img {
  width: 35%;
  height: 40%;
  object-fit: contain;
}
</style>
