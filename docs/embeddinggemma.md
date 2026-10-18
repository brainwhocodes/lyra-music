# Local music intelligence

Lyra uses the official `google/embeddinggemma-2` checkpoint to search the meaning of track metadata and available lyrics, suggest descriptive tags, and recommend tracks from listening history. The model revision is pinned to `914f7f89142e33e77833254d9c9b90c3cef7303b`. No API key or hosted inference service is required.

EmbeddingGemma outputs vectors, not text. Whistle remains responsible for transcription. This integration only loads the text encoder and does not listen to the recording: a suggested “Calm” tag describes similarity to a text category, not a measured acoustic property. Sparse metadata and inaccurate lyrics produce weaker results. Suggestions do not overwrite the library's genre or other metadata.

## Install and download

The reproducible path is `python scripts/setup-models.py install --models embedding`
followed by `python scripts/setup-models.py verify --models embedding`. See
[model setup](model-setup.md) for dependency/model pins, offline smoke checks,
disk/cache handling and generated `NUXT_` environment snippets. The manual steps
below remain useful when managing the environment yourself.

Python 3.12 on Windows x64 was tested. From the project directory:

```powershell
py -3.12 -m venv .venv-embedding
.\.venv-embedding\Scripts\python.exe -m pip install -r requirements-embedding.txt
.\.venv-embedding\Scripts\python.exe -c "from huggingface_hub import snapshot_download; print(snapshot_download('google/embeddinggemma-2', revision='914f7f89142e33e77833254d9c9b90c3cef7303b'))"
```

On Linux/macOS, use `python3 -m venv .venv-embedding` and `.venv-embedding/bin/python`. Those platforms are supported by the libraries but were not exercised in this Windows session. The setup download uses the public, ungated Apache-2.0 model repository. Runtime requests are forced offline and cannot download a missing model.

The official checkpoint is about 1.53 GB on disk even when loading only the 270M-parameter text encoder. The full checkpoint contains the other encoders. Float32 text weights alone require roughly 1.1 GB of RAM, with additional runtime and inference overhead. Allow several GB of available memory. Windows without symlink support may use extra cache space. The bundled multimodal processor still imports Pillow and Torchvision; both are pinned in the requirements despite text-only inference.

Configure the executable using an absolute path. In development `.env`:

```dotenv
NUXT_EMBEDDING_PYTHON=C:/path/to/lyra/.venv-embedding/Scripts/python.exe
```

Production must receive this environment variable when starting `.output/server/index.mjs`. The Python runner is embedded in the Nitro bundle, so it does not depend on the source checkout or current directory. The server's operating-system account must have access to the downloaded Hugging Face cache. To provision a different account/cache, set `HF_HOME` consistently during setup and runtime.

Run `pnpm db:migrate` to apply the checked-in journal, including the additive `0003_track_embeddings` migration, before using the feature. Existing installations originally created with `db:push` should keep that schema workflow (`pnpm db:push`) rather than replaying the initial migration onto an unjournaled database. Back up an existing database before changing its schema. No existing tracks or lyrics are rewritten by the embeddings migration.

## API and indexing

Every endpoint verifies the session. Tracks are joined to albums owned by that user; orphan tracks without an album are excluded. Listening events are additionally filtered by user. Ownership and input content are checked again after asynchronous inference, including before committing generated vectors.

| Endpoint | Behavior |
| --- | --- |
| `GET /api/intelligence/status` | Counts total, current and pending tracks without loading the model. `ready` means at least one current index entry; `runtime.loaded` is separate. |
| `POST /api/intelligence/index` | Accepts `{ "limit": 16 }` (1–16). Indexes one pending batch and returns `indexedThisBatch`, `indexedTracks`, `pendingTracks`, `totalTracks`. Repeat while pending tracks remain. The handler lives at `server/api/intelligence/index/index.post.ts` so Nitro preserves the `/index` path segment. |
| `GET /api/intelligence/search?q=...&limit=20` | Searches current indexed tracks using a query embedding; 1–1000 query characters, 1–50 results. |
| `GET /api/intelligence/recommendations?limit=20` | Returns explainable local recommendations or a clearly labelled recently-added cold start. |
| `GET /api/intelligence/tags?trackId=...` | Returns suggested taxonomy tags with model, revision, taxonomy version, score and input provenance. |

