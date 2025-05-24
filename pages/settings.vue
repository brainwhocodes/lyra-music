<!-- pages/settings.vue -->
<template>
  <div class="flex h-screen bg-base-200">

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
                <tr v-for="folder in mediaFolders" :key="folder.mediaFolderId">
                  <td class="align-middle break-all">{{ folder.path }} <span v-if="folder.label" class="text-xs text-base-content/60">({{ folder.label }})</span></td>
                  <td>
                    <button class="btn btn-xs btn-ghost text-error" @click="removeFolder(folder.mediaFolderId)" :disabled="isLoading">
                      <Icon name="material-symbols:delete-outline-rounded" class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Add Folder Input -->
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <input
                type="text"
                placeholder="Enter new folder path (e.g., C:\\Music)"
                class="input input-bordered w-full pr-10"
                v-model="newFolderPath"
                @keyup.enter="addFolder"
                :disabled="isLoading"
                id="folder-path-input"
              />
              <button 
                class="btn btn-square btn-sm absolute right-2 top-1/2 -translate-y-1/2" 
                @click="browseFolders"
                :disabled="isLoading"
                title="Browse for folder"
              >
                <Icon name="material-symbols:folder-open-outline-rounded" class="w-4 h-4" />
              </button>
            </div>
            <button class="btn btn-secondary whitespace-nowrap" @click="addFolder" :disabled="!newFolderPath.trim() || isLoading">
              <Icon name="material-symbols:add-circle-outline-rounded" class="w-4 h-4 mr-1" /> Add Folder
            </button>
          </div>
          <p class="text-xs text-base-content/60 mt-1">Enter the full path to the folder you want to add to the library or click the folder icon to browse.</p>
          
          <!-- Hidden file input for folder selection -->
          <input
            type="file"
            ref="folderInput"
            accept="audio/*"
            class="hidden"
            @change="handleFolderSelect"
          />

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

// Define types for better structure
interface MediaFolder {
  mediaFolderId: string;
  path: string;
  label?: string | null;
  createdAt: string; // Assuming createdAt is returned as string/timestamp
}

interface ScanResponse {
  success: boolean;
  message: string;
  scanned: number;
  errors: number;
  added?: number; // Optional for backward compatibility
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
    // $fetch will throw an error for non-2xx responses.
    // If it doesn't throw, the request was successful and 'newlyAddedFolder' will be the response body.
    const newlyAddedFolder = await $fetch<MediaFolder>('/api/settings/folders', {
      method: 'POST',
      body: { path: newFolderPath.value.trim() }, // Assuming 'label' is optional or handled by API default
    });

    // Check if newlyAddedFolder has mediaFolderId to confirm it's a valid folder object
    if (newlyAddedFolder && newlyAddedFolder.mediaFolderId) { 
      mediaFolders.value.push(newlyAddedFolder);
      newFolderPath.value = ''; // Clear input
      successMessage.value = `Folder "${newlyAddedFolder.path}" added successfully.`;
    } else {
      // This case should ideally not be hit if the API returns a valid folder or throws an error.
      // But as a fallback:
      errorMessage.value = 'Failed to add folder: Invalid response from server.';
    }
  } catch (error: any) {
    console.error('Error adding folder:', error);
    if (error.data?.statusMessage) {
      errorMessage.value = `Failed to add media folder: ${error.data.statusMessage}`;
    } else if (error.data?.message) {
      errorMessage.value = `Failed to add media folder: ${error.data.message}`;
    } else if (error.message) {
      errorMessage.value = `Failed to add media folder: ${error.message}`;
    } else {
      errorMessage.value = 'Failed to add media folder: Unknown error occurred';
    }
  } finally {
    isLoading.value = false;
    if(successMessage.value) setTimeout(() => successMessage.value = null, 3000);
  }
};

// Remove folder function
const removeFolder = async (folderId: string): Promise<void> => {
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
      const index = mediaFolders.value.findIndex((f: MediaFolder) => f.mediaFolderId === folderId);
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
      method: 'POST'
    });
    
    if (response.success) {
      successMessage.value = response.message || 'Scan initiated successfully.';
      // Update the scan results with the response data
      scanResults.value = {
        scanned: response.scanned,
        added: response.added || 0, // May be undefined
        errors: response.errors
      };
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

// Reference to the hidden file input element
const folderInput = ref<HTMLInputElement | null>(null);

// Browse folders function - triggers the hidden file input
const browseFolders = (): void => {
  // Trigger the hidden file input click event
  if (folderInput.value) {
    folderInput.value.click();
  }
};

// Handle folder selection
const handleFolderSelect = (event: Event): void => {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    // Get the first file
    const file = input.files[0];
    
    // Extract the directory path by removing the filename from the path
    // Note: Due to browser security, this will be a relative path or partial path
    // The user may need to manually edit it to get the full path
    let path = file.webkitRelativePath || file.name;
    
    // If we have a relative path with directories, extract the directory part
    if (path.includes('/')) {
      // Remove the filename, keep only the directory path
      path = path.substring(0, path.lastIndexOf('/'));
    }
    
    // If we have a Windows-style path
    if (path.includes('\\')) {
      path = path.substring(0, path.lastIndexOf('\\'));
    }
    
    // Set the path in the input field
    // The user may need to edit this to get the full correct path
    newFolderPath.value = path;
    
    // Reset the input to allow selecting the same folder again
    input.value = '';
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
