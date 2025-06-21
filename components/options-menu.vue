<template>
  <div class="relative options-menu-container" @click.stop>
    <button
      class="btn btn-ghost btn-sm p-1 focus:opacity-100 bg-base-100"
      @click.stop="toggleMenu"
      aria-label="Open options menu"
      :aria-expanded="isMenuOpen.toString()"
    >
      <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
    </button>

    <div
      v-if="isMenuOpen"
      class="fixed w-56 bg-base-100 rounded-lg shadow-lg z-[2000] py-1 border border-base-300 max-h-96 overflow-y-auto"
      :style="menuPosition"
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
const menuPosition = ref({ top: '0px', left: '0px' });

const toggleMenu = (event?: Event) => {
  if (event) event.stopPropagation();
  
  // Toggle menu state
  isMenuOpen.value = !isMenuOpen.value;
  
  // If opening the menu, calculate position
  if (isMenuOpen.value && event) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    // Position the menu below the button and aligned to the right
    menuPosition.value = {
      top: `${rect.bottom + window.scrollY + 5}px`,
      left: `${rect.left + window.scrollX - 120}px` // Offset to align right side of menu with button
    };
    
    // Ensure menu doesn't go off-screen
    const menuWidth = 224; // width of the menu (56 * 4)
    if (rect.left - 120 < 0) {
      menuPosition.value.left = `${rect.left}px`;
    } else if (rect.left + menuWidth > window.innerWidth) {
      menuPosition.value.left = `${window.innerWidth - menuWidth - 10}px`;
    }
  }
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
  // Use a more specific selector to identify our options menu container
  if (isMenuOpen.value && !target.closest('.options-menu-container')) {
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
