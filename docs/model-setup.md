# Provision local models

The default setup installs **Whistle** for timestamped speech transcription and **EmbeddingGemma 2** for text retrieval, tags and recommendations. They have different jobs. The optional **Gemma 4 E2B** profile is an audio-to-text comparison model; enabling it does not replace either production service.

Use 64-bit Python 3.12 and install `ffmpeg` through your OS package manager. Run commands from the checkout; on Windows use `py -3.12` instead of `python` when necessary, and on Linux/macOS use `python3.12`. Only the standard library is needed in this bootstrap interpreter. Setup creates/reuses `.venv-whistle` and `.venv-embedding`, without changing system Python or `.env`.

```sh
# Explicit network phase: install pinned packages and download public pinned models.
python scripts/setup-models.py install

# Repeatable offline phase: actual local inference with a Python socket guard.
python scripts/setup-models.py verify

# Print the local provisioning/verification report without loading a model.
python scripts/setup-models.py status
```

The model revisions, artifact sizes and SHA-256 digests are checked in at `scripts/model-pins.json`. This also pins each platform's Whistle native engine wheel at a fixed repository revision. Setup extracts only its expected shared library and never executes a wheel's Python installation code. Direct Python dependencies are exactly pinned in the two requirements files; transitive packages are resolved by pip, checked for compatibility, and are not a complete cross-platform lockfile. Model code loads with `trust_remote_code=False`.

Matching installed packages are reused. Existing pinned cached files are reused and hashed before loading. A second install does not recreate the venv or download another copy of those files. Interrupted downloads may require a new partial file, depending on the Hub client and transport. A corrupt artifact fails verification instead of silently replacing a trusted file. Remove only the identified corrupt cached artifact and rerun install if repair is needed. A lock prevents two setup processes from modifying the same environments simultaneously; a forcibly terminated process may leave `.tools/models/setup.lock`, which can be removed after confirming setup is no longer running.

## Cache and resources

| Profile | Checkpoint | Downloaded weights | Runtime |
| --- | --- | ---: | --- |
| `whistle` | Cactus-Compute/whistle | 16,919,407 bytes plus a platform engine under 1 MB | CPU, one process per transcription |
| `embedding` | google/embeddinggemma-2 | 1,488,915,288 bytes plus tokenizer/config (~1.53 GB total) | CPU float32, only the 270M text encoder loaded |
| `gemma-audio` (optional) | google/gemma-4-E2B-it | 10,246,621,918 bytes plus tokenizer/config (~10.3 GB total) | CPU float32 comparison; about 20.5 GB for raw full-model float32 weights plus working memory |

Disk checks reserve room for partial files and copies on hosts without symlink support. Fresh embedding dependencies/model setup needs several GB; optional audio Gemma needs roughly 23 GiB of download headroom plus its environment. Its effective E2B name does not mean the whole checkpoint has two billion parameters: the official model card lists 5.1B including embeddings. Fresh Windows/Linux installs explicitly select PyTorch's official CPU wheel index; macOS uses PyPI's native wheels. The setup does not install CUDA or change GPU drivers. Windows x64/Python 3.12 is the exercised host; Unix path handling and the pinned SDK's Linux/macOS engine selection are supported, but those OS combinations require their own execution check. A platform without published binary dependency wheels fails clearly rather than compiling an untested stack.

The default is the running account's Hugging Face cache. To choose another cache before installation:

```sh
python scripts/setup-models.py install --hf-home /absolute/path/to/huggingface
```

Use the same operating-system account in production, or provision the production account/container explicitly. `--ffmpeg /absolute/path/to/ffmpeg` supports a custom binary. Setup does not download system executables, request administrator privileges, or bypass model access controls. All three selected checkpoints are public and do not require an API key; implicit Hugging Face tokens are disabled for their downloads.

## Use the registered paths

After successful inference, setup writes ignored `.tools/models/setup-state.json` and two optional environment snippets containing local paths. Load one in the shell that will start Nuxt:

