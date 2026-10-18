<template>
  <div
    class="loading-skeleton"
    role="status"
    :aria-label="label"
    aria-busy="true"
  >
    <span class="sr-only">{{ label }}</span>
    <div
      aria-hidden="true"
      :class="[
        'skeleton-content',
        `skeleton-${variant}`,
        { 'collection-grid': variant === 'cards' },
      ]"
    >
      <template v-if="variant === 'detail'">
        <div class="skeleton-hero">
          <div class="skeleton-bone skeleton-art" />
          <div class="skeleton-copy">
            <div class="skeleton-bone skeleton-title" />
            <div class="skeleton-bone skeleton-line" />
            <div class="skeleton-bone skeleton-line skeleton-short" />
            <div class="skeleton-bone skeleton-action" />
          </div>
        </div>
        <div v-for="index in count" :key="index" class="skeleton-track">
          <div class="skeleton-bone skeleton-number" />
          <div class="skeleton-copy">
            <div class="skeleton-bone skeleton-line" />
            <div class="skeleton-bone skeleton-line skeleton-short" />
          </div>
          <div class="skeleton-bone skeleton-duration" />
        </div>
      </template>
      <template v-else>
        <div v-for="index in count" :key="index" class="skeleton-item">
          <div v-if="variant !== 'text'" class="skeleton-bone skeleton-art" />
          <div class="skeleton-copy">
            <div class="skeleton-bone skeleton-line" />
            <div class="skeleton-bone skeleton-line skeleton-short" />
            <div
              v-if="variant === 'cards'"
              class="skeleton-bone skeleton-action"
            />
          </div>
          <div
            v-if="variant === 'tracks'"
            class="skeleton-bone skeleton-duration"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string;
    variant?:
      | "cards"
      | "rows"
      | "compact"
      | "tracks"
      | "detail"
      | "tiles"
      | "text";
    count?: number;
  }>(),
  { variant: "cards", count: 4 },
);
</script>

<style scoped>
.loading-skeleton {
  min-width: 0;
  width: 100%;
}
.skeleton-content {
  pointer-events: none;
}
.skeleton-bone {
  background: #cbd0d8;
  border-radius: 2px;
  animation: skeleton-breathe 1.8s ease-in-out infinite;
}
.skeleton-art {
  width: 100%;
  aspect-ratio: 1;
}
.skeleton-copy {
  min-width: 0;
  display: grid;
  gap: 0.65rem;
  align-content: center;
}
.skeleton-line {
  width: 83%;
  height: 1rem;
}
.skeleton-short {
  width: 52%;
  height: 0.8rem;
}
.skeleton-title {
  width: 85%;
  height: clamp(2.5rem, 5vw, 4.5rem);
  margin-bottom: 0.5rem;
}
.skeleton-action {
  width: min(7rem, 100%);
  height: 44px;
  margin-top: 0.65rem;
}
.skeleton-cards .skeleton-copy {
  padding-top: 1rem;
}
.skeleton-rows,
.skeleton-compact,
.skeleton-tracks,
.skeleton-text {
  display: grid;
  gap: 0.85rem;
}
.skeleton-rows .skeleton-item {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: 1.5rem;
  padding: 1.5rem 0;
  border-bottom: 1px solid var(--rule);
}
.skeleton-compact .skeleton-item {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 0.85rem;
}
.skeleton-tracks .skeleton-item,
.skeleton-track {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 2.5rem;
  gap: 1rem;
  align-items: center;
  min-height: 4.5rem;
  border-bottom: 1px solid var(--rule);
}
.skeleton-number {
  width: 1.2rem;
  height: 1rem;
  justify-self: center;
}
.skeleton-duration {
  width: 2.5rem;
  height: 0.8rem;
}
.skeleton-hero {
  display: grid;
  grid-template-columns: minmax(12rem, 20rem) minmax(0, 1fr);
  gap: 2.5rem;
  align-items: center;
  padding: 1.5rem 0 2.5rem;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 2rem;
}
.skeleton-tiles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.skeleton-tiles .skeleton-item {
  display: grid;
  grid-template-columns: 36% minmax(0, 1fr);
  gap: 1.25rem;
  align-items: center;
  min-height: 138px;
  border: 1px solid var(--rule);
  padding: 1rem;
}
.skeleton-tiles .skeleton-art {
  display: block;
}
.skeleton-tiles .skeleton-line {
  height: 2rem;
}
.skeleton-tiles .skeleton-short {
  height: 1rem;
  margin-top: 0.35rem;
}
.skeleton-text .skeleton-item {
  padding-block: 0.65rem;
}
@keyframes skeleton-breathe {
  0%,
  100% {
    opacity: 0.5;
  }
  50% {
    opacity: 1;
  }
}
@media (max-width: 700px) {
  .skeleton-hero {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
  }
  .skeleton-hero > .skeleton-art {
    max-width: 18rem;
    margin-inline: auto;
  }
  .skeleton-rows .skeleton-item {
    grid-template-columns: 5rem minmax(0, 1fr);
    gap: 1rem;
  }
}
@media (max-width: 550px) {
  .skeleton-tiles {
    grid-template-columns: 1fr;
  }
}
@media (prefers-reduced-motion: reduce) {
  .skeleton-bone {
    animation: none !important;
    opacity: 0.75;
  }
}
</style>
