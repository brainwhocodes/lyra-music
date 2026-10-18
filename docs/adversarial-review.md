# Adversarial review record

Reviewed on 2026-10-18 during the Gemini-to-Whistle migration and addition of
tests that require no API keys. Independent agents reviewed implementation,
licensed fixtures and browser journeys; findings were returned to the owning
agent, fixed, and reviewed again. This record describes that bounded review,
not a claim that the entire application has no defects.

## Review rounds and resolved findings

| Round | Finding and consequence | Resolution and regression evidence |
| --- | --- | --- |
| 1: existing authentication | Login treated the object returned by `verifyPassword()` as a boolean. Wrong passwords therefore passed the check. | `server/api/auth/login.post.ts` checks `verification.success`. `tests/integration/auth-login.test.ts` exercises real scrypt hashes, SQLite and HTTP: wrong passwords receive 401 and no session; correct passwords receive a session. |
| 1: old lyric generation | The old route interpolated filenames into a shell command, did not await directory creation, created temporary files inside the music directory, and used callback-based cleanup. Filenames and concurrent requests could cause unsafe execution or races. | `server/utils/whistle-service.ts` uses shell-free argument arrays, a unique OS temporary directory, awaited cleanup, a single active-job limit, bounded processes and input/duration/output limits. `tests/integration/whistle-service.test.ts` checks cleanup after multiple failure stages, concurrency, actual child-process timeout/output bounds, and literal shell metacharacters. |
| 1: lyric persistence | Missing artist metadata prevented transcription. A valid no-speech result must not replace existing lyrics with an empty result. | The route only requires a track audio path. `tests/integration/lyrics-generation.test.ts` uses real HTTP and SQLite to check missing artists, insertion, upsert without duplicates, and preservation of the entire existing row on silence or inference failure. Its model boundary is mocked; actual inference is tested separately. |
| 1: database isolation | `NODE_ENV=test` ignored an explicitly configured `DATABASE_URL` and forced a shared on-disk database. | `server/db/index.ts` honors an explicit database URL. Node test setup selects `:memory:`; suites use their own connections. Playwright creates and seeds a new temporary database instead of using a developer's library. |
| 1: playback | The player's actual `/play` endpoint advertised byte ranges but ignored them. `/stream` accepted valid substrings of malformed range headers, omitted the representation size on 416, and failed on empty files. | `/play` delegates ordinary playback to the common range-capable handler. `tests/integration/stream.test.ts` verifies response status, exact bytes and headers over HTTP for both endpoints, including suffix/open-ended/clamped ranges, malformed or unsatisfiable ranges, and empty/missing files. |
| 1: Safari playback | Live FLAC/OGG-to-AAC output retained the source file's `Content-Length` and range claims, and conversion failures could appear as successful empty responses. | Live conversion sends AAC without the source length or range headers and reports startup/decoder failures before response bytes are sent. The same integration suite runs real FFmpeg conversion of synthetic FLAC and checks the AAC frame signature and response headers. |
| 1: track listing | `GET /api/tracks` joined on nonexistent `tracks.artistId`, so the real schema produced invalid SQL. | The endpoint resolves the artist through `artists_tracks`, preferring a primary credit with a fallback and returning one row per track. `tests/integration/tracks-list.test.ts` covers collaborations, missing credits and combined filters using actual migrations, SQLite and HTTP. |
| 2: Whistle output contract | Hour-boundary timestamps were initially formatted as `HH:MM:SS.mmm`, while the existing lyrics modal interpreted only minutes and seconds. | Output uses unbounded minutes, such as `60:00.125`. `tests/unit/whistle-output.test.ts` covers rounding and the hour boundary. |
| 2: native output capacity | The SDK's convenience function used a 256 KiB native result buffer, smaller than the service's 4 MiB limit and potentially insufficient for long transcripts. | The embedded Python runner constructs the public `needle.Whistle` class with an explicit 4 MiB buffer. The revised runner passed all real offline inference tests, including repeated speech beyond a 30-second model window. |
| 3: setup and documentation | Build-time `WHISTLE_*` variables could be mistaken for production runtime overrides, and the environment example used a SQLite `file:` URI where the server expects a filesystem path. | `docs/whistle.md` maps development variables to `NUXT_WHISTLE_*` runtime overrides. `.env.example` uses `./db.sqlite`. The model test command and count were reconciled with the final scripts. |
| 4: native dialog reopening and focus | Binding the native dialog's `open` attribute conflicted with `showModal()`. A queued close event could close a newly reopened dialog. Subsequent browser investigation identified DaisyUI's hidden starting style and discrete `visibility` transition as the reason native autofocus could run while the input was not focusable. | `create-playlist-modal.vue` uses native dialog methods, ignores stale close events, makes an open dialog visible, excludes `visibility` from its transition properties, and checks that it is still open before focusing on the next animation frame. Browser assertions for repeated reopening, focus, Escape and accessibility passed in the production run described below. |
| 4: mobile navigation | The mobile sidebar remained open after navigation and obstructed controls on the destination page. | `sidebar-layout.vue` closes it when the route changes. Desktop/mobile browser journeys exercise navigation before filtering and playlist operations. |
| 4: media promise races | A rejected initial play could schedule playback after an intentional pause; rejected resume/seek/repeat/previous requests could clean up a newer track. Older requests on the same audio element could also overwrite its newer loading state. | Every play entry point now uses one helper in `stores/player.ts` that checks both element identity and a monotonically increasing request ID before handling rejection. Intentional `AbortError` does not retry playback. Cleanup invalidates requests first, and actual decoder errors are reported before cleanup. `tests/unit/player-races.test.ts` covers 10 cases; the implementing agent reported 7 failing negative controls before the fix, and the independent reviewer reran all 10 successfully. |
| 5: duplicate playlist fetch | `pages/playlists/index.vue` called `refresh()` on mount even though `useLazyFetch` already scheduled the initial request. Nuxt aborted that first GET when the redundant refresh began; both playlist browser journeys failed their strict request-failure checks despite completing their functional assertions. | The page's redundant mount refresh was removed. Initial loading remains owned by `useLazyFetch`, and the three refresh calls after create/update/delete are retained. The independent reviewer confirmed this against the installed Nuxt implementation: initial fetching defaults to enabled, and a repeated fetch aborts the preceding controller. The request-failure guard was kept strict, and the final production rerun passed all nine tests. |

