# Lyra Music

A self-hosted music library built with Nuxt, Vue, Pinia and SQLite. Browse albums,
artists and genres, stream local files, build playlists and library-seeded radio
stations, follow podcasts, and keep a playback queue with timed lyrics.

The responsive interface uses an original anime/graffiti radio identity, with
public landing pages at `/`, `/features` and `/self-host`. `/explore` adds local
semantic search, suggested tags and listening-history recommendations using
EmbeddingGemma. Cactus Whistle transcribes lyrics locally. Neither model needs
an API key after its initial download.

The player integrates a [complete-track waveform](docs/track-waveform.md) into
its native seek bar. Mediabunny builds it locally while playback continues;
unsupported files, resource limits and podcasts retain a plain seek bar.
Compact and full-screen controls share the result, with volume available on
demand. The [editable form and transport kit](docs/design/lyra-radio/controls-v3/control-kit.html)
documents the shared controls and their states.

## Quick start

Install Git, Node.js **22.12+** (Node 24 also tested), **64-bit Python 3.12**,
and **FFmpeg** on PATH. Python and FFmpeg support the local models; the bootstrap
script does not install system packages. Use pnpm **10.12.1** throughout. If
`pnpm` is not installed or has a different version, substitute
`npx --yes pnpm@10.12.1` for every `pnpm` command below.

```sh
git clone https://github.com/brainwhocodes/lyra-music.git
cd lyra-music
npx --yes pnpm@10.12.1 install --frozen-lockfile
```

Copy the example configuration once on a fresh clone:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
```

```sh
# Linux/macOS
cp .env.example .env
```

Edit your private `.env` before starting:

- Set `NUXT_JWT_SECRET` to a random signing key of at least 32 characters. Generate
  one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`.
  Keep this key across restarts.
- Choose a separate private `SECRET_ACCESS_CODE` for account registration. Also
  add `NUXT_SECRET_ACCESS_CODE` with the same value so a production build can read
  it at runtime. Development bypasses the signup access-code check.
- Keep `DATABASE_URL="./db.sqlite"`, or choose a persistent SQLite filename.
- For scans without Genius credentials, set `SCANNER_DISABLE_GENIUS=true` and
  add `NUXT_SCANNER_DISABLE_GENIUS=true` for the production server.

Apply the schema to a **new database**, then provision the models using the next
section:

```sh
pnpm db:migrate
```

Back up an existing database first. Installations originally made with
`db:push` should continue using `pnpm db:push` instead of replaying initial
migrations against an unjournaled database. Never commit `.env`, your database,
uploaded covers or private music.

