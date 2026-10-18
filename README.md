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

Use Node.js 22.12+ (Node 24 also tested), pnpm **10.12.1**, and FFmpeg on PATH.
If your global pnpm has a different version, substitute
`npx --yes pnpm@10.12.1` for `pnpm` in the commands below.

```sh
npx --yes pnpm@10.12.1 install --frozen-lockfile
```

On a fresh clone, copy `.env.example` to `.env`. Set a random `NUXT_JWT_SECRET` and
`SECRET_ACCESS_CODE`; the latter gates production signups. `DATABASE_URL` is a
local SQLite filename, defaulting to `./db.sqlite`. Never commit `.env` or your
music/database. Disable optional Genius enrichment with `SCANNER_DISABLE_GENIUS=true`
when running without its credentials.

```sh
pnpm db:migrate
pnpm dev
```

Open `http://localhost:3000` and create an account. Existing installations made
with `db:push` should continue using `pnpm db:push` instead of replaying initial
migrations against an unjournaled database. Back up an existing database first.

Music scans are queued. Run the [separate worker](server/jobs/README.md) when
using Settings → Music folders; starting the web server alone does not process
queued scans. Organize files in separate artist/album directories. The legacy
library is shared among authenticated listeners; this is not a tenant-isolated
hosting product. Folder settings, playlist/station edits, listening history and
the new intelligence index enforce their respective user ownership.

## Local models

- [Automatic model setup](docs/model-setup.md): run `pnpm models:setup` to install
  pinned libraries and download model weights, then `pnpm models:verify` to check
  actual local inference. Load the generated runtime environment
  snippet before starting the server.
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
SQLite database and music files on persistent storage. Run the scan worker as a
separate process. Python environments and model caches are local installation
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