## Independent verification

The independent reviewer executed these commands in the Windows workspace. These
are separate reruns, not just reports from the implementation agent:

```powershell
node node_modules/vitest/vitest.mjs run --config vitest.node.config.ts tests/integration/stream.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.node.config.ts tests/integration/tracks-list.test.ts
node node_modules/vitest/vitest.mjs run --config vitest.node.config.ts tests/integration/auth-login.test.ts tests/unit/auth.test.ts tests/integration/lyrics-generation.test.ts tests/integration/whistle-service.test.ts tests/unit/whistle-output.test.ts
$env:WHISTLE_REAL_TESTS = "1"
$env:WHISTLE_PYTHON = (Resolve-Path .venv-whistle/Scripts/python.exe).Path
node node_modules/vitest/vitest.mjs run --config vitest.node.config.ts tests/integration/whistle-runtime.test.ts
```

Results: 41 playback tests passed, 2 track-list tests passed, 38 tests in the
authentication/transcription group passed, and all 4 actual offline model tests
passed. The latter completed in approximately 6.6 seconds of test execution on
this machine. They cover recognizable speech, digital silence, absolute timing
past 30 seconds and a licensed instrumental excerpt. They do not establish
sung-lyric accuracy or prove that music never produces hallucinated words.

The fixture ingestion tests parse and persist real audio, but disable external
metadata enrichment. The queue-worker tests mock the legacy ingestion boundary.
The browser server seeds tagged fixture metadata into a temporary database;
browser journeys exercise the built application, login, browsing/search,
playback and playlists rather than pretending to cover the entire scan pipeline.
Final production-build and browser-run results are recorded separately by their
owning workflow; the counts above are only this reviewer's executed checks.

### Later full-suite and browser review status

After strengthening the lyric route tests to use the real migrations and foreign
keys, and adding the player race regressions, the root agent reported a complete
Vitest run with `WHISTLE_REAL_TESTS=1`: **115 tests passed across 21 files, with no
skips**, in approximately 8.47 seconds. The independent reviewer separately ran
the 10 player race tests and examined stale-element rejection, newer requests on
the same element, deliberate pause and native decoder-error ordering; no concrete
remaining defect was found in those changed paths.

The root agent subsequently reported a successful production build and a
production Playwright run with **7 tests passed and 2 failed**. Both failures were
the strict request-failure guard catching an aborted initial `GET /api/playlists`;
all functional assertions, including dialog focus, accessibility checks,
duplicate-name recovery and actual production-server Whistle transcription,
completed successfully. This is not recorded as a passing nine-test run.

After removing the duplicate mount fetch, the root agent completed another
production build with exit code 0 and ran the complete production Playwright
suite: **9 tests passed in 21.6 seconds, with zero retries and exit code 0**. These
comprise eight desktop/mobile UI journeys and one real Whistle HTTP/persistence
test, which completed in approximately 897 ms. The strict console and network
guards were unchanged and passed; unexplained aborted playlist requests are
still failures. The earlier seven-pass/two-failure result above is retained as
the regression history, not the final status.

The final unit/integration result remains **115 passed across 21 files**,
including all four actual-model tests. CI enables the production-server Whistle
test explicitly with `LYRA_WHISTLE_E2E=1` and `NUXT_WHISTLE_PYTHON=python` after
provisioning the model. These final build/full-suite/browser results were
executed and reported by the root agent; this reviewer's independent reruns are
identified separately above.

## CI and test-configuration review

`.github/workflows/tests.yml` has a consistent sequence: install the pinned pnpm
version and Node 22, install FFmpeg, perform a frozen-lockfile install, verify
fixture checksums, and run `pnpm test`. The default Vitest configuration delegates
to `vitest.node.config.ts`, which selects Node unit/integration/server suites and
excludes Playwright files. It does not boot Nuxt once per unit test.

The four actual-model tests are skipped unless `WHISTLE_REAL_TESTS=1`. CI then
explicitly installs the pinned Python runtime, provisions the public engine and
model, and reruns that test file with the opt-in flag. Consequently the default
suite does not silently require a model download, and CI does not merely report
the skipped model tests as inference coverage. Runtime child processes force
offline mode and disable telemetry; installation/provisioning still needs internet
access. No provider API key is supplied.

CI subsequently installs Chromium, builds the production server and runs
Playwright against that build, including the explicitly enabled production-server
Whistle smoke test. Desktop and mobile projects both use Chromium;
the mobile project emulates an iPhone viewport and input behavior, and is not a
WebKit/Safari browser run. Separate HTTP tests exercise the Safari server-side
transcoding branch. Failure traces, screenshots and reports are retained.

The workflow and configuration were reviewed locally; a GitHub-hosted Ubuntu run
was not executed during this review. Local execution evidence is Windows-based.
The migration helper currently lists the same migrations as the checked-in
Drizzle journal; update it when adding a migration.

