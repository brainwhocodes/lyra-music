# Refactor Scanner Service: Folder-Centric Approach

This checklist outlines the steps to change the music library scanner from a metadata-driven approach (processing all files recursively) to a folder-centric approach (processing subdirectory by subdirectory, assuming each subdirectory is an album).

- [ ] **Task 1: Modify `scanDirectory` Entry Point (`server/services/scanner.ts`)**
    - [ ] Replace recursive `glob` with `fs.readdir` to list top-level contents.
    - [ ] Iterate through top-level directory contents (`fs.Dirent`).
    - [ ] For each subdirectory found (`dirent.isDirectory()`), call a new `processAlbumFolder` function.
    - [ ] Define strategy for handling audio files directly in the top-level folder (e.g., skip for now).
    - [ ] Aggregate results (scanned, added, errors) from `processAlbumFolder` calls.

- [X] **Task 2: Create `processAlbumFolder` Function (`server/services/scanner.ts`)**
    - [X] Function signature: `async processAlbumFolder(folderPath: string): Promise<{ scanned: number; added: number; errors: number }>`.
    - [X] Find audio files *directly within* `folderPath` (non-recursive).
    - [X] Initialize `albumData = null`, `albumId = null`, `trackInsertList = []`.
    - [X] Loop through audio files found:
        - [X] Parse metadata (`music-metadata`).
        - [X] Find/Create *Track Artist*.
        - [X] If `albumData` is null (first valid track):
            - [X] Extract album title, year, album artist name from metadata.
            - [X] Find/Create *Album Artist* and store their ID.
            - [X] Populate `albumData` (title, year, albumArtistId).
        - [X] Create track data object (title, trackArtistId, duration, track#, disk#, filePath) and add to `trackInsertList`.
        - [X] Handle metadata errors for individual tracks.
    - [X] After loop:
        - [X] If `trackInsertList` is empty or `albumData` is null, log skip and return zeros.
        - [X] Find/Create Album using `albumData`, ensuring `artPath` is initially null. Get the `albumId`.
        - [X] Iterate `trackInsertList`, assign `albumId` to each track object.
        - [X] Insert tracks into DB (bulk insert if possible).
        - [X] Implement Folder-Level Cover Art Search:
            - [X] Define cover filenames (`cover.jpg`, `folder.png`, etc.).
            - [X] Search for these files *directly within* `folderPath` (`fs.access`).
            - [X] If found, read file (`fs.readFile`).
            - [X] Process/save using `processAndSaveCoverArt` helper to get `relativePath`.
            - [X] Update the corresponding album entry in DB with `artPath = relativePath`.
            - [X] Stop search after first cover found.
        - [X] Return `{ scanned: number, added: number, errors: number }` for the folder.

- [X] **Task 3: Refactor/Remove Old Logic**
    - [X] Remove recursive `glob` from `scanDirectory`.
    - [X] Remove/adjust embedded picture handling logic within the track loop (if folder art is the primary/only source).
    - [X] Verify `processAndSaveCoverArt` helper is still suitable or adjust if needed.

- [X] **Task 4: Update API Response**
    - [X] Ensure `/api/settings/scan` correctly aggregates and returns the results from the new folder-by-folder processing.

- [ ] **Task 5: Testing**
    - [ ] Prepare sample folder structures with various scenarios:
        - Album with external `cover.jpg`.
        - Album with embedded art in the first track.
        - Album with multiple tracks but no cover art.
        - Album with multiple cover art files (test stopping at first found).
