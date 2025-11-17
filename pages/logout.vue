<template>
  <div>
    <h1>Logging out...</h1>
    <p>You will be redirected to the login page.</p>
  </div>
</template>

<script setup>
const authStore = useAuthStore();

// Use the auth store logout method which handles everything properly
await authStore.logout();
onMounted(() => {
  navigateTo('/login');
});
</script>