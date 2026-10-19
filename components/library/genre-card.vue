<template>
  <NuxtLink :to="`/genres/${genre.genreId}`" class="library-item genre-link">
    <AlbumArt :src="getGenreImageUrl(genre.name)" sizes="72px" />
    <span
      ><strong>{{ genre.name }}</strong
      ><small>Browse albums</small></span
    >
    <span aria-hidden="true">↗</span>
  </NuxtLink>
</template>
<script setup lang="ts">
import AlbumArt from "~/components/album/album-art.vue";
defineProps<{ genre: { genreId: string; name: string } }>();
const { getGenreImageUrl } = useGenreImage();
</script>
