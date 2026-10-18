import { onScopeDispose, ref, watch, type Ref } from 'vue';

type Selection = { channelId: string };

/** A completed mutation must not dismiss a confirmation opened after it. */
export function useRadioStationDeletion(
  selected: Ref<Selection | null>,
  open: Ref<boolean>,
  remove: (channelId: string) => Promise<unknown>,
  refresh: () => Promise<unknown>,
) {
  const deleting = ref(false);
  const deleteError = ref('');
  const status = ref('');
  let generation = 0;
  let disposed = false;

  watch([open, () => selected.value?.channelId], () => {
    generation++;
    deleting.value = false;
    deleteError.value = '';
  }, { flush: 'sync' });

  onScopeDispose(() => { disposed = true; generation++; });

  async function deleteStation() {
    if (disposed || !open.value || !selected.value || deleting.value) return;
    const channelId = selected.value.channelId;
    const current = generation;
    deleting.value = true;
    deleteError.value = '';
    status.value = '';
    try {
      // Closing a confirmation cannot undo a mutation accepted by the server.
      // Refresh the list, but only the original dialog can receive its result.
      await remove(channelId);
      if (disposed) return;
      await refresh();
      if (current !== generation) return;
      open.value = false;
      status.value = 'Station deleted.';
    } catch {
      if (current === generation) {
        deleteError.value = 'Could not delete the station. Please try again.';
      }
    } finally {
      if (current === generation) deleting.value = false;
    }
  }

  return { deleting, deleteError, status, deleteStation };
}
