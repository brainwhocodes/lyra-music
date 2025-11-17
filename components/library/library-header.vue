<template>
  <div class="flex justify-between items-center mb-2 sticky top-0 backdrop-blur py-2 z-10">
    <OmniSearch v-model="searchQuery" />
    <div class="flex items-center gap-4">
        <ul tabindex="0" class="mt-3 z-[1] p-2 menu menu-sm w-52">
          <li><a class="btn btn-ghost">Logout</a></li>
        </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from '#imports';
import OmniSearch from '~/components/ui/omni-search.vue';
import SortingDropdown from '~/components/ui/sorting-dropdown.vue';

const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimer: NodeJS.Timeout | null = null;

const emit = defineEmits<{
  (e: 'search', query: string): void
  (e: 'sort', sortBy: string): void
}>();

watch(searchQuery, (newValue: string) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newValue.trim();
    emit('search', debouncedSearchQuery.value);
  }, 300);
});

const handleSortChange = (sortBy: string) => {
  emit('sort', sortBy);
};

</script>
