<template>
  <div class="marketing-shell">
    <header class="marketing-header">
      <LyraBrand />
      <nav aria-label="Public navigation">
        <NuxtLink to="/features">Features</NuxtLink
        ><NuxtLink to="/self-host">Self-host</NuxtLink
        ><NuxtLink to="/login">Log in</NuxtLink>
      </nav>
    </header>
    <slot />
    <footer class="marketing-footer">
      <LyraBrand />
      <nav aria-label="Footer navigation">
        <NuxtLink to="/features">Features</NuxtLink
        ><NuxtLink to="/self-host">Self-host</NuxtLink
        ><a href="https://github.com/brainwhocodes/lyra-music">GitHub</a>
      </nav>
    </footer>
  </div>
</template>
<style>
.marketing-shell {
  max-width: 1440px;
  margin: auto;
  padding: 0 clamp(1.25rem, 4.5vw, 4rem);
}
.marketing-header,
.marketing-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  border-bottom: 1px solid var(--rule);
  padding: 1rem 0;
}
.marketing-header nav,
.marketing-footer nav {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.marketing-header nav a,
.marketing-footer nav a {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--ink);
  text-decoration: none;
}
.marketing-header nav a:hover,
.marketing-footer nav a:hover {
  text-decoration: underline;
}
.marketing-header nav .router-link-active {
  color: var(--copper);
  text-decoration: underline;
}
.marketing-footer {
  border-bottom: 0;
  border-top: 1px solid var(--rule);
  margin-top: 3rem;
}
.marketing-footer .lyra-brand {
  font-size: 2rem;
}
.marketing-hero {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  gap: 3rem;
  align-items: center;
  padding: 3rem 0;
}
.marketing-hero h1 {
  font-size: clamp(3.3rem, 6.2vw, 6rem);
  margin: 0 0 1.5rem;
  line-height: 1.04;
  letter-spacing: -0.045em;
}
.marketing-hero p {
  max-width: 43ch;
  color: var(--muted);
  margin-bottom: 2rem;
}
.marketing-hero > img {
  width: 100%;
  height: 100%;
  min-height: 420px;
  max-height: 650px;
  object-fit: cover;
  object-position: 73% center;
}
.marketing-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}
.marketing-actions > a:not(.btn) {
  color: var(--ink);
  text-decoration: underline;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.marketing-columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2.5rem;
  border-top: 1px solid var(--rule);
  padding: 3rem 0;
}
.marketing-columns h2 {
  font-size: 2.3rem;
  margin: 0 0 1.25rem;
}
.marketing-columns p {
  color: var(--muted);
  margin: 0;
  line-height: 1.75;
}
.marketing-cta {
  text-align: center;
  border-top: 1px solid var(--rule);
  padding: 3rem 0 1rem;
}
.marketing-cta h2 {
  font-size: clamp(2rem, 4vw, 3.3rem);
  margin: 0 0 1rem;
}
.marketing-cta p {
  color: var(--muted);
  max-width: 65ch;
  margin: 0 auto 1.5rem;
}
.marketing-title {
  padding: 3rem 0 2rem;
  max-width: 70rem;
}
.marketing-title h1 {
  font-size: clamp(3rem, 6vw, 5.5rem);
  margin: 0 0 1.25rem;
}
.marketing-title p {
  max-width: 65ch;
  color: var(--muted);
  font-size: 1.125rem;
  margin-bottom: 1.5rem;
}
.feature-row {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 3rem;
  border-top: 1px solid var(--rule);
  padding: 2.5rem 0;
}
.feature-row h2 {
  margin: 0;
}
.feature-row p {
  margin: 0;
  color: var(--muted);
  max-width: 65ch;
}
.marketing-banner {
  width: 100%;
  height: 300px;
  object-fit: cover;
  object-position: center 52%;
}
.setup-step {
  display: grid;
  grid-template-columns: 3rem 1fr 1.2fr;
  gap: 2rem;
  border-bottom: 1px solid var(--rule);
  padding: 2rem 0;
}
.setup-step > span {
  font: 700 2.5rem var(--font-display);
  color: var(--copper);
}
.setup-step h2 {
  margin: 0;
  font-size: 2rem;
}
.setup-step p {
  margin: 0;
  color: var(--muted);
}
@media (max-width: 800px) {
  .marketing-hero {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .marketing-hero > img {
    height: 340px;
    min-height: 0;
    max-height: none;
  }
  .marketing-hero h1 {
    font-size: clamp(3rem, 10vw, 5rem);
  }
  .marketing-columns {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
  .marketing-columns article {
    border-bottom: 1px solid var(--rule);
    padding-bottom: 2rem;
  }
  .marketing-columns article:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }
  .feature-row {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  .setup-step {
    grid-template-columns: 2rem 1fr;
    gap: 1rem;
  }
  .setup-step p {
    grid-column: 2;
  }
  .marketing-banner {
    height: 220px;
  }
}
@media (max-width: 480px) {
  .marketing-header,
  .marketing-footer {
    flex-wrap: wrap;
    padding: 1.25rem 0;
    gap: 0.75rem;
  }
  .marketing-header nav,
  .marketing-footer nav {
    gap: 1.25rem;
  }
  .marketing-header .lyra-brand {
    font-size: 2.3rem;
  }
  .marketing-hero {
    padding-top: 2rem;
  }
  .marketing-hero > img {
    height: 270px;
  }
  .marketing-actions {
    gap: 1rem;
  }
  .marketing-title {
    padding-top: 2rem;
  }
}
</style>
