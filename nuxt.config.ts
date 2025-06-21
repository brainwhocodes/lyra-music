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
  // Define explicit paths for public assets
  app: {
    baseURL: '/',
    head: {
      title: 'Lyra',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: 'Lyra - AI-powered music discovery' },
        { name: 'format-detection', content: 'telephone=no' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }
      ]
    }
  },
  css: ['~/assets/app.css'],
  modules: [
    '@nuxt/content',
    '@nuxt/fonts',
    '@nuxt/icon',
   // '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/test-utils',
    '@pinia/nuxt', // Add Pinia module
  ],
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'development-secret',
    musicbrainzUserAgent: process.env.MUSICBRAINZ_USER_AGENT,
    secretAccessCode: process.env.SECRET_ACCESS_CODE,
    geniusApiClientId: process.env.GENIUS_API_CLIENT_ID,
    geniusApiClientSecret: process.env.GENIUS_API_CLIENT_SECRET,
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
  vite: {
    plugins: [tailwindcss()]
  },
  sourcemap: process.env.NODE_ENV === 'development' ? true : false,
})  