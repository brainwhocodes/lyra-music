# Local private-album verification

This opt-in harness uses four locally supplied ZIP albums. It does not download,
redistribute, commit, or claim a public license for those recordings. The existing
openly licensed fixtures remain the reproducible public test corpus.

Run from the repository with Python, Node, FFmpeg, installed dependencies,
Playwright Chromium, and a completed production build:

```powershell
node scripts/private-albums.mjs
```

The default input directory is the current user's `Music` folder. To select a
different input directory, set `LYRA_PRIVATE_MUSIC_DIR`. If any of the four archives
are absent, the command explicitly reports `SKIP`; it has not passed private
tests. `prepare` only extracts/verifies and imports; `browser` reuses the most
recent prepared private run. These phases are useful while coordinating a build:

```powershell
node scripts/private-albums.mjs prepare
node scripts/private-albums.mjs browser
python scripts/private-albums-extract.py --self-test
python scripts/private-albums-extract.py --verify
```

After provisioning both local runtimes, opt in to the two additional model cases:

```powershell
. ./.tools/models/runtime-env.ps1
$env:LYRA_PRIVATE_MODELS = '1'
node scripts/private-albums.mjs browser
```

The base suite contains eight desktop/mobile cases and one separate Chromium
native-codec integration. Model opt-in adds two desktop
cases: index every imported track through the actual Explore UI, inspect real
search/tag/recommendation responses, and send one complete original recording
through the production Whistle route and SQLite persistence. The selected
recording is short and produced nonempty output in an earlier bounded inference
probe; that selection is not a human transcript or a quality label. A genuine
no-speech response must preserve existing lyrics and is reported separately from
a successful saved transcription. Model text and per-track results remain private.

The browser phase owns `127.0.0.1:3200` and refuses to reuse an existing server.
Do not rebuild `.output` while this runtime is running. It is separate from the
ordinary fixture ports 3100/3101 and the user's preview on 3000.
Each imported run has a randomly generated local account password, saved only in
its ignored report. Each server launch generates a fresh signing key in memory.
No existing account, environment file, or developer database is used.

## Isolation and archive checks

All extracted files, converted covers, SQLite databases, logs, screenshots,
inventories, traces, and model outputs belong under the ignored directory
`.test-data/private-albums/`. These artifacts can contain private song titles,
audio, artwork, and transcriptions. Do not attach them to a public issue or commit
them. Only aggregate counts and implementation/test descriptions may enter the
repository's verification documentation.

Extraction validates every archive before writing. It rejects traversal,
absolute/drive/UNC paths, Windows alternate streams and device names, links and
special files, encrypted entries, duplicate/case-colliding paths, file/directory
conflicts, redirected output directories, excessive entry counts, excessive
expanded size, and suspicious compression ratios. Entries stream into exclusive
new files with actual byte-count and ZIP CRC verification. A fresh staging
directory is published only after success. Existing extraction is never
overwritten; subsequent runs verify hashes instead. Original archives are only
read, and their hashes are verified again.

Security tests include unsafe ZIP entries, symlinks, a compression bomb, path
collisions, Unicode extraction, no overwrite, and tamper detection. The deliberate
negative control disables central-directory validation only in memory:

```powershell
python scripts/private-albums-extract.py --self-test --negative-control
```

That command **must fail**. It is evidence that the checks detect the disabled
validator, not a passing security test. Normal `--self-test` must then pass.

## What the harness proves

The import fork allocates a new SQLite database and applies the actual migrations.
Direct invocation also validates the canonical extraction/run roots and every
manifest checksum, refuses an existing database/report, and atomically reserves
the new database filename before SQLite can open it. Five ordinary unit cases
cover this boundary, including a real directory junction on Windows.
It uses the real filesystem discovery, music metadata parser, scanner,
artist/album/track relations, and Sharp artwork conversion. Its working directory
is the private runtime, so generated `/uploads` covers never enter the checkout's
public assets. Only external MusicBrainz/Genius enrichment is suppressed; any
unexpected outbound fetch fails. Each complete original file is decoded by
FFmpeg. A second import must preserve every track ID and the album count.

Browser journeys log in through the real UI on desktop and mobile, verify every
imported track's byte range against its original file, search all four albums,
check Unicode metadata and decoded artwork, and play the longest track from each
album. They verify advancing native time, near-end/Home seeking, complete
waveforms for this corpus, playlist creation/reordering/rename/removal/reload,
artist-seeded radio playback/queue/persistence, Unicode metadata editing, and
original manual lyric-editor text persistence. Screenshots, interactive
inventories, axe results, and network diagnostics stay private.

