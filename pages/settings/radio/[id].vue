<template>
  <div class="p-4 sm:p-6 lg:p-8">
    <div class="max-w-6xl mx-auto">
      <div class="mb-6">
        <NuxtLink :to="`/radio/${channelId}`" class="btn btn-ghost">
          <Icon name="ph:arrow-left" class="mr-2" /> Back to Station
        </NuxtLink>
      </div>

      <h1 class="text-3xl font-bold tracking-tight text-base-content">Radio Station Settings</h1>
        <p class="mt-2 text-sm text-base-content/70">
          Update your station's name and branding.
        </p>

      <div class="mt-8">
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

        <div v-else-if="station" class="space-y-8 lg:space-y-0 lg:grid lg:grid-cols-3 lg:gap-8">
          <!-- Left Column -->
          <div class="lg:col-span-1">
            <div class="card bg-base-200">
              <div class="card-body">
                <h2 class="card-title">
                  <Icon name="ph:pencil-simple-line-duotone" class="w-6 h-6" />
                  Station Details
                </h2>
                <p class="text-sm text-base-content/70 mt-1">
                  Change the public name of your radio station.
                </p>
                <div class="form-control mt-4">
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
                    <span v-if="isSavingDetails" class="loading loading-spinner"></span>
                    {{ isSavingDetails ? 'Saving...' : 'Save Details' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Right Column -->
          <div class="lg:col-span-2">
            <div class="card bg-base-200">
              <div class="card-body">
                <h2 class="card-title">
                  <Icon name="ph:image-duotone" class="w-6 h-6" />
                  Station Images
                </h2>
                <p class="text-sm text-base-content/70 mt-1">
                  Upload a logo and background image for your station's page.
                </p>
                <div class="mt-4">
                  <RadioImageUpload 
                    :channelId="channelId" 
                    :currentLogoPath="station.logoImagePath" 
                    :currentBackgroundPath="station.backgroundImagePath"
                    @updated="handleImagesUpdated"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="text-center py-8">
          <p class="text-base-content/70">No radio station found with this ID.</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import { ref, computed } from '#imports';

definePageMeta({
  layout: 'sidebar-layout',
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
watch(station, (newStation: RadioChannel) => {
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
      message: 'Station details updated successfully',
      type: 'success'
    });
    
    refresh();
  } catch (error) {
    console.error('Error saving station details:', error);
    toast.add({
      message: 'Failed to update station details',
      type: 'error'
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
    message: 'Station images updated successfully',
    type: 'success'
  });
}
</script>
