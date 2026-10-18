<template>
  <UiLoadingSkeleton
    v-if="pending"
    label="Loading artists…"
    variant="compact"
  />
  <p v-else-if="error" role="alert">
    Could not load artists. Please try again.
  </p>
  <div v-else-if="artists?.length" class="library-links">
    <NuxtLink
      v-for="artist in artists.slice(0, 4)"
      :key="artist.artistId"
      :to="`/artists/${artist.artistId}`"
      class="library-item"
    >
      <AlbumArt :src="artist.artistImage" />
      <span
        ><strong>{{ artist.artistName }}</strong
        ><small>Explore artist</small></span
      >
      <span aria-hidden="true">↗</span>
    </NuxtLink>
  </div>
  <p v-else>No artists in your library yet.</p>
</template>
<script setup lang="ts">
import AlbumArt from "~/components/album/album-art.vue";
const {
  data: artists,
  pending,
  error,
} = useLazyFetch<
  Array<{ artistId: string; artistName: string; artistImage: string | null }>
>("/api/artists");
</script>
