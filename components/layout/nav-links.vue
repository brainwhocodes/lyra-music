<template>
  <nav class="app-nav" aria-label="Main navigation">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      :class="{ 'nav-separator': item.divider }"
      @click="$emit('navigate')"
      >{{ item.label }}</NuxtLink
    >
  </nav>
</template>
<script setup lang="ts">
defineEmits<{ navigate: [] }>();
const items = [
  { to: "/library", label: "Library" },
  { to: "/albums", label: "Albums" },
  { to: "/artists", label: "Artists" },
  { to: "/genres", label: "Genres" },
  { to: "/tracks", label: "Tracks" },
  { to: "/playlists", label: "Playlists" },
  { to: "/explore", label: "Explore", divider: true },
  { to: "/discovery", label: "Discover" },
  { to: "/podcasts", label: "Podcasts" },
  { to: "/radio", label: "Radio" },
  { to: "/settings", label: "Settings", divider: true },
  { to: "/settings/radio", label: "Radio Stations" },
  { to: "/logout", label: "Log out" },
];
</script>