```powershell
# Windows PowerShell
. .\.tools\models\runtime-env.ps1
pnpm dev
# Or start the previously built production output:
# node .output/server/index.mjs
```

```sh
# POSIX shell
. .tools/models/runtime-env.sh
pnpm dev
```

The snippets use **`NUXT_WHISTLE_*` and `NUXT_EMBEDDING_*`** for production runtime overrides, plus the explicit pinned `NEEDLE3_LIB_PATH` and cache location. Plain `WHISTLE_PYTHON`/`EMBEDDING_PYTHON`, Whistle model and FFmpeg aliases are included for the existing test commands. Non-prefixed custom environment variables alone do not override a previously built Nuxt runtime config. No private `.env` file is read or rewritten by setup.

Verification runs separate interpreters with offline flags and a Python socket audit guard that rejects Python DNS/connection attempts. This is not OS firewall isolation: native-library sockets are outside Python's audit hook. Model loaders use local paths and offline options; the guard reports its scope explicitly. The snapshot repository/revision path and the exact weight file used by the loader must match the hashed artifact. Whistle must recognize the committed synthetic sentence with valid word times and return no words on silence. EmbeddingGemma must return finite normalized 256-dimensional vectors and correctly order one semantic paraphrase. These are installation smoke checks, not lyric-accuracy or broad semantic-quality claims. The existing 28-case model quality evaluation still has its separately documented failing Calm-tag case.

## Optional audio Gemma comparison

```sh
python scripts/setup-models.py install --models gemma-audio
python scripts/setup-models.py verify --models gemma-audio
```

This explicitly downloads the larger generative model and reuses `.venv-embedding`. It is excluded from the default setup. Its verification transcribes the same local speech fixture. Audio stays on this host; it is never sent to a hosted inference service. The comparison helper rejects audio longer than 30 seconds and caps generated tokens. It returns text and timing measurements, **not word timestamps**. It is not wired into production lyric generation.

Run setup's no-model regression tests with:

```sh
python -m unittest discover -s tests -p setup_models_test.py
```

On the exercised Windows x64/Python 3.12 host, all 16 regression groups passed, including snapshot/weight mismatches, corrupt artifacts, engine extraction, concurrent setup, insufficient disk, environment quoting, the Python socket guard and private report boundaries (real Windows junctions/hard links, alternate-stream/device syntax and atomic Unicode writes). Default installation and repeated installation both completed with actual Whistle/EmbeddingGemma inference. A separately created clean Whistle venv installed the pinned requirements, passed `pip check`, and recognized the speech fixture while returning no words on silence. The optional Gemma audio profile also installed and passed standalone verification with the exact spoken sentence, no token/time limit hit and no word timestamps. The four opt-in application Whistle integration cases passed using the generated runtime paths, including a 36-second input spanning model windows. Three actual embedding runtime tests passed, including consecutive Japanese/French/Cyrillic/emoji requests. The new Unicode test failed before an explicit UTF-8 stdio fix: isolated Python ignores `PYTHONUTF8`, so Windows pipes otherwise used Windows-1252 and corrupted metadata. After the fix, the production source engine indexed all 37 private tracks on an isolated database backup in batches of 16, 16 and 5. This is a runtime/serialization check, not a multilingual retrieval-quality score. A clean embedding environment and non-Windows hosts have not been executed in this session.

See [the Gemma/Whistle comparison](gemma-whistle-comparison.md) for the separate private-album protocol, labeled controls and the distinction between embeddings and generated transcripts.

References: [Whistle's official runtime](https://github.com/cactus-compute/needle), [EmbeddingGemma 2 model card](https://ai.google.dev/gemma/docs/embeddinggemma/model_card_2), [Gemma 4 audio guide](https://ai.google.dev/gemma/docs/capabilities/audio), [official Gemma 4 E2B checkpoint](https://huggingface.co/google/gemma-4-E2B-it).
