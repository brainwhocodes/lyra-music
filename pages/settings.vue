<!-- pages/settings.vue -->
<template>
  <div class="flex h-screen bg-base-200">
    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-base-100 p-4 flex flex-col text-base-content shadow-lg overflow-y-auto">
      <h2 class="text-xl font-bold mb-6 text-primary">Otogami</h2>

      <!-- Recommend Section -->
      <nav class="mb-auto">
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mb-2">Recommend</h3>
        <ul>
          <li><NuxtLink to="/libraries" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:explore-outline-rounded" class="w-5 h-5" /> Discovery</NuxtLink></li>
          <li><NuxtLink to="/albums" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:album-outline" class="w-5 h-5" /> Albums</NuxtLink></li>
          <li><NuxtLink to="/artists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:artist-outline" class="w-5 h-5" /> Artists</NuxtLink></li>
          <li><NuxtLink to="/genres" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:label-outline" class="w-5 h-5" /> Genres</NuxtLink></li>
          <li><NuxtLink to="/tracks" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:music-note-outline" class="w-5 h-5" /> Tracks</NuxtLink></li>
        </ul>

        <!-- Play List Section (Example) -->
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mt-6 mb-2">Play List</h3>
        <ul>
          <li><NuxtLink to="/playlists/recent" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:history" class="w-5 h-5" /> Recently Played</NuxtLink></li>
          <li><NuxtLink to="/playlists/liked" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:thumb-up-outline" class="w-5 h-5" /> Thumbs Up</NuxtLink></li>
        </ul>

        <!-- Tag Section (Example) -->
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mt-6 mb-2">Tag</h3>
        <div class="flex flex-wrap gap-2">
          <span class="badge badge-primary badge-outline cursor-pointer">Blues</span>
          <span class="badge badge-secondary badge-outline cursor-pointer">Country</span>
          <span class="badge badge-accent badge-outline cursor-pointer">Pop</span>
        </div>
      </nav>

      <!-- User/Settings Footer -->
      <div class="mt-auto border-t border-base-300 pt-4">
        <!-- Placeholder -->
        <NuxtLink to="/settings" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1 !bg-base-300 font-semibold"><Icon name="material-symbols:settings-outline-rounded" class="w-5 h-5" /> Settings</NuxtLink>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 p-6 overflow-y-auto">
      <!-- Top Bar Placeholder -->
      <div class="flex justify-between items-center mb-6 sticky top-0 bg-base-200/80 backdrop-blur py-2 z-10">
        <h1 class="text-2xl font-semibold">Settings</h1>
      </div>

      <!-- Feedback Messages -->
      <div v-if="isLoading" class="text-center my-4">
        <span class="loading loading-spinner text-primary"></span> Loading...
      </div>
      <div v-if="errorMessage" role="alert" class="alert alert-error my-4 shadow-md max-w-xl mx-auto">
        <Icon name="material-symbols:error-outline" class="w-6 h-6" />
        <span>Error: {{ errorMessage }}</span>
        <button class="btn btn-sm btn-ghost" @click="errorMessage = null">✕</button>
      </div>
      <div v-if="successMessage" role="alert" class="alert alert-success my-4 shadow-md max-w-xl mx-auto">
        <Icon name="material-symbols:check-circle-outline" class="w-6 h-6" />
        <span>{{ successMessage }}</span>
        <div v-if="scanResults" class="mt-2 text-sm">
          Processed: {{ scanResults.scanned }} files | Added: {{ scanResults.added }} tracks | Errors: {{ scanResults.errors }}
        </div>
        <button class="btn btn-sm btn-ghost" @click="successMessage = null">✕</button>
      </div>

      <div>
        <h2 class="text-xl font-semibold mb-4 border-b pb-2">Application Settings</h2>
        <p class="text-base-content/70">General settings, appearance, etc. will go here.</p>

        <div class="mt-8">
          <div class="flex justify-between items-center mb-4 pb-2 border-b">
            <h2 class="text-xl font-semibold">Media Library Folders</h2>
            <button class="btn btn-sm btn-primary" @click="scanFolders" :disabled="isLoading">
              <Icon name="material-symbols:sync-rounded" class="w-4 h-4 mr-1" /> Scan All Folders
            </button>
          </div>

          <!-- Folder List -->
          <div class="mb-4 overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>Path</th>
                  <th class="w-24">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!isLoading && mediaFolders.length === 0">
                  <td colspan="2" class="text-center italic text-base-content/60">No media folders added yet.</td>
                </tr>
                <tr v-for="folder in mediaFolders" :key="folder.id">
                  <td class="align-middle break-all">{{ folder.path }}</td>
                  <td>
                    <button class="btn btn-xs btn-ghost text-error" @click="removeFolder(folder.id)" :disabled="isLoading">
                      <Icon name="material-symbols:delete-outline-rounded" class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Add Folder Input -->
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="Enter new folder path (e.g., C:\\Music)"
              class="input input-bordered w-full max-w-md"
              v-model="newFolderPath"
              @keyup.enter="addFolder"
              :disabled="isLoading"
            />
            <button class="btn btn-secondary" @click="addFolder" :disabled="!newFolderPath.trim() || isLoading">
              <Icon name="material-symbols:add-circle-outline-rounded" class="w-4 h-4 mr-1" /> Add Folder
            </button>
          </div>
          <p class="text-xs text-base-content/60 mt-1">Enter the full path to the folder you want to add to the library.</p>

        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

