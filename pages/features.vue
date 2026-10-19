<template>
  <MarketingShell class="features-marketing">
    <section class="features-opening lp-dark">
      <div class="lp-hero lp-hero--dark lp-gutter">
        <div class="lp-hero-copy">
          <h1>More ways<br />into your<br />music.</h1>
          <p>A proper home for the records you love.<br />Room for the next thing you’ll love.</p>
          <div class="lp-actions"><NuxtLink to="/library" class="lp-button lp-button-acid">Open your library <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></NuxtLink></div>
        </div>
        <ResponsiveArtwork class="lp-hero-art" name="platform-session" alt="An anime listener in orange headphones with a skateboard on a colorful train platform" sizes="(max-width: 700px) 100vw, 65vw" priority />
      </div>
      <div class="features-player lp-gutter"><MarketingPlayerPreview transport /></div>
    </section>
    <section class="lp-section lp-gutter lp-split features-albums">
      <div class="lp-copy"><h2>Start with a<br />whole record.</h2><p>Browse your albums, follow your favorite artists, and build playlists that belong to you. Everything begins with your own library.</p></div>
      <MarketingCollectionPreview />
    </section>
    <section class="lp-section lp-gutter lp-split lp-orange">
      <div class="lp-copy"><h2>Your artists.<br />Your station.</h2><p>Choose artists and genres to seed a personal radio queue. Lyra finds matching tracks from your library, so every station starts with your music.</p><NuxtLink to="/radio" class="lp-text-link">Find your station <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink></div>
      <figure class="features-stations">
        <div v-for="station in stations" :key="station.name" class="features-station">
          <ResponsiveArtwork :name="station.art" alt="" sizes="100px" />
          <div><h3>{{ station.name }}</h3><p><span v-for="genre in station.genres" :key="genre">{{ genre }}</span></p></div>
          <Icon name="material-symbols:radio-outline" aria-hidden="true" />
        </div>
        <figcaption class="lp-caption">Illustrative library · Station preview</figcaption>
      </figure>
    </section>
    <section class="lp-section lp-gutter lp-split lp-dark">
      <div class="lp-copy"><h2>Search for<br />the connection.</h2><p>Use the words you remember—or a description of what you want. Search draws on track metadata and available lyrics in your indexed collection.</p><p class="features-model-note"><Icon name="material-symbols:search" aria-hidden="true" /><span><strong>Local EmbeddingGemma</strong>Text search with your own data.</span></p><NuxtLink to="/explore" class="lp-text-link">Explore your collection <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink></div>
      <MarketingSearchPreview excerpts />
    </section>
    <section id="lyrics" class="lp-section lp-gutter lp-split">
      <div class="lp-copy"><h2>Keep the words.<br />Change the mistakes.</h2><p>Generate timed lyrics locally with Whistle, then edit the words and timing. Singing can be difficult to recognize; your corrections make the result yours.</p><NuxtLink to="/tracks" class="lp-text-link">Choose a track <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink></div>
      <MarketingPlayerPreview editor />
    </section>
    <section class="features-daily lp-section lp-gutter lp-blue">
      <div class="lp-copy"><h2>Every day,<br />a different way in.</h2><p>A background worker refreshes recommendations every 24 hours, building connections from your recent recorded plays and indexed track information.</p><p>New listening informs the next refresh. The list stays ready while you browse.</p></div>
      <div class="features-daily-clock" aria-hidden="true"><Icon name="material-symbols:history" /><span class="features-daily-label">24h</span></div>
      <ol>
        <li><Icon name="material-symbols:equalizer" aria-hidden="true" /><div><h3>Recent recorded plays</h3><p>Qualified plays and recency shape your listening profile.</p></div></li>
        <li><Icon name="material-symbols:search" aria-hidden="true" /><div><h3>Related words and ideas</h3><p>Metadata and available lyrics connect one track to another.</p></div></li>
        <li><Icon name="material-symbols:album-outline" aria-hidden="true" /><div><h3>Room for another album</h3><p>A first pass favors other albums before filling the list.</p></div></li>
      </ol>
    </section>
    <section class="features-tools lp-section lp-gutter">
      <h2>Tools for<br />the way you listen.</h2>
      <dl>
        <div><dt><Icon name="material-symbols:queue-music" aria-hidden="true" />Queue your next track</dt><dd>Add another song, reorder the queue, or let your station continue.</dd></div>
        <div><dt><Icon name="material-symbols:playlist-play" aria-hidden="true" />Playlists for every detour</dt><dd>Create and edit playlists from the music in your library.</dd></div>
        <div><dt><Icon name="material-symbols:podcasts" aria-hidden="true" />Podcasts in the same player</dt><dd>Follow a feed and move between episodes and your collection.</dd></div>
        <div><dt><Icon name="material-symbols:label-outline" aria-hidden="true" />Review suggested tags</dt><dd>Inspect suggestions and their sources. Suggestions stay separate from saved metadata.</dd></div>
      </dl>
    </section>
    <MarketingFaq id="feature-questions" :items="questions" />
    <section class="features-cta lp-section lp-gutter lp-acid">
      <h2>Give your collection<br />another listen.</h2>
      <div><p>A personal music library with street-radio energy.<br />All from your own files, on your own server.</p><NuxtLink to="/library" class="lp-button">Open your library <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></NuxtLink></div>
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
definePageMeta({ layout: false });
useSeoMeta({ title: 'Features — Lyra Radio', description: 'Album-first listening, artist and genre radio, local semantic search, daily recommendations and editable timed lyrics for your own collection.' });
const stations = [
 { name: 'City Drift Radio', art: 'landing-midnight-signals' as const, genres: ['synthwave', 'indie', 'electronic'] },
 { name: 'Indie favourites', art: 'landing-stray-light' as const, genres: ['indie rock', 'dream pop', 'alternative'] },
];
const questions = [
 { question: 'Does search listen to the audio?', answer: 'No. EmbeddingGemma represents track metadata and available lyrics as text embeddings. It does not analyze a recording’s sound or measure its acoustic mood. Better metadata gives search more useful information.' },
 { question: 'Are generated lyrics always correct?', answer: 'No. Whistle works locally and provides word timing, but singing, effects and background instruments can cause mistakes. Review and edit the generated transcript before relying on it.' },
 { question: 'When do recommendations update?', answer: 'The separate worker checks for due accounts and refreshes saved recommendations every 24 hours. If the worker or computer is off, it catches up after restarting. Indexing new tracks can make a refresh due sooner. Until personalization is ready, you can browse recently added tracks.' },
];
</script>
<style scoped>
.features-opening .lp-hero { min-height: clamp(34rem, 47vw, 56rem); }
.features-opening .lp-hero-copy { padding-bottom: 7rem; }
.features-player { position: relative; margin-top: -5rem; padding-bottom: 2rem; }
.features-albums { grid-template-columns: .7fr 1.3fr; }
.features-stations { margin: 0; }
.features-station { display: flex; flex-wrap: wrap; gap: 1.2rem; align-items: center; border: 2px solid var(--ink); padding: 1.2rem; margin-bottom: 1rem; }
.features-station .responsive-artwork { width: clamp(4rem,6vw,7rem); aspect-ratio: 1; flex-shrink: 0; }
.features-station > div { flex: 1 1 10rem; min-width: 0; }
.features-station h3 { font-size: clamp(1.5rem,2vw,2.4rem); }
.features-station p { display: flex; gap: .4rem; flex-wrap: wrap; margin: .6rem 0 0; }
.features-station p span { border: 1px solid var(--ink); padding: .15rem .45rem; font-size: .875rem; }
.features-station > .iconify { width: 2.25rem; height: 2.25rem; flex-shrink: 0; }
.features-model-note { display: flex; align-items: center; gap: 1rem; border-left: 3px solid var(--acid); padding-left: 1rem; }
.features-model-note .iconify { width: 2rem; height: 2rem; flex-shrink: 0; }
.features-model-note > span { font-size: .875rem; }
.features-model-note strong { display: block; font-size: 1rem; }
.features-daily { display: grid; grid-template-columns: 1.1fr .65fr 1fr; gap: 3rem; align-items: center; }
.features-daily h2 { font-size: clamp(2.6rem,3.8vw,4.5rem); }
.features-daily-clock { aspect-ratio: .85; background: var(--ink); border: 3px solid var(--paper); box-shadow: 10px 10px 0 var(--orange); display: flex; align-items: center; justify-content: center; position: relative; transform: rotate(-4deg); }
.features-daily-clock .iconify { position: absolute; width: 90%; height: 90%; color: var(--acid); opacity: .65; }
.features-daily-label { font: 800 clamp(3rem,5vw,6rem)/1 var(--font-display); background: var(--ink); position: relative; padding: .25rem; }
.features-daily ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 2rem; }
.features-daily li { display: flex; align-items: flex-start; gap: 1rem; }
.features-daily li > .iconify { width: 2.5rem; height: 2.5rem; color: var(--acid); flex-shrink: 0; }
.features-daily li h3 { font-family: var(--font-body); font-size: clamp(1rem,1.15vw,1.375rem); line-height: 1.3; letter-spacing: 0; }
.features-daily li p { font-size: clamp(.9375rem,1vw,1.1875rem); margin-top: .4rem; }
.features-tools { display: grid; grid-template-columns: .7fr 1.3fr; gap: 3rem; }
.features-tools dl { margin: 0; }
.features-tools dl > div { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); align-items: start; gap: 1.5rem; padding: 1rem 0; border-bottom: 1px solid var(--rule); }
.features-tools dl > div:first-child { padding-top: 0; }
.features-tools dt { display: flex; align-items: center; gap: .85rem; font-size: clamp(1rem,1.15vw,1.375rem); font-weight: 600; }
.features-tools dt .iconify { width: 1.7rem; height: 1.7rem; flex-shrink: 0; }
.features-tools dd { margin: 0; font-size: clamp(.9375rem,1.05vw,1.25rem); }
.features-cta { display: grid; grid-template-columns: 1.2fr 1fr; gap: 4rem; align-items: center; }
.features-cta h2 { text-transform: uppercase; font-weight: 800; }
.features-cta p { margin: 0 0 1.5rem; }
@media(max-width: 1100px) { .features-daily { grid-template-columns: 1.15fr 1fr; } .features-daily-clock { display: none; } .features-tools dl > div { grid-template-columns: minmax(0,1fr); gap: .5rem; } }
@media(max-width: 700px) { .features-opening .lp-hero { min-height: 0; } .features-opening .lp-hero-copy { padding-bottom: 2.5rem; } .features-player { margin-top: 0; padding-top: 1.5rem; } .features-albums, .features-daily, .features-tools, .features-cta { grid-template-columns: minmax(0,1fr); } .features-station { gap: .75rem; padding: clamp(.5rem,2.5vw,.85rem); } .features-station > .iconify { display: none; } .features-daily ol { margin-top: 1rem; } .features-cta { gap: 1.5rem; } }
</style>
