# Phase 5: Enhanced Playback & Queue Management

This phase focuses on improving the audio playback experience with queue management and more robust controls.

## Features

*   [x] Implement track queue in player store
    *   [x] Store a list of tracks (the queue)
    *   [x] Store the index of the currently playing track in the queue
    *   [x] Action to load a new queue (e.g., all tracks from an album)
    *   [x] Action to play a specific track within the current queue
    *   [x] Logic to automatically play the next track when the current one ends
*   [ ] Add queue management controls to the player UI
    *   [x] Next track button
    *   [x] Previous track button
    *   [x] (Optional) Shuffle button
    *   [x] (Optional) Repeat button (none, one, all)
    *   (Optional) View/edit current queue
*   [x] Add "Play Album" button on album views (e.g., libraries page)
    *   [x] Fetch tracks for the selected album
    *   [x] Load fetched tracks into the player store's queue and start playback

## Future Considerations

*   Saving/loading playlists
*   Adding individual tracks to the current queue
*   Reordering the queue
