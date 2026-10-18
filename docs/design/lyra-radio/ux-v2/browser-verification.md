# Browser verification for listening layout and audio analysis

Status: **final production build 5 passed all 61 browser cases in 5.9 minutes**. This is the complete run with the requested neutral palette, upright self-host headline, corrected responsive player and actual Mediabunny analysis. The fixture servers stopped afterward; ports 3100/3101 were closed.

The final scope is the existing 49 browser cases that require no model runtime plus 12 new cases across desktop, tablet and mobile. The new cases use real authenticated original audio, the actual Mediabunny decoder, and the native player. The previous 53-case anime-radio result remains preserved under `.test-data/anime-radio-build4-production`; it includes four opt-in model cases and belongs to the prior revision.

## New journeys

- `tests/e2e/audio-analysis.spec.ts`: decode each licensed MP3, compare visible peak/RMS with the independent FFmpeg/native-Chromium reference, inspect 49 finite varying waveform bins, run Analyze again, and retain paused native playback at three seconds.
- The failure journey writes malformed bytes only into the isolated server's temporary MP3 copy, observes the real decoder error, restores the original bytes, and retries successfully. The checked-in fixture remains untouched. One worker and serial execution prevent concurrent corruption of the copy.
- The cancellation journey holds the actual `/stream` response, operates Analyze and Cancel using the keyboard, and observes native `ERR_ABORTED` after explicit cancellation, player closure and track replacement. Actual native playback must continue while analysis is pending, and a subsequent analysis must belong to the new track. Eight separate reactive ownership tests deliver late success/error/progress from abort-ignoring promises; browser abort evidence and those adversarial unit cases cover different boundaries.
- `tests/e2e/radio-selection.spec.ts`: creates a second station through the real API, plays station A, holds station B's actual queue response, then chooses A again. It asserts B's native request cancellation, no second queue fetch for A, retained track/order/position, and paused playback. Cleanup deletes only the created station.
- Existing podcast journeys open the full player at each width, assert its library-only eligibility message and absent Analyze control, and require zero original-track stream requests while actual external episode playback remains usable. Existing 320px and doubled-text journeys operate real analysis. The doubled-text journey also combines 320px width with 200% text and inspects dialog/transport/analysis overflow plus the reached Analyze again hit target before restoring the viewport.

User-facing role/name selectors operate every control. SVG bar geometry and native progress are read-only observations. Strict console, first-party HTTP/request, accessibility and layout guards remain enabled. Only the exact deliberately held stream or station request is allowed to abort, and the test separately requires that abort to occur.

## Negative controls

1. `.test-data/mediabunny-negative-control`: the mobile full-player journey loaded and decoded the licensed track, paused and sought to three seconds, then failed because **Analyze audio** did not exist in the old production build.
2. `.test-data/radio-current-negative-control`: the real mobile A → pending B → A journey observed B's native abort, then failed because choosing current A made **two** queue requests, while the corrected contract requires **one**. The raw log, screenshot and trace are preserved.

## Final evidence and coverage

The exact run is archived at `.test-data/ux-v2-build5-production`, with its build log, browser log, unit log, evidence manifest and raw `test-results/` directory. Commands and outcomes:

- `node node_modules/@playwright/test/cli.js test` with `LYRA_E2E_DEV=0`, `LYRA_WHISTLE_E2E=0` and `LYRA_EMBEDDING_E2E=0`: **61 passed, exit 0, 5.9 minutes**.
- `node scripts/ui-coverage-report.mjs --current=.test-data/ux-v2-build5-production/test-results`, then `node scripts/ui-coverage-report.mjs --verify`: **6,487 exact inventory rows verified from 277 snapshots**; 768 operated-control occurrences, 45 state assertions and 5,674 owned gaps.
- `node scripts/music-fixtures.mjs --verify`: all three original checked-in files match their checksums.
- Ordinary Vitest evidence: **230 passed, six opt-in model cases skipped**, 38 files passed and two skipped. The 27 decoder/ownership cases are included in 230. Separate real-MP3/FFmpeg proof and earlier real-model evidence are not added to that count.

