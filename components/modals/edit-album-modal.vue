<template>
    <dialog :class="['modal', isOpen ? 'modal-open' : '']">
        <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Edit Album</h3>
            <form @submit.prevent="updateAlbum">
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div class="album-cover border border-base-300 p-4 relative cursor-pointer" @click="triggerFileInput">
                        <Icon name="heroicons-solid:pencil" class="w-8 h-8 text-base-content absolute top-2 right-2 z-10" />
                        <img :src="previewUrl || editableAlbum.coverPath || '/images/icons/default-album-art.webp'" width="128" height="128" alt="Album Cover" class="object-cover w-full h-full" />
                        <input type="file" ref="fileInputRef" @change="handleFileChange" accept="image/*" class="hidden" />
                    </div>
                </div>
                <div>
                    <label for="title" class="label">
                        <span class="label-text">Title</span>
                    </label>
                    <input v-model="editableAlbum.title" type="text" class="input input-bordered w-full mb-4" required />
                </div>
                <div>
                    <label for="artist" class="label">
                        <span class="label-text">Artist(s)</span>
                    </label>
                    <input v-model="editableAlbum.artistName" type="text" class="input input-bordered w-full mb-4" required />
                </div>
                <div>
                    <label for="year" class="label">
                        <span class="label-text">Year</span>
                    </label>
                    <input v-model.number="editableAlbum.year" type="number" class="input input-bordered w-full mb-4" />
                </div>
                <div class="modal-action">
                    <button type="button" class="btn" @click="closeModal">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save</button>
                </div>
            </form>
        </div>
    </dialog>
</template>

<script setup lang="ts">
import type { Album } from '~/types/album';

const props = defineProps<{ album: Album, open: boolean }>();

const emit = defineEmits(['close', 'albumUpdated', 'updateError']);

// Initialize with empty object but will be populated when modal opens
const editableAlbum = ref<Partial<Album>>({});
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const isOpen = ref(props.open);
const isLoading = ref(false);
const userToken = document ? ref(localStorage.getItem('auth_token')) : useCookie('auth_token');

// Initialize editableAlbum with album prop data immediately if available
if (props.album) {
  editableAlbum.value = JSON.parse(JSON.stringify(toRaw(props.album)));
}

watch(() => props.open, (newValue: boolean) => {
  isOpen.value = newValue;
  if (newValue && props.album) {
    // Create a deep copy for editing to avoid mutating the prop directly
    editableAlbum.value = JSON.parse(JSON.stringify(toRaw(props.album)));
    selectedFile.value = null;
    previewUrl.value = null; // Reset preview on open if it's from a previous selection
  } else if (!newValue) {
    // Reset when modal closes
    selectedFile.value = null;
    previewUrl.value = null;
  }
});

watch(() => props.album, (newAlbum: Album) => {
  if (newAlbum && isOpen.value) {
    editableAlbum.value = JSON.parse(JSON.stringify(toRaw(newAlbum)));
    previewUrl.value = null; // Reset preview if album prop changes while open
  }
}, { deep: true });

const triggerFileInput = () => {
  fileInputRef.value?.click();
};

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    selectedFile.value = target.files[0];
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value); // Clean up previous object URL
    }
    previewUrl.value = URL.createObjectURL(selectedFile.value);
  } else {
    selectedFile.value = null;
    previewUrl.value = null;
  }
};

const closeModal = () => {
  isOpen.value = false;
  emit('close');
  // Reset state if needed, though watch on props.open handles some of this
  selectedFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
};

const updateAlbum = async () => {
  if (!editableAlbum.value.albumId) {
    console.error('Album ID is missing');
    emit('updateError', 'Album ID is missing');
    return;
  }

  isLoading.value = true;
  const formData = new FormData();
  
  // Append text fields from editableAlbum
  formData.append('title', editableAlbum.value.title || '');
  // Ensure artistName is present in your Album type or editableAlbum structure
  formData.append('artistName', (editableAlbum.value as any).artistName || ''); 
  if (editableAlbum.value.year !== null && editableAlbum.value.year !== undefined) {
    formData.append('year', String(editableAlbum.value.year));
  }

  if (selectedFile.value) {
    formData.append('coverImage', selectedFile.value);
  }

  try {
    const updatedAlbumData = await $fetch(`/api/albums/${editableAlbum.value.albumId}`,  {
      headers: {
        'Authorization': `Bearer ${userToken.value}`
      },
      method: 'PUT',
      body: formData,
      // Nuxt's $fetch handles FormData content type automatically
    });
    emit('albumUpdated', updatedAlbumData);
    closeModal();
  } catch (error: any) {
    console.error('Failed to update album:', error);
    emit('updateError', error.data?.message || 'Failed to update album.');
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.album-cover {
    width: 128px;
    height: 128px;
    &:hover {
        cursor: pointer;
        border-color: oklch(var(--p)); /* Use primary color for hover border */
        border-width: 2px;
    }
}
</style>
