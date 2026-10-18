<template>
  <article class="record-card">
    <NuxtLink :to="`/albums/${album.albumId}`" class="record-link">
      <AlbumArt :src="album.coverPath" />
      <h2 :title="album.title">{{ album.title || "Untitled album" }}</h2>
    </NuxtLink>
    <p class="record-credit">{{ displayArtists }}</p>
    <p v-if="album.year" class="record-year">{{ album.year }}</p>
    <div class="record-actions">
      <button
        type="button"
        class="btn btn-primary"
        :disabled="isLoadingThisAlbum"
        :aria-label="`${isPlayingThisAlbum ? 'Pause' : 'Play'} ${album.title}`"
        @click="$emit('play', album)"
      >
        <Icon
          :name="
            isPlayingThisAlbum
              ? 'material-symbols:pause-rounded'
              : 'material-symbols:play-arrow-rounded'
          "
          aria-hidden="true"
        />
        {{
          isLoadingThisAlbum
            ? "Loading…"
            : isPlayingThisAlbum
              ? "Pause"
              : "Play"
        }}
      </button>
      <OptionsMenu
        v-if="options.length"
        :options="options"
        @option-selected="selectOption"
      />
      <slot name="actions" />
    </div>
  </article>
</template>
<script setup lang="ts">
import type { Album } from "~/types/album";
import AlbumArt from "~/components/album/album-art.vue";
import OptionsMenu from "~/components/options-menu.vue";
const props = withDefaults(
  defineProps<{
    album: Album;
    isPlayingThisAlbum?: boolean;
    isLoadingThisAlbum?: boolean;
    availableActions?: Array<"add" | "edit" | "delete">;
  }>(),
  { availableActions: () => ["add", "edit", "delete"] },
);
const emit = defineEmits([
  "cardClick",
  "addToPlaylist",
  "editAlbum",
  "deleteAlbum",
  "play",
]);
const displayArtists = computed(() => {
  const credits = props.album.artists || [];
  const primary = credits.filter((artist) => artist.isPrimaryArtist);
  return (
    (primary.length ? primary : credits)
      .map((artist) => artist.name)
      .join(", ") || "Unknown artist"
  );
});
const options = computed(() =>
  [
    {
      id: "add",
      label: "Add to Playlist",
      icon: "material-symbols:playlist-add",
    },
    { id: "edit", label: "Edit Album", icon: "material-symbols:edit" },
    {
      id: "delete",
      label: "Delete Album",
      icon: "material-symbols:delete-outline",
    },
  ].filter((option) =>
    props.availableActions.includes(option.id as "add" | "edit" | "delete"),
  ),
);
function selectOption(id: string) {
  if (id === "add") emit("addToPlaylist", props.album);
  if (id === "edit") emit("editAlbum", props.album);
  if (id === "delete") emit("deleteAlbum", props.album);
}
</script>
<style scoped>
.record-card {
  min-width: 0;
}
.record-link {
  display: block;
  color: inherit;
  text-decoration: none;
}
.record-link h2 {
  font-family: var(--font-display);
  font-size: clamp(1.45rem, 2.2vw, 2rem);
  line-height: 1.12;
  margin: 1rem 0 0.4rem;
  overflow-wrap: anywhere;
  font-weight: 700;
}
.record-link:hover h2 {
  color: var(--copper, #a34127);
}
.record-credit {
  color: var(--muted, #62594f);
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.record-year {
  font-size: 0.875rem;
  margin: 0.3rem 0 0;
  color: var(--muted, #62594f);
}
.record-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  margin-top: 1rem;
}
.record-actions :deep(button) {
  min-width: 44px;
  min-height: 44px;
}
</style>
