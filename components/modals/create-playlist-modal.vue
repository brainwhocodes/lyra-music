<template>
  <Teleport to="body">
    <dialog
      class="modal modal-middle"
      aria-labelledby="create-playlist-heading"
      @close="handleClose"
      ref="dialogElement"
    >
      <div class="modal-box p-6 max-w-md">
        <button
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          aria-label="Close create playlist"
          @click="closeModal"
        >
          ✕
        </button>
        <h3 id="create-playlist-heading" class="font-bold text-lg mb-4">
          Create New Playlist
        </h3>
        <form @submit.prevent="submitCreatePlaylist">
          <div class="form-control">
            <label class="label" for="new-playlist-name">
              <span class="label-text">Playlist Name</span>
            </label>
            <input
              id="new-playlist-name"
              type="text"
              v-model="playlistName"
              placeholder="My Awesome Playlist"
              class="input input-bordered w-full"
              required
              autofocus
              ref="playlistNameInput"
            />
          </div>
          <p v-if="errorMessage" role="alert" class="text-error text-sm mt-3">
            {{ errorMessage }}
          </p>
          <div class="modal-action mt-6">
            <button type="button" class="btn btn-ghost" @click="closeModal">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isSubmitting || !playlistName.trim()"
            >
              <span
                v-if="isSubmitting"
                class="loading loading-spinner loading-xs mr-2"
              ></span>
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
  isSubmitting?: boolean;
  errorMessage?: string;
}

const props = defineProps<Props>();
const emit = defineEmits(["update:open", "create-playlist"]);

const playlistName = ref("");
const playlistNameInput = ref<HTMLInputElement | null>(null);
const dialogElement = ref<HTMLDialogElement | null>(null);

/**
 * Handles the submission of the create playlist form.
 */
const submitCreatePlaylist = (): void => {
  if (!playlistName.value.trim() || props.isSubmitting) return;
  emit("create-playlist", playlistName.value.trim());
};

/**
 * Closes the modal.
 */
const closeModal = (): void => {
  emit("update:open", false);
};

/**
 * Handles the native 'close' event of the dialog element (e.g., when Escape is pressed).
 */
const handleClose = (): void => {
  // close events are queued by the browser; ignore a stale event if the
  // user already reopened this dialog before that event was dispatched.
  if (!dialogElement.value?.open) emit("update:open", false);
};

watch(
  () => props.open,
  async (isOpen: boolean) => {
    // Added type for isOpen
    if (isOpen) {
      playlistName.value = ""; // Reset name on open
      dialogElement.value?.showModal(); // Use showModal for native dialog behavior
      await nextTick();
      // Native focus can run while the opening styles are still hidden. Focus
      // after styles apply only if native/user focus has not reached a control.
      requestAnimationFrame(() => {
        const currentDialog = dialogElement.value;
        if (
          props.open && currentDialog?.open &&
          (document.activeElement === currentDialog || !currentDialog.contains(document.activeElement))
        ) {
          playlistNameInput.value?.focus({ preventScroll: true });
        }
      });
    } else {
      dialogElement.value?.close(); // Use close for native dialog behavior
    }
  },
);

// Ensure dialog is closed if component is unmounted while open
onUnmounted(() => {
  if (dialogElement.value?.open) {
    dialogElement.value.close();
  }
});
</script>

<style scoped>
/* DaisyUI's hidden starting style prevents native dialog autofocus before the
   first paint. Keep an open dialog focusable while the box animates in. */
dialog[open] {
  visibility: visible;
}
dialog {
  transition-property: translate, background-color, opacity;
}
</style>
