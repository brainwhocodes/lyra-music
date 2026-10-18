# Evaluation audio

`transcription.json` records exact reference text, source/attribution, transformations,
duration and SHA-256 for all eight cases. `prepare-transcription.py` downloads three
small clips from the public Hugging Face mirror of **LibriSpeech dev-clean**. The
corpus was prepared by Vassil Panayotov and Daniel Povey from LibriVox readings and
is distributed under [CC BY 4.0](https://www.openslr.org/12). Credit the corpus and
LibriVox narrator 1272 when redistributing these fixtures; the
[license](https://creativecommons.org/licenses/by/4.0/) allows adaptations with
attribution. The FLAC source is decoded to mono 16 kHz WAV without trimming.

Two instrumental controls are the already attributed Scott Buckley excerpts in
`tests/fixtures/music/README.md`. The mixed case combines one LibriSpeech clip with
The Distant Sun at 0.25 music gain; it is a CC-BY-4.0 adaptation with both sources
credited. Digital silence is generated locally. The original synthetic sentence
comes from the existing test fixture and is reported separately from human speech.

The generated/downloaded audio directory is ignored to avoid duplicating binary
fixtures. Setup requires network; benchmark execution validates all checked-in
hashes and runs offline. Re-running preparation must not silently replace the
references/checksums in review: inspect any manifest diff before accepting new data.

This is one English narrator, three speech clips, not a representative ASR corpus.
No case contains a verified sung-lyric reference. Instrumental hallucination and
speech-plus-music results must not be described as singing-transcription accuracy.
