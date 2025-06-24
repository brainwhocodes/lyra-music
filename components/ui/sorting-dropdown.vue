<template>
  <select class="select select-bordered select-sm" v-model="selectedSort" @change="onSortChange">
    <option v-for="option in sortOptions" :key="option.value" :value="option.value">
      {{ option.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { ref } from '#imports';

type SortOption = {
  label: string;
  value: string;
};

const emit = defineEmits<{(e: 'sort-change', value: string): void;}>();

const selectedSort = ref('title-asc');

const sortOptions: SortOption[] = [
  { label: 'Sorted By: A-Z', value: 'title-asc' },
  { label: 'Sorted By: Z-A', value: 'title-desc' },
  { label: 'Release Year', value: 'release-year-desc' },
  // { label: 'Date Added', value: 'date-added' },
  // { label: 'Most Played', value: 'most-played' },
];

const onSortChange = () => {
  emit('sort-change', selectedSort.value);
};

</script>
