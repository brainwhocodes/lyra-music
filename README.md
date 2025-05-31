# Lyra Music

Lyra Music is a modern, self-hosted music streaming application designed to give you control over your personal music library. Built with Nuxt 3, Vue 3, and Pinia for a reactive frontend experience, it uses Drizzle ORM with SQLite to manage your music metadata. Scan your local music folders, organize your collection by artists and albums, create custom playlists, and stream your favorite tunes.

## Key Features

*   **Self-Hosted:** Full control over your music library and data.
*   **Local Music Scanning:** Easily scan and import your existing music folders.
*   **Music Organization:** Browse your collection by artists and albums.
*   **Playlist Management:** Create, edit, and manage custom playlists.
*   **Music Streaming:** Stream your tracks directly through the web interface.
*   **User Authentication:** Secure access to your personal music library.
*   **Album Art Display:** Visually browse your library with album cover art.
*   **Playback Queue:** View and manage upcoming tracks.
*   **Search Functionality:** Quickly find specific tracks, albums, or artists.
*   **Responsive UI:** Accessible on desktop and mobile devices.
*   **Modern Tech Stack:** Built with Nuxt 3, Vue 3, Pinia, and Drizzle ORM for a fast and responsive experience.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

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
