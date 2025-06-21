<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
        <h1 class="text-2xl font-bold leading-6 text-base-content">Radio Stations</h1>
        <p class="mt-2 text-sm text-base-content/80">
          Manage your custom radio stations based on seed artists and genres.
        </p>
      </div>
      <div class="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
        <button @click="openAddModal" type="button" class="btn btn-primary">
          Add Radio Station
        </button>
      </div>
    </div>

    <!-- Stations List -->
    <div class="mt-8 flow-root">
      <div class="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div v-if="stations.length > 0" class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
            <table class="min-w-full divide-y divide-base-300">
              <thead class="bg-base-200">
                <tr>
                  <th scope="col" class="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-base-content sm:pl-6">Name</th>
                  <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-base-content">Seeds</th>
                  <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span class="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-base-200 bg-base-100">
                <tr v-for="station in stations" :key="station.channelId">
                  <td class="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-base-content sm:pl-6">
                    {{ station.name }}
                  </td>
                  <td class="px-3 py-4 text-sm text-base-content/80">
                    <div class="flex flex-wrap gap-1">
                      <div v-for="seed in station.radioChannelArtists" :key="seed.artist.artistId" class="badge badge-primary">
                        {{ seed.artist.name }}
                      </div>
                      <div v-for="seed in station.radioChannelGenres" :key="seed.genre.genreId" class="badge badge-secondary">
                        {{ seed.genre.name }}
                      </div>
                    </div>
                  </td>
                  <td class="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button @click="openEditModal(station)" class="btn btn-ghost btn-sm">Edit</button>
                    <button @click="openDeleteModal(station)" class="btn btn-ghost btn-sm text-error">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="text-center py-12">
            <p class="text-base-content/70">No radio stations found. Add one to get started.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <EditRadioStationModal 
      :open="isEditModalOpen"
      :station="selectedStation"
      @close="closeEditModal"
      @station-updated="refreshStations"
    />
    
    <!-- Delete Confirmation Modal -->
    <ConfirmDeleteModal
      :open="isDeleteModalOpen"
      title="Delete Radio Station"
      message="Are you sure you want to delete this radio station? This action cannot be undone."
      @close="closeDeleteModal"
      @confirm="deleteStation"
    />
  </div>
</template>

<script setup lang="ts">
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import type { Artist } from '~/server/db/schema/artists';
import type { Genre } from '~/server/db/schema/genres';
import EditRadioStationModal from '~/components/modals/edit-radio-station-modal.vue';
import ConfirmDeleteModal from '~/components/modals/confirm-delete-modal.vue';

// Define the detailed type for a station, matching the API response
interface Station extends RadioChannel {
  radioChannelArtists: { artist: Artist }[];
  radioChannelGenres: { genre: Genre }[];
}

definePageMeta({
  layout: 'sidebar-layout',
});

const stations = ref<Station[]>([]);
const isEditModalOpen = ref(false);
const isDeleteModalOpen = ref(false);
const selectedStation = ref<Station | null>(null);

async function fetchStations() {
  try {
    stations.value = await $fetch<Station[]>('/api/radio-stations');
  } catch (error) {
    console.error('Failed to fetch radio stations:', error);
    // TODO: Add user-facing error notification
  }
}

function openAddModal() {
  selectedStation.value = null;
  isEditModalOpen.value = true;
}

function openEditModal(station: Station) {
  selectedStation.value = station;
  isEditModalOpen.value = true;
}

function closeEditModal() {
  isEditModalOpen.value = false;
  selectedStation.value = null;
}

function openDeleteModal(station: Station) {
  selectedStation.value = station;
  isDeleteModalOpen.value = true;
}

function closeDeleteModal() {
  isDeleteModalOpen.value = false;
  selectedStation.value = null;
}

async function deleteStation() {
  if (!selectedStation.value?.channelId) return;

  try {
    await $fetch(`/api/radio-stations/${selectedStation.value.channelId}`, {
      method: 'DELETE',
    });
    await refreshStations();
  } catch (error) {
    console.error('Failed to delete station:', error);
    // TODO: Add user-facing error notification
  } finally {
    closeDeleteModal();
  }
}

async function refreshStations() {
  await fetchStations();
}

onMounted(() => {
  fetchStations();
});

useHead({
  title: 'Radio Stations - Settings',
});
</script>
