<template>
  <MarketingShell class="host-marketing">
    <section class="lp-hero lp-hero--host lp-gutter">
      <div class="lp-hero-copy">
        <h1>Your collection.<br />Your server.</h1>
        <p>Keep the music close. Run Lyra on your own machine and listen through your browser.</p>
        <div class="lp-actions"><a :href="setupUrl" class="lp-button">Read the setup guide <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></a><NuxtLink to="/login" class="lp-button lp-button-outline">Log in to this server</NuxtLink></div>
      </div>
      <ResponsiveArtwork class="lp-hero-art" name="record-room" alt="An anime listener in a city record room, choosing a sleeve beside turntables and speakers" sizes="(max-width: 700px) 100vw, 65vw" priority />
    </section>
    <section class="host-overview lp-section lp-gutter">
      <div class="host-intro"><h2>A home for<br />the music you own.</h2><p>Lyra organizes your local collection, builds a searchable database, and creates artist and genre radio queues. The app runs on your server. You listen through your browser.</p></div>
      <ol class="host-flow">
        <li><div class="host-flow-icon"><Icon name="material-symbols:folder-open-outline" aria-hidden="true" /></div><h3>Music folder</h3><p>Point Lyra at your existing folders. It reads music files and metadata.</p></li>
        <li><div class="host-flow-icon"><Icon name="material-symbols:dns-outline" aria-hidden="true" /></div><h3>Lyra + local database</h3><p>The server scans your library and stores your collection’s information.</p></li>
        <li><div class="host-flow-icon"><Icon name="material-symbols:devices-outline" aria-hidden="true" /></div><h3>Your browser</h3><p>Listen, search and build stations from a device that can reach your server.</p></li>
      </ol>
    </section>
    <section class="lp-section lp-gutter lp-split lp-dark">
      <div class="lp-copy"><h2>What you’ll need.</h2><p>These are the main requirements to run Lyra on your own machine. Optional models need additional disk space and memory.</p></div>
      <dl class="host-requirements">
        <div><dt>Node.js 22.12+</dt><dd>The application server. Node 24 has also been tested.</dd></div>
        <div><dt>pnpm 10.12.1</dt><dd>The project’s pinned package manager.</dd></div>
        <div><dt>FFmpeg</dt><dd>Audio decoding and conversion, available on PATH.</dd></div>
        <div><dt>Python 3.12 <span>(optional)</span></dt><dd>Local models. EmbeddingGemma artifacts take about 1.53 GB, plus space for dependencies and Whistle.</dd></div>
      </dl>
    </section>
    <section class="host-setup lp-section lp-gutter">
      <h2>Four steps to your first station.</h2>
      <ol>
        <li><span>01</span><h3>Get the project.</h3><p>Download Lyra and install its pinned dependencies. The setup guide includes the exact commands for a fresh checkout.</p></li>
        <li><span>02</span><h3>Configure your server.</h3><p>Set a private session secret and registration access code. Initialize the database, then start the app. Back up an existing installation before a migration.</p></li>
        <li><span>03</span><h3>Connect your music.</h3><p>In Settings, add a music folder on the server. Run the separate worker to process scans and build your album and artist library.</p></li>
        <li><span>04</span><h3>Start listening.</h3><p>Open Lyra, choose an album, and make your first station. Keep the worker running for queued scans and daily recommendation refreshes.</p></li>
      </ol>
      <div class="host-commands"><div><p>Initialize a fresh database</p><code>pnpm db:migrate</code></div><div><p>Run the separate worker</p><code>pnpm worker</code></div></div>
      <a :href="setupUrl" class="lp-text-link">Follow the complete setup guide <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></a>
    </section>
    <section class="host-models lp-section lp-gutter">
      <div class="lp-copy"><h2>Local intelligence.<br />Optional by design.</h2><p>Add timed lyrics, deeper search and connections in your collection with models that run on your own machine.</p><strong class="host-model-promise">Download once.<br />Run locally.<br />Review the results.</strong></div>
      <div class="host-model-cards">
        <article><Icon name="material-symbols:graphic-eq" aria-hidden="true" /><h3>Whistle</h3><h4>Timed lyric transcription</h4><p>Generates words and timestamps from audio. Review and edit the result in Lyra; singing and background instruments can cause mistakes.</p></article>
        <article><Icon name="material-symbols:hub-outline" aria-hidden="true" /><h3>EmbeddingGemma</h3><h4>Search, tags and recommendations</h4><p>Connects track metadata and available lyrics. Index your collection before semantic search. It does not analyze a recording’s acoustic mood.</p></article>
      </div>
      <a href="https://github.com/brainwhocodes/lyra-music/blob/codex/whistle-transcription-tests/docs/model-setup.md" class="lp-text-link host-model-guide">Read the local model guide <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></a>
    </section>
    <section class="host-notes lp-section lp-gutter">
      <h2>A few things worth knowing.</h2>
      <div><article><Icon name="material-symbols:database-outline" aria-hidden="true" /><h3>Keep your<br />library backed up.</h3><p>Keep your own backups of music files and the SQLite database. Store them on persistent storage.</p></article><article><Icon name="material-symbols:settings-outline" aria-hidden="true" /><h3>Run the worker<br />alongside the app.</h3><p>The worker handles queued scans and daily recommendation jobs. It catches up after a restart.</p></article><article><Icon name="material-symbols:group-outline" aria-hidden="true" /><h3>Share a server<br />with care.</h3><p>Accounts use the same server hardware and storage. Manage registration access and keep your installation maintained.</p></article></div>
    </section>
    <MarketingFaq id="hosting-questions" title="Before you press play." :items="questions" />
    <section class="host-cta lp-section lp-gutter lp-blue">
      <h2>Make room for<br />a proper listen.</h2><div><p>Your music. Your server.<br />Give your collection a home.</p><a :href="setupUrl" class="lp-button lp-button-acid">Read the setup guide <Icon name="material-symbols:arrow-outward" aria-hidden="true" /></a></div>
    </section>
  </MarketingShell>
