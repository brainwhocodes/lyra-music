# Listening layout pass

## Evidence and scope

This pass improves the library, station index and full player. It retains the
existing brand, all real library data, local radio queues, native audio playback,
landing pages and station-detail composition. Before screenshots are untouched
copies from `.test-data/anime-radio-build4-production`, the current production
bundle when this pass began. They are historical browser captures, not new
mockups. New browser verification follows implementation.

The current library placed a large promotional panel ahead of albums. The radio
index used a large poster before its station controls. The full player was a tall
single column and was unavailable on desktop. These observations motivated the
changes; they are not findings from a user study.

## Research applied

- [Apple layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout)
  supports visual hierarchy around important content. Application here: place
  albums before the promotional panel in DOM/mobile order, and shorten the radio
  banner. This is our design inference, not a prescription to copy native styling.
- [Spotify queue documentation](https://support.spotify.com/us/article/play-queue/)
  makes queue access part of listening. Keep Up Next alongside Lyrics and transport
  in the full player; expose the same full player from desktop. Existing queue
  contents/clearing behavior remain a separate follow-up.
- [Mediabunny reading documentation](https://mediabunny.dev/guide/reading-media-files)
  documents lazy input reads, codec capability checks and disposal. Its
  [media sinks](https://mediabunny.dev/guide/media-sinks) expose decoded samples.
  We use actual PCM for an optional amplitude preview, independent of the native
  playback element. See `docs/audio-analysis.md` for resource bounds and evidence.
- [W3C status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
  informs polite progress/completion/cancellation status, without moving focus.
  [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) informs the
  stacked player and wrapping controls. Verification is scoped, not a conformance claim.

## Image generation and decisions

`generation-records.json` preserves exact prompts, actual local reference images,
raw generated output locations and request timestamps. The brand board and before
captures were inspected before use. All six generated references were inspected
before the corresponding layout was implemented. No mockup was sliced into UI
artwork; the previously generated, independently exported DJ asset is reused.

Radio A uses a short horizontal banner; B puts art in a tall right column. **A is
selected** because a full-width station list handles long titles, more stations
and narrower screens better. B is retained as a rejected structural alternative.
The mobile reference guides hierarchy, with deliberate live adaptations: the
existing Menu/Explore header is retained, form labels stay visible and the purely
decorative banner image is hidden below 440px to reserve space for controls.

The library reference is selected: albums on the left, secondary art/promotion on
the right; below 1000px albums precede promotion. The mockup's duplicate Explore
link and invented sidebar icons are not implemented. Real data determines how
many albums and lists appear; no extra albums are created to fill the layout.

The player references are selected: artwork/identity and transport on the left,
optional analysis on the right; a single readable column on narrower screens.
Existing transport semantics and button-based seek/volume are retained. Generated
waveform/measurements are illustrative; production draws only the actual decoder
result, with peak scaling disclosed and numerical PCM peak/RMS shown separately.

## Final art direction

The user's later preference against cream reading surfaces prompted a deliberate
palette adjustment after inspecting the production captures. The application now
uses cool concrete `#f3f4f6`, secondary surfaces `#e4e7ec`, neutral tracks
`#cbd0d8`, white inputs and muted text `#545861`. Acid, ink, orange, blue, the
original artwork and both real typefaces remain unchanged. Shared tokens cover
the shell, radio panels, cover placeholders, tags and playback states. The old
brand-board export and generated concepts retain their original warmer palette;
they are historical references, not screenshots of this final revision.

Uppercase is retained for short, substantial radio poster headlines, where the
condensed type contributes to the street-poster identity. Reading copy and
controls use normal sentence case; no decorative eyebrow labels or italicized
headline fragments were added. The existing self-host headline fragment and album
artist-filter label were also returned to upright type. The waveform stays still because its shape is
measured data. No ornamental animation competes with playback or analysis status.

An independent source audit checked the final palette: ink on concrete 16.01:1,
muted text on concrete 6.48:1, blue on concrete 5.79:1, and input outline on white
5.15:1. Decorative separators are lighter; these calculations are not a claim of
complete accessibility conformance. The browser journeys still check rendered
content, controls and reflow.

## Interaction contract

- Open player: desktop Full screen player or narrow track button opens the same native
  modal dialog. Close/Escape dismisses it and aborts pending analysis. Up Next and
  Lyrics preserve existing nested dialogs and native focus containment.
- Analyze audio: explicit action on a library track, original authenticated
  `/api/tracks/:id/stream`, first 30 seconds maximum. Idle, opening, decoding,
  complete, cancelled, failure/retry and podcast-ineligible states are visible.
  No decode starts automatically; no result or progress may publish after its
  request is cancelled, the track changes or the component is disposed.
- The waveform is a named, noninteractive image with a text description and
  numerical summary. It does not imply seeking, LUFS, genre or mood inference.
- Station card: Play loads a new station; current station Pause/Resume keeps its
  queue and position. Selecting the current station first cancels any pending
  other station request so late responses cannot override the latest choice.
- Playback, albums, station search/filter, editing, playlists and routes retain
  their actual handlers. No fake data, external API credentials or media autoplay
  are added.

## Verification

Final build-5 browser verification passed **61 cases** across desktop, tablet and
mobile Chromium, including the combined 320px + 200% text journey. See the
[browser record](browser-verification.md) for commands, evidence and limits.
Two old-build negative controls are
preserved: `.test-data/mediabunny-negative-control` fails the new Analyze audio
assertion after real play/pause/seek; `.test-data/radio-current-negative-control`
fails because choosing the current station fetches a second queue.

Build 2 passed all 12 new analysis/radio browser cases across three viewports and
all three route sweeps. The combined 320px + 200% text check failed. Its diagnostic
record (`.test-data/ux-v2-build2-overflow-diagnostic`) found an implicit playback
grid column expanded by the unwrapped seek form: 446px inside 225px of content.
Native scrolling then displaced the otherwise-fitting analysis panel. Separate
album action/table overflow enlarged the background document. The repair uses
bounded grid tracks and wrapping controls, footer/header and album actions, plus
intrinsic narrow table action columns; it does not hide overflow.

The first mobile library capture also exposed an overly large one-column album
grid caused by a local override. Removing it restores the existing responsive
two-column phone grid and its single column below 350px. These are layout repairs
within the selected composition. The final captures and checks confirm them.

Build 4 was deliberately stopped after the palette audit identified additional
tan surfaces and the self-host headline emphasis. Build 5 contains the complete
neutral palette correction and upright headline; its production build passed.
The final browser record identifies this bundle separately from earlier captures.

## Rendered review

The final captures come from the running production application and its isolated
licensed-fixture library. Playlists created by preceding browser journeys remain
visible in some library captures. They are real persisted test state, not extra
content inserted for a screenshot. Desktop, tablet and phone captures were
inspected, along with the 320px/doubled-text transport and analysis states. An
independent reviewer also inspected the final desktop player. No material visual
blocker remains in these inspected states.

| Screen | Concept beside final render (reference left, application right) | Observed result |
|---|---|---|
| Library | [Desktop comparison](after/library-comparison.webp) | Albums precede the promotional panel; phone albums remain two columns at 390px. Existing collection grids determine cover size, and no invented sidebar icons or duplicate Explore action were added. |
| Radio | [Desktop](after/radio-comparison.webp), [phone](after/radio-mobile-comparison.webp) | Shorter banner, visible field labels and full-width station rows. Phone art is omitted and Manage stations remains a full control. The actual form is taller than the generated study. |
| Player | [Desktop](after/player-comparison.webp), [phone top](after/player-mobile-comparison.webp), [phone analysis](after/player-analysis-mobile-comparison.webp) | Track/transport and analysis sit alongside each other on desktop. Phone controls wrap at their real readable size; analysis starts below the fold and is reached by scrolling. The waveform and measurements are decoded data. |

The comparisons preserve aspect ratios and normalize width only (720px desktop,
390px phone). Phone player captures intentionally show separate scroll positions;
the top capture is paused at five seconds, while the analysis journey is paused
at three. They are not one stitched viewport. The live layout retains native
transport controls, readable labels and larger spacing than the generated study.
The DJ strip crops some upper hairline in the player but leaves the face visible.
These are recorded adaptations, not a claim of pixel-identical implementation.

`verification.json` records source paths, dimensions and SHA-256 hashes for the
before, reference and final images. All six generation records remain intact.
Side-by-side images and 50% overlays support manual inspection; no numerical
fidelity score or accessibility-conformance claim is made.