## Pre-existing scanner limitations retained

These findings remain outside the transcription replacement. They are not
covered up by the new test results:

1. **Discovery restrictions do not constrain legacy ingestion.**
   `server/services/scanner/scan.ts` passes `payload.options` to `walkDirectory`,
   but later invokes `runLibraryIngestion` without the discovered file list or
   those options. `server/utils/scanner/index.ts` starts another unrestricted
   `findAudioFiles(libraryPath)` traversal. A scan with `maxFiles: 1` or an ignored
   subdirectory can therefore import tracks beyond that discovery restriction.
   A future regression should queue a scan containing allowed and ignored real
   audio, execute the actual ingestion boundary, and assert the final track rows,
   not only `scan_files` or mocked ingestion counts. A fix should make discovery
   and ingestion consume the same approved file set.

2. **Different tagged albums sharing one directory can be merged.**
   `findOrCreateAlbum` in `server/utils/scanner/db-operations.ts` prioritizes an
   existing album matching `(folderPath, userId)` before album metadata. Putting
   songs from different albums in the same directory can associate them with the
   same album record. The new ingestion fixture deliberately uses one directory
   per album, matching the current supported layout. A future regression should
   place both licensed fixtures in one directory and assert two independently
   tagged albums before changing album identity rules.

No remaining task-blocking defect was found in the reviewed Whistle replacement
after the second implementation pass. The two scanner limitations above remain
explicit follow-up work.

## Expanded intelligence, utility and modal review

The 115-test/nine-browser-test results above describe the completed initial
transcription phase. The later library-intelligence and interface work expands
that scope. The final logs confirm **196 passing unit/integration checks across
34 files** and **13 passing deterministic Evalite policy cases**. The fifth
production build completed successfully and its browser run passed **50/50**
in 5.6 minutes. The sixth build passed nine scoped follow-up cases for two shared
components; the 50-case result applies to build five. Earlier failed rounds
are retained below as regression evidence.
The following are concrete later findings, with implementation and verification
kept distinct from the historical results above.

| Finding | Repair and evidence |
| --- | --- |
| Playlist detail routes returned inconsistent track relations; duplicate adds created duplicate memberships, and malformed add bodies could crash. | Shared detail hydration, real SQLite route tests, transactional ID validation, ordered deduplicated additions and compacted removal. `playlist-routes.test.ts` has ten passing cases; the implementation owner recorded ten failing controls before the relation fixes. `radio-mutations.test.ts` adds retry and malformed-body checks. The library's existing shared track-read policy is retained. |
| Radio mutations used asynchronous SQLite work and could replace seeds on a name-only edit. Unsafe deletion paths and unvalidated image bytes also needed protection. | Owned synchronous transactions validate seeds before mutation, preserve omitted seed arrays and recheck ownership after image processing. Uploaded raster formats and sizes are validated; removal only accepts generated image paths. A recursive review found that replacements left old images behind, so superseded allowlisted files are now removed after the DB commit. Nine radio/playlist mutation tests pass against real HTTP, JWTs, migrations and SQLite. |
| Settings listed all users' folders, and deleting a known folder ID lacked an owner condition. | Both routes authenticate explicitly and filter by current user. Four HTTP/SQLite tests pass; three failed against the prior implementation, including a foreign deletion that returned 200. Shared music-library reading does not authorize changing another user's configured directories. |
| Real RSS subscription and episode loading failed with `xml.match is not a function` when ofetch inferred a non-text response for `application/rss+xml`. | Both fetches specify `responseType: 'text'`. Three tests use an actual localhost HTTP publisher and real ofetch content-type handling. Two failed before the change, while `application/xml` already worked; all three now pass. Fourth-build production screenshots show the actual episode, duration and license attribution. The real RSS subscribe/refresh/play/unsubscribe journey passes at all three widths. |
| The station editor skipped initialization when mounted open, accepted stale seed results, and an old save could close a reopened editor for a different station. | `useRadioStationEditor` initializes immediately, tracks open/identity changes synchronously, aborts old seed requests and ignores obsolete save/results. Five deferred-response Vue tests pass, including reopen during save and unmount. These are lifecycle regression tests, not a claim of real-network browser coverage. |
| Album edit validation could return 400 after committing a changed title, duplicated artist records for repeated names, and wrote arbitrary uploaded content using the caller's extension. | Multipart fields and decoded raster bytes are validated before writes; the DB transaction is synchronous, artists are deduplicated, ownership is rechecked after asynchronous image work, and covers are reencoded to generated WebP files. Six real multipart/SQLite/HTTP cases pass; four failed before the change. A focused pre-fix case proved the 400 response still changed the title. Title/year success and owner checks already passed before repair, so the earlier suspicion of unconditional SQLite failure was disproved. |
| Runtime radio/scanner images had stored `/uploads/...` URLs but no serving route; album edits wrote to build-time public assets. | An authenticated runtime handler accepts only generated raster paths, verifies their resolved location remains inside uploads and returns an explicit image type with `nosniff`. Album covers now use runtime storage. HTTP tests fetch a newly uploaded cover and verify replacement cleanup. Scanner hash-named covers are not deleted as replacements because they may be shared. |
| Shared metadata, lyrics and add-to-playlist dialogs had non-native opening, missing initial fetches or obsolete add-track payloads that silently failed. | The modal owner migrated them to `UtilityDialog`, added immediate lifecycle initialization, stale-result checks and visible error/retry states, and sends `action: add` with `trackIds`. Independent source review caught a lyrics visible-label/accessibility-name mismatch and returned it to the owner. The fourth-build shared-modal journey passes at all three widths, including persisted metadata and lyrics, playlist selection, Escape and keyboard focus. |
| Direct manual-lyrics HTTP requests could persist objects or non-string timestamps despite the editor's client validation. | PUT now requires an array of string time/text pairs with valid chronological timestamps. Three real JWT/HTTP/SQLite regressions pass. The negative control returned 200 for `lyricsJson: {}`; the repaired route returns 400 and preserves every existing field for twelve malformed payload forms. Empty arrays still intentionally clear lyrics, and unbounded-minute Whistle timestamps and valid hour timestamps remain accepted. The existing authorization policy was not expanded. |
| The 200% text-size browser round showed playlist titles squeezed into one-character lines; the album dialog focused an earlier file picker instead of its autofocus title. | Utility collection rows now wrap their actions before consuming the text column. `UtilityDialog` queries the explicit autofocus element before enabled fallback inputs/buttons. Fourth-build focused browser checks pass, including a hard album-title autofocus assertion. A nearly invisible doubled-text playlist-dialog capture was investigated separately: browser geometry recorded an in-viewport box during the opening opacity animation; awaiting its finite completion produced an opaque, fully visible form with heading/input/Create all in the viewport. No additional production fix was needed for that capture. |

