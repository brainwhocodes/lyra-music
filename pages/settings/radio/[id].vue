<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-3xl mx-auto">
      <div class="mb-6">
        <NuxtLink :to="`/radio/${channelId}`" class="btn btn-ghost">
          <Icon name="ph:arrow-left" class="mr-2" /> Back to Station
        </NuxtLink>
      </div>

      <h1 class="text-3xl font-bold tracking-tight text-base-content mb-6">Radio Station Settings</h1>

      <div v-if="pending" class="animate-pulse">
        <div class="h-8 bg-base-300 rounded w-1/3 mb-4"></div>
        <div class="h-32 bg-base-300 rounded mb-4"></div>
        <div class="h-8 bg-base-300 rounded w-1/4 mb-4"></div>
        <div class="h-32 bg-base-300 rounded"></div>
      </div>

      <div v-else-if="error" class="alert alert-error">
        <Icon name="ph:warning" class="w-6 h-6" />
        <span>Failed to load radio station. Please try again later.</span>
      </div>

      <div v-else-if="station" class="space-y-8">
        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Station Details</h2>
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Station Name</span>
              </label>
              <input 
                type="text" 
                v-model="stationName" 
                class="input input-bordered" 
                placeholder="Enter station name"
              />
            </div>

            <div class="flex justify-end mt-4">
              <button 
                @click="saveStationDetails" 
                class="btn btn-primary" 
                :disabled="!stationDetailsChanged || isSavingDetails"
              >
                {{ isSavingDetails ? 'Saving...' : 'Save Details' }}
              </button>
            </div>
          </div>
        </div>

        <div class="card bg-base-200">
          <div class="card-body">
            <h2 class="card-title">Station Images</h2>
            <RadioImageUpload 
              :channelId="channelId" 
              :currentLogoPath="station.logoImagePath" 
              :currentBackgroundPath="station.backgroundImagePath"
              @updated="handleImagesUpdated"
            />
          </div>
        </div>
      </div>

      <div v-else class="text-center py-8">
        <p class="text-base-content/70">No radio station found with this ID.</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import { ref, computed } from 'vue';

definePageMeta({
  layout: 'sidebar-layout',
  middleware: ['auth']
});

const route = useRoute();
const channelId = route.params.id as string;
const toast = useToast();

const { data: station, pending, error, refresh } = await useFetch<RadioChannel>(`/api/radio-stations/${channelId}`, {
  lazy: true,
});

const stationName = ref<string>('');
const isSavingDetails = ref<boolean>(false);
const stationDetailsChanged = computed((): boolean => {
  return station.value && stationName.value !== station.value.name;
});

// Initialize form values when data is loaded
watch(station, (newStation) => {
  if (newStation) {
    stationName.value = newStation.name;
  }
}, { immediate: true });

async function saveStationDetails(): Promise<void> {
  if (!stationDetailsChanged.value) return;
  
  isSavingDetails.value = true;
  
  try {
    await $fetch(`/api/radio-stations/${channelId}`, {
      method: 'PUT',
      body: {
        name: stationName.value
      }
    });
    
    toast.add({
      title: 'Success',
      description: 'Station details updated successfully',
      color: 'success'
    });
    
    refresh();
  } catch (error) {
    console.error('Error saving station details:', error);
    toast.add({
      title: 'Error',
      description: 'Failed to update station details',
      color: 'error'
    });
  } finally {
    isSavingDetails.value = false;
  }
}

function handleImagesUpdated(data: { logoImagePath?: string | null, backgroundImagePath?: string | null }): void {
  if (station.value) {
    if (data.logoImagePath !== undefined) {
      station.value.logoImagePath = data.logoImagePath;
    }
    if (data.backgroundImagePath !== undefined) {
      station.value.backgroundImagePath = data.backgroundImagePath;
    }
  }
  
  toast.add({
    title: 'Success',
    description: 'Station images updated successfully',
    color: 'success'
  });
}
</script>
