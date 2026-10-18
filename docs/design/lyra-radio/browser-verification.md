# Anime radio browser verification

Final production build 4 passed **all 53 browser cases in 6.0 minutes** with both real local models enabled and provider API keys blank. A subsequent **one-case doubled-text evidence correction passed in 9.7 seconds** on the same immutable production bundle. Stable evidence roots and exact snapshot selection are recorded in `.test-data/anime-radio-final-production/evidence-manifest.json`.

## Verified scope

- Landing journeys on desktop, tablet and mobile verify “Own your frequency.”, loaded Space Grotesk and Barlow Condensed faces, actual image decoding, guest radio/library redirects, registration navigation and all five authenticated listening CTAs. A loaded Barlow face must support the computed 700/800 heading weight; declaring a font or synthesizing bold cannot satisfy the test.
- Radio journeys create stations, edit artist/genre seeds, upload/remove artwork, play from detail and index controls and observe real audio progress, recover from query/genre empty states, and delete temporary stations. A real seedless station returns an empty queue and useful message while retaining the previous paused track and enabled playback control.
- The complete suite consists of 49 runtime-free cases, three actual EmbeddingGemma browser journeys and one actual Whistle production HTTP-to-SQLite case. Every one of the 26 routes is rendered at 1440px, 768px and 390px. An additional 320px sweep covers all 20 authenticated routes plus representative public/player/dialog states.
- One desktop journey at 1440×1000 doubles text/rem sizing, verifies 32px body text and operates compact navigation, the player, a dialog and radio search. This is not browser-chrome zoom or a claim of doubled text at every viewport.
- Console, failed-request and HTTP guards remain strict. Expected authentication/validation errors are allowed only where the exact endpoint/status is deliberately asserted. Serious/critical axe violations fail the route and selected-state checks. No broad cancellation exception was added for the editor bug.

The final matrix verifies **5,570 observations from 262 inventories**: **688 covered, 22 state-asserted and 4,860 intentional gaps**. These are repeated control occurrences, including shared layout controls and conservative pointer-container candidates. Each gap retains its owner, reason and review expiry. Route observations do not mean every control was operated; these results do not establish full-site WCAG conformance.

## Doubled-text radio evidence

The full-page radio screenshots provide page context. A fixed player can appear across a stitched image, so they alone do not prove that every lower control is unobscured. The journey separately scrolls each search/filter control, Play/Edit action and artist/genre seed into view, checks native trial-click actionability without activation, and confirms that the control occupies its center and four inset hit-test points. It captures each reached viewport. Next track is separately scrolled, captured and asserted disabled before this station starts.

The seven viewport captures are `text200-radio-{search,filter,play,edit,next-disabled,artist-seed,genre-seed}.png`; three `*-hit-targets.json` files preserve the measured geometry and hit targets. The selected versions are under `.test-data/anime-radio-build4-text-readiness/text-scaling-public-librar-3189b-in-usable-with-text-doubled-desktop/`. Each was visually reviewed, with the controls readable above the fixed player. Trial-checked controls are recorded as state assertions rather than activated controls.

The focused follow-up added an exact detail URL and level-1 heading readiness check: the station's old index card had the same heading text and allowed the first inventory to capture the prior page during navigation. Later screenshots and hit checks were already on the correct detail page. The corrected inventory now records actual detail controls; the original complete run remains untouched.

## Negative evidence and fixes

Before implementation, the existing warm-theme preview at `http://127.0.0.1:3000` was captured without starting another server. Desktop/mobile images and computed fonts are under `.test-data/anime-radio-before`. The exact new exported heading/font assertions failed against that preview: it had the old heading, Public Sans and Bodoni Moda. The result is preserved in `negative-control.json`.

Build 2 executed all 53 cases: **41 passed and 12 failed in 7.3 minutes**. Its screenshots, traces, log and 252 inventories are preserved under `.test-data/anime-radio-build2-production`. Failures repeated four cases on each viewport: the new landing test over-constrained an existing login query string; actual acid-colored Login/Register links failed contrast; and the radio editor issued cancelled artist/genre requests during intermediate prop assignment. The landing assertion now checks the pathname and visible form. Product fixes corrected link/current-track colors and batched stable editor work. Deferred unit checks failed on the original request race and passed after its fix. Visual review also corrected desktop/tablet artwork crops before the next run.

Build 3 executed all 53 cases: **52 passed and one failed in 6.1 minutes**, preserved under `.test-data/anime-radio-build3-production`. In the tablet playlist dialog, the initial input-focus assertion passed, Tab moved focus, then a delayed focus fallback stole it back from Cancel. No screenshot occurred between those steps. Both the playlist and shared utility dialog now preserve focus already within a real descendant, while retaining fallback from the dialog container or outside. Ten actual-component-script deferred focus checks passed separately. Build 4 passes the unchanged real Tab/Shift+Tab assertions on all three viewports.

## Final evidence and limits

- Full run: `.test-data/anime-radio-build4-production/`, including `run.log` and its passing `.last-run.json`.
- Evidence-only follow-up: `.test-data/anime-radio-build4-text-readiness/`.
- Selected snapshot manifest: `.test-data/anime-radio-final-production/evidence-manifest.json`.
- Checked-in route audit: `docs/ui-route-audit.json`; control matrix: `tests/e2e/ui-coverage.json`.
- Ordinary Vitest after the final dialog fixes: **203 passed, six opt-in cases skipped** across 35 passing/two skipped files. The **six actual model runtime cases passed separately**. The ten script-level focus checks are not additional Vitest cases.
- All three licensed/original fixture hashes passed verification. The separate semantic-quality evaluation remains **27/28 and fails its unchanged quality gate**; functional browser success does not override it.

Root built each immutable production bundle before the isolated test server started. The final test processes closed ports 3100/3101, and the preserved archives avoid mixing different runs. The old editorial-theme evidence under `.test-data/design-final-production` remains historical rather than proof of this theme.
