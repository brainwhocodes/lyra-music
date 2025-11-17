import { defineStore } from 'pinia';

/**
 * Store for managing modal states across the application
 */
export const useModalStore = defineStore('modal', () => {
  // State
  const isLyricsModalOpen = ref(false);
  const isSettingsModalOpen = ref(false);
  const isUploadModalOpen = ref(false);

  // Actions
  function openLyricsModal() {
    isLyricsModalOpen.value = true;
  }

  function closeLyricsModal() {
    isLyricsModalOpen.value = false;
  }

  function openSettingsModal() {
    isSettingsModalOpen.value = true;
  }

  function closeSettingsModal() {
    isSettingsModalOpen.value = false;
  }

  function openUploadModal() {
    isUploadModalOpen.value = true;
  }

  function closeUploadModal() {
    isUploadModalOpen.value = false;
  }

  // Close all modals (useful when navigating away)
  function closeAllModals() {
    isLyricsModalOpen.value = false;
    isSettingsModalOpen.value = false;
    isUploadModalOpen.value = false;
  }

  return {
    // State
    isLyricsModalOpen,
    isSettingsModalOpen,
    isUploadModalOpen,
    
    // Actions
    openLyricsModal,
    closeLyricsModal,
    openSettingsModal,
    closeSettingsModal,
    openUploadModal,
    closeUploadModal,
    closeAllModals,
  };
});
