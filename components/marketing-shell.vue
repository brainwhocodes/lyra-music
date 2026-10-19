<template>
  <div class="marketing-shell">
    <a class="marketing-skip" href="#marketing-content">Skip to content</a>
    <header class="marketing-header lp-gutter">
      <LyraBrand />
      <nav aria-label="Public navigation">
        <NuxtLink to="/features">Features</NuxtLink>
        <NuxtLink to="/self-host">Self-host</NuxtLink>
        <NuxtLink to="/login">Log in</NuxtLink>
      </nav>
    </header>
    <main id="marketing-content" tabindex="-1"><slot /></main>
    <footer class="marketing-footer lp-gutter">
      <LyraBrand />
      <p>Your collection. Your frequency.</p>
      <nav aria-label="Footer navigation">
        <NuxtLink to="/features">Features</NuxtLink>
        <NuxtLink to="/self-host">Self-host</NuxtLink>
        <a href="https://github.com/brainwhocodes/lyra-music">GitHub</a>
      </nav>
    </footer>
  </div>
</template>
<style>
.marketing-shell { --lp-gutter: clamp(1.25rem, 5vw, 6rem); --lp-space: clamp(3rem, 5.5vw, 6.5rem); max-width: 1920px; margin-inline: auto; color: var(--ink); background: var(--paper); font-size: clamp(1rem, 1.2vw, 1.4375rem); line-height: 1.55; overflow-wrap: anywhere; }
.marketing-shell.features-marketing, .marketing-shell.host-marketing { --lp-space: clamp(3rem, 3.4vw, 4rem); }
.marketing-shell :where(section, article, figure, ol, dl, li, dt, dd, .lp-faq-list, .lp-copy) { min-width: 0; }
.marketing-shell .lp-gutter { padding-inline: var(--lp-gutter); }
.marketing-shell h1, .marketing-shell h2, .marketing-shell h3 { margin: 0; overflow-wrap: anywhere; }
.marketing-shell h2 { font-size: clamp(2.5rem, 4.25vw, 5.125rem); line-height: 1.02; letter-spacing: -.025em; }
.marketing-shell h3 { font-size: clamp(1.6rem, 2.2vw, 2.65rem); line-height: 1.1; }
.marketing-shell p { margin: 1.2rem 0 0; }
.marketing-shell a { text-underline-offset: .24em; }
.marketing-shell a:focus-visible, .marketing-shell summary:focus-visible { outline: 3px solid var(--blue); outline-offset: 5px; }
.marketing-shell .lp-dark a:focus-visible, .marketing-shell .lp-blue a:focus-visible { outline-color: var(--acid); }
.marketing-header, .marketing-footer { display: flex; align-items: center; justify-content: space-between; gap: 2rem; min-height: clamp(5rem, 6vw, 7.2rem); }
.marketing-header { border-bottom: 1px solid var(--rule); }
.marketing-header nav, .marketing-footer nav { display: flex; align-items: center; gap: clamp(1rem, 2vw, 2.5rem); flex-wrap: wrap; }
.marketing-header nav a, .marketing-footer nav a { display: inline-flex; align-items: center; min-height: 44px; color: var(--ink); text-decoration: none; font-size: clamp(.875rem, 1vw, 1.1875rem); }
.marketing-header nav a:hover, .marketing-footer nav a:hover, .marketing-header nav .router-link-active { text-decoration: underline; }
.marketing-header .lyra-brand, .marketing-footer .lyra-brand { width: clamp(7rem, 11vw, 12rem); max-width: none; flex-shrink: 0; }
.marketing-header .lyra-brand img, .marketing-footer .lyra-brand img { width: 100%; height: auto; }
.marketing-footer { padding-block: 2rem; border-top: 1px solid var(--rule); }
.marketing-footer p { font-size: .875rem; margin: 0; }
.marketing-skip { position: fixed; top: 1rem; left: 1rem; transform: translateY(-180%); z-index: 100; background: var(--ink); color: white; padding: .75rem 1rem; }
.marketing-skip:focus { transform: translateY(0); }
.marketing-shell .lp-section { padding-block: var(--lp-space); }
.marketing-shell .lp-split { display: grid; grid-template-columns: minmax(0, .85fr) minmax(0, 1.15fr); gap: clamp(2rem, 5vw, 6rem); align-items: center; }
.marketing-shell .lp-copy { min-width: 0; }
.marketing-shell .lp-copy p { max-width: 42ch; }
.marketing-shell .lp-dark { background: var(--ink); color: var(--paper); }
.marketing-shell .lp-orange { background: var(--orange); }
.marketing-shell .lp-blue { background: var(--blue); color: white; }
.marketing-shell .lp-acid { background: var(--acid); }
.marketing-shell .lp-actions { display: flex; gap: 1rem 1.5rem; flex-wrap: wrap; align-items: center; margin-top: 2rem; }
.marketing-shell .lp-button { display: inline-flex; align-items: center; justify-content: center; gap: 1.5rem; min-height: 3.5rem; width: fit-content; max-width: 100%; padding: .85rem 1.25rem; font-size: clamp(.875rem, 1.05vw, 1.25rem); line-height: 1.4; font-weight: 700; text-decoration: none; color: var(--paper); background: var(--ink); border: 2px solid var(--ink); text-align: left; }
.marketing-shell .lp-button .iconify { flex-shrink: 0; width: 1.35rem; height: 1.35rem; }
.marketing-shell .lp-button:hover { box-shadow: 5px 5px 0 var(--orange); }
.marketing-shell .lp-button-acid { background: var(--acid); color: var(--ink); }
.marketing-shell .lp-button-outline { background: transparent; color: inherit; border-color: currentColor; }
.marketing-shell .lp-text-link { display: inline-flex; align-items: center; gap: .65rem; color: inherit; font-weight: 600; text-decoration: underline; min-height: 44px; max-width: 100%; margin-top: 1.5rem; }
.marketing-shell .lp-text-link .iconify { flex-shrink: 0; }
.marketing-shell .lp-dark .lp-text-link { color: var(--acid); }
.marketing-shell .lp-caption { font-size: .875rem; margin-top: .75rem; text-align: right; }
.marketing-shell .lp-hero { position: relative; isolation: isolate; min-height: clamp(37rem, 53vw, 63.5rem); display: grid; align-items: center; overflow: clip; }
.marketing-shell .lp-hero-art { position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%; object-position: center; }
.marketing-shell .lp-hero-copy { width: 48%; align-self: stretch; display: flex; flex-direction: column; justify-content: center; padding: clamp(2rem, 4vw, 5rem) 0; }
.marketing-shell .lp-hero h1 { font-size: clamp(4rem, 8.4vw, 10rem); line-height: .93; letter-spacing: -.025em; font-weight: 800; text-transform: uppercase; }
.marketing-shell .lp-hero-copy > p { max-width: 34ch; font-size: clamp(1rem, 1.5vw, 1.75rem); }
.marketing-shell .lp-hero-copy .lp-actions { align-items: flex-start; }
.marketing-shell .lp-hero-copy .lp-text-link { margin-top: .5rem; }
.marketing-shell .lp-hero--home .lp-hero-copy h1, .marketing-shell .lp-hero--home .lp-hero-copy > p { background: var(--acid); box-shadow: 1rem 0 var(--acid); }
.marketing-shell .lp-hero--home .lp-hero-copy { padding-bottom: 10%; }
.marketing-shell .lp-hero--home .lp-hero-art { object-position: center top; }
.marketing-shell .lp-hero--dark { background: var(--ink); color: var(--paper); }
.marketing-shell .lp-hero--dark .lp-hero-art, .marketing-shell .lp-hero--host .lp-hero-art { left: 35%; width: 65%; object-position: 64% center; }
.marketing-shell .lp-hero--dark .lp-hero-copy { background: var(--ink); padding-right: 1.25rem; }
.marketing-shell .lp-hero--host { background: var(--acid); }
.marketing-shell .lp-hero--host .lp-hero-copy { background: var(--acid); padding-right: 1.25rem; }
.marketing-shell .lp-hero--host h1 { font-size: clamp(4rem, 7.8vw, 9.4rem); }
.marketing-shell .lp-hero--host { min-height: clamp(33rem, 45vw, 54rem); }
@media (max-width: 1000px) {
 .marketing-shell .lp-split { gap: 2rem; }
 .marketing-footer p { display: none; }
 .marketing-shell .lp-hero-copy { width: 51%; }
 .marketing-shell .lp-hero h1 { font-size: clamp(3.5rem, 8.4vw, 6rem); }
}
@media (max-width: 700px) {
 .marketing-shell .lp-split { grid-template-columns: minmax(0, 1fr); gap: 2rem; }
 .marketing-shell .lp-hero { display: flex; flex-direction: column; align-items: stretch; min-height: 0; padding-inline: 0; overflow: visible; }
 .marketing-shell .lp-hero-copy, .marketing-shell .lp-hero--home .lp-hero-copy { width: 100%; padding: 2.5rem var(--lp-gutter); }
 .marketing-shell .lp-hero h1 { font-size: clamp(3.75rem, 12vw, 6rem); }
 .marketing-shell .lp-hero-copy > p { max-width: 42ch; }
 .marketing-shell .lp-hero-art, .marketing-shell .lp-hero--dark .lp-hero-art, .marketing-shell .lp-hero--host .lp-hero-art { position: relative; inset: auto; z-index: 0; width: 100%; height: auto; aspect-ratio: 1.5; object-position: center; }
 .marketing-shell .lp-hero--home .lp-hero-copy h1, .marketing-shell .lp-hero--home .lp-hero-copy > p { box-shadow: none; }
 .marketing-header, .marketing-footer { gap: .75rem; flex-wrap: wrap; padding-block: 1rem; }
 .marketing-header nav { gap: 1rem; }
 .marketing-footer { row-gap: 1rem; }
 .marketing-shell .lp-section { padding-block: 3rem; }
}
@media (max-width: 390px) {
 .marketing-header { justify-content: center; }
 .marketing-header .lyra-brand { width: 7rem; }
 .marketing-header nav { justify-content: center; width: 100%; }
 .marketing-shell .lp-hero h1 { font-size: 3.65rem; }
 .marketing-shell .lp-button { gap: .75rem; }
}
</style>
