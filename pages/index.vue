<template>
  <MarketingShell>
    <section class="radio-landing-hero">
      <picture class="radio-landing-art">
        <source srcset="/images/lyra-radio/rooftop-dj.webp" type="image/webp" />
        <img
          src="/images/lyra-radio/rooftop-dj.png"
          alt="An anime radio DJ on a graffiti-covered rooftop speaker"
          width="1536"
          height="1024"
          fetchpriority="high"
        />
      </picture>
      <div class="radio-landing-copy">
        <h1>Own your <br />frequency.</h1>
        <p>
          Your collection. Your station. Your rules. Turn the music you keep
          into a mix that moves with you.
        </p>
        <div class="radio-landing-actions">
          <NuxtLink to="/radio" class="btn radio-ink-button"
            >Tune into radio
            <Icon name="material-symbols:arrow-forward" aria-hidden="true"
          /></NuxtLink>
          <NuxtLink to="/library">Open your library</NuxtLink>
        </div>
      </div>
      <p class="radio-sticker" aria-hidden="true">Sound on.<br />World off.</p>
    </section>
    <section class="radio-promise-strip" aria-label="What Lyra offers">
      <p>
        <strong>Your music</strong><span>Play what you keep. Your way.</span>
      </p>
      <p>
        <strong>Local discovery</strong
        ><span>Find another side of your collection.</span>
      </p>
      <p>
        <strong>Self-hosted</strong
        ><span>Your library, on your own server.</span>
      </p>
    </section>
    <section class="radio-landing-features" aria-label="Make Lyra yours">
      <article>
        <h2>Build your <br />station.</h2>
        <p>
          Pick artists and genres from your library. Let Lyra turn them into a
          fresh queue for the next part of your day.
        </p>
        <NuxtLink to="/settings/radio">Build a station</NuxtLink>
      </article>
      <article>
        <h2>Find your next <br />obsession.</h2>
        <p>
          Search your indexed music by meaning. Rediscover forgotten tracks and
          explore recommendations from your listening history.
        </p>
        <NuxtLink to="/explore">Explore your music</NuxtLink>
      </article>
      <article>
        <h2>Keep your <br />collection.</h2>
        <p>
          Albums, artists, playlists, and the tracks you keep coming back to.
          Give everything you love a home of its own.
        </p>
        <NuxtLink to="/library">Browse your library</NuxtLink>
      </article>
    </section>
    <section class="radio-landing-cta">
      <h2>Good music. <br />Your rules.</h2>
      <div>
        <p>Bring your collection. Find your frequency.</p>
        <NuxtLink to="/register" class="btn radio-ink-button"
          >Create an account
          <Icon name="material-symbols:arrow-forward" aria-hidden="true"
        /></NuxtLink>
      </div>
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
useSeoMeta({
  title: "Lyra Radio — Own your frequency",
  description:
    "Your collection. Your station. Your rules. Personal radio, local music discovery and a home for the music you keep.",
});
</script>
<style scoped>
.radio-landing-hero {
  position: relative;
  isolation: isolate;
  display: grid;
  align-items: center;
  min-height: 40rem;
  border: 3px solid var(--ink);
  background: var(--acid);
  margin-top: 1.5rem;
}
.radio-landing-art {
  position: absolute;
  inset: 0;
  z-index: -1;
}
.radio-landing-art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
}
.radio-landing-copy {
  width: 48%;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: var(--acid);
  padding: 2rem 0 2rem clamp(1.25rem, 3vw, 3rem);
}
.radio-landing-copy h1 {
  font-size: clamp(4rem, 7.7vw, 7rem);
  line-height: 0.92;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: -0.025em;
  margin: 0;
  padding: 0.2em 0.08em 0.22em 0;
  background: var(--acid);
}
.radio-landing-copy p {
  margin: 0;
  padding: 0 1rem 1.5rem 0;
  font-size: 1.125rem;
  line-height: 1.55;
  max-width: 40ch;
  background: var(--acid);
}
.radio-landing-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
  width: fit-content;
  padding: 0.5rem 1rem 0.6rem 0;
  background: var(--acid);
}
.radio-ink-button {
  background: var(--ink);
  color: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 0;
  min-height: 3.5rem;
  padding: 0.75rem 1.25rem;
  gap: 1.5rem;
  box-shadow: 5px 5px 0 var(--orange);
}
.radio-ink-button:hover {
  background: #303438;
  color: white;
}
.radio-ink-button:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 6px;
}
.radio-landing-actions > a:not(.btn) {
  display: inline-flex;
  align-items: center;
  min-height: 2.75rem;
  font-weight: 600;
  text-decoration: underline;
}
.radio-sticker {
  position: absolute;
  right: 1.75rem;
  bottom: 1.25rem;
  margin: 0;
  transform: rotate(-6deg);
  background: var(--orange);
  color: var(--ink);
  border: 3px solid var(--ink);
  outline: 4px solid var(--paper);
  padding: 0.6rem 1rem;
  font: 800 2rem/1 var(--font-display);
  text-transform: uppercase;
}
.radio-promise-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  background: var(--ink);
  color: var(--paper);
  padding: 1.75rem 0.75rem;
  gap: 1rem;
}
.radio-promise-strip p {
  margin: 0;
  padding: 0 1rem;
  text-align: center;
}
.radio-promise-strip p + p {
  border-left: 1px solid #b7b9af;
}
.radio-promise-strip strong {
  display: block;
  font: 700 1.8rem/1.1 var(--font-display);
  color: var(--acid);
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}
.radio-promise-strip span {
  font-size: 0.9375rem;
}
.radio-landing-features {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  padding: 3rem 0;
  gap: 2rem;
}
.radio-landing-features article {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
}
.radio-landing-features article + article {
  border-left: 2px solid var(--ink);
  padding-left: 2rem;
}
.radio-landing-features h2 {
  text-transform: uppercase;
  font-size: clamp(2.4rem, 3.2vw, 3.5rem);
  line-height: 1;
  margin: 0;
}
.radio-landing-features p {
  margin: 1rem 0 1.25rem;
}
.radio-landing-features a {
  display: flex;
  align-items: center;
  min-height: 2.75rem;
  margin-top: auto;
  font-weight: 600;
  text-decoration: underline;
}
.radio-landing-cta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  align-items: center;
  background: var(--orange);
  border: 3px solid var(--ink);
  padding: clamp(1.25rem, 3vw, 3rem);
}
.radio-landing-cta h2 {
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 0.95;
  text-transform: uppercase;
  margin: 0;
}
.radio-landing-cta p {
  margin: 0 0 1rem;
}
.radio-landing-cta .radio-ink-button {
  box-shadow: 5px 5px 0 var(--paper);
}
@media (max-width: 1100px) {
  .radio-landing-hero {
    min-height: 34rem;
  }
  .radio-landing-copy h1 {
    font-size: clamp(3.2rem, 7.2vw, 6rem);
  }
  .radio-landing-copy p {
    font-size: 1rem;
  }
}
@media (max-width: 800px) {
  .radio-landing-hero {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    min-height: 0;
  }
  .radio-landing-copy {
    width: 100%;
    padding: 1.5rem;
  }
  .radio-landing-copy h1 {
    font-size: clamp(3rem, 10vw, 5.5rem);
  }
  .radio-landing-copy p {
    max-width: 50ch;
  }
  .radio-landing-art {
    position: relative;
    order: 2;
    z-index: 0;
    display: block;
    height: 23rem;
  }
  .radio-landing-art img {
    object-position: 70% top;
  }
  .radio-sticker {
    z-index: 1;
    font-size: 1.6rem;
    right: 1rem;
    bottom: 1rem;
  }
  .radio-landing-features {
    grid-template-columns: 1fr;
    gap: 1.75rem;
    padding: 2rem 0;
  }
  .radio-landing-features article + article {
    border-left: 0;
    border-top: 2px solid var(--ink);
    padding: 1.75rem 0 0;
  }
  .radio-landing-features h2 br {
    display: none;
  }
  .radio-landing-features h2 {
    line-height: 1.05;
  }
  .radio-landing-cta {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 520px) {
  .radio-landing-copy {
    padding: 1.25rem;
  }
  .radio-landing-art {
    height: 20rem;
  }
  .radio-promise-strip {
    grid-template-columns: 1fr;
    padding: 1.25rem;
    gap: 1.25rem;
  }
  .radio-promise-strip p + p {
    border-left: 0;
    border-top: 1px solid #b7b9af;
    padding-top: 1.25rem;
  }
  .radio-ink-button {
    gap: 0.75rem;
  }
}
</style>
