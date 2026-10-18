# Utility page design handoff

The utility implementation follows the inspected `brand-board.png` and
`library-mockup.png` references: warm paper, dark ink, copper actions, Bodoni Moda
headings, Public Sans body text, thin rules and a persistent library sidebar.
Eleven separate page mockups were generated with both image references attached
and inspected before any of these page sources were edited. The exact prompts,
original generated paths and copied reference paths are preserved in
`utility-generation-prompts.json` and `utility-generation-record.json`. Originals
remain in the generated-image directory; the copies below are review artifacts.

| Route | Inspected page reference | Implemented composition and controls |
| --- | --- | --- |
| `/playlists` | `playlists-mockup.png` | Editorial heading, labeled search, horizontal collection rows; visible play, open, rename and delete controls; retained create-playlist workflow |
| `/playlists/:id` | `playlist-detail-mockup.png` | Artwork and name hero, real duration/count, ordered track list; completed add-track search and selection; explicit move-up/down buttons replace required dragging |
| `/discovery` | `discovery-mockup.png` | Intro explaining local collections, search, collection rows, play/open actions and a real Explore link |
| `/discovery/:id` | `discovery-detail-mockup.png` | Text-led listening introduction, track list and real save-as-playlist workflow using the existing playlist APIs |
| `/podcasts` | `podcasts-mockup.png` | Inline RSS URL subscription form and horizontal subscription rows; removed the inert nested play button |
| `/podcasts/:id` | `podcast-detail-mockup.png` | Cover and podcast information, feed update/unsubscribe actions, episode rows with actual audio playback |
| `/radio` | `radio-mockup.png` | Local-library station explanation, name search and genre filter, station rows, play/open/manage controls |
| `/radio/:id` | `radio-detail-mockup.png` | Station hero, play/pause/next controls and separate artist/genre seed lists; now uses the shared navigation and player |
| `/settings` | `settings-mockup.png` | Folder path form, folder list and scan queue acknowledgment, followed by real Explore and station-management links |
| `/settings/radio` | `radio-settings-mockup.png` | Current user's stations, creation/edit-seed forms with checkboxes, settings links and confirmed deletion |
| `/settings/radio/:id` | `radio-edit-mockup.png` | Station-name form, seed editor and separate logo/background upload fields with preview, save, cancel and removal |

## Artwork and source boundaries

The only generated production artwork used by these pages is the existing
`public/images/lyra/mark.png`, displayed by `components/utility/art.vue` when real
artwork is absent. Real podcast images and uploaded station images come from
their stored data. No mockup was sliced into production assets. The existing
`listening-room.png` remains available to other pages but is not used here.
Generated names, counts, invented artists and descriptions were not copied into
application data. Radio mockups were interpreted against the actual seed-based
local queue API; there are no invented internet stream URL controls. The settings
mockup's model-ready assertion was replaced with an explanatory Explore link,
because readiness must come from the real model status. Scan success means jobs
were queued, not that ingestion completed.

`assets/utility-pages.css` contains styles scoped by `.utility-page`; the shared
palette and application shell remain in `assets/app.css` and `sidebar-layout`.
`UtilityDialog` uses native `showModal`/`close`, named headings, Escape handling
and guarded focus after opening. Track options retain metadata, lyrics and
playlist actions. Reordering is available with keyboard-operable buttons.

## Responsive interpretation and evidence

The generated references are desktop compositions. Mobile and tablet behavior
was inferred explicitly: collection-row artwork becomes smaller; action groups
wrap beneath rows; detail heroes stack; seed/image panels become a single
column; dialogs fit the viewport; long paths and names wrap. The shared shell
replaces the sidebar with its native navigation drawer at narrower widths.
These adaptations are implementation decisions, not supplied mobile mockups.
Touch targets use the shared 44px minimum; forms have visible labels and failed
mutations retain their form and show an inline error.

The browser agent captured the previous production pages at three widths in
`.test-data/ui-before/report.json`, with matching per-route screenshots. The
utility reviewer also inspected the previous desktop playlist, mobile settings
and tablet station-detail renders: the previous list used an empty cover grid,
settings included a future-feature placeholder, and station detail omitted the
shared navigation/player. That observation informed the scoped changes above.

