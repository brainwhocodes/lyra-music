<template>
  <NuxtLink :to="`/genres/${genre.id}`" class="card bg-base-100 shadow-xl image-full hover:scale-105 transition-transform duration-300 ease-in-out">
    <figure>
      <img :src="genreImage" alt="Genre Image" class="w-full h-full object-cover" />
    </figure>
    <div class="card-body justify-center items-center">
      <h2 class="card-title text-white text-2xl font-bold">{{ genre.name }}</h2>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from '#imports';

const props = defineProps<{ 
  genre: { 
    id: string;
    name: string;
  }
}>();

const { getGenreImageUrl } = useGenreImage();
const genreImage = computed(() => getGenreImageUrl(props.genre.name));
</script>

<style scoped>
.card {
  aspect-ratio: 16 / 9;
}
</style>
