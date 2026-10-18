// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: {
    enabled: true,

    timeline: {
      enabled: true,
    },
  },
  // Define explicit paths for public assets
  app: {
    baseURL: "/",
    head: {
      htmlAttrs: { lang: "en" },
      title: "Lyra",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "Lyra - AI-powered music discovery" },
        { name: "format-detection", content: "telephone=no" },
      ],
      link: [
        {
          rel: "icon",
          type: "image/png",
          href: "/images/lyra-radio/favicon.png",
        },
      ],
    },
  },
  css: ["~/assets/fonts.css", "~/assets/app.css", "~/assets/control-kit.css"],
  icon: {
    provider: "server",
    fallbackToApi: false,
    serverBundle: {
      collections: ["material-symbols"],
      externalizeIconsJson: false,
    },
    // Bundle literal names (including conditional names) so playback controls
    // render immediately and do not depend on an external icon service.
    clientBundle: { scan: true },
  },
  modules: [
    "@nuxt/content",
    "@nuxt/icon",
    "@nuxt/scripts",
    "@nuxt/test-utils",
    "@pinia/nuxt", // Add Pinia module
  ],
  runtimeConfig: {
    // Supplied at runtime as NUXT_JWT_SECRET; never bake a signing key into a build.
    jwtSecret: "",
    musicbrainzUserAgent: process.env.MUSICBRAINZ_USER_AGENT,
    secretAccessCode: process.env.SECRET_ACCESS_CODE,
    geniusApiClientId: process.env.GENIUS_API_CLIENT_ID,
    geniusApiClientSecret: process.env.GENIUS_API_CLIENT_SECRET,
    whistlePython: process.env.WHISTLE_PYTHON || "",
    whistleModelPath: process.env.WHISTLE_MODEL_PATH || "",
    whistleFfmpegPath: process.env.WHISTLE_FFMPEG_PATH || "ffmpeg",
    whistleTimeoutMs: process.env.WHISTLE_TIMEOUT_MS || "300000",
    whistleMaxDurationSeconds:
      process.env.WHISTLE_MAX_DURATION_SECONDS || "1200",
    scannerDisableGenius: process.env.SCANNER_DISABLE_GENIUS,
    embeddingPython: process.env.EMBEDDING_PYTHON || "python",
    embeddingModel: process.env.EMBEDDING_MODEL || "google/embeddinggemma-2",
    embeddingRevision:
      process.env.EMBEDDING_REVISION ||
      "914f7f89142e33e77833254d9c9b90c3cef7303b",
    embeddingTimeoutMs: process.env.EMBEDDING_TIMEOUT_MS || "300000",
    embeddingMaxTracks: process.env.EMBEDDING_MAX_TRACKS || "2000",
    embeddingDimensions: process.env.EMBEDDING_DIMENSIONS || "256",
  },
  vite: {
    plugins: [tailwindcss()],
  },
  sourcemap: process.env.NODE_ENV === "development" ? true : false,
});