Each track stores three normalized 256-dimensional vectors: retrieval, custom-category clustering, and sentence similarity. The text prioritizes explicit genre and up to 3000 lyric characters before album/artist metadata, within 4000 total characters and 2048 model tokens. Album genres fill missing track genres. Retrieval supplies the title in its dedicated prefix; category/similarity text uses titles only when genre and lyrics are missing, reducing the influence of metaphorical titles. Cached vectors are invalidated when this text, retrieval title, formatting version, model, revision or dimensions change. Stale entries are excluded until indexing runs again. Search never silently rebuilds the whole library. JSON vector storage uses roughly tens of kilobytes per track, rather than a separate vector database.

Recommendations use the latest 500 listening events, capped at 25 weighted seed tracks. Recorded listens shorter than 30 seconds (or half a short track) are ignored, affinity decays over 30 days, and events older than 180 days are ignored. Tracks recently heard or already used as seeds are excluded. Each result names an actual similar seed. A first pass limits each album to two results, then fills remaining slots if necessary. Without meaningful listening history, the response says `cold-start` and orders current indexed tracks by addition date.

Search combines 85% semantic cosine with 15% coverage of meaningful query tokens in the track's genre and lyrics. Titles, album names and artist names receive no lexical boost. Negated English requests and queries with no meaningful tokens use semantic scores alone. This fixed blend retains semantic paraphrase matching while using explicit descriptions when available; returned search scores are ranking scores, not probabilities.

The versioned taxonomy has 12 mood, theme and style descriptions. Both track and label use the documented clustering prompt for custom categories. At most three tags are returned above a cosine floor of 0.7 and within 0.08 of the best category. A first pass selects one per category, then fills any remaining slots. These are explicit heuristics, not calibrated confidence probabilities or measured music-classification accuracy. An empty tag list is valid. Model-quality evaluations are separate from deterministic tests of ranking mechanics; the final small evaluation still exposes a calm piano description incorrectly tagged with other moods/themes. Suggested tags need human judgment.

## Limits and failure behavior

The default library cap is 2000 tracks, configurable through `NUXT_EMBEDDING_MAX_TRACKS` up to 20000. Exceeding it produces 413, without silently omitting tracks. `NUXT_EMBEDDING_DIMENSIONS` accepts 128, 256, 512 or 768 and requires reindexing. `NUXT_EMBEDDING_TIMEOUT_MS` defaults to 300000, bounded to 100–900000. Model and revision overrides are `NUXT_EMBEDDING_MODEL` and `NUXT_EMBEDDING_REVISION`; use an explicit compatible revision and rebuild the index after changing either.

One local CPU worker handles one batch at a time with four CPU threads and four inputs per inference batch. Concurrent requests receive 429 rather than entering an unbounded queue. The process is killed on timeout (504), malformed or oversized output (502), and releases model memory after 60 seconds idle. Missing Python/dependencies/cache produces 503. Inputs are capped at 64 items/1 MiB per request; stdout and stderr are each bounded to 2 MiB during inference. Subprocess arguments never pass through a shell. A failure leaves existing cached embeddings intact.

## Validation

```powershell
pnpm test
$env:EMBEDDING_REAL_TESTS='1'
$env:EMBEDDING_PYTHON=(Resolve-Path .venv-embedding/Scripts/python.exe).Path
pnpm exec vitest run tests/integration/intelligence-runtime.test.ts
```

Default tests use synthetic vectors only to verify mathematics and mock the inference boundary only for HTTP/database behavior. They cover JWT authentication, user isolation, content invalidation, concurrent ownership changes, migration constraints and bounded subprocess behavior. The opt-in tests call the actual cached model offline and check semantic ordering plus deterministic repeated inference. See the repository's Evalite suite for the separate semantic-quality dataset and reported outcomes.

Official references: [model and capabilities](https://huggingface.co/google/embeddinggemma-2), [task prompts and custom categories](https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers), [Google's overview](https://deepmind.google/models/gemma/embeddinggemma/).
