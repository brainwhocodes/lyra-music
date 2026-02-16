# Frontend Refactor Plan

## Phase 1: Auth + cookie correctness
- **Intent:** eliminate auth bypass risk and normalize cookie attributes.
- **Files:** `server/api/auth/login.post.ts`, `server/api/auth/register.post.ts`, `server/utils/auth.ts`, `server/middleware/auth.ts`, `server/utils/auth-cookie.ts`, `server/utils/auth-session.ts`.
- **Risks:** login/register response shape changed (token removed from body).
- **Tests:** unit test for session derivation; auth route smoke via existing integration tests where applicable.

## Phase 2: Redirect hardening
- **Intent:** prevent open redirect and preserve valid in-app return path.
- **Files:** `utils/redirect.ts`, `middleware/session.global.ts`, `pages/login.vue`.
- **Risks:** invalid/unknown redirect params now fall back to `/library`.
- **Tests:** unit tests for redirect sanitizer edge cases.

## Phase 3: Lazy retrieval tightening
- **Intent:** reduce initial payload on radio detail by deferring non-critical and interaction-based calls.
- **Files:** `composables/use-fetch-policy.ts`, `pages/radio/[id].vue`.
- **Risks:** first play may incur loading delay; mitigated by pending state.
- **Tests:** unit tests for fetch policy decisions.

## Phase 4: SSR determinism guard
- **Intent:** ensure critical visual card renders deterministically in SSR.
- **Files:** `tests/component/playlist-card-formatting.test.ts`.
- **Risks:** none.
- **Tests:** deterministic component-facing formatting assertions used by playlist card rendering.
