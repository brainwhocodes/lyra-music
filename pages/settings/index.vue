<template>
  <div class="utility-page">
    <header>
      <h1 class="page-heading">Settings.</h1>
      <p class="page-intro utility-subtitle">Make Lyra feel at home.</p>
    </header>
    <section class="utility-section">
      <h2>Media library folders</h2>
      <p>
        Add the folders where your music is stored, then scan them to update
        your library.
      </p>
      <form class="utility-form-line" @submit.prevent="addFolder">
        <label for="folder-path-input"
          >Folder path<input
            id="folder-path-input"
            v-model="newFolderPath"
            class="input"
            placeholder="C:\Music"
            required
            :disabled="busy" /></label
        ><button
          type="button"
          class="btn btn-outline"
          :disabled="busy"
          @click="openBrowser"
        >
          Browse</button
        ><button
          class="btn btn-primary"
          :disabled="busy || !newFolderPath.trim()"
        >
          Add Folder
        </button>
      </form>
      <UiLoadingSkeleton
        v-if="pending"
        label="Loading folders…"
        variant="text"
        :count="3"
        class="mt-4"
      />
      <div v-else-if="loadError" role="alert" class="utility-status">
        Could not load folders.
        <button class="btn btn-outline" @click="refresh()">Try again</button>
      </div>
      <div v-else class="utility-folder-list">
        <article v-for="folder in folders" :key="folder.mediaFolderId">
          <p>{{ folder.path }}</p>
          <button
            class="btn btn-outline"
            :aria-label="`Remove folder ${folder.path}`"
            :disabled="busy"
            @click="askRemove(folder)"
          >
            Remove
          </button>
        </article>
        <p v-if="!folders.length">No media folders added yet.</p>
      </div>
      <button
        class="btn btn-primary"
        :disabled="busy || !folders.length"
        @click="scanFolders"
      >
        {{ scanning ? "Queueing scans…" : "Scan All Folders" }}
      </button>
      <p v-if="errorMessage" role="alert" class="utility-status text-error">
        {{ errorMessage }}
      </p>
      <p v-if="statusMessage" role="status" class="utility-status">
        {{ statusMessage }}
      </p>
    </section>
    <section class="utility-section">
      <h2>Local intelligence</h2>
      <p>
        Explore can search the meaning of your library’s titles, metadata and
        saved lyrics. Open Explore to check the local model and index your
        music.
      </p>
      <NuxtLink to="/explore" class="btn btn-outline">Open Explore →</NuxtLink>
    </section>
    <section class="utility-section">
      <h2>Your radio stations</h2>
      <p>Choose artist and genre seeds, or update station names and artwork.</p>
      <NuxtLink to="/settings/radio" class="btn btn-outline"
        >Manage radio stations →</NuxtLink
      >
    </section>
    <UtilityDialog v-model:open="browserOpen" title="Browse for Folder">
      <p class="browser-path">Current path: {{ browserPath || "Loading…" }}</p>
      <p v-if="browserLoading" role="status" class="mt-4">Loading folders…</p>
      <p v-if="browserError" role="alert" class="text-error mt-4">
        {{ browserError }}
      </p>
      <div class="folder-browser">
        <button
          v-if="parentPath !== null"
          class="btn btn-outline"
          :disabled="browserLoading"
          @click="browse(parentPath)"
        >
          Up one folder</button
        ><button
          v-for="entry in entries.filter((e) => e.isDirectory)"
          :key="entry.fullPath"
          class="folder-entry"
          :disabled="browserLoading"
          @click="browse(entry.fullPath)"
        >
          {{ entry.name }}
        </button>
        <p
          v-if="
            !browserLoading &&
            !entries.some((e) => e.isDirectory) &&
            !browserError
          "
        >
          No subfolders here.
        </p>
      </div>
      <div class="modal-action">
        <button class="btn" autofocus @click="browserOpen = false">
          Cancel</button
        ><button
          class="btn btn-primary"
          :disabled="
            browserLoading ||
            !browserPath ||
            browserPath === 'Computer' ||
            !!browserError
          "
          @click="selectFolder"
        >
          Select this folder
        </button>
      </div>
    </UtilityDialog>
    <UtilityDialog v-model:open="removeOpen" title="Remove media folder"
      ><p>Remove “{{ removing?.path }}” from the folder list?</p>
      <p v-if="removeError" role="alert" class="text-error mt-4">
        {{ removeError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="removeOpen = false">Cancel</button
        ><button class="btn btn-error" :disabled="busy" @click="removeFolder">
          Remove folder
        </button>
      </div></UtilityDialog
    >
  </div>
</template>
<script setup lang="ts">
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Settings") });
interface MediaFolder {
  mediaFolderId: string;
  path: string;
}
interface BrowserEntry {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}
const {
  data: folderResponse,
  pending,
  error: loadError,
  refresh,
} = useLazyFetch<{ success: boolean; folders: MediaFolder[] }>(
  "/api/settings/folders",
);
const folders = computed(() => folderResponse.value?.folders || []);
const newFolderPath = ref(""),
  busy = ref(false),
  scanning = ref(false),
  errorMessage = ref(""),
  statusMessage = ref("");
const browserOpen = ref(false),
  browserLoading = ref(false),
  browserError = ref(""),
  browserPath = ref(""),
  parentPath = ref<string | null>(null),
  entries = ref<BrowserEntry[]>([]);
const removeOpen = ref(false),
  removeError = ref(""),
  removing = ref<MediaFolder | null>(null);
const failure = (err: any, fallback: string) =>
  err?.data?.statusMessage || err?.data?.message || fallback;
async function addFolder() {
  if (busy.value || !newFolderPath.value.trim()) return;
  busy.value = true;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    await $fetch("/api/settings/folders", {
      method: "POST",
      body: { path: newFolderPath.value.trim() },
    });
    newFolderPath.value = "";
    await refresh();
    statusMessage.value =
      "Folder added. Scan your folders to update the library.";
  } catch (err) {
    errorMessage.value = failure(err, "Could not add this folder.");
  } finally {
    busy.value = false;
  }
}
function askRemove(folder: MediaFolder) {
  removing.value = folder;
  removeError.value = "";
  removeOpen.value = true;
}
async function removeFolder() {
  if (!removing.value || busy.value) return;
  busy.value = true;
  removeError.value = "";
  try {
    await $fetch(`/api/settings/folders/${removing.value.mediaFolderId}`, {
      method: "DELETE",
    });
    await refresh();
    removeOpen.value = false;
    statusMessage.value = "Folder removed from the list.";
  } catch (err) {
    removeError.value = failure(err, "Could not remove this folder.");
  } finally {
    busy.value = false;
  }
}
async function scanFolders() {
  if (busy.value) return;
  busy.value = true;
  scanning.value = true;
  errorMessage.value = "";
  statusMessage.value = "";
  try {
    const result = await $fetch<{
      success: boolean;
      message: string;
      scans: { scanId: string; jobId: string }[];
    }>("/api/settings/scan", { method: "POST" });
    statusMessage.value =
      result.message || `Queued ${result.scans.length} scan jobs.`;
  } catch (err) {
    errorMessage.value = failure(err, "Could not queue the scans.");
  } finally {
    busy.value = false;
    scanning.value = false;
  }
}
function openBrowser() {
  browserOpen.value = true;
  void browse();
}
async function browse(path?: string | null) {
  if (browserLoading.value) return;
  browserLoading.value = true;
  browserError.value = "";
  try {
    const result = await $fetch<{
      currentPath: string;
      parentPath: string | null;
      entries: BrowserEntry[];
      error?: string;
    }>("/api/filesystem/browse", { query: path ? { path } : {} });
    browserPath.value = result.currentPath;
    parentPath.value = result.parentPath;
    entries.value = result.entries || [];
    browserError.value = result.error || "";
  } catch (err) {
    browserError.value = failure(err, "Could not browse this folder.");
    entries.value = [];
  } finally {
    browserLoading.value = false;
  }
}
function selectFolder() {
  if (
    browserPath.value &&
    browserPath.value !== "Computer" &&
    !browserError.value
  ) {
    newFolderPath.value = browserPath.value;
    browserOpen.value = false;
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
<style scoped>
.utility-folder-list {
  margin: 1.5rem 0;
  border-top: 1px solid var(--rule);
}
.utility-folder-list article {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--rule);
  padding: 1rem 0;
}
.utility-folder-list p,
.browser-path {
  overflow-wrap: anywhere;
  min-width: 0;
}
.folder-browser {
  max-height: 20rem;
  overflow: auto;
  border-block: 1px solid var(--rule);
  margin-top: 1rem;
  padding: 0.5rem 0;
}
.folder-entry {
  display: block;
  width: 100%;
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--rule);
  min-height: 44px;
  overflow-wrap: anywhere;
}
.folder-entry:hover {
  background: var(--color-base-200);
}
@media (max-width: 500px) {
  .utility-folder-list article {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
