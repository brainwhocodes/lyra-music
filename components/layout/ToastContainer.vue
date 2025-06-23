<template>
  <div class="toast toast-top toast-end z-50">
    <div v-for="toast in toasts" :key="toast.id" :class="`alert alert-${toast.type}`">
      <div class="flex-1">
        <span>{{ toast.message }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useToast } from '~/composables/useToast';

const { toasts } = useToast();
</script>
