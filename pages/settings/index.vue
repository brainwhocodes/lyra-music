<!-- pages/settings.vue -->
<template>
  <div class="flex h-screen bg-base-200">

    <!-- Custom File Browser Modal -->
    <dialog id="fileBrowserModal" class="modal modal-bottom sm:modal-middle" :class="{'modal-open': showFileBrowserModal}">
      <div class="modal-box w-11/12 max-w-2xl">
        <h3 class="font-bold text-lg mb-2">Browse for Folder</h3>
        <p class="text-sm text-base-content/70 mb-1">Current Path: <span class="font-mono bg-base-300 px-1 rounded">{{ browserCurrentPath || 'Loading...' }}</span></p>
        
        <div v-if="browserIsLoading" class="text-center my-4">
          <span class="loading loading-spinner text-primary"></span> Loading entries...
        </div>
        <div v-if="browserError" role="alert" class="alert alert-error my-2 py-2 px-3 text-sm">
          <Icon name="material-symbols:error-outline" class="w-5 h-5" />
          <span>{{ browserError }}</span>
        </div>

        <div class="max-h-96 overflow-y-auto bg-base-100 border border-base-300 rounded-md p-2 min-h-48">
          <ul class="menu p-0">
            <li v-if="browserParentPath !== null">
              <a @click.prevent="navigateBrowserUp()" class="flex items-center">
                <Icon name="material-symbols:arrow-upward-rounded" class="w-5 h-5 mr-2" />
                ..
              </a>
            </li>
            <li v-for="entry in browserEntries" :key="entry.fullPath">
              <a @click.prevent="entry.isDirectory ? navigateBrowser(entry.fullPath) : null" 
                 :class="{'cursor-pointer hover:bg-base-200': entry.isDirectory, 'opacity-50 cursor-not-allowed': !entry.isDirectory}"
                 class="flex items-center">
                <Icon :name="entry.isDirectory ? 'material-symbols:folder-outline-rounded' : 'material-symbols:draft-outline'" class="w-5 h-5 mr-2" />
                {{ entry.name }}
              </a>
            </li>
            <li v-if="!browserIsLoading && browserEntries.length === 0 && browserParentPath === null && !browserError">
              <span class="italic text-base-content/60">No drives or locations found.</span>
            </li>
             <li v-else-if="!browserIsLoading && browserEntries.length === 0 && browserParentPath !== null && !browserError">
              <span class="italic text-base-content/60">Folder is empty.</span>
            </li>
          </ul>
        </div>

        <div class="modal-action mt-4">
          <button class="btn btn-primary" @click="selectFolderFromBrowser" :disabled="browserIsLoading || !browserCurrentPath || browserCurrentPath === 'Computer' || !!browserError">
            <Icon name="material-symbols:check-circle-outline-rounded" class="w-4 h-4 mr-1" /> Select this folder
          </button>
          <button class="btn btn-ghost" @click="closeFileBrowser">Cancel</button>
        </div>
      </div>
      <!-- Click outside to close -->
      <form method="dialog" class="modal-backdrop">
        <button @click="closeFileBrowser">close</button>
      </form>
    </dialog>


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
          Processed: {{ scanResults.scanned }} folders | Added: {{ scanResults.addedTracks }} tracks, {{ scanResults.addedArtists }} artists, {{ scanResults.addedAlbums }} albums | Errors: {{ scanResults.errors }}
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
                class="btn btn-square btn-sm absolute right-2 " 
                @click="openFileBrowser"
                :disabled="isLoading"
                title="Browse for folder using custom browser"
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

// Custom File Browser State
const showFileBrowserModal: Ref<boolean> = ref(false);
const browserCurrentPath: Ref<string> = ref('');
const browserParentPath: Ref<string | null> = ref(null);
interface BrowserEntry {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}
const browserEntries: Ref<BrowserEntry[]> = ref([]);
const browserIsLoading: Ref<boolean> = ref(false);
const browserError: Ref<string | null> = ref(null);
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

