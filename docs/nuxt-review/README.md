# Nuxt and loading-state review

Reviewed on 18 October 2026 against the installed Nuxt **3.17.1** application.

## Official MCP evidence

This review used the actual Nuxt documentation MCP at <https://nuxt.com/mcp>, discovered from the [official Nuxt MCP guide](https://nuxt.com/docs/3.x/guide/ai/mcp). The previously indexed `mcp.nuxt.com` host did not resolve; the current official endpoint did.

`node scripts/nuxt-mcp-review.mjs` performs a read-only JSON-RPC handshake, lists tools, searches the **3.x** documentation catalog, and calls `get-documentation-page` for six relevant pages. It does not install an application MCP server or change global agent configuration. [mcp-evidence.json](mcp-evidence.json) records the actual server identity, tool names, arguments, success flags, response lengths and SHA-256 fingerprints. Full responses are retained locally in the ignored `.test-data/nuxt-mcp-review/` directory. Nuxt's live 3.x documentation may describe features introduced after 3.17; no newer async-data cancellation API was assumed here.

## Findings and repairs

1. **Session actions used a setup-oriented fetch composable too late.** `useUser.fetchUser()` created `useFetch` after an event, while login/registration also invoked `useUser()` after their first awaited request. Capture `useRequestFetch()` and `useUser()` synchronously instead. Session revalidation is now an explicit request, avoiding payload-cache semantics for changing authentication. Request headers remain forwarded during SSR. Sources: [useFetch](https://nuxt.com/docs/3.x/api/composables/use-fetch), [useRequestFetch](https://nuxt.com/docs/3.x/api/composables/use-request-fetch).
2. **Playlist choices could show a false empty state while loading, and a load failure was indistinguishable from an empty collection.** The composable's existing loading/error refs now reach all shared picker instances. Pending renders placeholders; failure exposes a retry; a successful empty array retains the existing create-playlist guidance. Cancel remains mounted and focused. Overlapping loads abort and ignore obsolete responses; scope disposal cancels work.
3. **Lazy navigation collapsed populated collections into one line during requests.** Shared skeletons reserve the expected card, row, compact list, track, detail, tile, or text shape. They follow existing pending refs, contain no controls or synthetic delays, and yield to the existing success, empty, and error branches. Sources: [useLazyFetch](https://nuxt.com/docs/3.x/api/composables/use-lazy-fetch), [useAsyncData](https://nuxt.com/docs/3.x/api/composables/use-async-data).
4. **The unused `isAuthenticated` helper returned the truthiness of a Promise.** It now awaits `getUserFromEvent`, returning false for anonymous and malformed sessions. Real HTTP regression tests verify anonymous, cookie, and bearer requests.
5. **A predictable signing-key fallback could issue trusted tokens.** The build now contains an empty default. Signing requires a runtime `NUXT_JWT_SECRET` of at least 32 non-padding characters and rejects known placeholder strings. Verification fails closed if configuration is invalid, accepts only HS256, and requires identity claims. Registration validates configuration before creating an account, avoiding an account that cannot receive a session. README and `.env.example` explain random key generation and migration from the old `JWT_SECRET` name. No private `.env` was read or changed by this review.

The skeleton is deterministic on server and client; CSS handles viewport differences. Its accessible status names identify the resource, `aria-busy` identifies pending content, and all placeholder geometry is hidden from assistive technology. A slow opacity pulse is disabled entirely under `prefers-reduced-motion`. Existing navigation and controls retain their labels and behavior. [Nuxt hydration guidance](https://nuxt.com/docs/3.x/guide/best-practices/hydration) informed the server/client boundary review.

## Remaining review notes

- Nuxt's `runtimeConfig` environment overrides require matching `NUXT_` names. Differently named `process.env` defaults can be baked in during the build. Setup scripts must supply the runtime names; inference setup is owned by the model-runtime workstream. [Official runtime configuration guidance](https://nuxt.com/docs/3.x/guide/going-further/runtime-config).
- The redundant direct `@nuxt/kit` dependency resolved to a **4.0 nightly** although Nuxt itself is 3.17.1. No direct application import was found, so it was removed and the lockfile regenerated. The resulting production build passed without a framework upgrade.

## Verification

- All **75 Vue templates** parsed and compiled through the installed Vue SFC compiler after the loading changes.
- `pnpm exec vitest run tests/integration/auth-configuration.test.ts tests/integration/auth-login.test.ts tests/server/api/auth/register.test.ts tests/unit/playlist-loader-races.test.ts`: **24 passed**. These include four request-race/failure/disposal cases, twelve authentication configuration/session cases, and registration's invalid-key/no-account-write check. Existing short integration-test keys were lengthened; production secrets were not inspected.
- `pnpm exec playwright test tests/e2e/loading-states.spec.ts --list`: **9 registered cases** across desktop, tablet, and mobile. This only verifies registration, not execution.
- Negative control against the prior production build: **one expected failure**, because its plain status text did not expose the new named, busy skeleton. The trace's accessibility snapshot confirms all four library requests were genuinely held and rendered their original loading text. Evidence: `.test-data/loading-negative-control/`, `.cache-loading-negative.log`. The automatic failure screenshot was captured after the `finally` block released those responses, so it shows loaded content; it is not claimed as a loading-state screenshot.
- Final focused browser execution: **9/9 passed** on production build2 across desktop, tablet and mobile. The initial attempt passed eight and exposed a test-only resize readiness race; it is retained separately. The corrected test waits for the compact menu to become hidden after restoring desktop width. The E2E cases hold genuine application responses, check layout and axe, release the original bytes, and exercise the resulting navigation. They also test reduced motion and a genuine session-expiry 401 followed by visible retry after signing in again. Root inspected the actual genre ready/skeleton captures at desktop and 320px, plus ready states at tablet and mobile. Full-suite evidence is recorded in `docs/testing.md` after completion.

The loading UI introduces one interactive behavior, **Retry loading playlists**, in four uses of the same picker component. The session-change journey operates it and asserts that real choices return. Placeholder shapes themselves are decorative, never focusable controls. The complete release-build-2 browser suite subsequently passed **74/74 cases in 7.9 minutes**, including the nine loading cases and four actual-model journeys. Evidence is preserved under `.test-data/release-build2-production/`, and the verified matrix retains 7,698 observations from 352 inventories with unoperated controls recorded as owned gaps.

After the subsequent codec and Unicode repairs, release build 3 passed the 25
affected public cases in 2.7 minutes. The current merged matrix retains 7,678
observations from 352 inventories, keeping these unchanged loading/route captures
identified as build-2 evidence. Private verification separately passed ten
application/model cases and one native-codec fixture rerun; see the
[sanitized aggregate](../private-albums-verification.json). Native Safari and
Firefox have not been tested.

The same reviewer inspected release build 3's narrow playback and Unicode changes without finding a Nuxt/SSR blocker. Codec detection runs when the player creates its browser audio element; the shared URL helper has no browser globals or hydration-dependent markup. FFmpeg, filesystem streaming, the bounded representation cache and Python workers remain server-only, with private runtime configuration read inside the request handler. The review reused the recorded official MCP evidence and checked the relevant range, capability, cache and cleanup tests. It did not rerun browser tests or claim native Safari coverage.
