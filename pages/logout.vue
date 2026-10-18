<template>
  <div class="logout-page">
    <header><LyraBrand /></header>
    <section>
      <h1>{{ error ? "Could not sign out" : "Signing you out" }}</h1>
      <p role="status">{{ error || "Returning to the home page." }}</p>
      <button v-if="error" class="btn btn-primary" @click="signOut">
        Try again</button
      ><span v-else class="loading loading-spinner" aria-hidden="true"></span
      ><img
        src="/images/lyra-radio/rooftop-dj.webp"
        alt=""
        width="1536"
        height="1024"
      />
    </section>
  </div>
</template>
<script setup lang="ts">
import { useUser } from "~/composables/use-user";
import { usePlayerStore } from "~/stores/player";
const { logout } = useUser();
const error = ref("");
async function signOut() {
  error.value = "";
  try {
    await logout();
    usePlayerStore().clearQueue();
    await navigateTo("/");
  } catch {
    error.value = "Please try signing out again.";
  }
}
onMounted(signOut);
useSeoMeta({ title: "Signing out — Lyra" });
</script>
<style scoped>
.logout-page {
  max-width: 1200px;
  margin: auto;
  padding: 2rem;
}
.logout-page header {
  border-bottom: 1px solid var(--rule);
  padding-bottom: 2rem;
}
.logout-page section {
  text-align: center;
  padding: 3rem 0;
}
.logout-page h1 {
  margin-bottom: 1rem;
}
.logout-page img {
  display: block;
  width: min(650px, 100%);
  margin: 2rem auto;
  aspect-ratio: 1.8;
  object-fit: cover;
}
</style>
