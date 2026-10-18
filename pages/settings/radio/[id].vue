<template>
  <div class="utility-page">
    <NuxtLink to="/settings/radio" class="utility-back"
      >← Your radio stations</NuxtLink
    >
    <h1 class="page-heading">Edit station.</h1>
    <p class="page-intro">
      Give your station a name and a look that feels familiar.
    </p>
    <UiLoadingSkeleton
      v-if="pending || userPending"
      label="Loading station…"
      variant="text"
      :count="4"
    />
    <div v-else-if="error || userError" class="utility-status" role="alert">
      Could not load this station.
      <button class="btn btn-outline" @click="reload">Try again</button>
    </div>
    <p v-else-if="!isOwner" class="utility-status">
      Only the station’s creator can edit its settings.
    </p>
    <template v-else-if="station">
      <form class="utility-panel" @submit.prevent="saveName">
        <div class="utility-form-line">
          <label for="radio-station-name"
            >Station Name<input
              id="radio-station-name"
              v-model="name"
              class="input"
              required
              maxlength="200" /></label
          ><button
            class="btn btn-primary"
            :disabled="saving || !name.trim() || name.trim() === station.name"
          >
            Save Details</button
          ><NuxtLink class="btn btn-outline" :to="`/radio/${id}`"
            >Back to station</NuxtLink
          >
        </div>
        <p v-if="saveError" role="alert" class="text-error mt-4">
          {{ saveError }}
        </p>
        <p v-if="saved" role="status" class="mt-4">Station details saved.</p>
      </form>
      <section class="utility-section">
        <div class="utility-head">
          <div>
            <h2>Artist and genre seeds</h2>
            <p class="mt-3 text-base-content/70">
              Choose the music that shapes this station.
            </p>
          </div>
          <button class="btn btn-outline" @click="seedsOpen = true">
            Edit seeds
          </button>
        </div>
        <p>
          {{
            [
              ...station.radioChannelArtists.map((s) => s.artist.name),
              ...station.radioChannelGenres.map((s) => s.genre.name),
            ].join(" · ") || "No seeds selected"
          }}
        </p>
      </section>
      <section class="utility-section">
        <h2>Station images</h2>
        <p>
          Add a logo and an optional background. PNG, JPEG, WebP or GIF, up to 5
          MB each.
        </p>
        <RadioImageUpload
          :channel-id="id"
          :current-logo-path="station.logoImagePath"
          :current-background-path="station.backgroundImagePath"
          @updated="imagesUpdated"
        />
      </section>
      <EditRadioStationModal
        :open="seedsOpen"
        :station="station"
        @close="seedsOpen = false"
        @station-updated="refresh()"
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import type { RadioStation } from "~/types/radio";
import EditRadioStationModal from "~/components/modals/edit-radio-station-modal.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Edit radio station") });
const route = useRoute();
const id = computed(() => String(route.params.id));
const {
  data: station,
  pending,
  error,
  refresh,
} = useLazyFetch<RadioStation>(() => `/api/radio-stations/${id.value}`);
const {
  data: user,
  pending: userPending,
  error: userError,
  refresh: refreshUser,
} = useLazyFetch<{ userId: string }>("/api/auth/me", { method: "POST" });
const isOwner = computed(
  () => !!user.value?.userId && user.value.userId === station.value?.userId,
);
const name = ref(""),
  saving = ref(false),
  saved = ref(false),
  saveError = ref(""),
  seedsOpen = ref(false);
watch(
  station,
  (value) => {
    if (value) name.value = value.name;
  },
  { immediate: true },
);
async function reload() {
  await Promise.all([refresh(), refreshUser()]);
}
async function saveName() {
  if (saving.value || !name.value.trim()) return;
  saving.value = true;
  saveError.value = "";
  saved.value = false;
  try {
    await $fetch(`/api/radio-stations/${id.value}`, {
      method: "PUT",
      body: { name: name.value.trim() },
    });
    await refresh();
    saved.value = true;
  } catch (err: any) {
    saveError.value =
      err?.data?.statusMessage ||
      "Could not save station details. Please try again.";
  } finally {
    saving.value = false;
  }
}
function imagesUpdated(data: {
  logoImagePath?: string | null;
  backgroundImagePath?: string | null;
}) {
  if (station.value) Object.assign(station.value, data);
}
</script>
<style src="~/assets/utility-pages.css"></style>