The separate native-codec harness requests the actual authenticated
`/play?format=mp3` representation of an imported Ogg, verifies a 512-byte range,
then uses a native media element to prove finite duration, near-end seeking and
resumed playback. Its small external test page is explicitly a codec integration,
not an application UI journey or a simulated Safari engine. It does not replace
the application's capability check or inject a player-store value.

Ogg containers can legitimately use multiple range readers. A successful decoder
may cancel consumed readers before EOF. The browser guard may qualify only the
actual request objects whose 206 content ranges match the original file and
whose associated current-track waveform is proven complete. It does not ignore
all stream failures.

## Scope and current evidence

Release build 3 passed **10 application/model cases** and the **separate native
MP3 codec case**. The latter passed in a focused 9.5-second rerun after correcting
its fixture document; this is not a single all-green 11-case run. Desktop and
mobile-emulated Chromium both play and seek all four representative original
Ogg recordings, including the complete 411-second waveform. The explicit MP3
fallback independently returns authenticated range bytes, reports finite native
duration, seeks near its end and resumes. Native Safari remains untested.

The real import passed: **4 archives, 37 Ogg Vorbis tracks, 4 albums,
4 converted covers, 6 Unicode track titles, approximately 121.4 minutes**, with a
longest track of **411.43 seconds**. All 37 complete files decoded successfully,
and the idempotent rescan preserved IDs. Archive/extraction hash verification and
the restored ZIP security tests passed. The in-memory disabled-validator negative
control failed as intended.

Earlier runs are retained as negative evidence. Initial desktop playlist/radio
journeys passed; native playback
and long seeking passed for all four representative tracks. Three waveforms
completed, while the longest track reached the plain-seek fallback. An independent
real-codec probe identified repeated Ogg reads caused by a cache smaller than the
container probing working set: this exhausted the 16 MiB download budget. The
decoder cache now retains data up to that existing budget, and the isolated URL
probe completes the full 411-second waveform. The final browser run requires all
four waveforms to complete; a failed decoder is not exempted from the network
guard.

Release build 2's expanded private run passed **7/10** cases and preserved three
failures. All four desktop native/waveform representatives passed, confirming the
long-Ogg repair inside the app. The two mobile playback journeys exposed the old
Safari-user-agent branch returning live AAC with no usable finite seek duration.
The real index completed its first 16 tracks, then rejected the Unicode-containing
second batch; a real tokenizer probe traced this to Windows Python decoding its
UTF-8 input pipe as cp1252. Both repairs passed the build-3 browser checks. The whole-track
Whistle request succeeded on a 107.544-second recording and persisted eight timed
segments; this is runtime/persistence evidence, not an accuracy score. The failed
run remains under the ignored private run directory and is not relabelled green.

Build 3's original combined attempt passed ten cases and failed only the new
codec fixture's document setup: writing HTML into an image document left a blank
page before any native media request. The corrected fixture intercepts only its
own exact same-origin HTML URL; every production media response remains real.
The focused codec rerun passed all unchanged byte-range, finite-duration,
near-end-seek and resumed-time assertions. The original result and trace remain
unchanged. All 37 tracks indexed through the real UI in batches of 16, 16 and 5;
the index reported 256 dimensions, and actual search/tag responses contained
finite scores and library-owned IDs. Recommendations also returned real library
tracks. The whole-track Whistle route again saved eight timed segments.
These results prove execution and persistence, not recommendation relevance,
audio classification or transcription accuracy. Only the sanitized
[aggregate verification](private-albums-verification.json) is checked in.

Private inventories retain 1,187 observations in 21 files. Their original matrix
conservatively retains owned gaps because that combined run contained the codec
fixture failure; the supplemental codec result is reported separately rather
than silently promoting a failed run. Detailed screenshots, titles, covers,
lyrics, request payloads and traces remain under the ignored private run.

These tests supplement the existing public fixture suite. They do not prove every
control in the application, queued-worker ingestion, all browser engines, manual
screen-reader behavior, or transcription accuracy. Model inference is separately
opt-in and must report its actual runtime and limits. Without reliable human
transcripts for the songs, song WER/CER and invented quality scores are not valid.
