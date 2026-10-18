# Can Gemma replace Whistle?

**EmbeddingGemma 2 cannot replace the transcription service.** Its output is a vector, even when its optional audio encoder is enabled. Lyra currently loads its 270M text encoder for metadata/lyrics retrieval, tag suggestions and recommendations. No transcript can be recovered by treating those vectors as generated words. The official model card distinguishes the text, audio and vision encoders and their embedding output. [EmbeddingGemma 2 model card](https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2).

**Gemma 4 E2B is a different, generative model with audio transcription capability.** The official audio guide accepts normalized mono 16 kHz audio of at most 30 seconds for its small audio-capable variants. The public E2B checkpoint includes 5.1B parameters, despite its 2.3B effective parameter description. It has no documented word-timestamp output contract. Replacing Whistle would therefore also require chunk assembly and independently validated alignment for Lyra's seekable lyric lines. [Gemma 4 audio guide](https://ai.google.dev/gemma/docs/capabilities/audio), [E2B checkpoint and Apache 2.0 license](https://huggingface.co/google/gemma-4-E2B-it).

Whistle's pinned weights are 16,919,407 bytes; Gemma 4 E2B's are 10,246,621,918 bytes, about 606 times larger. The optional comparison runs CPU float32, requiring about 20.5 GB for its full raw weight values plus working memory. The exercised host has 128 GiB RAM and a Ryzen 9 3900X. Setup deliberately uses the existing CPU runtime and does not install CUDA drivers. Whistle provides word timestamps and processes longer audio in windows. Its official runtime also warns that music can cause hallucinated speech. Model size and nonempty output alone do not establish lyric accuracy. [Whistle announcement](https://cactuscompute.com/blog/whistle), [official Needle runtime](https://github.com/cactus-compute/needle).

## Private album protocol

The user-supplied corpus contains four albums and 37 Ogg Vorbis tracks, totaling 121.4 minutes. The extraction/import/browser reports, track names, absolute paths, audio and model outputs remain in ignored `.test-data/private-albums`; no private audio or generated lyric text is included in the repository. The extraction script records the four requested archive basenames so it can select those inputs reproducibly.

The protocol was fixed before predictions: choose the first and midpoint track within each album after ordering by track number and path, then transcribe the same 20-second excerpt beginning at 45 seconds (or centered for shorter tracks). This produces eight cases. Resampling uses local FFmpeg with file/pipe protocols, mono 16 kHz PCM and a 30-second bound. Models load the checked-in pinned artifacts. Inference uses offline flags and a Python socket audit guard; this is not an OS firewall and does not intercept native-library sockets.

There are no reference lyrics for these songs. This experiment can establish that the runtime accepts the real local format and can compare latency, output extent and timestamp availability. It cannot establish a song word-error rate, certify language recognition, count hallucinations reliably or declare a lyric-quality winner.

Both audio models completed the identical eight excerpts locally, with one model load per batch:

| Private excerpt measurement | Whistle | Gemma 4 E2B |
| --- | ---: | ---: |
| Completed without runtime errors | 8 / 8 | 8 / 8 |
| Excerpts with nonempty text | 8 / 8 | 4 / 8 |
| Returned text characters | 218 | 293 |
| Model loading | 0.116 s | 21.533 s |
| All excerpts, including local audio preparation | 9.795 s | 148.900 s |
| Word timestamps | 43 timed words | Not provided |

No Gemma case reached its token or generation-time bound. Nonempty output and character counts describe output extent; they do not show whether speech was present or transcribed correctly. Whistle's word times remain private and relative to each excerpt. Gemma's empty and longer outputs cannot be labeled correct omissions or hallucinations without reference lyrics. These are single local CPU runs, not a hardware benchmark. EmbeddingGemma separately returned eight finite normalized 256-dimensional vectors from the actual title/artist/album text, with 28.695 seconds model loading and 0.814 seconds total encoding; it received no audio and generated no transcript.

## Fixed labeled controls: actual local result

On 2026-10-18, the same eight controls ran with each model loaded once. The report is preserved in `evals/baselines/transcription.gemma4.windows-x64.json`; it contains only the public/licensed control fixtures, not private album text.

| Measurement | Whistle | Gemma 4 E2B |
| --- | ---: | ---: |
| All speech controls: errors / 80 reference words | 5 / 80 (6.25%) | 4 / 80 (5.00%) |
| Human speech errors / 56 reference words | 2 / 56 (3.57%) | 3 / 56 (5.36%) |
| Speech mixed with music errors / 17 words | 2 / 17 | 1 / 17 |
| Synthetic sentence errors / 7 words | 1 / 7 | 0 / 7 |
| Words emitted on digital silence | 0 | 0 |
| Words emitted on two instrumental excerpts | 5 | 0 |
| Artifact verification | 0.037 s | 8.566 s |
| Cold model load | 0.112 s | 21.179 s |
| Warm cases, including fixture reading/preprocessing | 3.993 s | 87.997 s |
| Whole batch process | 4.288 s | 120.495 s |
| Word timestamps | Yes | No |

No Gemma case reached the token or generation-time limit. The combined speech score includes human, synthetic and mixed controls; the mixed control repeats one human excerpt over music, so these are not 80 independent reference words. The three human clips share one narrator, and the lexical metric counts spelling/abbreviation differences without repairing them after predictions. Gemma improved the combined speech score, the mixed/synthetic cases and both instrumental controls, while Whistle had fewer errors on the human-only subset. This small set does not establish a general accuracy winner or validate singing. Retaining Whistle is based on its timestamp/long-track contract, resources and the absence of aligned sung-lyric evidence, not a claim that it is the most accurate model overall. Raw timing is one local run on an idle CPU window, not a hardware benchmark or a GPU comparison.

## Reproduce the comparison

Provision the two production models first using [model setup](model-setup.md). The optional audio model is an explicit larger download:

```sh
python scripts/setup-models.py install --models gemma-audio
python scripts/setup-models.py verify --models gemma-audio
```

For labeled controls, the existing eight-clip manifest covers three human speech clips, synthetic speech, silence, two licensed instrumental excerpts and speech mixed with music. The mixture is not singing. Use the generated runtime environment, then run:

```sh
node --import tsx evals/compare-transcription.ts --models=whistle,gemma-4-E2B-it
```

This opt-in candidate run writes ignored `evals/results/transcription.with-gemma.json`, retaining the existing two-model report. Whistle and Gemma each load once in a separate process for the eight controls. The report separates artifact verification, cold model loading, warm per-case inference and total process wall time; the latter includes Gemma's 10.25 GB hash check and is not a pure model-speed benchmark. Each batch has a 30-minute outer timeout. Gemma uses greedy generation, a 192-token limit and a 120-second generation budget checked between generation steps, reports whether either bound was reached, and returns no fabricated word times. Lexical WER uses known speech references; empty-reference controls report generated words separately. These controls cannot establish accuracy on singing. The default Whistle/Whisper comparison retains its original fresh-process-per-case protocol.

For private albums, use the ignored importer report and keep outputs under `.test-data`:

```sh
# Run with the registered profile's Python interpreter from setup-state.json.
python evals/private-models.py whistle --import-report /local/import-report.json --output .test-data/private-albums/whistle-results.json
python evals/private-models.py embedding --import-report /local/import-report.json --output .test-data/private-albums/embedding-results.json
python evals/private-models.py gemma-audio --import-report /local/import-report.json --output .test-data/private-albums/gemma-results.json
```

The private harness never writes application lyrics or metadata. It rejects redirected output directories, Windows alternate data streams and reserved/ambiguous file names, and uses exclusively created temporary files for atomic reports. This protects against preexisting local redirects; it is not isolation from a hostile concurrent account that can rewrite the workspace. Keep Whistle as the production transcription backend until a candidate demonstrates acceptable sung-lyric accuracy and timestamp alignment on a suitably labeled corpus.
