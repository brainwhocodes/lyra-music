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

const editableAlbum = ref<Partial<Album> & { artistName?: string }>({});
const originalAlbum = ref<Partial<Album> & { artistName?: string }>({}); // To store the initial state
const selectedFile = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const previewUrl = ref<string | null>(null);
const isOpen = ref(props.open);
const isLoading = ref(false);
const userToken = document ? ref(localStorage.getItem('auth_token')) : useCookie('auth_token');

const getArtistNameString = (artists: import('~/types/album').AlbumArtistDetail[] | undefined): string => {
  if (!artists || artists.length === 0) return '';
  const primaryArtists = artists.filter(a => a.isPrimaryArtist);
  const artistsToDisplay = primaryArtists.length > 0 ? primaryArtists : artists;
  return artistsToDisplay.map(a => a.name).join(', ');
};

const initializeState = (album: Album) => {
  const albumCopy = JSON.parse(JSON.stringify(toRaw(album)));
  const artistName = getArtistNameString(albumCopy.artists);

  originalAlbum.value = { ...albumCopy, artistName };
  editableAlbum.value = { ...albumCopy, artistName };

  selectedFile.value = null;
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value);
    previewUrl.value = null;
  }
};

if (props.album) {
  initializeState(props.album);
}

watch(() => props.open, (newValue: boolean) => {
  isOpen.value = newValue;
  if (newValue && props.album) {
    initializeState(props.album);
  }
});

watch(() => props.album, (newAlbum: Album) => {
  if (newAlbum && isOpen.value) {
    initializeState(newAlbum);
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
      URL.revokeObjectURL(previewUrl.value);
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

  // Compare and append only changed fields
  if (editableAlbum.value.title !== originalAlbum.value.title) {
    formData.append('title', editableAlbum.value.title || '');
  }
  if (editableAlbum.value.artistName !== originalAlbum.value.artistName) {
    formData.append('artistName', editableAlbum.value.artistName || '');
  }
  if (editableAlbum.value.year !== originalAlbum.value.year) {
    formData.append('year', editableAlbum.value.year === null || editableAlbum.value.year === undefined ? '' : String(editableAlbum.value.year));
  }

  if (selectedFile.value) {
    formData.append('coverImage', selectedFile.value);
  }

  const formDataKeys = [...formData.keys()];
  if (formDataKeys.length === 0) {
    isLoading.value = false;
    console.log('No changes detected, closing modal.');
    closeModal();
    return;
  }

  try {
    const updatedAlbumData = await $fetch(`/api/albums/${editableAlbum.value.albumId}`, {
      headers: {
        'Authorization': `Bearer ${userToken.value}`,
      },
      method: 'PUT',
      body: formData,
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