</template>
<script setup lang="ts">
definePageMeta({ layout: false });
useSeoMeta({ title: 'Self-host — Lyra Radio', description: 'Run Lyra on your own server. Connect your music folder, start the background worker, and optionally add local Whistle and EmbeddingGemma models.' });
const setupUrl = 'https://github.com/brainwhocodes/lyra-music#quick-start';
const questions = [
 { question: 'Can I start without the AI models?', answer: 'Yes. Browse albums, play music, make playlists and create artist or genre radio stations without installing the local models. Add Whistle for generated lyrics and EmbeddingGemma for semantic search and related-track suggestions when you are ready.' },
 { question: 'Will everything run without an API key?', answer: 'Core local playback and the selected Whistle and EmbeddingGemma checkpoints do not require an API key. Initial installation downloads dependencies and model files. Optional integrations such as external metadata enrichment may need their own credentials.' },
 { question: 'What happens when the worker stops?', answer: 'The web app can still serve your existing library, but queued scans and recommendation refreshes wait. Start the worker again with the same database and filesystem access; it checks for overdue recommendations on startup.' },
 { question: 'Can I use my existing music folders?', answer: 'Yes. Add server-accessible folders in Settings and run a scan. Separate artist and album directories work best. Keep the music files available at their configured paths and maintain your own backups.' },
];
</script>
<style scoped>
.host-intro { display: grid; grid-template-columns: .85fr 1.15fr; gap: 4rem; align-items: start; }
.host-intro p { margin: 0; max-width: 60ch; }
.host-flow { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 5rem; padding: 0; margin: 4rem 0 0; list-style: none; text-align: center; }
.host-flow li { position: relative; }
.host-flow li + li::before { content: '→'; position: absolute; left: -3.5rem; top: 3rem; font-size: 3rem; line-height: 1; }
.host-flow-icon { display: flex; align-items: center; justify-content: center; width: 9rem; height: 8rem; margin: 0 auto 1.5rem; color: var(--blue); }
.host-flow-icon .iconify { width: 7rem; height: 7rem; filter: drop-shadow(5px 5px 0 var(--orange)); }
.host-flow li:nth-child(2) .host-flow-icon { color: var(--ink); }
.host-flow h3 { font-family: var(--font-body); font-size: clamp(1.15rem,1.5vw,1.75rem); font-weight: 700; letter-spacing: 0; }
.host-flow p { max-width: 32ch; margin-inline: auto; font-size: clamp(.9375rem,1.1vw,1.3rem); }
.host-requirements { margin: 0; border: 1px solid #9ca2ad; }
.host-requirements > div { display: grid; grid-template-columns: .8fr 1.2fr; }
.host-requirements > div + div { border-top: 1px solid #9ca2ad; }
.host-requirements dt, .host-requirements dd { padding: 1.4rem; font-size: clamp(.9375rem,1.1vw,1.3rem); }
.host-requirements dt { font-weight: 700; border-right: 1px solid #9ca2ad; }
.host-requirements dt span { display: block; font-weight: 400; }
.host-requirements dd { margin: 0; }
.host-setup ol { padding: 0; margin: 3rem 0 1.5rem; list-style: none; }
.host-setup li { display: grid; grid-template-columns: .15fr .75fr 1.1fr; gap: 1.5rem; align-items: start; padding-block: 1.25rem; border-bottom: 1px solid var(--rule); }
.host-setup li > span { font: 800 clamp(2.5rem,3.5vw,4.2rem)/1 var(--font-display); color: var(--blue); }
.host-setup li h3 { font-size: clamp(1.8rem,2.5vw,3rem); }
.host-setup li p { margin: 0; font-size: clamp(.9375rem,1.1vw,1.3rem); }
.host-commands { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
.host-commands > div { border: 1px solid var(--rule); padding: 1rem 1.25rem; }
.host-commands p { margin: 0 0 .75rem; font-size: .875rem; }
.host-commands code { display: block; font: .9375rem/1.5 monospace; color: var(--ink); background: #e4e7ec; padding: .75rem; overflow-wrap: anywhere; }
.host-models { display: grid; grid-template-columns: .85fr 1.15fr; gap: 2.5rem 4rem; background: linear-gradient(112deg,var(--orange) 0 43%,var(--blue) 43% 100%); }
.host-models h2 { font-size: clamp(2.5rem,3.8vw,4.5rem); }
.host-model-promise { display: block; margin-top: 1.75rem; padding-top: 1rem; border-top: 1px solid var(--ink); font: 700 clamp(1.7rem,2.5vw,3rem)/1.1 var(--font-display); }
.host-model-cards { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1.5rem; align-items: stretch; }
.host-model-cards article { background: var(--paper); color: var(--ink); border: 2px solid var(--ink); padding: clamp(1.25rem,2vw,2.4rem); }
.host-model-cards article > .iconify { width: 5rem; height: 5rem; margin-bottom: 1rem; color: var(--blue); }
.host-model-cards article:first-child > .iconify { background: var(--acid); color: var(--ink); padding: .5rem; }
.host-model-cards h3 { font-size: clamp(1.8rem,2.2vw,2.6rem); overflow-wrap: anywhere; }
.host-model-cards h4 { font: 700 clamp(.9375rem,1.05vw,1.25rem)/1.4 var(--font-body); margin: .75rem 0 0; }
.host-model-cards p { font-size: clamp(.9375rem,1.05vw,1.25rem); }
.host-model-guide { color: white !important; grid-column: 2; margin: 0 !important; justify-self: start; }
.host-model-guide:focus-visible { outline-color: var(--acid) !important; }
.host-notes h2 { font-size: clamp(2.5rem,3.25vw,3.9rem); }
.host-notes > div { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 2rem; margin-top: 2.5rem; }
.host-notes article { position: relative; padding-left: 4rem; }
.host-notes article + article { border-left: 1px solid var(--rule); padding-left: 5rem; }
.host-notes article > .iconify { position: absolute; left: 0; top: 0; width: 2.5rem; height: 2.5rem; }
.host-notes article + article > .iconify { left: 1rem; }
.host-notes h3 { font-size: clamp(1.6rem,2vw,2.4rem); }
.host-notes p { font-size: clamp(.9375rem,1.05vw,1.25rem); }
.host-cta { display: grid; grid-template-columns: 1.2fr 1fr; align-items: center; gap: 4rem; }
.host-cta h2 { font-weight: 800; text-transform: uppercase; font-size: clamp(3rem,5vw,6rem); }
.host-cta p { margin: 0 0 1.5rem; }
@media(max-width: 1050px) { .host-models { grid-template-columns: minmax(0,1fr); background: var(--orange); } .host-model-cards { background: var(--blue); padding: 1.5rem; margin-inline: -1.5rem; } .host-model-guide { grid-column: 1; color: var(--ink) !important; } .host-model-guide:focus-visible { outline-color: var(--blue) !important; } .host-notes article, .host-notes article + article { padding-left: 0; border-left: 0; } .host-notes article > .iconify, .host-notes article + article > .iconify { position: static; margin-bottom: 1rem; } }
@media(max-width: 700px) { .host-intro, .host-flow, .host-cta { grid-template-columns: minmax(0,1fr); gap: 2rem; } .host-flow { margin-top: 2rem; } .host-flow li + li::before { content: ''; } .host-flow li + li { padding-top: 2rem; border-top: 1px solid var(--rule); } .host-flow-icon { width: 7rem; height: 6rem; margin-bottom: 1rem; } .host-flow-icon .iconify { width: 5rem; height: 5rem; } .host-setup li { grid-template-columns: 3rem 1fr; gap: 1rem; } .host-setup li p { grid-column: 2; } .host-commands, .host-notes > div { grid-template-columns: minmax(0,1fr); } .host-notes article + article { padding-top: 1.5rem; border-top: 1px solid var(--rule); } .host-requirements dt, .host-requirements dd { padding: 1rem; } .host-model-cards { padding: 1.25rem; margin-inline: -1.25rem; } }
@media(max-width: 500px) { .host-model-cards { grid-template-columns: minmax(0,1fr); } .host-requirements > div { grid-template-columns: minmax(0,1fr); } .host-requirements dt { border-right: 0; padding-bottom: .35rem; } .host-requirements dd { padding-top: .35rem; } .host-requirements dt span { display: inline; } .host-setup li { grid-template-columns: auto minmax(0,1fr); } .host-setup li p { grid-column: 1/-1; } }
</style>
