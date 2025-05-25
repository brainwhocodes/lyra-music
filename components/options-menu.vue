<template>
  <div class="relative" @click.stop>
    <button
      class="btn btn-ghost btn-sm p-1 focus:opacity-100"
      @click.stop="toggleMenu"
      aria-label="Open options menu"
      :aria-expanded="isMenuOpen.toString()"
    >
      <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
    </button>

    <div
      v-if="isMenuOpen"
      class="absolute right-0 top-full mt-1 w-56 bg-base-200 rounded-lg shadow-lg z-[1000] py-1 border border-base-300 max-h-96 overflow-y-auto"
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="options-menu-button"
      @click.stop
    >
      <!-- Render options from prop -->
      <template v-if="options && options.length > 0">
        <button
          v-for="option in options"
          :key="option.id"
          @click="selectOption(option)"
          class="w-full px-4 py-2.5 text-left text-sm text-base-content hover:bg-base-300 focus:bg-base-300 focus:outline-none flex items-center gap-3 transition-colors duration-150 ease-in-out"
          role="menuitem"
        >
          <Icon v-if="option.icon" :name="option.icon" class="w-5 h-5 text-base-content/70" />
          <span class="flex-1 truncate">{{ option.label }}</span>
        </button>
      </template>
      <!-- Fallback to slot if no options prop or options prop is empty -->
      <template v-else>
        <div class="flex flex-col">
          <slot>
            <!-- Default slot content if no options and no slot content provided by parent -->
            <p class="px-4 py-2 text-sm text-base-content/60">No options available.</p>
          </slot>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Option {
  id: string;
  label: string;
  icon?: string;
  // Add other properties like 'payload' if needed in the future
}

const props = defineProps({
  options: {
    type: Array as PropType<Option[]>,
    default: () => []
  }
});

const emit = defineEmits(['option-selected']);

const isMenuOpen = ref(false);

const toggleMenu = (event?: Event) => {
  if (event) event.stopPropagation();
  isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
  isMenuOpen.value = false;
};

const selectOption = (option: Option) => {
  emit('option-selected', option.id);
  closeMenu();
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (isMenuOpen.value && !target.closest('.relative')) {
    closeMenu();
  } else if (isMenuOpen.value && target.closest('.relative') === null) {
    closeMenu();
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, true);
});

defineExpose({
  closeMenu,
  toggleMenu
});
</script>
