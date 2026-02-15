# Frontend Refactor Baseline (Nuxt 3 SSR + Client)

## SSR / hydration issues found

- `server/api/auth/login.post.ts`: password verification result was treated as a boolean object, allowing invalid passwords to pass (`if (!isPasswordValid)` with `{ success }` object). Root-cause auth/security bug affecting SSR-protected routes indirectly.
- `pages/radio/[id].vue`: ownership check read `user.value.user.id` while `/api/auth/me` returns `{ userId, ... }`, so owner-only UI never appears.
- `middleware/session.global.ts`: redirects to login without preserving intent, and no redirect sanitization existed for post-login return.
- `server/middleware/auth.ts`, `server/api/auth/login.post.ts`, `server/api/auth/register.post.ts`, `server/utils/auth.ts`: cookie policy was duplicated and hard-coded (`secure: true`, `sameSite: strict`) without environment-aware behavior or consistent clear semantics.

## Cookie/auth handling map

- Set auth cookie:
  - `server/api/auth/login.post.ts`
  - `server/api/auth/register.post.ts`
- Read auth cookie:
  - `server/utils/auth.ts` (`getUserFromEvent`)
  - `server/middleware/auth.ts`
- Clear auth cookie:
  - `server/api/auth/logout.post.ts` -> `server/utils/auth.ts::clearToken`
  - `server/middleware/auth.ts` (invalid token cleanup)
- Client auth state:
  - `composables/use-user.ts` (`useState('user')`)
  - `stores/auth.ts` (duplicate auth state path; potential drift)

## Data loading classification checklist

### SSR-required
- Detail pages where first paint and SEO rely on content title/body (`pages/albums/[id].vue`, `pages/artists/[id].vue`, `pages/podcasts/[id].vue`, `pages/discovery/[id].vue`, `pages/playlists/[id].vue`, `pages/radio/[id].vue` station metadata).

### Lazy-ok
- Session user profile fetch for UI affordances only (`/api/auth/me` usage in radio details).
- Secondary collections that are not above-the-fold for SEO.

### User-triggered
- Radio track queue for playback (`/api/radio-stations/:id/tracks`) fetched only when play/next interaction occurs.

## Prioritized checklist

1. Fix auth verification bug and centralize cookie policy (security + correctness).
2. Add redirect sanitization and safe post-login return flow.
3. Move non-critical data fetches to lazy/user-triggered policy to reduce SSR payload.
4. Add focused tests for fetch policy, cookie/session derivation, redirect sanitizer, SSR deterministic component render.
