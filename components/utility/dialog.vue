<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="utility-dialog"
      :aria-labelledby="headingId"
      @close="onClose"
      @click="onBackdrop"
    >
      <div class="utility-dialog-body">
        <h2 :id="headingId">{{ title }}</h2>
        <slot />
      </div>
    </dialog>
  </Teleport>
</template>
<script setup lang="ts">
const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ "update:open": [value: boolean] }>();
const headingId = useId();
const dialog = ref<HTMLDialogElement | null>(null);
function syncOpen() {
  if (props.open && !dialog.value?.open) {
    dialog.value?.showModal();
    requestAnimationFrame(() => {
      const currentDialog = dialog.value;
      if (
        props.open && currentDialog?.open &&
        (document.activeElement === currentDialog || !currentDialog.contains(document.activeElement))
      ) {
        const initialFocus =
          currentDialog.querySelector<HTMLElement>("[autofocus]") ??
          currentDialog.querySelector<HTMLElement>(
            "input:not(:disabled), button:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
          );
        initialFocus?.focus({ preventScroll: true });
      }
    });
  } else if (!props.open) dialog.value?.close();
}
watch(() => props.open, syncOpen, { flush: "post" });
onMounted(syncOpen);
function onClose() {
  if (!dialog.value?.open) emit("update:open", false);
}
function onBackdrop(event: MouseEvent) {
  if (event.target !== dialog.value) return;
  const box = dialog.value.getBoundingClientRect();
  if (
    event.clientX < box.left ||
    event.clientX > box.right ||
    event.clientY < box.top ||
    event.clientY > box.bottom
  )
    emit("update:open", false);
}
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.utility-dialog {
  inset: 0;
  margin: auto;
  width: min(42rem, calc(100vw - 2rem));
  max-height: 85dvh;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: 4px;
  background: var(--paper);
  color: var(--ink);
  overflow: auto;
}
.utility-dialog::backdrop {
  background: #26252275;
}
.utility-dialog-body {
  padding: clamp(1rem, 4vw, 2rem);
}
.utility-dialog-body > h2 {
  margin: 0 0 1.5rem;
  font-size: 2rem;
}
.utility-dialog :deep(.modal-action) {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
</style>