| Changed control/state | Journey proof |
| --- | --- |
| Analyze audio / Analyze again | Keyboard start and actual reanalysis; independently measured peak/RMS and 49 varying finite bins; native paused position retained. |
| Cancel analysis | Enter preserves focus through the label changes; the obsolete browser request emits `ERR_ABORTED` while native playback remains usable. |
| Retry analysis | Real malformed temporary file produces an alert; restoration and retry decode the original bytes. |
| Close / Up Next | Closing or replacing the track aborts obsolete analysis; only the new track's verified waveform is published. |
| Current station A during pending B | B aborts, A is not fetched again, and title/queue order/position remain intact. |
| Podcast eligibility | Actual episode playback advances; library-only note is visible, Analyze is absent and no original-track stream request occurs. |
| Seek/Go and Analyze again at 320px + 200% text | Real pointer actions change/restore position and rerun analysis; controls remain reachable without document or dialog overflow. |

All 26 routes were rendered at desktop/tablet/mobile. Changed states received native keyboard/focus assertions, strict console/request guards and serious/critical axe checks. The 320px sweep includes the real waveform, and the desktop text-scaling journey also combines 320px width with doubled text. Root and independent reviewers inspected final desktop library/radio/player/self-host and combined-size captures; this agent also inspected the final two-column phone library and actual waveform states. No material visual blocker remained in those views.

The [coverage matrix](../../../../tests/e2e/ui-coverage.json) retains an owner, reason and 2026-11-18 review expiry for every unoperated occurrence. Route sweeps and automated axe checks do not establish full interaction coverage or WCAG conformance. Unsupported capability is tested at the decoder boundary; native browser globals are not replaced in UI tests. Other browser engines, actual iOS/Android browsers, and complete site-wide doubled-text coverage remain gaps. Recordings longer than the 30-second preview are covered by bounded-decoder tests, not by these short-MP3 browser fixtures. The unrelated semantic-quality gate remains 27/28 and failing; earlier real Whistle/Gemma results are historical, not part of this run.

## Build 2 findings

`node node_modules/@playwright/test/cli.js test tests/e2e/audio-analysis.spec.ts tests/e2e/radio-selection.spec.ts tests/e2e/responsive-routes.spec.ts tests/e2e/text-scaling.spec.ts` finished with 15 passed and one failed in 2.9 minutes. This used the production build with both model E2E flags set to `0`. Raw evidence is preserved under `.test-data/ux-v2-build2-focused-production`.

The failing combined case measured document width 330 at a 320px viewport, dialog width/scrollWidth 305/486, and transport-region width/scrollWidth 225/446. A separate real-browser diagnostic rerun reproduced it, preserved under `.test-data/ux-v2-build2-overflow-diagnostic`. Its `text200-compact320-overflow.json` distinguishes background album overflow (298px table and 291px Add to playlist button within a 241px content region) from the dialog's 446px seek form/transport content and overflowing footer. No overflow was hidden or assertion weakened. Normal desktop/tablet/mobile audio results, cancellation and malformed-file recovery passed, as did the 320px analysis decode at ordinary text size.

Build 3's standalone combined gate passed in 7.7 seconds (11.0 seconds including setup). Actual pointer-operated Seek/Go and Analyze again worked at 320px plus doubled text, and independent visual review confirmed the repaired control wrapping. This run is preserved under `.test-data/ux-v2-build3-combined-production`.

The subsequent full build-3 run stopped when the conversation was interrupted. Its log records 52 completed passes but no final runner manifest; it must not be reported as 61/61. The preserved `.test-data/ux-v2-build3-full61-interrupted/run-status.json` labels the evidence explicitly. No fixture server remained running afterward.
