<template>
  <div ref="container" class="relative options-menu-container" @click.stop>
    <button
      :id="buttonId"
      ref="trigger"
      type="button"
      class="btn btn-ghost min-h-11 min-w-11 p-1 focus:opacity-100 bg-base-100"
      :class="buttonClass"
      :disabled="disabled"
      :aria-label="buttonLabel"
      :aria-expanded="isMenuOpen"
      :aria-controls="isMenuOpen ? menuId : undefined"
      :aria-haspopup="options.length ? 'menu' : undefined"
      @click.stop="toggleMenu"
      @keydown.down.prevent="openMenu()"
      @keydown.up.prevent="openMenu(true)"
    >
      <Icon
        name="material-symbols:more-vert"
        class="w-5 h-5"
        aria-hidden="true"
      />
    </button>
    <Teleport to="body">
      <div
        v-if="isMenuOpen"
        :id="menuId"
        ref="panel"
        class="fixed w-56 bg-base-100 rounded-sm shadow-lg z-[2000] py-1 border border-base-300 max-h-96 overflow-y-auto"
        :style="menuPosition"
        :role="options.length ? 'menu' : 'group'"
        :aria-labelledby="buttonId"
        @keydown="onKeydown"
        @click.stop
        @click.capture="onSlotSelection"
      >
        <template v-if="options.length">
          <button
            v-for="option in options"
            :key="option.id"
            type="button"
            role="menuitem"
            tabindex="-1"
            class="w-full min-h-11 px-4 py-2.5 text-left text-sm text-base-content hover:bg-base-300 focus:bg-base-300 focus:outline-none flex items-center gap-3"
            @click="selectOption(option)"
          >
            <Icon
              v-if="option.icon"
              :name="option.icon"
              class="w-5 h-5 text-base-content/70"
              aria-hidden="true"
            />
            <span class="flex-1">{{ option.label }}</span>
          </button>
        </template>
        <div v-else class="flex flex-col">
          <slot
            ><p class="px-4 py-2 text-sm text-base-content/60">
              No options available.
            </p></slot
          >
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  useId,
  watch,
} from "vue";
interface Option {
  id: string;
  label: string;
  icon?: string;
}
const props = withDefaults(
  defineProps<{
    options?: Option[];
    disabled?: boolean;
    buttonClass?: string;
    buttonLabel?: string;
  }>(),
  {
    options: () => [],
    disabled: false,
    buttonClass: "",
    buttonLabel: "Open options menu",
  },
);
const emit = defineEmits<{ "option-selected": [id: string] }>();
const id = useId();
const buttonId = `options-button-${id}`,
  menuId = `options-panel-${id}`;
const container = ref<HTMLElement | null>(null),
  trigger = ref<HTMLButtonElement | null>(null),
  panel = ref<HTMLElement | null>(null);
const isMenuOpen = ref(false);
const menuPosition = ref({ top: "0px", left: "0px", maxHeight: "384px" });
let openingAnchor: { top: number; left: number } | null = null;
const options = computed(() => props.options);
const controls = () =>
  Array.from(
    panel.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], [tabindex="0"]',
    ) ?? [],
  );

async function openMenu(last = false) {
  if (props.disabled) return;
  isMenuOpen.value = true;
  await nextTick();
  if (!isMenuOpen.value || !trigger.value || !panel.value) return;
  const rect = trigger.value.getBoundingClientRect();
  openingAnchor = { top: rect.top, left: rect.left };
  const margin = 10,
    width = panel.value.offsetWidth;
  const height = Math.min(
    panel.value.scrollHeight,
    384,
    window.innerHeight - margin * 2,
  );
  const top =
    rect.bottom + 5 + height <= window.innerHeight - margin
      ? rect.bottom + 5
      : Math.max(margin, rect.top - height - 5);
  menuPosition.value = {
    top: `${top}px`,
    left: `${Math.max(margin, Math.min(rect.right - width, window.innerWidth - width - margin))}px`,
    maxHeight: `${Math.max(44, window.innerHeight - top - margin)}px`,
  };
  // Apply viewport positioning before focus; the panel initially renders at 0,0.
  await nextTick();
  if (!isMenuOpen.value) return;
  const items = controls();
  (last ? items.at(-1) : items[0])?.focus({ preventScroll: true });
}
function closeMenu(restoreFocus = false) {
  isMenuOpen.value = false;
  openingAnchor = null;
  if (restoreFocus) trigger.value?.focus({ preventScroll: true });
}
function toggleMenu() {
  if (isMenuOpen.value) closeMenu();
  else void openMenu();
}
function selectOption(option: Option) {
  // Focus returns before emitting; an action opening a dialog then takes focus normally.
  closeMenu(true);
  emit("option-selected", option.id);
}
function onSlotSelection(event: MouseEvent) {
  if (
    !props.options.length &&
    (event.target as Element).closest("button:not(:disabled), a[href]")
  )
    closeMenu(true);
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeMenu(true);
    return;
  }
  if (event.key === "Tab") {
    closeMenu(true);
    return;
  }
  const items = controls();
  if (
    !items.length ||
    !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
  )
    return;
  event.preventDefault();
  const current = items.indexOf(document.activeElement as HTMLElement);
  const index =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
          items.length;
  items[index]?.focus();
}
function outside(event: Event) {
  const target = event.target as Node;
  if (!container.value?.contains(target) && !panel.value?.contains(target))
    closeMenu();
}
function onScroll(event: Event) {
  if (!isMenuOpen.value || panel.value?.contains(event.target as Node)) return;
  const rect = trigger.value?.getBoundingClientRect();
  // A scroll event may be queued before the trigger is clicked. Only close if
  // scrolling actually moved this menu's anchor after it opened.
  if (
    rect &&
    openingAnchor &&
    Math.abs(rect.top - openingAnchor.top) < 0.5 &&
    Math.abs(rect.left - openingAnchor.left) < 0.5
  )
    return;
  closeMenu();
}
function onResize() {
  closeMenu();
}
watch(
  () => props.disabled,
  (value) => {
    if (value) closeMenu();
  },
);
onMounted(() => {
  document.addEventListener("pointerdown", outside, true);
  window.addEventListener("resize", onResize);
  document.addEventListener("scroll", onScroll, true);
});
onUnmounted(() => {
  document.removeEventListener("pointerdown", outside, true);
  window.removeEventListener("resize", onResize);
  document.removeEventListener("scroll", onScroll, true);
});
defineExpose({ closeMenu, toggleMenu });
</script>