const selectDirectory = async (): Promise<void> => {
  try {
    if (typeof window === 'undefined' || !('showDirectoryPicker' in window)) {
      errorMessage.value = 'Your browser does not support the File System Access API for folder selection. Please type the path manually.';
      // If you wish to fall back to the old method, you could call it here:
      // console.log("Falling back to old folder browse method.");
      // browseFolders(); // Make sure browseFolders() is still defined and works.
      return;
    }

    const dirHandle: FileSystemDirectoryHandle = await window.showDirectoryPicker();
    // The File System Access API returns a FileSystemDirectoryHandle.
    // For security reasons, the full file path is not directly exposed.
    // We can get the name of the selected directory using dirHandle.name.
    // Example: if user selects "C:\Users\Name\Documents\Music", dirHandle.name will be "Music".
    // This name is then assigned to newFolderPath.value.
    // If your backend '/api/settings/folders' (called by addFolder)
    // expects a full absolute path, sending just the directory name will likely not work as intended.
    // You may need to adjust backend expectations or inform the user about this limitation.
    newFolderPath.value = dirHandle.name;

    // Clear previous error messages related to folder picking if any
    if (errorMessage.value && (errorMessage.value.includes('folder selection') || errorMessage.value.includes('selecting folder'))) {
        errorMessage.value = null;
    }
    successMessage.value = `Selected folder name: "${dirHandle.name}". Review and click 'Add Folder'.`;
    // Clear success message after a few seconds
    setTimeout(() => { if (successMessage.value && successMessage.value.includes(dirHandle.name)) successMessage.value = null; }, 5000);

  } catch (error: any) {
    if (error.name === 'AbortError') {
      // User cancelled the directory picker. This is not an error condition requiring a user-facing message.
      console.info('Folder picker dialog was dismissed by the user.');
    } else {
      // Other errors (e.g., security restrictions, API not supported).
      console.error('Error using showDirectoryPicker:', error);
      errorMessage.value = `Error selecting folder: ${error.message}. This feature may require a secure context (HTTPS or localhost) and explicit user permission.`;
    }
  }
};

// File Browser Logic
const fetchBrowserEntries = async (pathToBrowse?: string | null): Promise<void> => {
  browserIsLoading.value = true;
  browserError.value = null;
  try {
    const params = pathToBrowse ? { path: pathToBrowse } : {};
    const response = await $fetch<{ currentPath: string; parentPath: string | null; entries: BrowserEntry[]; error?: string }>('/api/filesystem/browse', { params });
    if (response.error) {
      browserError.value = response.error;
      // Keep current path and entries if there's an error, but show parent from response if available
      browserCurrentPath.value = response.currentPath || (pathToBrowse ?? '');
      browserParentPath.value = response.parentPath;
      browserEntries.value = response.entries || []; // Show empty entries on error or what was returned
    } else {
      browserCurrentPath.value = response.currentPath;
      browserParentPath.value = response.parentPath;
      browserEntries.value = response.entries;
    }
  } catch (error: any) {
    console.error('Error fetching browser entries:', error);
    browserError.value = error.data?.message || error.message || 'An unexpected error occurred while browsing files.';
    // Attempt to set path context even on error
    browserCurrentPath.value = pathToBrowse || '';
    // Simplified parent path derivation for error fallback, avoiding 'path.sep'
    if (pathToBrowse) {
      const lastSlash = Math.max(pathToBrowse.lastIndexOf('/'), pathToBrowse.lastIndexOf('\\'));
      if (lastSlash > 0) {
        browserParentPath.value = pathToBrowse.substring(0, lastSlash);
      } else if (lastSlash === 0 && pathToBrowse.length > 1) { // Root like /foo or C:\foo
        browserParentPath.value = pathToBrowse.substring(0, 1);
      } else {
        browserParentPath.value = null; // Could be a drive letter like 'C:' or a root directory name
      }
    } else {
      browserParentPath.value = null;
    }
    browserEntries.value = [];
  } finally {
    browserIsLoading.value = false;
  }
};

const openFileBrowser = (): void => {
  showFileBrowserModal.value = true;
  browserError.value = null; // Clear previous errors
  // Fetch initial directory (e.g., 'Computer' on Windows, or user's home dir)
  fetchBrowserEntries(); 
};

const closeFileBrowser = (): void => {
  showFileBrowserModal.value = false;
  // Optionally reset browser state if desired
  // browserCurrentPath.value = '';
  // browserParentPath.value = null;
  // browserEntries.value = [];
  // browserError.value = null;
};

const navigateBrowser = (entryPath: string): void => {
  fetchBrowserEntries(entryPath);
};

const navigateBrowserUp = (): void => {
  if (browserParentPath.value !== null) {
    fetchBrowserEntries(browserParentPath.value);
  }
};

const selectFolderFromBrowser = (): void => {
  if (browserCurrentPath.value && browserCurrentPath.value !== 'Computer' && !browserError.value) {
    newFolderPath.value = browserCurrentPath.value;
    closeFileBrowser();
  } else if (browserCurrentPath.value === 'Computer') {
    browserError.value = "Cannot select 'Computer'. Please navigate into a drive or folder.";
  } else if (browserError.value) {
    // If there's an error, don't select, user should resolve error or cancel
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
