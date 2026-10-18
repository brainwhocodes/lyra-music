<template>
  <UtilityDialog
    :open="open"
    :title="title"
    @update:open="
      (value) => {
        if (!value) emit('close');
      }
    "
  >
    <p class="py-4">{{ message }}</p>
    <div class="modal-action">
      <button type="button" class="btn" autofocus @click="emit('close')">
        Cancel
      </button>
      <button type="button" class="btn btn-error" @click="emit('confirm')">
        Delete
      </button>
    </div>
  </UtilityDialog>
</template>

<script setup lang="ts">
import UtilityDialog from "~/components/utility/dialog.vue";
defineProps<{
  open: boolean;
  title: string;
  message: string;
}>();

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>
