<template>
  <div 
    class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
    @click="$emit('click', playlist.playlistId)"
  >
    <figure class="relative pt-[100%] bg-base-300 overflow-hidden">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="grid grid-cols-2 w-full h-full">
          <div class="bg-base-200 aspect-square"></div>
          <div class="bg-base-300 aspect-square"></div>
          <div class="bg-base-200 aspect-square"></div>
          <div class="bg-base-300 aspect-square"></div>
        </div>
        <div 
          class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100"
        >
          <button class="btn btn-circle btn-primary" @click.stop="$emit('play', playlist.playlistId)">
            <Icon name="material-symbols:play-arrow" class="w-8 h-8" />
          </button>
        </div>
      </div>
    </figure>

    <div class="card-body p-4">
      <h2 class="card-title text-base truncate">{{ playlist.name }}</h2>
      <p class="text-sm text-base-content/70">
        {{ formatPlaylistTrackCount(playlist.trackCount) }}
      </p>
      <div class="card-actions justify-end mt-2">
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-sm btn-circle" @click.stop>
            <Icon name="material-symbols:more-vert" class="w-5 h-5" />
          </button>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
            <li><a @click.stop="$emit('edit', playlist)">Rename</a></li>
            <li><a @click.stop="$emit('delete', playlist.playlistId)" class="text-error">Delete</a></li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Playlist } from '~/types/playlist';

defineProps<{
  playlist: Playlist;
}>();

defineEmits<{
  (e: 'click', id: string): void;
  (e: 'play', id: string): void;
  (e: 'edit', playlist: Playlist): void;
  (e: 'delete', id: string): void;
}>();

import { formatPlaylistTrackCount } from '~/components/playlist/playlist-card.utils';
</script>
