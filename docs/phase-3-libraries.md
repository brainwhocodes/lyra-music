# ✅ Phase 3: Media Library Management

### Tasks

* [ ] `POST /api/libraries` to add a directory
* [ ] `GET /api/libraries` to list libraries
* [ ] Scanner script:

  * Recursively walk folder
  * Use `music-metadata` to read:

    * Title, artist, album, genre, duration, year, album art
  * Save album art locally or in DB
  * Prevent duplicate artists/albums/tracks
  * Associate library entry with current user
* [ ] UI to trigger manual rescan

### Clarification Questions

* Should the scanner run on a schedule or only on demand?
* Can multiple users point to the same media folder?
* Do you want live file watching?
