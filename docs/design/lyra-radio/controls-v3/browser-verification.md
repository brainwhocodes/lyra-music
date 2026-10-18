# Integrated transport verification

Status: **61/61 production browser cases passed in 6.9 minutes on controls-v3 build 5**, with no provider keys or model runtimes. The final evidence is `.test-data/controls-v3-build5-production/`; its manifest fingerprints the production artifacts and records the exact logs and inventory root. The earlier focused gate passed six of six cases in 1.1 minutes. Fixture servers exited and ports 3100/3101 are closed.

## UI journey verification

All 26 routes were checked in Chromium at desktop 1440×1000, tablet 768×1024 and mobile 390×664. The mobile sweep also checks all 20 authenticated routes at 320px plus representative public/player/dialog states. The desktop text-scaling journey verifies the player at combined 320px and 200% text. Final evidence includes 78 route screenshots, 24 compact screenshots and 19 text-scaling views.

| Changed control | Journey and observed result |
|---|---|
| Playback position | Actual pointer clicks while paused/playing, Home/End/arrows, and outside-range pointer release followed by keyboard seeking preserve native state. |
| Waveform and fallback | Both licensed MP3s produce complete varying bins; held or malformed original audio preserves plain seeking; reselection retries failures; track replacement aborts obsolete work. |
| Volume and mute | Native range, remembered volume, desktop compact/full sharing, mute/unmute, Escape/focus return and open-popover resize pass. |
| Password visibility | Focused login and registration inputs change type and preserve values through actual Show/Hide clicks at all three widths. |
| Podcast seeking | Actual external episode playback and seven-second seeking work with no local waveform or music-history submissions. |

Commands and results:

- `node node_modules/@playwright/test/cli.js test` with all model/dev flags set to `0`: **61 passed**, 6.9 minutes.
- Ordinary Vitest: **279 passed, six opt-in model tests skipped**, 42 files passed/two skipped. Log: `.cache-controls-v3-unit-final.log`.
- `node scripts/ui-coverage-report.mjs --current=.test-data/controls-v3-build5-production/test-results` and `--verify`: **6,677 observations across 286 inventories**, with **776 operated-control occurrences, 97 state assertions and 5,804 owned gaps**.

The serious/critical axe gate, native keyboard/focus assertions, layout checks, and strict HTTP/console guards passed. The narrowly qualified consumed-range cleanup is described below; no global stream-error exemption was added. Independent visual review checked the repaired artwork, icon sizing, transport spacing, popover and circular Play shape. Automation is not a WCAG-conformance claim.

Every unoperated occurrence remains a gap owned by Lyra maintainers, with reason and review expiry **2026-11-18**. Counts include repeated shared controls and pointer candidates, not distinct defects. Other browser engines, native mobile browsers, and every page at doubled text remain outside this gate. The separate historical semantic-quality result remains 27/28, failing its unchanged threshold. No model-runtime pass is inferred from this runtime-free run.

## Verified checks

The existing 61-case runtime-free suite is retained. Its three audio cases now exercise the integrated waveform and native seek range instead of the removed analysis panel. Tests operate semantic controls through actual keyboard and pointer events; they do not assign range values or player state through JavaScript.

- A held genuine original-audio response leaves native playback and plain seeking usable. Releasing it yields a finite, varying full-track waveform under the seek control. Pointer seeks preserve paused/playing state; Home, End and arrows change actual position. Closing and reopening the full player shares one decoded result.
- The malformed-input case buffers the genuine native playback response first, then corrupts only the isolated temporary waveform source before its actual server fetch. Seeking remains usable after the decoder fails. Restoring the file and selecting another track before returning must retry successfully, proving failed results do not poison the cache.
- Current-track work survives closing its full-screen view. Switching to another queued track explicitly produces native `ERR_ABORTED` for the obsolete held request. The new track has different real amplitude geometry. Returning to the original track retries its uncached aborted decode.
- The Volume popover supports its native range, mute/unmute, remembered nonzero values, Escape and focus return. The desktop bar and full player share the remembered volume. Podcast audio keeps a plain functional seek bar and sends no local original-track decoding request.
- All three normal viewports, the 320px route/player check and the combined 320px/200% text journey remain in scope. The combined check operates the seek bar and volume popover, inspects actual hit targets and checks overflow.

The decorative waveform has no independent accessible action. Tests inspect only its unplayed amplitude layer, excluding the duplicate played-color layer and clipping rectangle. The separate real-codec test establishes full-duration decoding using a 65-second recording with a late burst; the short licensed browser fixtures alone cannot establish behavior beyond 30 seconds.

## Negative control

The mobile waveform case was run against the previous production output before rebuilding. The actual audio response completed and the old player showed advancing time at 0:10 of 0:12 with a progress bar. The case failed because the new native `Playback position` slider was absent, at its real-value assertion. One expected failure completed in 11.6 seconds; the screenshot, trace and log are preserved at `.test-data/controls-v3-negative-control`. The fixture servers exited and ports 3100/3101 were closed afterward.

The previous coverage matrix is separately preserved at `.test-data/transport-waveform-baseline/ui-coverage-build5.json`. New coverage will be generated only from completed production inventories, retaining explicit owners, reasons and expiry dates for controls not operated by these journeys.

