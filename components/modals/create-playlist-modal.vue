<template>
  <Teleport to="body">
    <dialog :open="open" class="modal modal-middle" @close="handleClose" ref="dialogElement">
      <div class="modal-box p-6 max-w-md">
        <button
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          @click="closeModal"
        >
          ✕
        </button>
        <h3 class="font-bold text-lg mb-4">Create New Playlist</h3>
        <form @submit.prevent="submitCreatePlaylist">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Playlist Name</span>
            </label>
            <input
              type="text"
              v-model="playlistName"
              placeholder="My Awesome Playlist"
              class="input input-bordered w-full"
              required
              ref="playlistNameInput"
            />
          </div>
          <div class="modal-action mt-6">
            <button type="button" class="btn btn-ghost" @click="closeModal">Cancel</button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting || !playlistName.trim()"
            >
              <span v-if="isSubmitting" class="loading loading-spinner loading-xs mr-2"></span>
              Create
            </button>
          </div>
        </form>
      </div>
      <!-- Native backdrop click to close for dialog element -->
       <form method="dialog" class="modal-backdrop" @click="closeModal"></form>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">

interface Props {
  open: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits(['update:open', 'create-playlist']);

const playlistName = ref('');
const isSubmitting = ref(false);
const playlistNameInput = ref<HTMLInputElement | null>(null);
const dialogElement = ref<HTMLDialogElement | null>(null);

/**
 * Handles the submission of the create playlist form.
 */
const submitCreatePlaylist = async (): Promise<void> => {
  if (!playlistName.value.trim()) return;
  isSubmitting.value = true;
  try {
    emit('create-playlist', playlistName.value.trim());
    // Parent will handle actual API call and closing on success/failure
    // For now, we assume parent will close by setting open=false
  } catch (error) { // Added type for error
    console.error('Failed to emit create-playlist event:', error);
    // Optionally handle error display within the modal
  } finally {
    // isSubmitting.value = false; // Parent should manage this based on API call
  }
};

/**
 * Closes the modal.
 */
const closeModal = (): void => {
  emit('update:open', false);
};

/**
 * Handles the native 'close' event of the dialog element (e.g., when Escape is pressed).
 */
const handleClose = (): void => {
    emit('update:open', false);
};

watch(() => props.open, async (isOpen: boolean) => { // Added type for isOpen
  if (isOpen) {
    playlistName.value = ''; // Reset name on open
    isSubmitting.value = false; // Reset submitting state
    dialogElement.value?.showModal(); // Use showModal for native dialog behavior
    await nextTick();
    playlistNameInput.value?.focus();
  } else {
    dialogElement.value?.close(); // Use close for native dialog behavior
  }
});

// Ensure dialog is closed if component is unmounted while open
onUnmounted(() => {
  if (dialogElement.value?.open) {
    dialogElement.value.close();
  }
});
</script>

<style scoped>
/* Add any specific styles for this modal here if needed */
</style>
