<template>
  <div class="min-h-screen bg-base-100 text-base-content">
    <!-- Navbar Placeholder (Optional) -->
    <!-- You might add a common navbar here later -->
    <!-- <Navbar /> -->

    <!-- Main Page Content -->
    <main class="pb-20"> <!-- Add padding-bottom to prevent content overlap with fixed player -->
      <slot />
      <LazyLayoutToastContainer />
    </main>

  </div>
</template>

<script setup lang="ts">
// No specific script logic needed for the basic layout itself
</script>

<style scoped>
/* Add any layout-specific styles here */
</style>
