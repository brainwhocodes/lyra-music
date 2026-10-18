# Local lyric transcription with Whistle

Lyra converts a track to 16 kHz mono PCM with ffmpeg, transcribes it locally with
[Cactus Compute Whistle](https://cactuscompute.com/blog/whistle), and groups word
timestamps into the existing `[{ time: "MM:SS.mmm", text: "..." }]` lyric format.
Minutes can exceed 59 so both existing lyric players seek correctly. No Gemini
account or API key is used. The Python runner is bundled into the Nuxt server.

## Install once

For a reproducible installation with pinned model and native-engine hashes, use
`python scripts/setup-models.py install --models whistle`, then
`python scripts/setup-models.py verify --models whistle`. See
[model setup](model-setup.md) for prerequisites, cache selection and generated
production environment snippets. The manual commands below describe the upstream
runtime's default cache behavior; the provisioner additionally pins the engine
and model files explicitly.

Install Python 3.9+ and ffmpeg, then from the project root on Windows PowerShell:

```powershell
python -m venv .venv-whistle
.\.venv-whistle\Scripts\python.exe -m pip install -r requirements-whistle.txt
$env:NEEDLE_TELEMETRY = "0"
.\.venv-whistle\Scripts\python.exe -c "import needle; print(needle.transcribe([0.0] * 16000, word_timestamps=True))"
```

macOS/Linux:

```sh
python3 -m venv .venv-whistle
.venv-whistle/bin/python -m pip install -r requirements-whistle.txt
NEEDLE_TELEMETRY=0 .venv-whistle/bin/python -c 'import needle; print(needle.transcribe([0.0] * 16000, word_timestamps=True))'
```

The final command downloads the public approximately 17 MB speech model and
platform engine into the current user's cache, then checks real silence. It needs
internet access once and should print an empty `text` and `words` list. Perform
setup as the account that runs the server, including inside your production
container. Python packages themselves are installed separately from pnpm.

Set `WHISTLE_PYTHON` in `.env` to the absolute virtual-environment Python path,
for example `C:/path/to/lyra/.venv-whistle/Scripts/python.exe` on Windows or
`/path/to/lyra/.venv-whistle/bin/python` on macOS/Linux. The default is `python`
on Windows and `python3` elsewhere. Spaces in executable/file paths are supported.

Server requests force `HF_HUB_OFFLINE=1`, `NEEDLE_TELEMETRY=0`, and `DO_NOT_TRACK=1`.
They never download models or send track audio to a remote inference service.
An unprovisioned server returns a useful 503 error without changing saved lyrics.
The upstream runtime supports macOS, Linux and Windows x64/ARM64; this change was
executed on Windows x64. See the official
[runtime source](https://github.com/cactus-compute/needle/tree/main/needle/agent)
for platform and cache behavior.

## Configuration

| Development `.env` | Production runtime environment | Default |
| --- | --- | --- |
| `WHISTLE_PYTHON` | `NUXT_WHISTLE_PYTHON` | platform Python command |
| `WHISTLE_MODEL_PATH` | `NUXT_WHISTLE_MODEL_PATH` | cached public Whistle model |
| `WHISTLE_FFMPEG_PATH` | `NUXT_WHISTLE_FFMPEG_PATH` | `ffmpeg` |
| `WHISTLE_TIMEOUT_MS` | `NUXT_WHISTLE_TIMEOUT_MS` | `300000` |
| `WHISTLE_MAX_DURATION_SECONDS` | `NUXT_WHISTLE_MAX_DURATION_SECONDS` | `1200` |

Nuxt's non-prefixed variables are read during development/build. Override a built
server at startup with the `NUXT_` names. Optional `WHISTLE_MODEL_PATH` points to
a local custom `.cact` model; it still needs the cached native engine. Keep
executable/model paths controlled by the server operator. For air-gapped
deployment, provision the runtime cache in the image or configure the upstream
`NEEDLE3_LIB_PATH` for the engine and a local model path.

One transcription can run per server process; concurrent requests receive 429
and can be retried after completion. Multi-process deployments should budget one
job per worker or apply a shared gateway limit. The entire conversion plus
inference has one timeout (100–900000 ms), a 4 MiB stdout/stderr bound, a 512 MiB
input cap and a configurable duration cap (1–3600 seconds). Longer tracks are
rejected, never silently saved as partial lyrics. Intermediate audio is limited
to the duration cap plus 0.1 seconds, uses a unique OS temporary directory, and is
removed after success or failure. Subprocesses use argument arrays without a shell.

## Quality limits and validation

Whistle is a speech recognizer, not a music-specific lyric model. Its
[official documentation](https://github.com/cactus-compute/needle#whistle) warns
that music can produce hallucinated words. Singing, layered vocals, accents,
instrumental passages and lyric line breaks need human review. The supported
base languages are English, German, French, Spanish, Italian, Dutch and Polish.
Word timestamps are grouped by pauses, punctuation and line length; they do not
claim musical verse or beat alignment. Silence/no speech returns 422 from the
lyrics endpoint and preserves the full prior database row. Invalid output,
timeouts and failed inference also leave prior lyrics intact.

The committed tests cover timestamp validation, process injection/timeout/output
bounds, cleanup and concurrency, real MP3 conversion, and HTTP/SQLite saving and
preservation. Run the normal no-key suite with `pnpm test`.

After installing/caching Whistle, run its real offline inference tests in PowerShell:

```powershell
$env:WHISTLE_REAL_TESTS = "1"
$env:WHISTLE_PYTHON = (Resolve-Path .venv-whistle/Scripts/python.exe).Path
pnpm exec vitest run --config vitest.node.config.ts tests/integration/whistle-runtime.test.ts
```

Or on macOS/Linux:

```sh
WHISTLE_REAL_TESTS=1 WHISTLE_PYTHON="$PWD/.venv-whistle/bin/python" pnpm exec vitest run --config vitest.node.config.ts tests/integration/whistle-runtime.test.ts
```

These tests run the actual model on a synthesized spoken sentence, repeated speech
across a 30-second window boundary, digital silence and a licensed instrumental
excerpt. They validate the integration and
speech recognition, not sung-lyric accuracy. See the fixture manifest for music
licenses and provenance. The default suite skips the four model tests so a clean
checkout does not automatically download or require a Python model runtime.