The reviewer executed the folder/RSS/radio/playlist group with **26 passing
tests**, then the album/station-editor group with **11 passing tests**. These
37 tests are targeted local checks, not the expanded project-wide total. The
root separately reported four scanner containment regressions passing after a
Windows nested-path correction and eleven player race cases passing after
queue clearing was made to reset stale overlays.

After the third production build completed, the manual-lyrics validation was
added for the next build batch. The reviewer ran its three new cases together
with lyric generation and Whistle-output parsing: **27 tests passed across
three files**. This is additional targeted source verification; the preceding
production build does not contain that final schema change.

For visual review, all eleven utility routes were inspected at desktop, 768px
tablet and 390px mobile widths in the first production sweep. No clipped
controls or horizontal overflow were observed in those 33 captures. Their
known podcast error is recorded above; screenshot inspection is not proof of
successful RSS playback. Generated references, exact assets, responsive
interpretations and the evidence boundaries are documented in
`docs/design/lyra/utility-handoff.md`.

The reviewer then inspected all **33 fresh fourth-build utility route captures**
and all **11 reference/implementation comparison pairs**. The repaired podcast
detail contains the real episode, and normal-width utility controls show no
new material clipping or overlap. Representative native playlist, radio,
folder, album, lyrics and playlist-picker dialogs were inspected separately.
Large album forms scroll internally; the successful save journey is stronger
evidence than a screenshot that only shows the currently visible fields.

The fourth production build's focused seven cases passed. Its full browser run
finished **45 passed, five failed**: three route-audit failures identified an
invalid accessible name on a decorative logout spinner, and two Explore
expectations incorrectly required unheard recommendations after both available
tracks had been played. All fifteen utility journeys (five at three widths)
and all three shared-modal journeys passed. The fifth build contains the
spinner source repair and explicit history-empty Explore assertions, and its
full run passed **50/50**. The real production Whistle HTTP case took 937 ms
in that run and verified persisted timed lyrics. The scanner UI checks
queue acceptance/cancellation, not a complete worker ingestion, and the album
cover browser flow checks preview/cancel while real upload/persistence is
covered through HTTP integration. The folder-picker capture initially covered
loading/cancellation only. Real browse-response, current-path and
loading-completion assertions now pass, and the reviewer inspected the loaded
drive-list dialog. Selecting or navigating an actual host folder remains
outside that journey.

The fifth-build mobile sweep additionally captured every authenticated route
at **320px**. The utility reviewer directly inspected all eleven utility
captures: titles and actions wrap, station form/image controls remain inside
the page, and no new utility-specific clipping was found. The shared search
placeholder touches its overlaid magnifier at this width; that minor visual
finding was reported separately to the shell owner rather than hidden by the
passing layout checks. The root also confirmed a shared track-title/duration
overlap on a 320px album detail. Both shared-component repairs passed the
sixth build's nine targeted route, core-library and search/playback cases,
including direct non-overlap and search-inset assertions. The root inspected
the repaired 320px and desktop album screenshots. The complete 50-case run
belongs to build five; it is not relabeled as a build-six run.
Cross-browser behavior remains unverified; these are
Chromium desktop/tablet/mobile viewport runs.

The embedding evaluation uses the real pinned local model and production
serialization/ranking. Its final frozen set scores **27/28** and correctly exits
nonzero against the unchanged all-cases quality gate; one calm-piano tagging
case still fails. Eight held-out retrieval queries and the original cases are
preserved with earlier 256/768-dimensional baselines. The ASR comparison uses
actual Whistle and pinned faster-whisper on cleared speech, silence and licensed
music, with a repeat report and exact Whistle weight checksum. Results are
mixed, with no verified singing corpus, so Whistle remains the production
transcriber. See `docs/evaluations.md` for results and limitations; embeddings
are not an ASR substitute.

## Radio reliability follow-up before the graffiti redesign

The next radio-design pass exposed an independent playback race. A deferred
execution of the prior index handler selected station A, then B, completed B
first and A last, and recorded queue changes in that order: B then obsolete A.
The detail handler also read route/station identity again after the request,
allowing an old response to use newer context. This reproduction exercised the
actual extracted handlers with controlled responses; it was not a browser run.

