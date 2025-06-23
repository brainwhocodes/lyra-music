import { ref } from '#imports';
import type { Playlist } from '~/types/playlist';

/**
 * Provides utilities for loading user playlists.
 */
export const usePlaylists = () => {
  const playlists = ref<Playlist[]>([]);
  const error = ref<unknown>(null);
  const loading = ref(false);

  const fetchPlaylists = async (): Promise<Playlist[] | undefined> => {
    loading.value = true;
    error.value = null;
    try {
      const data = await $fetch<Playlist[]>('/api/playlists');
      playlists.value = data;
      return data;
    } catch (err) {
      console.error('Error fetching playlists:', err);
      playlists.value = [];
      error.value = err;
      return undefined;
    } finally {
      loading.value = false;
    }
  };

  return {
    playlists,
    error,
    loading,
    fetchPlaylists,
  };
};
