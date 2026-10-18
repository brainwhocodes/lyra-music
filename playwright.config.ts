import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', testMatch: ['loading-states.spec.ts', 'radio-selection.spec.ts', 'audio-analysis.spec.ts', 'brand-journeys.spec.ts', 'text-scaling.spec.ts', 'local-library.spec.ts', 'responsive-routes.spec.ts', 'core-library.spec.ts', 'utility-journeys.spec.ts', 'player-states.spec.ts', 'shared-modals.spec.ts', ...(process.env.LYRA_EMBEDDING_E2E === '1' ? ['explore.spec.ts'] : [])], use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', testMatch: ['loading-states.spec.ts', 'radio-selection.spec.ts', 'audio-analysis.spec.ts', 'brand-journeys.spec.ts', 'local-library.spec.ts', 'responsive-routes.spec.ts', 'core-library.spec.ts', 'utility-journeys.spec.ts', 'player-states.spec.ts', 'shared-modals.spec.ts', ...(process.env.LYRA_EMBEDDING_E2E === '1' ? ['explore.spec.ts'] : [])], use: { ...devices['iPad Mini'], defaultBrowserType: 'chromium' } },
    { name: 'mobile', testMatch: ['loading-states.spec.ts', 'radio-selection.spec.ts', 'audio-analysis.spec.ts', 'brand-journeys.spec.ts', 'local-library.spec.ts', 'responsive-routes.spec.ts', 'core-library.spec.ts', 'utility-journeys.spec.ts', 'player-states.spec.ts', 'shared-modals.spec.ts', ...(process.env.LYRA_EMBEDDING_E2E === '1' ? ['explore.spec.ts'] : [])], use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    ...(process.env.LYRA_WHISTLE_E2E === '1' ? [{ name: 'whistle', testMatch: 'whistle-production.spec.ts', use: { ...devices['Desktop Chrome'] } }] : []),
  ],
  webServer: {
    command: 'node scripts/e2e-server.mjs',
    url: 'http://127.0.0.1:3100/login',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
