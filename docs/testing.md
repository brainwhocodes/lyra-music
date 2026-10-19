# Local tests without API keys

Latest verification, **2026-10-19**: the final production build passed **80/80 browser cases in 10.4 minutes**, including real local Whistle and EmbeddingGemma. Desktop, tablet and mobile Chromium projects cover the expanded landing pages, responsive artwork, independent radio artwork motion, existing music journeys and enlarged-text layouts. The ordinary Vitest suite passed **358 tests**, with seven opt-in model cases skipped; the separate model-setup regression suite passed **16 tests**, and Evalite's policy suite passed **13/13**. Earlier release and UX results below are preserved history.

The new release evidence is saved locally under `.test-data/release-2026-10-19/test-results`. The regenerated coverage matrix verifies **8,153 observations from 369 inventories**, including **7,007 explicitly owned gaps**. These are repeated observations and conservative pointer candidates, not a claim that every control was operated. The final suite retains strict network checks: decoder-cleanup aborts are accepted only after each expected original request has a complete waveform and matching HTTP 206 byte extent. Real failures, unexplained requests and incorrect request counts still fail.

Independent landing review captured 18 responsive/text-scale states, checked six station reflow cases and operated 32 unique link groups. A negative control exposed station titles squeezed into vertical letter strips at 320px/200% text; the final production repair passes without injected CSS. See [landing comparisons and visual review](design/lyra-radio/landing-v2/visual-review.md). The [daily recommendation review](adversarial-daily-review.md) records the scheduling, ownership, runtime configuration and ranking fixes and their focused regressions. The actual [local listener](local-listener.md) also verified the new 24-hour snapshot contract against all 37 imported private tracks.

The production build succeeded locally. Master-version and release workflows now use Node 22, pinned pnpm 10.12.1 and explicit build dependency installation under `NODE_ENV=production`; their YAML and install steps were checked locally. This is not a claim that the new GitHub Actions runs have finished. Model weights, runtime environments, credentials, private audio and databases are excluded from Git. The separate semantic model-quality gate remains **27/28**, below its unchanged threshold because of the Calm-tag case; passing runtime tests does not establish lyric or recommendation accuracy.

Use Node 22.12 or newer and install dependencies with `pnpm install --frozen-lockfile`. This repository pins pnpm 10.12.1. SQLite needs a compatible `better-sqlite3` native binary; on unsupported Node versions it needs a C++ build toolchain. Node 22 is used in CI. Install FFmpeg on PATH as well: ordinary audio service/stream integration tests use it even without the Python model.

