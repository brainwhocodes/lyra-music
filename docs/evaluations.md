# Local model evaluations

EmbeddingGemma2 supplies similarity vectors, not a transcript. Lyra uses its text
encoder for metadata and available lyrics, with separate retrieval, clustering
and sentence-similarity prompts. The current
[EmbeddingGemma page](https://ai.google.dev/gemma/docs/embeddinggemma) describes a
multimodal model, but the text-only configuration is intentional here. Adding an
audio encoder would enable audio similarity, not turn an embedding into generated
lyric text. See the official [model card](https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2)
and [Sentence Transformers instructions](https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers).

## Evalite compatibility and commands

The project pins **Evalite 0.16.0 and Vitest/coverage 3.2.4** together. At the time
of implementation, stable Evalite 0.19.0 and the 1.0 beta depend on Vitest runner
4; 0.16.0 is the last stable line using runner 3. The repository previously used
Vitest 3.1.2. This avoids mixing runner majors or adopting the beta API. Verify
package metadata before upgrading both tools. The
[official stable docs](https://www.evalite.dev/quickstart/) describe `.eval.ts`
tasks and scorers; the [CI guide](https://www.evalite.dev/guides/ci/) explains
score thresholds and JSON export.

```sh
pnpm evals                    # 13 deterministic policy/metric cases; no model required
pnpm evals:models             # 28 cases using the real local EmbeddingGemma2 runtime
pnpm exec evalite watch       # optional local results UI
```

For the real run, first follow `docs/embeddinggemma.md` to provision the Python
runtime and cached public weights. Set `NUXT_EMBEDDING_PYTHON` to that environment's
Python executable. Missing dependencies/weights fail the model run; they are never
silently replaced by mock vectors. A direct Evalite run without `LYRA_MODEL_EVALS=1`
skips the model suite, while `pnpm evals:models` explicitly enables it.

`evals/run.mjs` writes ignored machine-readable results to `evals/results/`.
Each scorer returns 1 only if its quality floor passes, while recording the raw
metrics in metadata. The overall threshold is **100%** so a good average cannot
hide a broken case. Thresholds and the original fixture text were authored before
running the model.

| Evaluation | Cases | Required result |
| --- | ---: | --- |
| Ranking/tag/recommendation policies and metric controls | 13 | Exact documented geometry, limits, abstention, history handling, metric output |
| Real semantic retrieval | 8 | MRR ≥ 0.5, Recall@3 ≥ 0.5, nDCG@3 ≥ 0.7 for each query |
| Additional retrieval query holdout | 8 | Same three retrieval floors; fixed before candidate inference |
| Real descriptive tags | 6 | At least one relevant tag, no contradictory tag, at most three tags |
| Real recommendations | 6 | Relevant alternative in top two, no seed replay or contradictory first pick |

The real corpus contains 12 original, fictional track descriptions. Queries are
paraphrases; misleading titles such as a calm track called “Nightclub at Dawn”
help detect title-only matching. Expected relevance is authored independently
of model output. Retrieval uses the same production text serializer and prompt;
tagging uses the same shared threshold as the HTTP service; recommendations use
the production history/ranking function with a fixed clock. No cloud judge or API
key is involved.

The tag cosine floor of 0.7, relative margin of 0.08 and maximum of three tags are
heuristics, not confidence probabilities or calibrated music labels. The suite
evaluates affinity to text descriptions. It does not validate acoustic instrument
detection, genres from audio, broad multilingual quality, or user satisfaction.

The 13 policy cases passed at 100%. Setting `LYRA_EVAL_NEGATIVE_CONTROL=1` deliberately
reverses the ranking output: the same run fell to 85% and exited 1. This is a
regression-detection check, not another quality score. Remove that variable for
normal runs. Real-model results are recorded below after execution.

The first actual model run scored **90% (18/20)** and correctly exited 1. Seven
of eight retrieval cases, five of six tag cases and all six recommendations met
their floors. The relaxation query ranked the dance-party track first (nDCG@3
0.387); the gentle piano track's suggested tags omitted Calm and included Nature
and Electronic. The unchanged corpus exposed metadata/title sensitivity and
uncalibrated tags that deterministic vector tests could not detect. Initial raw
results are retained in `evals/baselines/semantic.initial-256d.json`; this is a
failed baseline, not a claim that the semantic quality gate passed.

The fixed comparisons retained those original twenty cases and floors:

| Candidate | Passed | Main finding |
| --- | ---: | --- |
| Initial representation, 256 dimensions | 18/20 | Relaxation retrieval and calm-piano tagging failed |
| Same representation, 768 dimensions | 17/20 | Added a contradictory Romantic tag on travel rock; relaxation still below the floor |
| Genre/lyrics-first representation, 256 dimensions | 18/20 | Relaxation Recall@3 improved to 1, but nDCG@3 remained 0.693 and piano tags still failed |
| Same representation plus eight new queries, before hybrid ranking | 26/28 | All eight added queries passed; original two failures remained |
| Fixed hybrid ranking and category-diverse tags, 256 dimensions | 27/28 | All sixteen retrieval queries and six recommendations passed; one tag case still failed |

The last candidate uses 85% semantic cosine and 15% lexical coverage from explicit
genre/lyrics, with a semantic-only fallback for negated queries. Tag selection
first takes one eligible match per category, preserving the original cosine and
relative-margin floors. The formula was fixed before its inference run; the
protocol and its timing are recorded in `evals/candidate-protocol.md`. The new
queries use the same fictional tracks, so they test query generalization rather
than an independent external music corpus. Neither their labels nor the original
twenty expected results were rewritten to fit the predictions.

**The final model quality gate remains failing: 27/28 (96.4%), exit 1.** The calm
piano description receives Nature, Instrumental and Melancholy suggestions and
misses Calm. Tags should remain reviewable suggestions, not authoritative labels.
The score is a count of small authored cases meeting their floors, not a global
accuracy estimate. All intermediate raw JSON reports remain in `evals/baselines/`,
including `semantic.final-hybrid-256d.json`; the 768-dimensional candidate was not
adopted. A broader licensed music corpus and independent relevance judgments are
still needed before claiming general semantic music quality.

## Whistle versus a local Whisper baseline

The alternative is **faster-whisper 1.2.1**, public
`Systran/faster-whisper-base.en` at revision
`3d3d5dee26484f91867d81cb899cfcf72b96be6c`, CPU int8, four threads, beam size five,
English, no prompt, no VAD and no previous-text conditioning. The comparison runs
the actual production Whistle adapter with cactus-needle 3.2.1. Both use cached
weights offline and a fresh process per clip. Wall time includes process startup,
model load and decoding, so this is a local pipeline measurement rather than a
general model speed claim. [Faster-whisper's official documentation](https://github.com/SYSTRAN/faster-whisper)
describes its CPU runtime and comparison options.

```sh
python -m venv .venv-evals
# Use .venv-evals/bin/python on Unix or .venv-evals/Scripts/python.exe on Windows:
python -m pip install -r requirements-evals.txt
python evals/faster-whisper-runner.py --prepare
python evals/prepare-transcription.py
# Set EVAL_PYTHON and WHISTLE_PYTHON to their respective venv executables;
# set WHISTLE_FFMPEG_PATH if ffmpeg is not on PATH.
pnpm evals:transcription
```

Run the pip/prepare commands with the evaluation environment's Python, not an
unrelated system Python. PyAV is pinned to 16.0.1 because the newer 19.0.1 removed
an argument still used by faster-whisper 1.2.1. Preparation downloads three
CC-BY-4.0 LibriSpeech clips. `evals/fixtures/transcription.json` includes the exact
reference, license, source, transformation and checksum; the fixture README
provides attribution. Both instrumental clips already have Scott Buckley credits.
The original synthesized sentence and generated silence are separate controls.

The first local run on 2026-10-18, Windows x64, Ryzen 9 3900X:

| Metric | Whistle | Whisper base.en |
| --- | ---: | ---: |
| Human speech word errors / 56 reference words | 2 / 56 (3.57%) | 4 / 56 (7.14%) |
| Speech mixed with music WER | 11.76% | 5.88% |
| Synthetic speech WER | 14.29% | 0% |
| Words emitted on ten seconds of digital silence | 0 | 1 |
| Words emitted on the two instrumental excerpts | 5 | 5 |
| Total pipeline time, eight clips | 8.896 s | 24.536 s |

WER lowercases Unicode text, removes punctuation, and counts token edits divided
by reference words; it is not capped at 100%. It intentionally does not rewrite
“Mr.” to “mister” or repair names after seeing predictions. Empty references use
hallucinated-word counts instead of an undefined WER. Outputs pass the same
timestamp parser, but there are no hand-aligned timestamps to measure alignment
accuracy. Raw per-case outputs and timestamps are in the generated JSON report.
The captured first run is also saved in
`evals/baselines/transcription.windows-x64.json` for review without rerunning models.
Its unchanged cached Whistle weights were independently fingerprinted after the
run: cactus-needle 3.2.1, `whistle.cact` (16,919,407 bytes), SHA-256
`b6e02f048568ac5d01a2042556c658061e699acbc0aa2a1439f52f3d461dffeb`.
The separate `transcription-runtime-identity.windows-x64.json` preserves that
audit without rewriting historical timings. Future comparison reports capture
the installed Whistle version and weights fingerprint before inference; set
`WHISTLE_MODEL_PATH` to evaluate an explicit local weights file.

A second full eight-clip run with the recorded runtime identity is preserved in
`evals/baselines/transcription.repeat.windows-x64.json`. Human speech, mixed speech,
synthetic speech and silence results were unchanged. Whisper emitted two words
over the instrumental excerpts in that run, versus five in the first; Whistle
emitted five in both. Pipeline totals were 8.738 s and 21.552 s respectively.
This observed output variability further limits conclusions from a single short
music test; neither run changes the lack of verified singing evaluation data.

**Decision: retain Whistle.** The alternative did not improve aggregate human
speech error rate, silence behavior or local pipeline time on this small set.
It did improve the mixed and synthetic speech cases. Both models hallucinated on
instrumental music. Three clips from one narrator are insufficient to establish
general speech quality, and none is verified singing. A future switch needs a
licensed, independently transcribed sung-vocal corpus with multiple singers,
genres and languages, plus held-out WER, hallucination and alignment checks.
Neither synthetic speech nor speech mixed over music proves lyric accuracy.

The separate optional **Gemma 4 E2B** comparison uses the same checksummed controls:
`node --import tsx evals/compare-transcription.ts --models=whistle,gemma-4-E2B-it`.
Provision `gemma-audio` explicitly first; it is a 10.3 GB generative checkpoint,
distinct from production EmbeddingGemma. Its output is text without word times,
so the comparison records absent timestamps rather than passing invented lines
through the timestamp parser. Results go to
`evals/results/transcription.with-gemma.json`. See the
[capability and private-album comparison](gemma-whistle-comparison.md) for scope,
resource limits and the absence of song reference transcripts. The historical
Whistle/Whisper results above remain unchanged.
