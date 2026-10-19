<template>
  <MarketingShell>
    <section class="lp-hero lp-hero--home lp-acid lp-gutter">
      <div class="lp-hero-copy">
        <h1>Own your<br />frequency.</h1>
        <p>Your collection. Your station.<br />A new way to get lost in the music you keep.</p>
        <div class="lp-actions">
          <NuxtLink to="/register" class="lp-button">Create an account <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></NuxtLink>
          <a href="#how-it-works" class="lp-text-link">See how it works</a>
        </div>
      </div>
      <ResponsiveArtwork class="lp-hero-art" name="rooftop-dj" alt="An original anime DJ in orange headphones sitting on a graffiti-covered rooftop speaker" sizes="(max-width: 700px) 100vw, (min-width: 1920px) 1920px, 100vw" priority />
    </section>
    <section class="home-promise lp-dark lp-gutter" aria-label="A home for your music">
      <div><Icon name="material-symbols:album-outline" aria-hidden="true" /><p><strong>Your music</strong><span>Albums, artists and playlists.</span></p></div>
      <div><Icon name="material-symbols:equalizer" aria-hidden="true" /><p><strong>Your station</strong><span>Built from your library.</span></p></div>
      <div><Icon name="material-symbols:explore-outline" aria-hidden="true" /><p><strong>Your next discovery</strong><span>Follow a new connection.</span></p></div>
    </section>
    <section class="lp-section lp-split lp-gutter home-collection">
      <div class="lp-copy">
        <h2>The records you kept.<br />The station you make.</h2>
        <p>Turn the music you already own into personal radio. Start from artists and genres, and let Lyra build a queue that fits.</p>
        <NuxtLink to="/features" class="lp-text-link">Explore the features <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink>
      </div>
      <MarketingCollectionPreview stations />
    </section>
    <section class="lp-section lp-split lp-gutter lp-dark">
      <div class="lp-copy">
        <h2>Find the track<br />you can’t name.</h2>
        <p>Search your library in your own words. Local EmbeddingGemma connects your description with track metadata and, when available, lyrics.</p>
        <NuxtLink to="/explore" class="lp-text-link">Try a search <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink>
      </div>
      <MarketingSearchPreview />
    </section>
    <section class="lp-section lp-split lp-gutter lp-orange">
      <div class="lp-copy">
        <h2>Keep the<br />words close.</h2>
        <p>Generate timed lyrics on your own machine with Whistle. Follow along, correct a word, or adjust a line until it feels right.</p>
        <NuxtLink to="/features#lyrics" class="lp-text-link">A closer look at lyrics <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink>
      </div>
      <MarketingPlayerPreview />
    </section>
    <section class="home-daily lp-blue lp-gutter">
      <div class="home-daily-icon" aria-hidden="true"><Icon name="material-symbols:history" /></div>
      <h2>A fresh route through<br />your collection, every day.</h2>
      <p>Recommendations refresh every 24 hours while the worker runs, using recent recorded plays and connections in your indexed library.</p>
    </section>
    <section id="how-it-works" class="home-steps lp-section lp-gutter">
      <div><h2>From folder<br />to first play.</h2><p>A home for your music, running on your own server.</p><NuxtLink to="/self-host" class="lp-text-link">Self-host setup guide <Icon name="material-symbols:arrow-forward" aria-hidden="true" /></NuxtLink></div>
      <ol>
        <li><span>01</span><h3>Connect<br />your music</h3><p>Add a music folder on the server and run a scan. Lyra reads your files and builds your library.</p></li>
        <li><span>02</span><h3>Make it<br />your own</h3><p>Collect albums into playlists. Seed a station with your favorite artists and genres.</p></li>
        <li><span>03</span><h3>Press play</h3><p>Settle into a record, follow the queue, or find a new connection in the music you keep.</p></li>
      </ol>
    </section>
    <MarketingFaq id="home-questions" :items="questions" />
    <section class="home-cta lp-acid lp-gutter lp-section">
      <h2>Good music.<br />Your rules.</h2><p>Bring your collection.<br />Find your frequency.</p>
      <NuxtLink to="/register" class="lp-button">Create an account <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></NuxtLink>
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
definePageMeta({ layout: false });
useSeoMeta({ title: 'Lyra Radio — Own your frequency', description: 'A personal music library with street-radio energy. Browse your albums, build stations, explore local search and keep the words close.' });
const questions = [
 { question: 'Is this an online radio broadcast?', answer: 'Lyra builds personal radio queues from music in your library. Your stations play matching tracks on this server; they are not FM or public internet broadcasts.' },
 { question: 'Do I need an API key?', answer: 'Core library playback and the optional local Whistle and EmbeddingGemma models do not need an API key. Download the models once before using local lyrics and semantic search. Optional external integrations have their own requirements.' },
 { question: 'Can I use music I already own?', answer: 'Yes. Add a folder of music files that you have the right to use. The scan worker reads metadata and builds the library. Lyra does not include a commercial streaming catalogue.' },
];
</script>
<style scoped>
.home-promise { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); padding-block: clamp(1.5rem, 3vw, 3.5rem); }
.home-promise > div { display: flex; gap: 1.5rem; align-items: center; min-width: 0; }
.home-promise > div + div { border-left: 1px solid #686d74; padding-left: 2rem; }
.home-promise .iconify { width: 3.5rem; height: 3.5rem; flex-shrink: 0; color: var(--acid); }
.home-promise p { margin: 0; }
.home-promise strong { color: var(--acid); font-family: var(--font-display); font-size: clamp(1.6rem, 2vw, 2.4rem); line-height: 1.1; }
.home-promise p > span { display: block; font-size: clamp(.875rem, 1vw, 1.1875rem); margin-top: .5rem; }
.home-collection { grid-template-columns: minmax(0,.7fr) minmax(0,1.3fr); }
.home-daily { display: grid; grid-template-columns: .25fr 1fr 1fr; align-items: center; gap: 2rem; padding-block: 2.5rem; }
.home-daily-icon .iconify { width: 7rem; height: 7rem; }
.home-daily h2 { font-size: clamp(2rem, 3vw, 3.6rem); }
.home-daily p { border-left: 1px solid #9da8fa; padding-left: 2rem; margin: 0; }
.home-steps { display: grid; grid-template-columns: .85fr 2.15fr; gap: 3rem; }
.home-steps > div p { max-width: 25ch; }
.home-steps h2 { font-size: clamp(2.5rem, 3.8vw, 4.5rem); }
.home-steps ol { list-style: none; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin: 0; padding: 0; }
.home-steps li { border-left: 1px solid var(--ink); padding-inline: 1.75rem; }
.home-steps li:last-child { padding-right: 0; }
.home-steps li > span { display: block; font: 700 clamp(2rem, 3vw, 3.5rem)/1 var(--font-display); margin-bottom: 1rem; }
.home-steps li p { font-size: clamp(.9375rem, 1.05vw, 1.25rem); }
.home-cta { display: grid; grid-template-columns: 1.2fr 1fr auto; align-items: center; gap: 3rem; }
.home-cta h2 { font-weight: 800; text-transform: uppercase; font-size: clamp(3rem,5vw,6rem); }
.home-cta p { margin: 0; border-left: 1px solid var(--ink); padding-left: 2.5rem; }
@media(max-width: 1100px) { .home-promise .iconify { width: 2.5rem; height: 2.5rem; } .home-promise > div { gap: .75rem; } .home-promise > div + div { padding-left: 1rem; } .home-steps { grid-template-columns: minmax(0,1fr); } .home-steps ol li:first-child { padding-left: 0; border-left: 0; } .home-cta { grid-template-columns: 1fr 1fr; } .home-cta .lp-button { grid-column: 2; } .home-daily { grid-template-columns: 1fr 1fr; } .home-daily-icon { display: none; } }
@media(max-width: 700px) { .home-promise { grid-template-columns: minmax(0,1fr); gap: 1.25rem; } .home-promise > div + div { padding: 1.25rem 0 0; border-left: 0; border-top: 1px solid #686d74; } .home-promise .iconify { width: 2.5rem; height: 2.5rem; } .home-collection, .home-daily { grid-template-columns: minmax(0,1fr); } .home-daily p { padding: 0; border: 0; } .home-steps ol { grid-template-columns: minmax(0,1fr); gap: 2rem; } .home-steps li, .home-steps ol li:first-child { padding: 1.5rem 0 0; border-left: 0; border-top: 1px solid var(--rule); } .home-steps li h3 br { display: none; } .home-steps li > span { float: left; margin-right: 1rem; } .home-steps li p { clear: both; } .home-cta { grid-template-columns: minmax(0,1fr); gap: 1.5rem; } .home-cta p { padding: 0; border: 0; } .home-cta .lp-button { grid-column: auto; } }
</style>
