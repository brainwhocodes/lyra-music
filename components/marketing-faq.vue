<template>
  <section class="lp-faq lp-gutter lp-section" :aria-labelledby="`${id}-title`">
    <h2 :id="`${id}-title`">{{ title }}</h2>
    <div class="lp-faq-list">
      <details v-for="(item, index) in items" :key="item.question" :open="index === 0">
        <summary>{{ item.question }}<span class="lp-faq-sign" aria-hidden="true"></span></summary>
        <p>{{ item.answer }}</p>
      </details>
    </div>
  </section>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ id: string; title?: string; items: { question: string; answer: string }[] }>(), { title: 'A few good questions.' });
</script>
<style scoped>
.lp-faq { display: grid; grid-template-columns: .65fr 1.35fr; gap: 3rem; }
.lp-faq.lp-section { padding-block: clamp(2rem, 3vw, 3rem); }
.lp-faq h2 { font-size: clamp(2.25rem, 3.2vw, 3.8rem); }
.lp-faq-list { min-width: 0; }
details { border-top: 1px solid var(--rule); padding-block: 1.1rem; }
details:last-child { border-bottom: 1px solid var(--rule); }
summary { display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; list-style: none; min-height: 44px; font-weight: 600; font-size: clamp(1rem, 1.2vw, 1.4375rem); }
summary::-webkit-details-marker { display: none; }
.lp-faq-sign { width: 1rem; height: 1rem; position: relative; flex-shrink: 0; }
.lp-faq-sign::before, .lp-faq-sign::after { content: ''; position: absolute; inset: calc(50% - 1px) 0 auto; height: 2px; background: currentColor; }
.lp-faq-sign::after { transform: rotate(90deg); }
details[open] .lp-faq-sign::after { display: none; }
details p { max-width: 70ch; margin: .75rem 2.25rem .5rem 0; font-size: clamp(.9375rem, 1.1vw, 1.25rem); }
@media(max-width: 850px) { .lp-faq { grid-template-columns: minmax(0, 1fr); gap: 1.75rem; } }
</style>
