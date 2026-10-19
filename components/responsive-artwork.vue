<template>
  <picture class="responsive-artwork">
    <source :srcset="srcset('avif')" type="image/avif" :sizes="sizes" />
    <source :srcset="srcset('webp')" type="image/webp" :sizes="sizes" />
    <img
      :src="`/images/responsive/${resolvedName}-768.webp`"
      :alt="alt"
      :width="asset.width"
      :height="asset.height"
      :sizes="sizes"
      :loading="priority ? 'eager' : loading"
      :fetchpriority="priority ? 'high' : undefined"
      decoding="async"
      @error="$emit('error', $event)"
    />
  </picture>
</template>
<script setup lang="ts">
import manifest from '~/utils/artwork-manifest.json';
const props = withDefaults(defineProps<{
  name: keyof typeof manifest;
  alt?: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  priority?: boolean;
}>(), { alt: '', sizes: '100vw', loading: 'lazy', priority: false });
defineEmits<{ error: [event: Event] }>();
const resolvedName = computed(() => Object.hasOwn(manifest, props.name) ? props.name : 'rooftop-dj');
const asset = computed(() => manifest[resolvedName.value]);
function srcset(format: 'avif' | 'webp') {
  return asset.value.widths.map(width => `/images/responsive/${resolvedName.value}-${width}.${format} ${width}w`).join(', ');
}
</script>
<style scoped>
.responsive-artwork { display: block; min-width: 0; overflow: hidden; object-fit: cover; }
.responsive-artwork > img { display: block; width: 100%; height: 100%; object-fit: inherit; object-position: inherit; }
</style>