Once the app and worker are running, open [Lyra locally](http://127.0.0.1:3000),
create your own account, add a music directory in **Settings → Music folders**,
and scan it. Organize files in separate artist/album directories. Then open
**Explore** and index your tracks to enable semantic search and suggested tags.
The ordinary music library works without downloaded models; local transcription
and semantic indexing require their respective setup profiles.

Music scans and daily recommendation refreshes require the
[background worker](server/jobs/README.md). The legacy library is shared among
authenticated listeners; this is not a tenant-isolated
hosting product. Folder settings, playlist/station edits, listening history and
the new intelligence index enforce their respective user ownership.

## Local models

**Model weights are not included in Git or the production bundle.** Each person
running Lyra downloads them with the checked-in
[`scripts/setup-models.py`](scripts/setup-models.py) bootstrap. It installs pinned
dependencies into ignored `.venv-whistle` and `.venv-embedding` directories,
downloads pinned artifacts into the current account's Hugging Face cache, checks
their SHA-256 hashes, and verifies actual local inference. Generated paths and
reports stay in ignored `.tools/models/`; setup does not rewrite `.env`.

| Profile | Used by | Approximate model download |
| --- | --- | ---: |
| `whistle` — default | Timestamped lyric transcription | 17 MB plus native engine |
| `embedding` — default | EmbeddingGemma 2 metadata/lyrics embeddings for search, tags and recommendations | 1.53 GB |
| `gemma-audio` — optional | Gemma 4 E2B generative audio comparison, not a production service | 10.3 GB |

Run from the repository root:

```powershell
# Windows, explicitly selecting the supported Python version
py -3.12 scripts/setup-models.py install
py -3.12 scripts/setup-models.py verify
```

```sh
# Linux/macOS
python3.12 scripts/setup-models.py install
python3.12 scripts/setup-models.py verify
```

`install` is the network/download phase and also performs inference checks.
`verify` rechecks the cached installation with offline flags and a Python socket
guard; it does not download missing models. `status` prints the local setup
report without loading a model. `pnpm models:setup` and `pnpm models:verify` are
equivalent shortcuts **when `python` already resolves to 64-bit Python 3.12**.

The selected checkpoints are public, and downloads explicitly disable implicit
Hugging Face tokens; no API key or hosted inference service is required. Setup
does not bypass model access controls. Allow several GB for dependencies and
download staging. Use `--hf-home /absolute/cache/path` to choose a cache and
`--ffmpeg /absolute/path/to/ffmpeg` if FFmpeg is not on PATH. Windows x64 is the
exercised host; Linux/macOS paths and engine selection are supported but have
not been execution-tested in this project session. See
[automatic model setup](docs/model-setup.md) for platform and verification limits.

The larger generative audio model is deliberately excluded from default setup.
To run that comparison, use the same Python launcher with
`scripts/setup-models.py install --models gemma-audio`, followed by
`scripts/setup-models.py verify --models gemma-audio`. It needs roughly 23 GiB of
download headroom and substantially more runtime RAM than the production text
encoder. It does not provide the word timestamps needed by synchronized lyrics.

Further model documentation:

- [Whistle setup](docs/whistle.md): Python environment, FFmpeg and cached CPU model.
- [EmbeddingGemma setup](docs/embeddinggemma.md): pinned model, indexing, limits and API.
- [Evaluation results](docs/evaluations.md): Evalite policies, semantic quality and
  measured Whistle/Whisper comparison. Whistle remains selected. One calm-tag
  case still fails the semantic quality gate; suggestions need review.
- [Gemma audio comparison](docs/gemma-whistle-comparison.md): optional Gemma 4
  setup and measured results, including why synchronized lyrics still use Whistle.

EmbeddingGemma embeds track metadata and available lyrics; it does not replace
speech recognition or measure a recording's acoustic mood. Index your library
from Explore after installing the model. Suggested tags do not overwrite genres.

## Run the app and worker

On Windows, the local production launcher loads the generated model paths,
applies migrations, and starts both the web server and a background worker:

```powershell
pnpm build
pnpm local:start:windows
# Alternatively: powershell -NoProfile -File scripts/start-local.ps1 -Port 3000
```

Keep this terminal open; Ctrl+C stops the server and its worker. Worker logs go
to ignored `.test-data/local-runtime/`. Stop the launcher before rebuilding on
Windows, where running native modules can lock build output files.
This migration-running launcher is for new or migration-journaled databases.
For a legacy `db:push` database, maintain its schema with `pnpm db:push` and run
the web server and worker separately; do not replay the initial migrations.

On Linux/macOS, start the two processes in separate terminals from the same
checkout. Source the generated model paths in **both** terminals:

```sh
# Terminal 1: build and run the web server
. .tools/models/runtime-env.sh
pnpm build
node --env-file=.env .output/server/index.mjs
```

```sh
# Terminal 2: scans and daily recommendations
. .tools/models/runtime-env.sh
pnpm worker
```

For development, replace the web build/start commands with `pnpm dev` and keep
the worker running separately. In PowerShell development terminals, load model
paths with `. .\.tools\models\runtime-env.ps1` instead of the POSIX command.
Both processes must use the same `.env`, database, model settings and filesystem
access. Production Nuxt does not automatically load `.env`; the commands above
and Windows launcher load it explicitly.

The worker checks for due recommendations every minute and refreshes each
listener's saved mix every **24 hours**, using qualifying recorded plays and
cached track embeddings. With no listening history it shows a labeled recent
tracks fallback. New plays affect the next scheduled mix; indexing can make a
refresh due sooner. The machine and worker must be running: after downtime the
worker catches up on restart. See [daily recommendations](docs/daily-recommendations.md)
for metrics, cold starts, retry behavior and signal limitations.

## Checks without API keys

```sh
pnpm fixtures:verify
pnpm test
pnpm evals
pnpm exec playwright install chromium
pnpm build
pnpm test:e2e
```

Real-model checks are opt-in once weights are cached. See [testing](docs/testing.md)
and [adversarial review](docs/adversarial-review.md) for commands, results and
coverage limits. Two licensed excerpts from Scott Buckley's free albums and an
original spoken fixture are checked in with [credits and checksums](tests/fixtures/music/README.md).
The tests use isolated temporary databases, never your library database.
For music ZIPs already on this computer, `pnpm test:private-albums` runs the
[opt-in private album checks](docs/private-albums.md). Audio, album covers,
databases and detailed reports stay in ignored local storage. Missing inputs
produce an explicit skip; they are never downloaded or added to Git.

The current [Lyra Radio identity](docs/design/lyra-radio/brand-guide.md) includes
original anime/graffiti artwork, transparent logos and locally hosted Barlow
Condensed/Space Grotesk fonts. The [portable brandkit](docs/design/lyra-radio/lyra-radio-brandkit.zip)
contains an editable offline board, font licenses and generation provenance.
See the [listening layout concepts and research](docs/design/lyra-radio/ux-v2/design-review.md)
and [current browser verification](docs/design/lyra-radio/ux-v2/browser-verification.md).
The [expanded landing pages](docs/design/lyra-radio/landing-v2/README.md) include
three 1920×5000 presentation mockups, implementation comparisons and responsive
checks. [Responsive artwork](docs/design/lyra-radio/artwork-v2/README.md) supplies
AVIF/WebP sizes for phones, tablets and desktops. The
[ten radio explorations](docs/design/lyra-radio/radio-explorations-v1/index.html)
remain design options awaiting selection.
The [initial radio implementation record](docs/design/lyra-radio/radio-implementation.md)
is preserved with its original verification results.
The earlier [design evidence](docs/design/lyra/README.md) is retained as history.

## Production

```sh
pnpm build
node --env-file=.env .output/server/index.mjs
```

Supply `NUXT_JWT_SECRET`, `NUXT_SECRET_ACCESS_CODE` and model settings as runtime
environment variables in deployed environments. Set `DATABASE_URL` and keep the
SQLite database and music files on persistent storage. Run the scan/recommendation
worker as a separate supervised process, and load the generated model environment
in both processes. Python environments and model caches are local installation
artifacts, not part of the Nuxt production bundle.

Generate a signing key once with
`node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`
and save the output as `NUXT_JWT_SECRET` in your private `.env` or deployment
secret store. Keep it across restarts; changing it signs existing sessions out.
Authentication rejects empty keys, keys shorter than 32 characters and example
placeholders. Existing installations must rename `JWT_SECRET` to
`NUXT_JWT_SECRET`; signing keys are read at runtime and are never built into
the application. Do not commit `.env`.

## Release Process

This project uses a GitHub Actions workflow to automate the building and tagging of releases. The workflow is triggered when a branch named `release-v*` (e.g., `release-v0.1.0`) is pushed to the repository.

**Manual Steps Before Pushing a Release Branch:**

1.  **Create and checkout a release branch:**
    From your `master` branch (or your main development branch), create a new branch for the release. Replace `X.Y.Z` with the target version number.
    ```bash
    git checkout -b release-vX.Y.Z master
    ```

2.  **Update version:**
    Update the `version` in your `package.json` file. You can do this manually or use the `npm version` command. Using `npm version` is recommended as it follows semantic versioning. Do **not** let npm create a git tag; the workflow will handle this.
    ```bash
    # For a patch release (e.g., 0.1.0 -> 0.1.1)
    npm version patch --no-git-tag-version

    # For a minor release (e.g., 0.1.0 -> 0.2.0)
    npm version minor --no-git-tag-version

    # For a major release (e.g., 0.1.0 -> 1.0.0)
    npm version major --no-git-tag-version
    ```

3.  **Update lock file:**
    After updating `package.json`, regenerate the `pnpm-lock.yaml` file to reflect any version changes in dependencies or the package itself.
    ```bash
    pnpm install --frozen-lockfile=false
    ```

4.  **Commit changes:**
    Commit the updated `package.json` and `pnpm-lock.yaml` files to your `release-vX.Y.Z` branch.
    ```bash
    git add package.json pnpm-lock.yaml
    git commit -m "chore(release): prepare release vX.Y.Z"
    ```
    (Replace `X.Y.Z` with the version number).

5.  **Push the release branch:**
    Push the `release-vX.Y.Z` branch to GitHub.
    ```bash
    git push origin release-vX.Y.Z
    ```

**Automated Workflow:**

Once the `release-v*` branch is pushed, the GitHub Actions workflow will:
*   Checkout the code from the pushed branch.
*   Install dependencies.
*   Build the application.
*   Read the version from `package.json`.
*   Create a Git tag (e.g., `vX.Y.Z`).
*   Push the new Git tag to the repository.

You can monitor the workflow's progress under the "Actions" tab of your GitHub repository.

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.
