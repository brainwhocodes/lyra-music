<template>
  <div class="auth-shell">
    <header>
      <LyraBrand /><NuxtLink to="/" class="btn btn-ghost">Home</NuxtLink>
    </header>
    <div class="auth-columns">
      <section class="auth-story">
        <img
          src="/images/lyra-radio/rooftop-dj.webp"
          alt="An anime radio DJ on a graffiti-covered rooftop speaker"
          width="1536"
          height="1024"
        />
        <h2>{{ headline }}</h2>
        <p>Your collection. Your station. Your rules.</p>
      </section>
      <section class="auth-form"><slot /></section>
    </div>
  </div>
</template>
<script setup lang="ts">
defineProps<{ headline: string }>();
</script>
<style>
.auth-shell {
  max-width: 1440px;
  margin: auto;
  padding: 0 clamp(1rem, 4.5vw, 4rem) 3rem;
}
.auth-shell > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--rule);
  padding: 2rem 0;
}
.auth-columns {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 3rem;
  padding: 2.5rem 0;
}
.auth-story img {
  width: 100%;
  aspect-ratio: 1.6;
  object-fit: cover;
  object-position: 73% center;
}
.auth-story h2 {
  font-size: clamp(3rem, 5.5vw, 5.5rem);
  margin: 2rem 0 1rem;
}
.auth-story p {
  color: var(--muted);
}
.auth-form {
  border-left: 1px solid var(--rule);
  padding: 1rem 0 1rem 3rem;
}
.auth-form h1 {
  font-size: clamp(2.5rem, 4.5vw, 4rem);
  margin: 0 0 2rem;
}
.auth-form form {
  display: grid;
  gap: 1.25rem;
}
.auth-form .input {
  width: 100%;
}
.auth-form .field-error {
  color: #9a2723;
  font-size: 0.875rem;
  margin-top: 0.35rem;
}
.auth-form .form-footer {
  border-top: 1px solid var(--rule);
  padding-top: 1.5rem;
  margin-top: 1.5rem;
}
.auth-form .field-hint {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0.4rem 0 0;
}
.password-field {
  position: relative;
  isolation: isolate;
}
.password-field input {
  min-width: 0;
}
.password-field:has(button) input {
  padding-right: 3.5rem;
}
.password-field button {
  position: absolute;
  inset: 4px 4px auto auto;
  z-index: 2;
}
@media (max-width: 800px) {
  .auth-columns {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .auth-story {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    align-items: center;
  }
  .auth-story h2 {
    font-size: 2.7rem;
    margin: 0;
  }
  .auth-story p {
    grid-column: 1/-1;
    margin: 0;
  }
  .auth-story img {
    aspect-ratio: 1;
  }
  .auth-form {
    border-left: 0;
    border-top: 1px solid var(--rule);
    padding: 2rem 0 0;
  }
}
@media (max-width: 480px) {
  .auth-story {
    grid-template-columns: 1fr;
  }
  .auth-story img {
    aspect-ratio: 2.3;
  }
  .auth-story h2 {
    font-size: 2.5rem;
  }
  .auth-shell > header {
    padding: 1.25rem 0;
  }
  .auth-columns {
    padding-top: 1.5rem;
  }
}
</style>