`useRadioPlayback` now snapshots station identity, aborts superseded requests,
checks request generation before changing playback and cancels when the page
scope ends. The detail page additionally cancels synchronously when its route
ID changes. Empty or failed selections preserve the existing queue and display
the existing actionable message. Six deferred-response tests deliberately
resolve requests despite cancellation, covering late success/error, route
changes, unmount, identity mutation and retry. Those tests plus the existing
station-editor and player race suites pass **22/22 across three files**. Both
radio Vue files compile; the templates and layout were unchanged in this batch.
These six new cases are separate from the historical 196-test project run and
are not included in the completed build-six browser evidence above.
An independent agent reviewed the composable and both page integrations,
found no material defect in those ownership/error paths and separately reran
all six deferred-response cases successfully without changing the source.

The station contract remains a finite queue of up to fifty local tracks,
matched by artist or album-genre seeds. It is not a continuous broadcast or an
automatically replenished queue. Stations without matching seeds produce an
empty result, and the UI reports that state instead of starting fallback audio.
The broader player's decoder/network error path still logs and resets playback
without a reactive user-facing error. That pre-existing behavior is a retained
follow-up, outside this request-ownership repair; track-list HTTP failures are
already displayed by the radio pages.

A separate deferred reproduction of the settings delete handler started an A
deletion, closed its confirmation and opened B's confirmation. Completing A
closed B's dialog, although the network request correctly targeted A alone.
`useRadioStationDeletion` now scopes completion/error state to the confirmation
that initiated it; a completed server mutation still refreshes the station
list. Four deferred regressions cover another-station reopen, same-station
reopen, duplicate submission/error retry and disposal. Together with the radio
playback, editor and player suites, **26/26 targeted tests pass**. The new radio
templates and scoped stylesheet are based on inspected graffiti references;
their subsequent production browser evidence must be recorded separately
from the earlier paper/ink/copper design runs.

The next production trace exposed redundant artist/genre requests when the
radio editor's open and station props changed in the same update. Watching a
freshly allocated array also reset unsaved input when a replacement station
object retained the same ID. The implementation owner changed the watcher to
individual scalar sources and deferred fetching by one checked microtask,
while retaining synchronous invalidation and cancellation. Three new negative
controls fail on the prior source and pass after repair. The independent
reviewer then reran the prop-batching, editor, playback and deletion suites:
**18/18 pass**. No additional stale-result defect was found in those paths.

The palette review found that using acid as text on bone produced only
**1.027:1** contrast, affecting authentication links and current-track text.
Blue corrected links on bone (**5.692:1**), but was still insufficient for the
small selected-track title on its darker `base-300` row (**4.146:1**). The final
source separates the roles: links remain blue while `.text-primary` uses ink,
giving **11.462:1** on that selected row. Ink on acid primary buttons measures
**15.320:1**, and white on blue measures **6.371:1**. These calculations use
the actual sRGB theme values; they do not substitute for the browser audit.

The reviewer directly inspected both radio pages in build 2 at desktop,
tablet, 390px and 320px, plus their two doubled-text viewport captures. Text,
filters and actions fit in the ordinary and compact captures. The tablet
detail artwork strip cropped off the DJ's entire head; the final source now
top-aligns that crop, and the root applied the same protection to the narrow
home artwork. The old doubled-text captures showed only upper page content;
the final run will capture full pages so filters, station rows, controls and
seed sections can also be inspected. The corrected solid home text panel,
cover-art fallback helper and editor source review found no further concrete
blocker. Six direct helper checks preserve missing/legacy fallback behavior
and real uploaded/public/HTTP artwork URLs. Fresh build 3 browser captures
remain required to confirm the corrected colors, crops and lower text-size
states; build 2's failures have not been relabeled as a successful final run.

The build 3 production run completed **52/53 browser cases**, with one tablet
playlist-creation focus failure. Native autofocus reached Playlist Name, and
Tab moved to Cancel before the queued animation-frame callback unconditionally
focused the name input again. The trace showed input focus passing at
152612ms, Tab at 152614–152618ms, and the final failure capture with the caret
back in the input; no intervening audit capture or navigation caused the move.
A deferred-frame execution of the actual component script reproduced that
same input → Cancel → input sequence without starting another browser server.

The create-playlist dialog and shared UtilityDialog now use their delayed
focus only as a fallback: an open dialog may focus its initial control when
focus remains on the container itself or outside the dialog. An already
focused descendant is preserved, including a control reached by Tab or a
click. Fallback focusing uses `preventScroll`. Both actual component scripts
were checked with real Vue watch/nextTick and a deferred animation-frame
boundary: native input focus is left alone, Tab focus remains on Cancel,
container and outside focus fall back to the input, and closing before the
frame causes no focus change. All **10 direct checks** passed, and both Vue
scripts/templates compiled. Details are in `.cache-dialog-focus-final.log`.
These checks are separate from the ordinary 203-test Vitest result and are
not claimed as additional browser passes. The coordinated build 4 run must
revalidate the existing real keyboard journey; build 3's failure is retained.

The next UX audit examined the current source and archived production library,
radio and queue screenshots. The selected implementation scope is compact
library/station layouts, consistent active-station Pause/Resume, and a revised
full-screen player with explicit local audio analysis. The following findings
remain follow-ups; they are not claimed as implemented in that change:

- Metadata search currently covers albums, artists and playlists, but no
  tracks. Its popup disappears when a completed search has no matches, and
  it has no explicit Enter/Escape behavior. Track results, clear/loading/empty
  states and a coherent keyboard interaction require a separate API/UI change.
- The queue labelled “Up Next” includes the complete queue, including current
  and previous tracks. “Clear queue” also stops playback and closes player
  overlays. Separate current/upcoming/history presentation and clearer action
  wording should be considered without silently changing queue semantics.
