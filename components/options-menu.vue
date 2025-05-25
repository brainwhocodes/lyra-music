<template>
  <div class="relative" @click.stop>
    <button 
      class="btn btn-ghost btn-sm p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
      @click.stop="toggleMenu"
    >
      <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
    </button>
    
    <!-- Custom dropdown menu -->
    <div 
      v-if="isMenuOpen" 
      class="absolute right-0 top-full mt-1 w-52 bg-base-200 rounded-lg shadow-lg z-[10] py-2 border border-base-300"
      @click.stop
    >
      <div class="flex flex-col">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from '#imports';

const isMenuOpen = ref(false);

const toggleMenu = (event: Event) => {
  event.stopPropagation();
  isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
  isMenuOpen.value = false;
};

// Close menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (isMenuOpen.value) {
    isMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
