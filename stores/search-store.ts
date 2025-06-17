import { defineStore } from 'pinia';
import { ref, watch } from '#imports';

export const useSearchStore = defineStore('search', () => {
  const searchQuery = ref<string>('');
  const activeSearchContext = ref<string | null>(null); // e.g., 'albums', 'artists'

  function setSearchQuery(query: string): void {
    searchQuery.value = query;
  }

  function setActiveSearchContext(context: string | null): void {
    activeSearchContext.value = context;
  }

  function clearSearch(): void {
    searchQuery.value = '';
    // Optionally clear context or set to a default
    // activeSearchContext.value = null;
  }

  // Optional: Watch for route changes to clear search when leaving a searchable page
  // This would require access to the router, which can be done via a plugin or passed in

  return {
    searchQuery,
    activeSearchContext,
    setSearchQuery,
    setActiveSearchContext,
    clearSearch,
  };
});
