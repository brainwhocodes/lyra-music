// Server suites are isolated from Nuxt and external providers. Browser journeys
// boot the real application separately via playwright.config.ts.
export { default } from './vitest.node.config';
