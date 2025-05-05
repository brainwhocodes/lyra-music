# ✅ Phase 3: Media Library Management

### Tasks

* [x] `POST /api/libraries` to add a directory
* [x] `GET /api/libraries` to list libraries
* [x] Scanner script:

  * [x] Recursively walk folder
  * [x] Use `music-metadata` to read:

    * Title, artist, album, genre, duration, year, album art
  * [x] Save album art locally or in DB
  * [x] Prevent duplicate artists/albums/tracks
  * [x] Associate library entry with current user (Handled via scan trigger)
* [x] UI to trigger manual rescan

### Clarification Questions

* Should the scanner run on a schedule or only on demand?
* Can multiple users point to the same media folder?
* Do you want live file watching?