All owned Vue script/template modules compile. The reviewer subsequently ran
37 targeted tests across six files: playlist/radio mutations, folder ownership,
real RSS decoding, multipart album edits and station-editor request races. They
include image validation, runtime image GETs and replacement/removal cleanup.
These checks are separate from browser and visual evidence.

The first production sweep produced all eleven utility routes at desktop,
768px tablet and 390px mobile widths. The utility reviewer inspected all 33 full
page captures in the `responsive-routes-...-desktop`, `-tablet` and `-mobile`
folders under `test-results`. Collection actions wrap below rows on mobile,
detail art and text stack, station image panels stack, and long media-folder
paths wrap. No clipped utility controls or horizontal overflow were visible in
those captures. Tablet playlist names occupy a narrower column beside the four
actions but remain readable. The captures contain real seeded/test records;
extra empty playlists from earlier retry tests are not product fixture claims.

This first sweep also exposed an actual RSS decoding failure: the subscription
and episode clients treated `application/rss+xml` as a non-text response. The
podcast detail screenshot therefore documents its visible error/retry state,
not a functioning episode list. Both clients now explicitly request text, and
real localhost RSS HTTP tests pass. The first desktop playlist and discovery
mutation journeys passed; later runs checked the repaired RSS, station
image and shared metadata/lyrics dialogs. The later 320px utility sweep is
recorded separately below; the first 390px images alone did not establish it.

A subsequent 200% root-font-size browser capture exposed a separate reflow
defect: the desktop playlist's action column squeezed its title and count into
one-character lines. The utility row now uses wrapping flex children with a
text-content basis, so actions can move to a new line before the text collapses;
the existing narrow-screen two-column grid is retained. The shared album-editor
journey also found that the dialog's combined selector chose an earlier file
input instead of the explicitly autofocus title. `UtilityDialog` now queries
`[autofocus]` first, then falls back to an enabled form control. Fourth-build
focused browser checks pass, including a hard Title-focus assertion. The
ordinary-width captures above do not establish doubled-text usability.

The fourth-build full production run is preserved in
`.test-data/design-fourth-production`. All eleven utility route captures were
inspected again at each of the three widths, alongside the eleven provisional
reference/implementation comparison pairs in `verification`. No new material
utility clipping or overlap was observed. RSS detail now shows the real
episode and its license credit. All fifteen utility journeys and the three
shared-modal journeys passed in that run. Its overall result was 45 passed and
five failed: three unrelated logout-spinner accessibility assertions and two
Explore recommendation-count expectations after the small library had been
heard. Their coordinated corrections are included in the successful fifth
production build, whose complete browser suite passed **50/50 in 5.6 minutes**.

The initial doubled-text dialog image was nearly transparent despite passing
focus checks. Browser diagnostics measured an in-viewport dialog during its
finite opacity opening animation. Waiting for that animation's actual
completion, without changing CSS or disabling behavior, produced a fully
opaque form; heading, input and Create button all passed full-viewport checks.
The reviewer inspected that settled capture directly. Representative native
playlist, station, folder, album, lyrics and playlist-picker captures were
also checked. Folder browsing initially captured its loading state only; real
response, current-path and loading-completion checks passed in the fifth run,
and the loaded drive-list dialog was inspected. Selecting/navigating a host
folder remains untested. Album cover
preview/cancel is browser-tested; saving and serving a new cover is verified
by real multipart HTTP tests. No claim of pixel identity, complete scan-worker
ingestion, Safari coverage or unobserved viewport behavior is made.

All eleven fifth-build `compact320-*` utility captures were inspected directly
under `test-results/responsive-routes-...-mobile`. Collection actions wrap onto
additional lines, detail heroes stack, station settings and image selectors
fit, and no new utility-specific clipping was observed. The shared search
placeholder touches the magnifier at 320px; this minor shell issue was reported
to its owner separately. Passing browser layout assertions do not erase that
visual observation. Desktop/tablet/390px review and reference comparisons are
described in `verification/utility-review.md`.

After the fifth build's 50-case pass, the sixth build repaired the shared
search padding and a shared track-title/duration overlap observed on 320px
album detail. All nine targeted route, core and search/playback cases passed,
including direct geometry assertions, and the root inspected the repaired
320px album capture. The full 50-case result above belongs to build five.
