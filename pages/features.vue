<template>
  <MarketingShell>
    <section class="marketing-title">
      <h1>More ways to get lost<br />in your music.</h1>
      <p>
        A thoughtful home for your albums and playlists, with local semantic
        discovery to help you choose what to play next.
      </p>
      <NuxtLink to="/library" class="btn btn-primary"
        >Open your library</NuxtLink
      >
    </section>
    <section class="feature-album">
      <img
        src="/images/lyra-radio/rooftop-dj.webp"
        alt="An anime radio DJ on a graffiti-covered rooftop speaker"
        width="1536"
        height="1024"
      />
      <div>
        <h2>Album-first<br />listening.</h2>
        <p>
          Start with the records you know. Browse cover art, follow artist
          credits, and build playlists that belong to you.
        </p>
      </div>
    </section>
    <section class="feature-row">
      <h2>Search by<br />what you mean.</h2>
      <p>
        Describe what you are looking for. Once indexed, your collection can be
        searched using EmbeddingGemma representations of track metadata and
        available lyrics. Results depend on that information; the search does
        not analyse the sound of a recording.
      </p>
    </section>
    <section class="feature-row">
      <h2>Find a new<br />connection.</h2>
      <p>
        Explore related tracks and recommendations shaped by your listening
        history. Review suggested tags with their source and similarity score.
        Suggestions stay separate from your saved metadata.
      </p>
    </section>
    <section class="feature-row">
      <h2>Keep the<br />words close.</h2>
      <p>
        Read, edit, and generate timed lyrics with local Whistle transcription.
        Review generated words before relying on them: music and singing can be
        harder to recognise than speech.
      </p>
    </section>
    <section class="marketing-cta">
      <h2>Your music. Your way.</h2>
      <p>
        Albums for a long afternoon. Playlists for the journey. Podcasts and
        personal radio stations for a change of pace.
      </p>
      <NuxtLink to="/library" class="btn btn-primary"
        >Open your library</NuxtLink
      >
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
useSeoMeta({
  title: "Features — Lyra",
  description:
    "Album-first listening, local semantic search, recommendations and editable lyrics for your own collection.",
});
</script>
<style scoped>
.feature-album {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 3rem;
  align-items: center;
  border-top: 1px solid var(--rule);
  padding: 2.5rem 0;
}
.feature-album img {
  width: 100%;
  aspect-ratio: 1.55;
  object-fit: cover;
  object-position: 73% center;
}
.feature-album h2 {
  font-size: clamp(2.7rem, 4.7vw, 4.5rem);
  margin: 0 0 1rem;
}
.feature-album p {
  color: var(--muted);
  max-width: 40ch;
}
@media (max-width: 700px) {
  .feature-album {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
}
</style>
