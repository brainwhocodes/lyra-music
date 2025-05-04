# Phase 0: Project Setup

### Tasks
- [x] Initialize Nuxt 3 project with TypeScript
- [x] Install dependencies:
  - Runtime: `@pinia/nuxt`, `drizzle-orm`, `better-sqlite3`, `music-metadata`, `fs-extra`, `jsonwebtoken`
  - Dev: `drizzle-kit`, `@types/fs-extra`, `@types/jsonwebtoken`, `tailwindcss`, `@tailwindcss/vite`, `daisyui`
- [x] Setup TailwindCSS & DaisyUI
- [x] Setup `.env` (created `.env.example`):
  - `DATABASE_URL`, `JWT_SECRET`, `MEDIA_PATH`, etc.
- [x] Create Drizzle config and initialize SQLite connection

### Clarification Questions
- ~~Do you want to use TypeScript or JavaScript?~~ (Using TypeScript)
- ~~Which UI library should be used?~~ (Using TailwindCSS + DaisyUI)
- Should the media path be static or per-user configurable?
