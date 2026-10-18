# Licensed music fixtures

**The Distant Sun** and **Signal to Noise** by **Scott Buckley**, released under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Artist: <https://www.scottbuckley.com.au/>. Copyright remains with the artist; no endorsement is implied.

The checked-in files are 12-second excerpts from 00:30, transcoded to 96 kbps MP3 with normalized ID3 metadata and artwork removed. These modifications are solely for deterministic local tests. Keep this attribution and the manifest with any redistribution of these fixtures.

| Album | Fixture | Primary-source download and license |
|---|---|---|
| [Monomyth](https://scottbuckley.bandcamp.com/album/monomyth) (2019) | The Distant Sun | [Artist's free MP3 page](https://www.scottbuckley.com.au/library/the-distant-sun/) |
| [Library Songs 5](https://scottbuckley.bandcamp.com/album/library-songs-5) (2020) | Signal to Noise | [Artist's free MP3 page](https://www.scottbuckley.com.au/library/signal-to-noise/) |

Both artist album pages explicitly allow free MP3 downloads from the library, even though Bandcamp offers paid high-quality album downloads. We downloaded one full track from each album to the ignored `.cache/` folder and keep only the small excerpts in Git. Full album track listings are linked above; no payment, account, or API key is required for the artist's library MP3s.

`manifest.json` records direct source URLs, original and excerpt SHA-256 checksums, license, and transformations. `node scripts/music-fixtures.mjs --verify` verifies the checked-in files without internet access. `--fetch` re-downloads and verifies original tracks into `.cache/`; `--rebuild` additionally recreates excerpts with FFmpeg. FFmpeg versions can produce byte differences: review them instead of silently changing the pinned checksums.

These instrumental clips exercise metadata parsing, album separation, scanner discovery, SQLite persistence, and actual browser decoding/streaming. They are **not evidence of sung-lyric transcription accuracy**. `audio/spoken-test.wav` is a separate locally synthesized original sentence, “The music plays softly in the morning.”, generated with Windows `System.Speech.Synthesis.SpeechSynthesizer` and converted to 16 kHz mono PCM with FFmpeg. Its separate provenance/checksum is in the manifest; it is for positive ASR smoke testing only.
