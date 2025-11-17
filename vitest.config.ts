import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'
export default defineVitestConfig({
  test: {
    globals: true,
    environment: 'nuxt',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.nuxt/**',
        'coverage/**',
        '**/*.d.ts',
        '**/*.config.ts',
        '**/types/**'
      ]
    }
  },
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('.', import.meta.url)),
      '#app': fileURLToPath(new URL('./node_modules/nuxt/dist/app', import.meta.url))
    }
  }
})
