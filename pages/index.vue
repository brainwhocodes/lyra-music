<!-- pages/index.vue -->
<template>
  <div class="hero min-h-screen bg-base-200">
    <div class="hero-content text-center">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">Welcome to Otogami</h1>
        <p class="py-6">
          Your personal music streaming server. Organize and listen to your music library from anywhere.
        </p>
        <div class="space-x-4">
           <NuxtLink to="/login" class="btn btn-primary">Login</NuxtLink>
           <NuxtLink to="/register" class="btn btn-outline">Register</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// No specific script needed for this simple landing page
</script>

<style scoped>
/* Add any page-specific styles here if needed */
</style>
