<template>
  <div>
    <h1>Logging out...</h1>
    <p>You will be redirected to the login page.</p>
  </div>
</template>

<script setup>
useCookie('auth_token').value = null;
// Redirect to login page
navigateTo('/login');
</script>