<template>
  <div class="tabs tabs-bordered mb-4">
    <a
      v-for="tab in tabs"
      :key="tab.id"
      class="tab"
      :class="{ 'tab-active': activeTab === tab.id }"
      @click="$emit('update:activeTab', tab.id)"
    >
      {{ tab.name }}
    </a>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ activeTab: string }>();
  defineEmits(['update:activeTab']);

  const tabs = [
    { id: 'playlists', name: 'Playlists' },
    { id: 'albums', name: 'Albums' },
    { id: 'artists', name: 'Artists' },
    { id: 'podcasts', name: 'Podcasts' },
    { id: 'genres', name: 'Genres' },
    { id: 'radio', name: 'Radio' },
    { id: 'discovery', name: 'Discovery' },
  ];
</script>
