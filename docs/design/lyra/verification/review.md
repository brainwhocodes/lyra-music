# Regional visual review

The selected references were generated before implementation. The comparison
manifest records their identities and the production browser captures separately.
The 29 side-by-side and 50%-opacity overlay images are inspection aids, not an
automated fidelity score. ODiff was unavailable. Reference canvas sizes and live
page lengths differ; no image was stretched or masked to hide those differences.

## Public and account pages

The root reviewer inspected all six desktop comparison/overlay pairs and raw
mobile and tablet captures. Regions inspected:
header/wordmark, heading hierarchy, photograph identity/crop, action placement,
section rules, form labels/fields, and footer navigation.

| Template | Observed implementation and deliberate adaptation |
| --- | --- |
| Home | Retains the split editorial hero, italic final line, copper primary action, three feature columns and closing invitation. Live desktop typography and spacing make a shorter page than the generated raster. Mobile/tablet stack the hero and feature columns. Decorative reference numbers were removed. |
| Features | Retains the large opening statement, photograph/text feature band, ruled feature rows and closing action. Copy describes metadata/lyrics search and reviewable suggestions accurately; it does not claim acoustic analysis. Narrow rows stack without squeezing the body column. |
| Self-host | Retains the split hero, setup sequence and requirements. Actual Node/pnpm/FFmpeg/Python requirements replace generated placeholder copy; model storage notes require more vertical room. Narrow requirements reflow from four to two to one column. |
| Login | Retains the photograph/editorial welcome beside a separated form. The password toggle is a named text button, and the empty decorative error box from the raster is omitted until an error exists. Mobile stacks the welcome and form with a horizontal separator. |
| Register | Retains the account form and photograph/welcome pairing. Live labels, confirmation, access-code help and password toggle determine field spacing. The form remains readable at narrow widths. |
| Logout | Retains the centered status and photograph. A native decorative spinner replaces the mockup's drawn progress rule. The actual status text announces progress; the spinner carries no invalid accessible label. |

The original listening-room asset is reused throughout with `object-fit: cover`;
it is cropped without distortion. Missing album art uses the separate transparent
mark and is never replaced with a fabricated record sleeve. The public desktop
implementation is more compact than some references, so the overlays correctly
show differing section positions. It preserves the selected visual hierarchy
rather than claiming pixel identity with generated typography.

## Issues found through browser inspection

- Early captures exposed tiny fallback marks from intrinsic grid sizing, repeated
  section borders and unavailable icon requests. Those were repaired, with local
  icons and explicit fallback-art sizing.
- At 200% text size, the fixed-width desktop shell squeezed navigation/content.
  The shell now uses the measured root font size to select compact navigation and
  playback; collection rows wrap actions before their text becomes unreadable.
- The skip link used a fixed negative offset and leaked a dark strip when its
  doubled text made it taller. A height-relative transform now hides its entire
  unfocused box while retaining keyboard access.
- Mobile marketing columns produced two adjacent section rules at their end.
  The final article no longer adds a second rule or redundant bottom padding.
- The first doubled-text dialog screenshot showed a dim backdrop with an almost
  invisible form. Read-only diagnostics found a valid on-screen box at opacity
  zero, 33ms into a delayed 200ms opening animation. Awaiting the actual finite
  animation produced a fully opaque 896x492 box inside the 1440x1000 viewport.
  Heading, input and Create button received separate full-viewport assertions.
  This corrected capture timing without disabling or modifying the animation.
- Functional browser checks independently found native lyrics-dialog dismissal,
  initial focus, stale-response and menu focus/scroll defects. Their fixes and
  regression evidence are recorded in the testing and adversarial-review docs.
- The first complete 320px sweep passed document-overflow checks, but direct
  screenshot inspection caught an album track title crossing into its duration
  and search text running behind the magnifier. The final scoped repair keeps a
  real table cell with an internal flex wrapper, hides its redundant thumbnail
  below 440px, wraps readable track text and reserves the duration column. Search
  receives an explicit right inset. Separate rectangle/inset assertions now
  check the actual overlap conditions, beyond whole-document overflow.

## Library, discovery and playback

The independent library reviewer directly inspected nine core/Explore templates
at desktop, tablet and mobile widths, real suggested-tag states on all three,
populated desktop recommendations, lyrics and queue dialogs at desktop/mobile,
and the full player at tablet/mobile. No remaining material clipping or overlap
was found in the fourth-build captures. The final build preserves those layouts.

Larger playable square cards replace compact reference rows on Library and Artist
detail, making live pages taller. Real fixture counts/durations and an honest
missing-biography state replace invented mockup content. Explore adds index
status and a description of its metadata/lyrics inputs above search. These are
visible functional adaptations, not pixel-matching claims.

The full player retains artwork, centered track identity and copper playback
controls, with accessible numeric seeking and named volume controls. Queue is a
side panel on desktop and fills the narrow viewport. Lyrics is a separate dialog
with seekable text; closing it returns to playback. The state comparisons select
mobile captures to match the mobile reference canvases, while the manifest also
retains other viewport captures. Raw images are used to assess responsive
geometry rather than comparing a desktop sidebar directly to a mobile overlay.

The utility reviewer independently inspected all eleven utility templates across
three viewports, their selected comparison pairs and representative native
dialogs. See [the utility review](utility-review.md) for specific regions and
intentional differences.

The fifth production build passed all 50 browser cases. The two narrow-layout
repairs passed all nine affected route, album and search/playback cases in the
sixth build. The root directly inspected the repaired 320px and desktop album
captures: title, duration and actions are separate, and search text stays clear
of its icon. All 26 routes across three widths and all 20 authenticated 320px
routes were rechecked. Evidence from the full run and the scoped follow-up is
kept separately before merging the newest captures; the full run is never
relabeled as a sixth-build result. Final counts belong in `docs/testing.md`.
