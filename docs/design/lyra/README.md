# Lyra design evidence

The requested [Soul skill](https://soul.brainwhocodes.rocks) resolved to
[image-gen-soul](https://github.com/brainwhocodes/image-gen-soul), version 2.1.0,
commit `3bee19bb5cc0e0e79adfba675b740acefdb190fa`. Its brand-first, redesign,
page-mockup and mockup-fidelity workflows were applied together with the local
UI Journey Verifier skill.

## Identity and references

The selected direction is a warm, editorial record store: paper `#f4efe5`, ink
`#262522`, copper `#a34127`, Bodoni Moda headings and Public Sans body text. An
optional direction question was left open before proceeding under the user's
delegated redesign request. Bandcamp informed album-led organization, not the
visual identity or page implementation.

The original listening-room photograph and transparent three-string mark were
generated as standalone assets. The actual HTML [brand board](brand-board.html)
was rendered with its fonts and images loaded, inspected, and then used as an
image reference for page mockups. The selected landing/library mockups also
carried the shared visual language into subsequent distinct pages. No mockup
was generated from a finished implementation to retroactively approve it.

- [Asset prompts, sources and decisions](generation-record.json)
- [Brand-board load and hash evidence](brand-board-evidence.json)
- [Root page prompts and selections](root-mockup-records.json)
- [Utility page prompts and selections](utility-generation-record.json)
- [Route-specific page plan](page-plan.json)
- [Utility implementation handoff](utility-handoff.md)

There are 29 selected references: 26 routes and three player/queue/lyrics states.
The standalone image files in `public/images/lyra` are reused directly; the UI
contains live text, forms and real library data. Neutral marks indicate missing
album/artist artwork. Generated artwork is never presented as a real album cover.

## Responsive implementation

Desktop uses a 216px navigation column and a persistent playback bar. Below
1024px, navigation becomes a native modal drawer and playback uses a compact bar
with a full-screen native dialog. Page grids reflow independently; desktop
screenshots are not scaled down into a mobile canvas. Public landing pages share
navigation, typography and the original photograph, with distinct content and
composition at `/`, `/features` and `/self-host`.

Necessary adaptations from the raster references include keyboard-accessible
seek/volume buttons instead of sliders, native dialogs with focus restoration,
explicit loading/error states, real fixture counts and track lengths, and
disclosures describing what local models actually use. Decorative eyebrows and
invented data in generated references were omitted. Radio stations use actual
artist/genre seeds from the library. All image aspect ratios are preserved.

## Verification and comparisons

Production Playwright captures are taken after network idle, with route content,
responsive document geometry and accessibility checks. Journeys exercise real
SQLite APIs and licensed audio. See [testing](../../testing.md) for the final
counts, model opt-ins and remaining interactive coverage gaps. Tests include
desktop, tablet, mobile, 320px reflow and separately documented 200% text scaling.

Run `node scripts/design-evidence.mjs` after a complete browser suite to preserve
the image identities and generate [comparison evidence](verification/manifest.json).
Each side-by-side image has the selected reference on the left and the actual
browser capture on the right. Both are uniformly resized to 720px wide, padded
where their heights differ, and never stretched. The overlay uses the same
top-left alignment with 50% opacity for the browser capture. Raw source files
remain untouched; their dimensions and SHA-256 hashes are recorded.

This delivery's final command was
`node scripts/design-evidence.mjs .test-data/design-final-production`.
It generated all 29 comparison/overlay pairs. The manifest includes the two-run
provenance: build five's full 50-case pass plus build six's nine affected-case
passes, with newer matching snapshots replacing older ones. The original run
directories remain separate. Screenshot widths in image labels are physical
pixels; the mobile captures use a 390px CSS viewport at device scale three.

ODiff was unavailable on this host. Sharp overlays and regional visual inspection
are the fallback; no ODiff run or numerical fidelity score is claimed. Generated
typography is not a browser golden. Review focuses on hierarchy, layout geometry,
asset identity/crop, navigation, spacing and controls. Functional and accessibility
results are separate from that visual review.

The first production comparisons caught tiny fallback marks caused by intrinsic
grid sizing, redundant section rules, missing locally bundled icons, and mobile
control labels. These were corrected against the original selected references.
Final regional inspection findings are recorded in `verification/review.md`.