import { ref, onMounted } from 'vue';
import type { Ref } from 'vue'; // Import Ref type

// Define types for better structure
interface MediaFolder {
  id: number;
  path: string;
  createdAt: string; // Assuming createdAt is returned as string/timestamp
}

interface ScanResponse {
  success: boolean;
  message: string;
  results?: { // Optional results object
    scanned: number;
    added: number;
    errors: number;
  };
}

// Reactive state for media folders
const mediaFolders: Ref<MediaFolder[]> = ref([]);
const newFolderPath: Ref<string> = ref('');
const isLoading: Ref<boolean> = ref(false); // For loading state
const errorMessage: Ref<string | null> = ref(null); // For displaying errors
const successMessage: Ref<string | null> = ref(null); // For success feedback
const scanResults: Ref<{ scanned: number; added: number; errors: number } | null> = ref(null); // Store detailed scan results

// Fetch initial folders
const fetchFolders = async (): Promise<void> => {
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  scanResults.value = null;
  try {
    const response = await $fetch<{ success: boolean; folders: MediaFolder[] }>('/api/settings/folders');
    if (response.success) {
      mediaFolders.value = response.folders;
    } else {
      // Handle potential API-level 'success: false' scenarios if any
      errorMessage.value = 'Failed to fetch folders.';
    }
  } catch (error: any) {
    console.error('Error fetching folders:', error);
    errorMessage.value = error.data?.message || error.data?.statusMessage || 'An error occurred while fetching folders.';
  } finally {
    isLoading.value = false;
  }
};

// Add folder function
const addFolder = async (): Promise<void> => {
  if (!newFolderPath.value.trim()) return;
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  scanResults.value = null;
  try {
    const response = await $fetch<{ success: boolean; folder: MediaFolder }>('/api/settings/folders', {
      method: 'POST',
      body: { path: newFolderPath.value.trim() },
    });
    if (response.success && response.folder) {
      // Add to local list immediately for responsiveness
      mediaFolders.value.push(response.folder);
      newFolderPath.value = ''; // Clear input
      successMessage.value = `Folder "${response.folder.path}" added successfully.`;
      // Optionally re-fetch to ensure consistency: await fetchFolders();
    } else {
      errorMessage.value = 'Failed to add folder.';
    }
  } catch (error: any) {
    console.error('Error adding folder:', error);
    errorMessage.value = error.data?.message || error.data?.statusMessage || 'An error occurred while adding the folder.';
  } finally {
    isLoading.value = false;
    // Clear success message after a delay
    if(successMessage.value) setTimeout(() => successMessage.value = null, 3000);
  }
};

// Remove folder function
const removeFolder = async (folderId: number): Promise<void> => {
  // Optional: Add a confirmation dialog here
  // if (!confirm('Are you sure you want to remove this folder?')) return;

  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  scanResults.value = null;
  try {
    const response = await $fetch<{ success: boolean; message: string }>(`/api/settings/folders/${folderId}`, {
      method: 'DELETE',
    });
    if (response.success) {
      // Remove from local list
      const index = mediaFolders.value.findIndex(f => f.id === folderId);
      const removedPath = mediaFolders.value[index]?.path; // Get path before removing
      if (index !== -1) {
        mediaFolders.value.splice(index, 1);
      }
      successMessage.value = response.message || `Folder removed successfully.`;
      // Optionally re-fetch: await fetchFolders();
    } else {
      errorMessage.value = 'Failed to remove folder.';
    }
  } catch (error: any) {
    console.error('Error removing folder:', error);
    errorMessage.value = error.data?.message || error.data?.statusMessage || 'An error occurred while removing the folder.';
  } finally {
    isLoading.value = false;
    // Clear success message after a delay
    if(successMessage.value) setTimeout(() => successMessage.value = null, 3000);
  }
};

// Scan folders function
const scanFolders = async (): Promise<void> => {
  isLoading.value = true;
  errorMessage.value = null;
  successMessage.value = null;
  scanResults.value = null; // Clear previous results
  try {
    const response = await $fetch<ScanResponse>('/api/settings/scan', {
      method: 'POST',
    });
    if (response.success) {
      successMessage.value = response.message || 'Scan initiated successfully.';
      // Store the detailed results if available
      if(response.results) {
        scanResults.value = response.results;
      }
    } else {
      errorMessage.value = 'Failed to initiate scan.';
    }
  } catch (error: any) {
    console.error('Error initiating scan:', error);
    errorMessage.value = error.data?.message || error.data?.statusMessage || 'An error occurred while initiating the scan.';
  } finally {
    isLoading.value = false;
    // Clear success message after a delay
    if(successMessage.value) setTimeout(() => successMessage.value = null, 5000); // Longer delay for scan message
  }
};

// Fetch folders when the component is mounted
onMounted(fetchFolders);

</script>

<style scoped>
/* Styles for table and actions if needed */
.table th:last-child, .table td:last-child {
  text-align: right;
}
</style>
