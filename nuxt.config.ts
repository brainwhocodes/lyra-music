// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: {
    enabled: true,

    timeline: {
      enabled: true
    }
  },
  css: ['~/assets/app.css'],
  modules: [
    '@nuxt/content',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@pinia/nuxt', // Add Pinia module
  ],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret',
    musicbrainzUserAgent: process.env.MUSICBRAINZ_USER_AGENT || 'Otogami/1.0.0 (mille@otogami.com)',

  },
  vite: {
    plugins: [tailwindcss()]
  }
})