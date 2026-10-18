import { ref, onScopeDispose } from "vue";
import type { Playlist } from "~/types/playlist";

/**
 * Provides utilities for loading user playlists.
 */
export const usePlaylists = () => {
  const playlists = ref<Playlist[]>([]);
  const error = ref<unknown>(null);
  const loading = ref(false);
  let version = 0;
  let controller: AbortController | undefined;

  const fetchPlaylists = async (): Promise<Playlist[] | undefined> => {
    const current = ++version;
    controller?.abort();
    controller = new AbortController();
    loading.value = true;
    error.value = null;
    try {
      // Use cookie-based authentication - no need to manually handle tokens
      const data = await $fetch<Playlist[]>("/api/playlists", {
        signal: controller.signal,
        retry: 0,
      });
      if (current !== version) return undefined;
      playlists.value = data;
      return data;
    } catch (err) {
      if (current === version) {
        playlists.value = [];
        error.value = err;
      }
      return undefined;
    } finally {
      if (current === version) loading.value = false;
    }
  };

  onScopeDispose(() => {
    version++;
    controller?.abort();
  });

  return {
    playlists,
    error,
    loading,
    fetchPlaylists,
  };
};
