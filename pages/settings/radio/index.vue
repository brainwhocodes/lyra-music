<template>
  <div class="utility-page">
    <NuxtLink to="/settings" class="utility-back">← Settings</NuxtLink>
    <header class="utility-head">
      <div>
        <h1 class="page-heading">Your radio stations.</h1>
        <p class="page-intro">
          Create a mix around artists and genres from your music library.
        </p>
      </div>
      <button class="btn btn-primary" @click="addStation">
        Add Radio Station
      </button>
    </header>
    <UiLoadingSkeleton
      v-if="pending || userPending"
      label="Loading your stations…"
      variant="rows"
      :count="3"
    />
    <div v-else-if="error || userError" class="utility-status" role="alert">
      Could not load your stations.
      <button class="btn btn-outline" @click="reload">Try again</button>
    </div>
    <div v-else-if="!ownedStations.length" class="utility-empty">
      <h2>A station of your own.</h2>
      <p>Add a station, choose its seeds, and let your library do the rest.</p>
    </div>
    <div v-else class="utility-list">
      <article
        v-for="station in ownedStations"
        :key="station.channelId"
        class="utility-row"
      >
        <UtilityArt :src="station.logoImagePath" />
        <div>
          <h2>
            <NuxtLink :to="`/radio/${station.channelId}`">{{
              station.name
            }}</NuxtLink>
          </h2>
          <p>
            Artists:
            {{
              station.radioChannelArtists
                .map((s) => s.artist.name)
                .join(", ") || "None selected"
            }}
          </p>
          <p>
            Genres:
            {{
              station.radioChannelGenres.map((s) => s.genre.name).join(", ") ||
              "None selected"
            }}
          </p>
        </div>
        <div class="utility-actions">
          <NuxtLink
            :to="`/settings/radio/${station.channelId}`"
            class="btn btn-outline"
            >Settings</NuxtLink
          ><button
            class="btn btn-outline"
            :aria-label="`Edit seeds for ${station.name}`"
            @click="editStation(station)"
          >
            Edit Seeds</button
          ><button
            class="btn btn-ghost text-error"
            :aria-label="`Delete ${station.name}`"
            @click="askDelete(station)"
          >
            Delete
          </button>
        </div>
      </article>
    </div>
    <p v-if="status" role="status" class="utility-status">{{ status }}</p>
    <EditRadioStationModal
      :open="editOpen"
      :station="selected"
      @close="editOpen = false"
      @station-updated="stationUpdated"
    />
    <UtilityDialog v-model:open="deleteOpen" title="Delete Radio Station"
      ><p>
        Delete “{{ selected?.name }}”? Your music files will remain in the
        library.
      </p>
      <p v-if="deleteError" role="alert" class="text-error mt-4">
        {{ deleteError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="deleteOpen = false">Cancel</button
        ><button
          class="btn btn-error"
          :disabled="deleting"
          @click="deleteStation"
        >
          Delete
        </button>
      </div></UtilityDialog
    >
  </div>
</template>
<script setup lang="ts">
import type { RadioStation } from "~/types/radio";
import EditRadioStationModal from "~/components/modals/edit-radio-station-modal.vue";
import { useRadioStationDeletion } from "~/composables/useRadioStationDeletion";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Radio settings") });
const {
  data: stations,
  pending,
  error,
  refresh,
} = useLazyFetch<RadioStation[]>("/api/radio-stations");
const {
  data: user,
  pending: userPending,
  error: userError,
  refresh: refreshUser,
} = useLazyFetch<{ userId: string }>("/api/auth/me", { method: "POST" });
const ownedStations = computed(() =>
  (stations.value || []).filter((s) => s.userId === user.value?.userId),
);
const selected = ref<RadioStation | null>(null),
  editOpen = ref(false),
  deleteOpen = ref(false);
const { deleting, deleteError, status, deleteStation } =
  useRadioStationDeletion(
    selected,
    deleteOpen,
    (channelId) =>
      $fetch(`/api/radio-stations/${channelId}`, { method: "DELETE" }),
    refresh,
  );
async function reload() {
  await Promise.all([refresh(), refreshUser()]);
}
function addStation() {
  selected.value = null;
  editOpen.value = true;
}
function editStation(station: RadioStation) {
  selected.value = station;
  editOpen.value = true;
}
function askDelete(station: RadioStation) {
  selected.value = station;
  deleteError.value = "";
  deleteOpen.value = true;
}
async function stationUpdated(station: RadioStation) {
  await refresh();
  status.value = `Saved “${station.name}”.`;
}
</script>
<style src="~/assets/utility-pages.css"></style>