## First production findings

Build 1's three desktop waveform cases all reached real decoding but failed the same geometry check. The MP3 has 12.0424 seconds of decoded samples while native playback reports 12 seconds. Its last padding bin began at SVG x=1000; a minimum-width rule still gave that bin width 0.5, placing it entirely beyond the native timeline. The browser clipped the extra bar visually. The test requires generated bars themselves to remain inside the native duration, so this is preserved as corrective evidence instead of loosening the assertion.

The malformed-source journey reached the unavailable fallback, retained paused seeking, restored the original file and decoded the other actual track before the shared geometry failure. The pending-source journey retained work across view closure and observed native cancellation on track replacement before that same failure. Later success/pointer/cache assertions did not all run; this is **zero passed, three failed**, not partial success for those cases. Raw evidence is at `.test-data/controls-v3-build1-focused-production`. Ports 3100/3101 were closed afterward. Root is also carrying independently found Volume popover semantics/positioning and seek-rail contrast corrections into the next build.

Build 2 passed the focused **16/16 cases in 3.7 minutes**: all nine waveform journeys, three actual playback/volume journeys, all three route sweeps and the doubled-text/combined 320px journey. Evidence is at `.test-data/controls-v3-build2-focused-production`. Native click seeking while paused/playing, Home/End/arrows, outside-range pointer release followed by keyboard input, actual decoder recovery, request cancellation and shared remembered volume all passed.

An additional run of the existing doubled-text case then reproduced two visual regressions before the full suite was attempted. Resizing from 1440px to 320px while Volume remained open left its 256px panel at x=600.64, outside the viewport. At doubled text, the intended circular Play control measured 56×88px because a shared button minimum-height overrode its explicit height. Soft assertions recorded both failures while the rest of the journey completed. This **one failed case** is preserved separately at `.test-data/controls-v3-build2-resize-probe`, including the observed panel geometry; it does not overwrite the passing 16-case archive. The updated checks stay in the existing case for the next production build.

Build 3's targeted seven-case run finished **four passed, three failed in 2.7 minutes**. The strict doubled-text journey passed the repaired popover resize/focus and circular Play checks, and all three registration cases passed. The newly added login eye-control action exposed a separate genuine pointer defect at every width: DaisyUI raised the focused password input above its contained Show password button, so the input intercepted every attempted click. These traces are preserved at `.test-data/controls-v3-build3-targeted-production`; no full-suite pass is claimed for build 3. The shared password wrapper now isolates its stacking and places the eye button above the focused input. Registration is also strengthened to focus Password immediately before clicking its eye, instead of relying on focus having moved to Access Code. The next production build must pass both unchanged login assertions and this focused registration path.

Build 4 passed that targeted gate: **seven passed in 27.7 seconds**, archived at `.test-data/controls-v3-build4-targeted-production`. Both login and registration now operate Show/Hide password with the password input focused and assert the actual type and preserved value at all three widths. The doubled-text test also passes open-popover resize, focus return, circular Play geometry and actual narrow seeking. The full production suite is a separate run on the same immutable build.

Build 4's complete run finished **57 passed and four failed in 6.9 minutes**, preserved at `.test-data/controls-v3-build4-production`. Three failures were the same real podcast boundary defect: seeking halfway through an external episode submitted its synthetic episode ID to music play history, causing a SQLite foreign-key error and HTTP 500. The network guard exposed this at all three widths. The source fix excludes direct external audio from music history while retaining positive library-track logging tests. The browser regression now crosses the threshold with an explicit native keyboard seek to seven seconds and requires zero music-history submissions; the original strict error guard remains.

The fourth failure was a native cancellation for the original Distant Sun waveform request during the mobile lyrics/queue journey, despite a ready waveform appearing later. Independent review established the cause in the installed Mediabunny source: it aborts a range worker once all target bytes are consumed, before the next read observes EOF. A separate real PCM decoding probe delivered all 91,726 WAV bytes while delaying EOF; the library cancelled the reader and still produced a complete 2.864-second result with 45,824 decoded frames and 184 bins. This is valid consumed-range cleanup, not an application request-ownership failure.

The existing guard has not been relaxed globally or given a stream-path allowance. This one journey requires complete waveforms for both actual recordings, with current-track title assertions before and after the geometry helper. Each recording must have exactly one identified original-stream request and an HTTP 206 response. After queue clearing it permits at most each proven Request object's single `ERR_ABORTED` entry. Any extra request, missing/partial waveform, different failure, HTTP error or console error remains fatal. The original failing trace is retained; build 4 remains a 57/4 result rather than being retrospectively labelled green.

The first build 5 targeted run passed five cases and caught the same consumed-range cleanup for Signal to Noise, because the initial proof covered only Distant Sun. That failure is preserved at `.test-data/controls-v3-build5-targeted-first`. Extending the identical success-qualified proof to both recordings required no application or global guard change. The corrected targeted run passed **six of six in 1.1 minutes**, archived at `.test-data/controls-v3-build5-targeted-production`, including all three podcast cases with native seven-second seeking and zero music-history submissions.
