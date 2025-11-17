<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <h1 class="text-3xl font-bold tracking-tight text-base-content">Radio Stations</h1>
    <p class="mt-2 text-lg leading-8 text-base-content/70">
      Tune in to one of our handcrafted radio stations.
    </p>

    <div v-if="pending" class="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <!-- Skeleton Loader -->
      <div v-for="n in 6" :key="n" class="animate-pulse">
        <div class="aspect-square bg-base-300 rounded-lg"></div>
        <div class="h-4 bg-base-300 rounded mt-2 w-3/4"></div>
      </div>
    </div>

    <div v-else-if="error" class="mt-8 text-center">
      <p class="text-error">Failed to load radio stations. Please try again later.</p>
    </div>

    <div v-else-if="stations && stations.length > 0" class="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      <NuxtLink v-for="station in stations" :key="station.channelId" :to="`/radio/${station.channelId}`" class="group">
        <div class="aspect-square relative overflow-hidden rounded-lg bg-base-300">
          <img v-if="station.logoImagePath" :src="station.logoImagePath" :alt="`${station.name} Logo`" class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon name="ph:radio-solid" class="h-1/2 w-1/2 text-base-content/50" />
          </div>
          <div class="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300"></div>
        </div>
        <h2 class="mt-2 text-sm font-semibold text-base-content truncate group-hover:text-primary">{{ station.name }}</h2>
      </NuxtLink>
    </div>

    <div v-else class="mt-8 text-center">
      <p class="text-base-content/70">No radio stations are available at the moment.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RadioChannel } from '~/server/db/schema/radio-channels';

const { data: stations, pending, error } = await useFetch<RadioChannel[]>('/api/radio-stations', {
  lazy: true,
  server: true, // Fetch on client side
});

definePageMeta({
  layout: 'sidebar-layout',
});

useHead({
  title: 'Radio',
});
</script>
