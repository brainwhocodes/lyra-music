<template>
  <figure ref="frame" class="radio-artwork" :class="{ 'is-animating': animate }">
    <ResponsiveArtwork
      class="radio-artwork-image"
      :name="name"
      :sizes="sizes"
      :priority="priority"
      alt=""
    />
    <button
      v-if="active && mounted && !reducedMotion"
      type="button"
      class="radio-artwork-motion"
      :aria-label="motionEnabled ? 'Pause artwork animation' : 'Resume artwork animation'"
      :title="motionEnabled ? 'Pause artwork animation' : 'Resume artwork animation'"
      @click="motionEnabled = !motionEnabled"
    >
      <Icon
        :name="motionEnabled ? 'material-symbols:motion-photos-paused-outline-rounded' : 'material-symbols:motion-photos-on-outline-rounded'"
        aria-hidden="true"
      />
    </button>
  </figure>
</template>
<script setup lang="ts">
import manifest from '~/utils/artwork-manifest.json';
const props = withDefaults(defineProps<{
  name: keyof typeof manifest;
  active?: boolean;
  sizes: string;
  priority?: boolean;
}>(), { active: false, priority: false });
const frame = ref<HTMLElement | null>(null);
const mounted = ref(false);
const visible = ref(false);
const pageVisible = ref(true);
const reducedMotion = ref(true);
// Share the user's choice across station navigation, independently of playback.
const motionEnabled = useState('radio-artwork-motion', () => true);
const animate = computed(() => props.active && mounted.value && visible.value && pageVisible.value && !reducedMotion.value && motionEnabled.value);
let observer: IntersectionObserver | undefined;
let media: MediaQueryList | undefined;
function syncMotionPreference() { reducedMotion.value = media?.matches ?? true; }
function syncPageVisibility() { pageVisible.value = document.visibilityState === 'visible'; }
onMounted(() => {
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  syncMotionPreference();
  syncPageVisibility();
  media.addEventListener('change', syncMotionPreference);
  document.addEventListener('visibilitychange', syncPageVisibility);
  observer = new IntersectionObserver(entries => { visible.value = entries.some(entry => entry.isIntersecting); });
  if (frame.value) observer.observe(frame.value);
  mounted.value = true;
});
onBeforeUnmount(() => {
  observer?.disconnect();
  media?.removeEventListener('change', syncMotionPreference);
  document.removeEventListener('visibilitychange', syncPageVisibility);
});
</script>
<style scoped>
.radio-artwork { position: relative; isolation: isolate; overflow: hidden; margin: 0; min-width: 0; background: #17191c; }
.radio-artwork-image { position: absolute; inset: -2%; width: 104%; height: 104%; object-fit: cover; object-position: inherit; transform: scale(1); animation: radio-artwork-drift 16s ease-in-out infinite alternate; animation-play-state: paused; }
.is-animating .radio-artwork-image { animation-play-state: running; }
.radio-artwork-motion { position: absolute; z-index: 1; right: .75rem; bottom: .75rem; width: 2.75rem; height: 2.75rem; display: inline-flex; align-items: center; justify-content: center; border: 1px solid #f3f4f6; background: #17191c; color: #f3f4f6; cursor: pointer; font-size: 1.25rem; }
.radio-artwork-motion:hover { background: #d7ff3f; color: #17191c; }
.radio-artwork-motion:focus-visible { outline: 3px solid #d7ff3f; outline-offset: 3px; }
@keyframes radio-artwork-drift { from { transform: translate3d(-.7%, 0, 0) scale(1); } to { transform: translate3d(.7%, -.6%, 0) scale(1.035); } }
@media (prefers-reduced-motion: reduce) { .radio-artwork-image { animation: none; transform: none; } }
</style>
