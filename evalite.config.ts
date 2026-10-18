import { defineConfig } from 'evalite/config';

export default defineConfig({
  // Every scorer reports whether its independently documented quality floor passed.
  // Requiring 100 prevents a strong search average masking a broken tag/recommendation.
  scoreThreshold: 100,
  maxConcurrency: 1,
  testTimeout: 300_000,
  hideTable: true,
});
