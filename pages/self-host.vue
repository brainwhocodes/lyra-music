<template>
  <MarketingShell>
    <section class="marketing-hero">
      <div>
        <h1>Your collection.<br />On your terms.</h1>
        <p>
          Lyra runs on your own server. Organise your albums, follow your
          curiosity, and make time for a proper listen.
        </p>
        <div class="marketing-actions">
          <a
            href="https://github.com/brainwhocodes/lyra-music#readme"
            class="btn btn-primary"
            >Read setup on GitHub</a
          ><NuxtLink to="/login" class="btn btn-outline"
            >Log in to this server</NuxtLink
          >
        </div>
      </div>
      <img
        src="/images/lyra-radio/rooftop-dj.webp"
        alt="An anime radio DJ on a graffiti-covered rooftop speaker"
        width="1536"
        height="1024"
      />
    </section>
    <section class="marketing-columns">
      <article>
        <h2>Get the project.</h2>
        <p>
          Download Lyra, install its dependencies, and configure a session
          secret and registration access code. Initialise the database before
          starting the server.
        </p>
      </article>
      <article>
        <h2>Connect a music folder.</h2>
        <p>
          In Settings, add a folder on the server and scan your music. Browse
          the albums and artist credits, then make a playlist for your first
          listen.
        </p>
      </article>
      <article>
        <h2>Enable local discovery.</h2>
        <p>
          Install the optional Python environments and download the models once.
          Open Explore to index your collection, search by meaning, and review
          recommendations.
        </p>
      </article>
    </section>
    <section class="requirements">
      <h2>What you need</h2>
      <dl>
        <div>
          <dt>Node.js 22.12+</dt>
          <dd>The application server.</dd>
        </div>
        <div>
          <dt>pnpm 10.12.1</dt>
          <dd>The project's package manager.</dd>
        </div>
        <div>
          <dt>FFmpeg</dt>
          <dd>Audio decoding and conversion.</dd>
        </div>
        <div>
          <dt>Python 3.12</dt>
          <dd>
            Optional local models. EmbeddingGemma 2 weights need about 1.53 GB;
            allow additional space for dependencies and Whistle.
          </dd>
        </div>
      </dl>
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
useSeoMeta({
  title: "Self-host — Lyra",
  description:
    "Run Lyra on your own server and connect your personal music collection.",
});
</script>
<style scoped>
.marketing-hero h1 {
  font-size: clamp(3rem, 4.8vw, 4.8rem);
}
.marketing-hero > img {
  min-height: 340px;
  max-height: 420px;
}
.requirements {
  border-top: 1px solid var(--rule);
  padding: 2rem 0;
}
.requirements h2 {
  margin: 0 0 1.5rem;
}
.requirements dl {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 2rem;
}
.requirements dt {
  font-weight: 600;
}
.requirements dd {
  margin: 0.5rem 0 0;
  color: var(--muted);
}
@media (max-width: 800px) {
  .requirements dl {
    grid-template-columns: 1fr 1fr;
  }
  .marketing-hero > img {
    min-height: 0;
  }
}
@media (max-width: 480px) {
  .requirements dl {
    grid-template-columns: 1fr;
  }
}
</style>
