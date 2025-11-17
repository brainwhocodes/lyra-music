<template>
  <div :class="['modal', { 'modal-open': open }]" role="dialog">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ title }}</h3>
      <p class="py-4">{{ message }}</p>
      <div class="modal-action">
        <button class="btn" @click="$emit('close')">Cancel</button>
        <button class="btn btn-error" @click="$emit('confirm')">Delete</button>
      </div>
    </div>
    <div class="modal-backdrop" @click="$emit('close')"></div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{ 
    open: boolean;
    title: string;
    message: string;
  }>();

  defineEmits(['close', 'confirm']);
</script>