- Navigation labels “Explore” versus “Discover” and “Radio” versus “Radio
  Stations” obscure semantic-search, discovery-mix and management distinctions.
  Clearer labels/grouping can preserve existing routes in a later change.

These are source/screenshot observations and design inferences, not findings
from a user study. Applicable primary references are Apple's
[search-field guidance](https://developer.apple.com/design/human-interface-guidelines/search-fields),
[layout guidance](https://developer.apple.com/design/human-interface-guidelines/layout)
and [navigation guidance](https://developer.apple.com/design/human-interface-guidelines/tab-bars),
W3C's [search status-message examples](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
and [combobox interaction pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/),
and the documented queue behavior in
[Spotify](https://support.spotify.com/us/article/play-queue/) and
[Apple Music](https://support.apple.com/en-ca/guide/music/musb1e6d1c76/mac).
The combobox pattern applies if selectable autocomplete is adopted; the
existing normal result links are not by themselves a combobox violation.

The independent review of the new Mediabunny analysis module reran its
**19/19 unit/integration checks** successfully. These include genuine PCM
decoding with an analytic sine-wave RMS expectation, silence, the original
speech fixture, rejection of corrupt bytes, retry, and exclusion of a loud
tail after the thirty-second preview. Source review confirmed explicit input
and sample disposal, disabled URL-source retries, a background-error handler,
same-origin track URLs, counted response-body bytes and bounded PCM copying.
This follows Mediabunny's documented cancellation contract: dispose the input;
its URL source overrides `requestInit.signal` internally.

A separate read-only `tsx` execution stalled an old codec-capability promise,
cancelled that analysis, completed a new real stereo PCM analysis, then
released the old promise. The obsolete operation emitted no decoding progress,
the replacement retained its expected 0.25 RMS despite opposite-phase
channels, and a subsequent retry succeeded. No material decoder-module defect
was found in these reviewed paths. These direct checks are not additional
Vitest or browser counts; application integration and compressed-audio browser
evidence remain separate validation steps. The browser test reviewer also
requested explicit aborted-request assertions for delayed-stream cancellation,
because an immediate empty-waveform assertion alone can precede a late result.

The UI ownership review independently reran **8/8 hostile deferred-analysis
cases** and **6/6 radio request cases**. Track replacement, same-track retry,
explicit cancellation and scope disposal reject obsolete success, failure and
progress callbacks. The radio index now cancels any pending other-station
request before toggling the current station. A new browser journey checks
that A → pending B → current A preserves queue order, current track and
playback position without fetching A again. The shared held-response test
helper now requires an actual browser `ERR_ABORTED` event for the obsolete
request, rather than merely permitting one in its console/network guard.

Source review identified two narrow UI corrections before the production run:
the desktop opener's visible “Open player” text was absent as a contiguous
phrase from its longer accessible name, and separate conditional Analyze and
Cancel buttons removed the focused element when analysis changed state.
The owner corrected the visible opener to “Full screen player,” which is
contained in its accessible name, and retained one stable button for Analyze,
Cancel, Retry and Analyze again. The reviewer confirmed both source changes.
These fixes and the new browser journeys must be verified against the built
application; source review and the 14 passing targeted tests do not claim a
new browser pass.

The first focused analysis/layout browser run then completed **15/16 cases**,
including all twelve new analysis/radio cases. The remaining failure combined
a 320px viewport with doubled text. Diagnostic geometry showed the full
player's 305px client width containing a 486px scroll area: an implicit grid
track and unwrapped seek form required 446px inside 225px of content. Scrolling
the seek input into view moved the dialog horizontally by 88px, displacing an
analysis panel that otherwise fit its own width. A separate background-page
overflow came from the album action button and track table, not the waveform.

The owner added an explicit `minmax(0, 1fr)` playback grid track, zero minimum
widths on its children, wrapping and bounded text buttons/seek form, wrapping
full-player header/footer, and responsive dialog padding. Album action buttons
now wrap, and compact table spacing/column widths no longer reserve the same
excess space. The reviewer checked these scoped source repairs: playback
handlers, focus behavior and minimum button targets are preserved, and no
horizontal-overflow clipping rule hides the defect. The unnecessary library
grid override was also removed to restore the existing shared phone columns.
These corrections are source-complete pending the next built application's
strict combined viewport/text-size gate; the original failed run remains
recorded separately from any subsequent result.

The final production closure is **61/61 browser cases passed in 5.9 minutes on
listening-layout build 5**, with no model runtime or provider key required.
The unchanged analysis/radio assertions passed across desktop, tablet and
mobile, including the stable Analyze/Cancel keyboard focus, actual malformed
audio failure/retry, explicit obsolete-request aborts and current-station queue
preservation. The combined 320px/200% text case now operates Seek/Go and Analyze
again without document or dialog overflow. Independent visual inspection
confirmed the repaired wrapping; final palette and upright self-host changes
were also rendered and reviewed. No overflow clipping was used to hide the
original defect.

Evidence is preserved in `.test-data/ux-v2-build5-production/`. The coverage
verifier matches 6,487 observations from 277 inventories: 768 operated-control
occurrences, 45 state assertions and 5,674 explicitly owned gaps. These are
snapshot occurrences, not claims of complete site coverage. Ordinary Vitest
remains 230 passing cases with six opt-in model cases skipped. Earlier model
results and the unrelated 27/28 failing semantic-quality gate remain separate.
Build 3's full browser run was interrupted after 52 completed passes and is
explicitly archived as incomplete; it is not used as the final gate.


## Integrated-control production closure (2026-10-18)

Controls-v3 build 5 completed **61/61 browser cases in 6.9 minutes**, following six affected-journey passes on the same immutable production output. Ordinary Vitest is **279 passed with six opt-in model tests skipped**. The final archive is `.test-data/controls-v3-build5-production/`; previous failed and focused runs retain their original outcomes.

The new checks exposed real minimum-width tail bins beyond native duration, an offscreen popover after resize, an oval doubled-text Play control, a focused password input intercepting its eye button, and synthetic podcast IDs reaching the music-history foreign key. Each applicable control assertion remained in the final suite. The podcast flow now performs real seeking beyond half duration and requires zero music-history requests. The source guard preserves positive local-track logging tests.

A separate observed native stream cancellation was proven to be Mediabunny consumed-range cleanup: it can abort after receiving the requested bytes before observing reader EOF. The lyrics/queue journey now proves both actual recordings have complete current waveforms, exactly one identified HTTP 206 Request each, and unchanged request identity through queue clearing. It accepts at most each proven Request's one ERR_ABORTED entry; missing waveforms, extra attempts and all other errors still fail. The first narrowed proof covered only one recording, and that targeted 5/1 outcome is preserved rather than relabelled green.

The final coverage verifier matches **6,677 observations from 286 inventories**, including **776 operated-control occurrences, 97 state assertions and 5,804 owned gaps**. Independent review checked mappings for overclaims and inspected the repaired rendered controls. Chromium success does not establish other browser engines, native mobile browsers, full site-wide doubled-text behavior or model quality; the historical semantic gate remains 27/28 and below threshold.

## Local-model and private-album release review (2026-10-18)

An independent reviewer inspected the new setup/download workers, private ZIP extraction and direct-import boundaries, runtime authentication configuration, session state ownership, and long-file waveform transport before the requested commit/push. The review found and repaired four concrete defects:

- The 2 MiB compressed waveform cache evicted early packets during Ogg container probing. A valid 9,240,860-byte private track then exceeded the 16 MiB cumulative download limit because bytes were fetched again. The unchanged production decoder completed the same file from a Blob in 1.95 seconds; a loopback HTTP reproduction identified the terminal error as `limit`, rather than inferring a timeout from UI waiting. Retaining compressed bytes up to the existing 16 MiB download ceiling completed the HTTP waveform in 2.03 seconds with exactly one file's received bytes. Network, time and decoded-sample limits remain unchanged. The new original-noise regression in `scripts/verify-waveform-ranges.mjs` passes; restoring the old cache only in its diagnostic bundle causes the normal completion assertion to fail. No private music is committed as a fixture.
- ZIP verification previously treated a replaced `extracted` directory's resolved location as its boundary, allowing a junction to redefine that boundary. Verification now checks the extraction directory, manifest and every file ancestor for redirects before reading. The direct Vitest importer also validates canonical paths, relative manifest entries, checksums, duplicate paths and an absent database/report, then reserves a new SQLite filename exclusively. Real Windows junction tests and an existing-database sentinel test pass. These checks address preexisting redirects and accidental reuse; they do not claim to isolate the process from a hostile local account that can rewrite its workspace during execution.
- Setup initially hashed one state-provided weight path while loading a separate snapshot path. Verification now binds the loader's snapshot repository/revision and resolved weight path to the artifact whose pinned SHA-256 is checked. Wrong snapshots, mismatched loaded/verified files and modified weights fail. The offline evidence was also corrected to say **Python socket audit guard plus offline loader options**, explicitly `osNetworkIsolation: false`; no OS firewall sandbox was applied.
- Session checks initially had no shared ownership guard. A stale `/api/auth/me` success could restore a cleared account, and a stale failure could clear a newer login. A Nuxt `useState` action epoch and separate latest-check counter now reject both outcomes across composable callers while remaining isolated per SSR request. Recursive review added checks launched during a pending logout, resolving on either side of logout completion, so a routine session read cannot take ownership away from logout.

The reviewer independently ran **36 focused Vitest cases** covering real waveform PCM decoding, private import boundaries and runtime auth configuration, followed by **10 deferred session-race cases**. All passed. **11 setup regression groups** and **4 extraction security groups** passed. The extraction validator's deliberate negative control failed 12 unsafe path/link/collision/bomb subcases, as required. Actual archive verification still reports four original archives, 42 files and 37 audio files with matching sizes and SHA-256 hashes. These counts are separate from the final built-application browser suite.

The original long-Ogg regression generated an 8,889,221-byte, 180-second stereo Vorbis file locally. Chromium decoded it in 750 ms with 181 bins and exactly 8,889,221 received bytes. Its old-cache negative control failed with `code: limit`. Completed range-worker cancellations are accepted only after the exact requests' successful 206 extents and complete waveform are proven; the standalone regression additionally checks exact received bytes. No `/stream` path-wide error exemption was added.

Recursive source review accepted the corrected setup and import boundaries. A read-only scan of 725 tracked/unignored release candidates found no private album/model/database artifacts or recognized provider/private-key signatures. The one archive over 10 MiB was the requested generated brand kit; its entries were inspected and contain design boards, generated art and font licenses, not the user albums. The final staged file list still requires the release owner's check before pushing. The optional large Gemma audio checkpoint and its ongoing evaluations are not counted as passed by this review; private excerpts without verified reference lyrics cannot establish sung-lyric WER or justify a transcription-engine replacement.

### Private playback and Unicode corrections

The first private browser run passed all four desktop cases but exposed a real mobile playback defect: the server treated an emulated Safari User-Agent as proof of unsupported Ogg and returned a live ADTS AAC stream. Native playback had no finite duration or useful seek range. Playback now reads the media element's `canPlayType` results; the server preserves original bytes when the relevant container family is supported and prepares a complete MP3 when compatibility conversion is requested. A completed representation has a finalized duration header and one stable byte-range space. No user-agent exception or test capability override hides the original failure.

The compatibility encoder accepts at most 512 MiB and 20 minutes, runs one conversion at a time with a 120-second subprocess timeout, and rejects output at or above 32 MiB. FFmpeg uses file/pipe protocols, no shell, fixed output settings and a freshly allocated temporary directory removed after success or failure. Duration and output-size safeguards are checked after conversion; a shortened output is rejected rather than published. The in-process cache retains at most four entries and 64 MiB for 30 minutes, keys source size/mtime/ctime and encoder identity, and rejects source changes during conversion. It does not write a persistent converted library. These are application bounds, not an OS sandbox or a guarantee that abrupt process termination cleans temporary files.

Independent focused verification passed **82 cases**: 50 real HTTP/range cases, six cache/process-boundary cases, two capability-selection cases and 24 existing player races. Actual FFmpeg FLAC-to-MP3 conversion produced finite metadata and byte-exact middle/suffix ranges. Tests also exercise malformed selectors, unsafe numeric ranges, source mutation, duplicate work, cache expiry/eviction, size rejection, an actual over-duration WAV rejected before encoding, sanitized invalid-media errors and temporary-directory cleanup after a real child-process failure. Authentication remains the existing API middleware. A separate native-media browser test will verify real fallback playback, near-end seeking and resume; these source tests do not claim Safari-engine coverage.

The same private run exposed Windows isolated Python reading UTF-8 JSON with the locale pipe encoding. Japanese metadata reached the tokenizer as invalid surrogate text and failed the second indexing batch. The worker now explicitly sets UTF-8 on its input/output pipes before importing the model. Independent source review accepted the narrow fix and its persistent-worker Unicode regression; the owner observed that regression fail before the fix and pass afterward, then indexed all 37 private recordings through an isolated database backup. No titles were dropped or transliterated. The final built-application rerun and final staged-artifact delta remain separate release gates.

The final recursive source pass found a separate private-evaluation output boundary defect: resolving `.test-data` before defining its boundary allowed a preexisting junction to redirect reports into a tracked directory. An isolated real Windows junction reproduced acceptance without using private data. The corrected writer fixes the checkout-relative root, rejects redirected ancestors, and atomically replaces reports through exclusively created random temporary files. Recursive review then demonstrated that Windows alternate-data-stream syntax could still redirect a temporary write through an existing hard link; lexical validation now rejects stream/device syntax and trailing-dot/space normalization before any path creation. Real filesystem regressions preserve outside sentinel files and cover repeated Unicode writes. The reviewer independently reran **16 setup/private-output regression groups**, all passing. These checks address preexisting paths, not a hostile local process changing directories concurrently.

An independent recomputation from all 16 saved public-control predictions confirmed Whistle's 5/80 combined speech errors versus Gemma's 4/80, and 2/56 versus 3/56 on human speech alone. Fixture hashes and emitted nonspeech word counts also match the comparison report. Cold verification/loading, warm case latency and whole-process time remain separate; no private lyric-quality score is inferred. The original long-Ogg synthetic regression is now included in CI after FFmpeg and Chromium installation. A test-only correction gives encoder cleanup assertions their own temporary root so another test worker's active conversion cannot be mistaken for a leak.

Build 3's first affected public journeys completed their functional waveform/recovery assertions but failed strict guards on decoder-reader `ERR_ABORTED` cleanup. Independent trace inspection found the exact successful 206 extents and, in the malformed-input journey, the deliberately corrupted 62-byte response. The reviewed test helper now requires every observed Request object to have its own proof: matching current-track complete waveform and exact fixture extent, an actual held-response cancellation before browser headers, or the separately identified malformed response with byte-for-byte body equality, expected unavailable state and no waveform. The malformed attempt is not described as a successful decode. Exact attempt counts and failure multiplicity reject extra requests, duplicate events, unrelated errors and unqualified same-URL aborts. The reviewer independently passed all **six helper boundary tests**. The previous pending-switch path-wide stream allowance was removed. These are test-evidence corrections; they introduce no new application behavior.

The final recursive source review has no remaining identified blocker after the playback, Unicode and private-output corrections. Passing source review is separate from browser and staged-artifact gates.

The completed browser closure on immutable release build 3 passed **25/25
affected public cases in 2.7 minutes**, after preserving the original seven-pass,
eighteen-abort-guard-failure run. The earlier full **74/74 build-2** baseline remains
unchanged. The merged public matrix verified 7,678 observations in 352 inventories
with 934 operated occurrences, 157 state assertions and 6,587 owned gaps.

Private build-3 verification passed **ten application/model cases**, including
unchanged desktop/mobile long-Ogg journeys, all 37 indexed recordings and actual
whole-track Whistle persistence. The eleventh, separate native-codec fixture
timed out while attempting to write HTML into Chromium's image document; its
trace showed a blank page before any native media request. An exact document-only
fixture route fixed that test setup. The focused rerun passed in 9.5 seconds,
retaining the real authenticated 206 bytes, finite 411.428-second MP3 duration,
near-end seeking and resumed playback. This is ten plus one successful cases in
separate runs, not a relabelled single all-green eleven-case run. Native Safari
remains unverified. Original archives and all 42 extracted file hashes were
verified again after the runs. Only sanitized aggregate evidence is checked in;
private traces, artwork and model text remain ignored. The final staged-artifact
audit belongs to the release owner and is not inferred from these browser results.
