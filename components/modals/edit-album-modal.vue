<template>
    <dialog :class="['modal', modalOpen ? 'modal-open' : '']">
        <div class="modal-box">
            <h3 class="font-bold text-lg mb-4">Edit Album</h3>
            <form @submit.prevent="updateAlbum">
                <div class="grid grid-cols-3 gap-4 mb-4">
                    <div class="album-cover border border-base-300 p-4 relative">
                        <Icon name="heroicons-solid:pencil" class="w-8 h-8 text-base-content absolute top-2 right-2" />
                        <img :src="album.coverPath" width="128" height="128" alt="Album Cover" />
                    </div>
                </div>
                <div>
                    <label for="title" class="label">
                        <span class="label-text">Title</span>
                    </label>
                    <input v-model="album.title" type="text" class="input input-bordered w-full mb-4" required />
                </div>
                <div>
                    <label for="artist" class="label">
                        <span class="label-text">Artist(s)</span>
                    </label>
                    <input v-model="album.artistName" type="text" class="input input-bordered w-full mb-4" required />
                </div>
                <div>
                    <label for="year" class="label">
                        <span class="label-text">Year</span>
                    </label>
                    <input v-model="album.year" type="number" class="input input-bordered w-full mb-4" />
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

const album = ref(props.album || {
    albumId: '',
    title: '',
    year: 0,
    coverPath: ''
} as Album);

const modalOpen = ref(props.open);

const emit = defineEmits(['close', 'update']);

const closeModal = () => {
    emit('close');
    modalOpen.value = false;
};

const updateAlbum = async () => {
    emit('update', props.album);
    closeModal();
};
</script>

<style scoped>
.album-cover {
    width: 128px;
    height: 128px;
    &:hover {
        cursor: pointer;
        border-color: var(--b1);
        border-width: 2px;
    }
}
</style>
