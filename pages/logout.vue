<template>
  <div>
    <h1>Logging out...</h1>
    <p>You will be redirected to the login page.</p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, navigateTo } from '#imports'
import { useUser } from '~/composables/use-user'

const { logout } = useUser()
onMounted(async () => {
  await logout()
  await navigateTo('/login')
})
</script>