```sh
pnpm fixtures:verify
pnpm test
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

The ordinary tests and browser journeys use no Gemini, Genius, email, or transcription API key. Tests do not require downloading music: two small, licensed MP3 excerpts and an original spoken fixture are checked in. Sources, album links, attribution, license, transformations, and original/excerpt checksums are in [the fixture manifest](../tests/fixtures/music/manifest.json) and [fixture credits](../tests/fixtures/music/README.md). `pnpm fixtures:fetch` can download the original tracks; `node scripts/music-fixtures.mjs --rebuild` recreates excerpts with FFmpeg and verifies their pinned checksums. Neither command downloads entire albums.

Unit tests exercise password verification, model output validation, scheduling/limits, filesystem walking and request validation. The music integration tests parse actual MP3 metadata, discover files, run the real `processAudioFile` scanner, write a migrated in-memory SQLite database, check two separate album/artist/track relationships, and rescan to verify identity/idempotence. Only external metadata enrichment and Nuxt runtime configuration are substituted in those scanner tests. Unexpected network access fails the test. They do not test the entire queued scanner or remote metadata services.

The Playwright server starts the production build with a freshly allocated temporary SQLite database and seeded listener account. It parses fixture metadata during seeding and serves the real audio files from the real track endpoint. It also seeds an Ambient genre, playlist, discovery playlist, dynamic radio station and podcast subscription. An isolated local RSS publisher on `127.0.0.1:3101` supplies original feed metadata and licensed audio; subscription journeys use the real application parser and database. Only that external publisher is controlled. It never opens the developer's database. The wrapper clears provider keys, binds the application to `127.0.0.1:3100`, and removes its temporary database when the child server exits normally. Force-killing Windows process trees can prevent JavaScript cleanup; any leftovers have a `lyra-e2e-` prefix in the OS temporary folder. `test-results/` and `playwright-report/` are ignored and contain screenshots, inventories, traces on failure, and accessibility findings.

For faster local iteration, set `LYRA_E2E_DEV=1` before `pnpm test:e2e` to launch Nuxt's development server. This mode waits for initial development hydration before operating login. Unset that variable for the final production-build verification and CI; do not run development and production builds concurrently in the same checkout.

## Real Whistle tests

See [Whistle setup](whistle.md) to provision Python, FFmpeg, the public model and its CPU engine once. After caching, inference is local and needs no API key. Default browser tests do not invoke it.

PowerShell:

```powershell
$env:WHISTLE_REAL_TESTS = '1'
$env:WHISTLE_PYTHON = (Resolve-Path '.venv-whistle/Scripts/python.exe').Path
pnpm exec vitest run tests/integration/whistle-runtime.test.ts
$env:LYRA_WHISTLE_E2E = '1'
$env:NUXT_WHISTLE_PYTHON = $env:WHISTLE_PYTHON
pnpm test:e2e --project=whistle
```

POSIX shells:

```sh
WHISTLE_REAL_TESTS=1 WHISTLE_PYTHON=.venv-whistle/bin/python pnpm exec vitest run tests/integration/whistle-runtime.test.ts
LYRA_WHISTLE_E2E=1 NUXT_WHISTLE_PYTHON=.venv-whistle/bin/python pnpm test:e2e --project=whistle
```

The opt-in production test logs in through HTTP, sends the spoken WAV through the production lyrics route, FFmpeg and real Whistle, checks recognized words and timestamps, then GETs the persisted SQLite lyrics. This proves deployment wiring in addition to service-level tests. Instrumental excerpts are not a sung-lyrics accuracy benchmark; speech and silence tests measure the supported ASR behavior.

## Browser journeys and limitations

The waveform journeys use the real Mediabunny decoder through the authenticated original `/stream` endpoint. They inspect varying full-track amplitude geometry beneath the native seek range, exercise pointer and keyboard seeking while paused and playing, and preserve the native player's position. Closing and reopening the full player shares the existing result or pending request; switching tracks explicitly aborts obsolete work. The failure case buffers real native playback first, corrupts only its isolated temporary waveform source, restores it in `finally`, and retries by selecting another track before returning. Checked-in audio remains untouched. The suite uses one worker because that isolated copy is intentionally mutable. Podcasts keep functional plain seeking and send no local original-track waveform request. The separate native-Chromium/FFmpeg comparison verifies both licensed MP3s and a 65-second recording with a burst after 60 seconds, establishing correct full-duration timing beyond the short browser fixtures. See [waveform setup and decoder evidence](track-waveform.md).

```sh
pnpm test:audio-codecs
pnpm test:e2e audio-analysis.spec.ts radio-selection.spec.ts
```

The radio selection regression starts station A, delays station B's actual queue response, then chooses A again. It requires native cancellation of B, only one queue fetch for A, and preservation of queue order, current track and playback position. Held responses retain the server's real bytes; neither the player state nor a decoder result is mocked. Separate reactive unit tests deliver late completion from an abort-ignoring decoder to test result ownership beyond the browser's request-abort boundary.

Chromium projects cover desktop (1440×1000), tablet (768×1024) and mobile (390×664 viewport, 390×844 simulated screen). The route sweep visits every page, checks meaningful headings and URLs, inventories visible controls, captures screenshots, checks document overflow and runs axe. Every authenticated route receives an additional 320px reflow check, plus representative public, player and dialog views. One focused desktop journey at 1440px applies a user stylesheet that doubles text/rem sizing, asserts 32px body text, and operates public navigation, playback, a dialog and radio search. It scrolls radio filters, actions and seed links independently into view, checks native trial-click actionability and five read-only hit points, and captures each reached viewport. Next track is separately asserted disabled before starting the station. At doubled text the interface adapts to compact navigation and a full-screen player; this is text scaling, not browser-chrome zoom. The source inventory and before-redesign observations are recorded in [the route audit](ui-route-audit.json). Local baseline evidence consists of 69 screenshots and inventories under `.test-data/ui-before/`; it predates the redesign and does not establish final behavior.

The player also receives a combined **320px plus 200% text** check within that desktop journey. It measures horizontal overflow inside the fixed dialog and transport, operates actual pointer and keyboard seeks, and checks the Volume popover's hit targets and native range. Resizing while Volume is open must close it or keep it inside the viewport. A geometry assertion requires the primary circular Play control to retain equal width and height. The viewport is restored afterward. This covers the changed player at the combined setting; it does not claim every route at doubled text.

Focused journeys cover login validation and wrong passwords, keyboard login, complete registration with mismatched-password correction and logout, library search, album grid/list modes and sorting, artist/genre/track filtering and navigation, playlist selection, options-menu keyboard dismissal and focus restoration, and playback of actual licensed audio. Login and registration Show/Hide password controls must change the actual input type while preserving its value. Playback must return audio and advance the native seek range; mobile and tablet use the full-screen player. Tests operate Home/End/arrows, pointer clicks, and a real pointer drag released outside the range followed by keyboard input. Volume disclosure, native range, mute/unmute, shared remembered volume, Escape and focus restoration are exercised. Playlist creation covers blank/whitespace validation, Cancel, close, Escape, successful save/reload, duplicate-name rejection and retry.

Utility journeys add playlist editing, checkbox selection, button-based reordering and removal; discovery collection saving; podcast subscription/update/playback/unsubscribe; radio station creation, seed edits, image upload/reload/removal, advancing playback from detail and index controls, query/genre empty-state recovery, an empty seedless queue that preserves the paused track, and deletion; and settings folder management. The folder test creates an isolated empty temporary directory, verifies the visible 202 queued-scan response and actual queued state, cancels its pending job through the real API, then removes its own folder. External episode seeking also requires zero submissions to the music-history endpoint. The browser server does not start the separate scan worker. It does not claim full scanner ingestion coverage.

The player state journey saves original test sentences through the real lyrics-editing API, then delays the first track's actual GET response while real audio advances to the next track. It verifies that the late response cannot overwrite current lyrics, operates keyboard lyric seeking and queue controls, and checks nested dialog focus restoration and queue clearing. These original test sentences are explicitly UI fixtures, not transcriptions of the instrumental recordings. Network timing substitutions hold real lyrics/logout responses, including a capture of the pending logout screen; no internal player state or replacement lyrics response is injected. The network guard permits that specific deliberately aborted lyrics request in this test only. Mediabunny can also cancel a fulfilled byte-range reader before observing EOF; the same journey separately proves each of its two recordings has a complete current waveform and exactly one HTTP 206 Request, then accepts at most that identified Request's single native abort. This is not a global stream-path exception; all other errors remain fatal.

The waveform, local-search/playback, Explore and station-selection tests also
qualify consumed-reader cleanup by exact Request identity. Each successful attempt
must match its fixture's full 206 byte extent and current-title complete waveform;
unexpected requests, changed counts and other errors still fail. Deliberately
malformed bytes form a separate expected-rejection category: the actual response
body must equal the intended 62-byte corruption and the UI must show unavailable
waveform with no drawing. A held obsolete request requires its own observed
pre-response cancellation. Six boundary tests prove that unqualified same-URL
aborts, extra requests, duplicate events and unmatched errors are not hidden.

User-facing role/name/label/text/placeholder selectors operate controls. Read-only DOM inspection collects interactive-element inventories (including associated input labels and visible pointer containers), checks geometry and captures a focus diagnostic on dialog failure; it does not drive application behavior. Route screenshots capture the full page; focused states and transient menus/dialogs capture the viewport. The two doubled-text full-page radio captures are contextual: a fixed player can cross a stitched image. Seven separately scrolled viewport captures and control hit tests establish the reachability of the lower controls. A failing trace proved that full-page mobile capture moved the document by one pixel and correctly dismissed an anchored menu before its keyboard assertion, so evidence collection now preserves that transient state. Album cards use native links. Tests check browser exceptions, console errors, first-party HTTP failures and any external Iconify/alternate-icon-host requests. Allowances are limited to deliberately asserted login 401/playlist 409 (plus the exact guest-session 401 when testing the public library CTA) at those exact URLs and browser-cancelled navigation or track audio requests.

Shared editor journeys save and restore album years and track titles, edit original manual lyric text, and verify persisted values. Album cover selection/preview/cancel is exercised; saving the cover is covered by real HTTP integration rather than a browser mutation, preserving the no-cover music fixture for visual comparisons. Radio upload uses the locally generated Lyra mark as test artwork.

The route sweep and selected dialog/result states receive an automated axe serious/critical gate. This does not establish WCAG conformance or prove every control works. Controls outside the focused interactions remain in the coverage inventory with owner/reason/expiry; route observations alone do not count as interaction coverage. Lyrics/track routes currently authenticate callers but do not provide per-track tenant isolation; these tests do not claim multi-tenant security. Local intelligence indexes only tracks linked to the current user's albums, so the standalone spoken fixture is intentionally excluded from its two-track library.

The checked-in [coverage matrix](../tests/e2e/ui-coverage.json) records one row per observed semantic control or pointer-container candidate. After a complete production browser run, regenerate it with `node scripts/ui-coverage-report.mjs`, then run `node scripts/ui-coverage-report.mjs --verify`. Verification compares its element keys with the actual inventory files in each recorded evidence root and requires journey evidence or an owned, dated gap. Ambiguous pointer containers and controls only observed during route sweeps are recorded as gaps. Development-only inventories can be labelled using `--development`; they are not the final production gate.

## Real local intelligence browser tests

Provision the public model and CPU runtime using [EmbeddingGemma setup](embeddinggemma.md). With the model cached, opt in to browser indexing/search/recommendation/tagging without an API key:

```powershell
$env:LYRA_EMBEDDING_E2E = '1'
$env:NUXT_EMBEDDING_PYTHON = (Resolve-Path '.venv-embedding/Scripts/python.exe').Path
pnpm test:e2e explore.spec.ts
```

The browser calls real production HTTP endpoints, a persistent local Python worker and SQLite. It requests indexing, stops after the active batch, searches for the credited artist, displays tag provenance, switches recommendations and search, plays a result and opens its album. Search and tags use metadata and available lyrics; this is not an audio classification test. Error and model-quality evidence also live in the service, HTTP and evaluation suites. Runtime-free route sweeps only inspect the unindexed Explore page.

The scanner expects album directory structure. The first real-fixture experiment deliberately exposed that two differently tagged albums in one folder are merged by the folder-first scanner lookup; the test library therefore uses separate artist/album folders, matching normal album imports. Mixed-album folders remain unsupported by this change. The queue walk's ignore/maxFiles handling is not established as full ingestion coverage by these tests.

Anti-vacuity evidence: the invalid-login browser assertion was temporarily changed to expect a nonexistent success message and failed at the visible-message assertion while the page correctly remained on Login. The correct expectation was restored. The auth integration test also failed against the original wrong-password bug before the fix. See [the review log](adversarial-review.md) for independent review findings and residual risks.

The redesign browser gates additionally exposed and drove fixes for XML feed parsing, native lyrics dialog/Escape handling, autofocus priority when a file input precedes the intended field, accessible names and menu focus/scroll timing. Their failing production traces are retained locally under `.test-data/design-second-production` and `.test-data/design-third-*`. The fourth run also caught invalid ARIA on the pending logout spinner. A doubled-text screenshot initially caught the playlist dialog's intentional opening-opacity delay; read-only geometry proved it was already within the viewport, and the settled dialog is now captured after its actual finite animations finish. Tests assert that its heading, input and submit button are fully within the viewport. The UI animations remain enabled.

The browser also exposed the playlist dialog losing focus on reopen: DaisyUI's visibility transition kept the input unfocusable at the native focus step. The scoped fix preserves the box animation while making the open dialog immediately focusable. Journeys verify input focus, Tab/Shift+Tab traversal, Escape dismissal, and focus returning to New Playlist. The player cancellation regression tests deliberately defer native media promises; stale and deliberate-abort cases failed before the shared fix, then passed with real decode errors still reported.

## Current release verification (2026-10-18)

- Nuxt release **build 2** passed **74/74 production Chromium cases in 7.9 minutes**: 70 ordinary cases, three real EmbeddingGemma journeys and one real Whistle HTTP/persistence journey. Both `LYRA_EMBEDDING_E2E=1` and `LYRA_WHISTLE_E2E=1` were enabled after loading `.tools/models/runtime-env.ps1`; `LYRA_E2E_DEV=0` selected the production output.
- Release **build 3** passed **25/25 affected public cases in 2.7 minutes**, including waveform success/failure/cancellation, native playback, queue/radio ownership, podcast playback, real Explore and real Whistle. This rerun verifies the subsequent codec/Unicode fixes; the full 74-case result above remains build 2 evidence. The first affected run remains preserved as seven passes and eighteen final abort-guard failures; independent request/body/decoded-state evidence justified the precise test-only correction described above.
- The final release-build-3 ordinary Vitest run passed **337 cases**, with **seven opt-in model cases skipped**, in 50 passing files and two skipped files (`.cache-release-unit-final.log`, 5.39 seconds). This includes the six request-evidence boundary cases. These counts are separate from browser tests and the private corpus import.
- Nine loading-state cases passed across desktop, tablet and mobile. Genuine responses were held and released without replacing their bytes. Named busy skeletons, reduced motion, real genre image decoding, and expired-session picker recovery all passed. A previous desktop supplement sampled compact navigation immediately after resizing back to desktop; its failed trace is preserved, and the corrected test waits for the real responsive navigation state.
- The public coverage verifier matched **7,678 observations from 352 inventories** across both preserved production runs: **934 operated-control occurrences, 157 state assertions and 6,587 owned gaps**. Build-3 inventories replace corresponding build-2 observations; unchanged route/loading evidence retains its original build identity. Route/layout observations do not claim that every control was operated.
- The private corpus passed all ten application/model cases, followed by a separate native MP3 codec pass after correcting only its fixture document. All 37 original recordings were fully decoded/imported, four long representatives played and sought on desktop/mobile emulation, 37 tracks indexed, and one complete recording produced persisted Whistle segments. The [sanitized aggregate](private-albums-verification.json) preserves the separate-run distinction and failed fixture attempt without including private media or lyrics.
- Public genre ready/loading screenshots at 1440, 768, 390 and 320 pixels are saved with hashes in [the genre evidence manifest](design/lyra-radio/genres-v1/after/manifest.json). The actual public fixture has one genre; this does not invent additional library data to display all seven generated images.

Exact results, flags, production artifact hashes and inventories are retained in `.test-data/release-build3-final-targeted-production/` and `.test-data/release-build2-production/`; the focused nine-case gate is in `.test-data/release-build2-loading-final/`. The original affected-run failures remain in `.test-data/release-build3-targeted-production/`. Regenerate the current matrix with:

```sh
node scripts/ui-coverage-report.mjs --baseline=.test-data/release-build2-production/test-results --current=.test-data/release-build3-final-targeted-production/test-results
node scripts/ui-coverage-report.mjs --verify
```

Real model operation establishes deployment wiring and persistence, not lyric accuracy or recommendation quality. The historical semantic-quality gate remains 27/28 and below its unchanged threshold. Other browser engines, native mobile browsers and full site-wide doubled-text behavior remain unverified.

## Historical integrated-control production results (2026-10-18)

- Final Nuxt production **controls-v3 build 5** passed. The complete runtime-free Chromium suite passed **61/61 in 6.9 minutes**, following a six-case affected-journey gate on the same build.
- Ordinary Vitest passed **279 tests**, with **six opt-in model tests skipped** (42 files passed, two skipped). Separate real Mediabunny PCM and native-Chromium/FFmpeg evidence establishes full-track decoding, including the 65-second late-burst case; historical model-runtime tests were not rerun for this control change.
- All 26 routes passed the three-width route/layout/axe/network gates. The 320px sweep and combined 320px/200% player checks passed, including actual native seeking, popover resize/focus and circular Play geometry.
- All nine waveform cases passed: real complete geometry, paused/playing pointer and keyboard seeking, outside-range release, malformed-source fallback and reselection, shared view caching, and obsolete-request cancellation. Volume/mute and focused password-eye controls passed at all three widths. External podcast seeking produces no music-history request.
- The coverage verifier matched **6,677 observations from 286 inventories**: **776 operated-control occurrences, 97 state assertions and 5,804 owned gaps**. These are repeated observations, not a complete-site coverage claim. Gaps retain an owner, reason and review expiry.
- Preserved failures drove native-timeline tail clipping, popover resize handling, circular Play sizing, focused password-eye stacking and podcast history isolation. Successful Mediabunny range cleanup is accepted only after each identified Request's HTTP 206 and complete current-waveform proof in the lyrics/queue journey; all other request and console guards remain strict.

The exact completed run, production artifact fingerprints, logs, codec report and captures are in `.test-data/controls-v3-build5-production/`. Recreate its matrix with:

```sh
node scripts/ui-coverage-report.mjs --current=.test-data/controls-v3-build5-production/test-results
node scripts/ui-coverage-report.mjs --verify
```

Other browser engines, native mobile browsers and full site-wide doubled-text behavior remain unverified. The separate semantic-quality gate remains historically **27/28**, below its unchanged threshold.

## Historical UX-v2 listening-layout results (2026-10-18)

- Final Nuxt production **build 5** passed. The complete runtime-free Chromium suite passed **61/61 in 5.9 minutes**: the existing 49 cases plus 12 audio-analysis/radio-preservation cases across desktop, tablet and mobile. It includes the final cool concrete palette and upright self-host headline.
- Ordinary Vitest passed **230 tests**, with **six opt-in model tests skipped** (38 files passed, two skipped). The 27 decoder/analysis-ownership cases are included in 230. The two licensed MP3 fixtures also passed a separate native-Chromium/FFmpeg comparison. The earlier six real-model runtime passes were not rerun for this browser-only audio feature.
- All 26 routes passed the three-width route, layout, serious/critical axe and first-party error checks. The route sweep includes the 320px views. The desktop text-scaling journey additionally combines **320px with 200% text**, checks overflow inside the dialog and transport/analysis regions, and actually operates Seek/Go and Analyze again while preserving native playback position.
- Real MP3 analysis, independently verified amplitudes, varying waveform bins, malformed-byte failure/retry, keyboard focus through Analyze/Cancel, and native request abortion on cancel/close/track replacement passed at all three widths. Podcast analysis correctly remains unavailable without requesting original-track bytes. Radio A → pending B → A retains its existing queue and position.
- All three checked-in audio checksums passed. That run's coverage verifier matched **6,487 observations from 277 inventories**: **768 operated-control occurrences, 45 state assertions and 5,674 owned gaps**. These include repeated shared controls and conservative pointer candidates; gap counts are not counts of distinct defects or evidence of complete site coverage.
- The separate [semantic-quality gate](evaluations.md) remains **27/28, failing its unchanged threshold**. Current browser success does not change that historical model-quality result. Other browser engines, native mobile browsers and complete site-wide doubled-text coverage remain outside this Chromium gate.

The exact completed run is preserved in `.test-data/ux-v2-build5-production/`, including production build/unit/browser logs, an evidence manifest and the `test-results/` captures. Reproduce that historical matrix with:

```sh
node scripts/ui-coverage-report.mjs --current=.test-data/ux-v2-build5-production/test-results
node scripts/ui-coverage-report.mjs --verify
```

For a fresh complete run, omit the optional root to read `test-results/`. The verifier checks the run manifest, complete inventory-file set, exact element keys and every covered journey or owned gap. Negative evidence is preserved: the old player lacked Analyze audio; the old radio selection fetched current A twice; build 2 exposed combined-width/text overflow. Build 3 passed the repaired combined gate, but its full run was interrupted after 52 completed cases and has no full-suite pass claim. Final build 5 is the complete result.

## Historical anime-radio production results (2026-10-18)

- Final Nuxt production build 4 passed. The complete model-enabled browser suite passed **53/53 in 6.0 minutes**: 49 runtime-free cases, three actual EmbeddingGemma journeys and one actual Whistle HTTP-to-SQLite case. Provider API keys were blank.
- A subsequent **one-case doubled-text rerun passed in 9.7 seconds** on the same production bundle. It tightened station-detail URL/heading readiness so its inventory records the destination rather than the preceding index. This was an evidence correction, with no application change; the original full-run archive remains intact.
- Ordinary Vitest: **203 passed**, with six opt-in model cases skipped. The six real-model runtime cases passed separately. Ten additional actual-component-script focus checks passed separately; they are not added to the Vitest count.
- All three checked-in audio fixture checksums passed verification.
- All 26 routes passed desktop, tablet and mobile rendering, serious/critical axe and first-party error gates. The 320px sweep covers all 20 authenticated routes plus representative public, player and dialog views. One desktop doubled-text journey verifies 32px body text, compact navigation/player adaptation, dialog geometry/focus and independently reachable radio controls. This does not claim browser-chrome zoom or doubled text at every viewport.
- Brand journeys verify loaded Space Grotesk and Barlow Condensed faces, a real loaded face supporting the heading's computed 700/800 weight, decoded artwork, guest login redirects and all authenticated listening links. Radio journeys retain real audio progression and verify that an empty station leaves the existing paused track available.
- The final matrix matches **5,570 observations from 262 inventories**: **688 operated controls, 22 state assertions and 4,860 explicit gaps**. These are repeated occurrences across snapshots, including shared controls and conservative pointer candidates, not 4,860 distinct defects. Each gap has an owner, reason and review expiry. Route renders and automated axe checks do not establish full-site accessibility conformance or complete interaction coverage.
- The separate [semantic-quality evaluation](evaluations.md) remains **27/28, failing its unchanged quality gate**. Functional browser success does not override that model-quality limitation.

Stable historical evidence is in `.test-data/anime-radio-build4-production/` (full 53-case run) and `.test-data/anime-radio-build4-text-readiness/` (corrected doubled-text captures). `.test-data/anime-radio-final-production/evidence-manifest.json` records the actual source of every selected snapshot. Those archives establish the earlier model-enabled version; the current matrix uses the complete listening-layout build-5 run above.

The preceding anime-radio runs are preserved as negative evidence: build 2 passed 41/53 and exposed link contrast and redundant editor fetches; build 3 passed 52/53 and exposed a delayed dialog focus fallback stealing focus after Tab. Final build 4 passes those unchanged functional assertions. The old-theme heading/font checks also failed against the prior preview. See [the browser verification record](design/lyra-radio/browser-verification.md) for causes and corrective evidence.

The earlier editorial redesign's full 50-case build-5 run and nine-case build-6 revalidation remain archived under `.test-data/design-final-production/`. They establish that historical version only.
