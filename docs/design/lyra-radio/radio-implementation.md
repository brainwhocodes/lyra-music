# Radio implementation record

**Final status (2026-10-18):** production build 4 succeeded and all 53 browser
journeys passed, including actual local Whistle/EmbeddingGemma inference,
desktop/tablet/mobile route sweeps, strict request guards, keyboard focus and
the desktop doubled-text radio checks. Final captures are archived in
`.test-data/anime-radio-build4-production`; the reference comparisons and
manual findings are in `verification/`. Earlier pending/failing statements
below describe the review history, not the final status. The passing ordinary
Vitest total is 203, with six real-model cases separately verified; the ten
direct dialog-focus checks are a separate diagnostic execution, not extra
Vitest cases. See `browser-verification.md` for evidence scope and the focused
inventory-readiness follow-up.

The radio reviewer inspected `brand-board.png`, the brand guide, and both
selected `mockups/radio-index.png` and `mockups/radio-detail.png` before changing
the two page templates. These are generated references, not browser captures.
The index reference SHA-256 is
`495549172a153ab3ebd49251e0ccafaaffd27f2b14532d6f7ce964ef7384b460`;
the detail reference is
`04695376fba9fe0cc9218cf92413fafbe7bbed50ca741657f64c43afa7214f1d`.

The index keeps the reference's large acid poster, condensed statement,
right-hand DJ artwork, station heading, filters and outlined station rows.
Its actual heading is “Find your frequency.” Station names, genres and artists
come from the API; the mockup's invented second station is not present in the
implementation. Search, genre filtering, station playback, open and management
links retain their existing labels and behavior.

The detail uses an ink listening panel with a station image, bone text, acid
play action and separate artist/genre seed sections. Its current-track section
appears only when this station owns the actual player queue. The illustration
is decorative; the mockup's waveform, replacement navigation and duplicate
player are omitted. The actual shared navigation and global player remain.
There are no claims of live broadcast, listener numbers or automatic refill.

Both templates reference the standalone `public/images/lyra-radio/rooftop-dj.webp`
artwork, rather than crops of the generated UI. Existing station logos and
backgrounds are preserved. Missing or failed station logos use the standalone
`mark.webp` fallback. Text and interactive controls remain live HTML on solid
surfaces. The illustration is in a separate image column, keeping headings and
focus indicators clear of its character.

Narrow layouts are inferred adaptations of the desktop references: at 700px
the index poster stacks its artwork below the copy and seed columns become
rows; the detail illustration becomes a separate strip below its listening
panel below 1050px. At 440px the station identity, filters and actions stack.
Typography, cards and action groups can grow with text rather than relying on
fixed text heights. Artwork crops prioritize the DJ's face and headphones;
the full desktop pose is not squeezed into the narrow strip. These are source
decisions whose final revision still awaits the coordinated build 3 browser
inspection, not claims of pixel-perfect correspondence with the references.

`assets/radio-pages.css` scopes every selector to radio-specific classes. The
root agent owns shared font loading, global palette, logo and other templates.
The application now serves Barlow Condensed 700/800 and Space Grotesk
400/500/600/700 from `public/fonts/lyra-radio`, with `assets/fonts.css` loaded
before the application CSS in `nuxt.config.ts`. The nine official WOFF2 files
retain the Latin, Latin Extended and Vietnamese subsets from the Google Fonts
CSS API. Their SIL Open Font License 1.1 notices are bundled alongside them;
source URLs, original metadata and hashes are recorded in `fonts/sources.json`
within this design directory. Runtime font loading uses local `/fonts/` URLs,
with no Google Fonts stylesheet import or font-service dependency. The brand
kit separately retains its original online board and a verified offline copy.

The playback and delete-confirmation repairs are separately tested through
controlled deferred responses. The prior handler reproductions showed an old
station response replacing newer playback, and an earlier deletion closing a
newer station confirmation. Six playback and four deletion regressions now
pass, alongside five existing editor and eleven player race cases.

The build 2 browser trace exposed a separate editor defect after deleting a
station and opening Add Radio Station: changing the child `open` and `station`
props started an intermediate artist/genre request pair, aborted it, then
started a replacement pair within 0.132ms. Watching a newly allocated array
also treated a refreshed object with the same station ID as a new identity,
resetting unsaved form values and restarting its requests. The editor now
watches individual scalar sources, invalidates old work synchronously, and
waits one checked microtask before fetching choices for the final identity.
Three new deferred-prop regressions failed against the prior source and pass
with the fix: same-ID refresh preserves the draft and active requests; a
combined open/identity update fetches once; an editor closed within that update
does not start requests. All **29 targeted radio/editor/player cases** pass.

The full ordinary Vitest run on 2026-10-18 completed with **203 passed and six
opt-in model-runtime tests skipped**, across **35 passed and two skipped test
files**, exit 0. The complete output is `.cache-radio-brand-unit-final.log`.
Real-model suites were deliberately not rerun for this presentation/editor
change. This is not an overall browser pass: build 2 ended at 41 passing and
12 failing browser cases, including the diagnosed aborted-request guard and
separate visual/accessibility corrections. The coordinated build 3 production
journeys and reference comparisons are pending; their result belongs in
`browser-verification.md`. No app build or browser server was started by this
reviewer, and the verified brandkit archive was not rebuilt for this change.

Independent visual review of build 2 covered both radio templates at desktop,
768px tablet, 390px mobile and 320px, plus the two doubled-text viewport captures.
The station controls and seed links remained readable, with no observed
clipping in the normal and compact views. The tablet detail strip did crop
off the character's head, so its final source uses `object-position: 72% top`
at the stacked breakpoint. The home narrow artwork also moves to top alignment.
These corrections need fresh captures. The final doubled-text audits are
full-page captures, since the earlier viewport-only images did not show
filters, station rows or the detail's lower controls and seed sections.

The shared palette's final source separates action fill from foreground:
acid stays on primary buttons, blue on ordinary links, and ink on the
current-track text. Measured sRGB contrast is 15.320:1 for ink/acid, 5.692:1
for blue/bone and 11.462:1 for ink on the selected track row. Blue on that row
was only 4.146:1, so using blue for both links and selected-track text was
rejected. No additional concrete source regression was found in the final
hero, fallback or editor changes; an independent 18-case editor/playback/delete
rerun passed. Final production rendering and accessibility remain separate
gates, to be reported in the browser verification record.
