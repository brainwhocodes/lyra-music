# Karaoke Mode with Lyrics Feature Checklist

This document outlines the tasks required to implement the karaoke mode with lyrics feature.

## Phase 1: Backend - Database & Core Lyrics Logic

- [x] **Database Schema (using Drizzle ORM):**
    - [x] Define the `lyrics` table schema using Drizzle ORM syntax (e.g., in a new file like `server/db/schema/lyrics.ts` or by extending an existing schema file).
    - [x] The `lyrics` table should include:
        - `id` (Primary Key)
        - `track_id` (Foreign Key referencing the `tracks` table, unique)
        - `lyrics_json` (TEXT or JSON type to store timestamped lyrics, e.g., `[{ "time": "00:01.23", "text": "lyric line" }, ...]`). Consider JSONB for PostgreSQL for better querying.
        - `source` (Optional: e.g., 'generated_llm', 'manual_upload', 'synced_lrc', 'user_edited')
        - `llm_model_used` (Optional: TEXT, to store which model generated the lyrics, e.g., 'gemini-2.5-flash')
        - `raw_llm_output` (Optional: TEXT, to store the raw output from the LLM for debugging/retraining)
        - `created_at` (Timestamp)
        - `updated_at` (Timestamp)
    - [x] Ensure the `lyrics` table has a one-to-one or one-to-many (if a track could have multiple lyric versions/sources) relationship with the `tracks` table, using `track_id` as a foreign key.
    - [x] Generate and apply the database migration using Drizzle Kit (e.g., `npx drizzle-kit generate:pg` and `npx drizzle-kit push:pg`).
- [ ] **API Endpoints (Lyrics):**
    - [x] `GET /api/tracks/:trackId/lyrics`: Fetches lyrics for a specific track from the `lyrics` table. (Implemented as `GET /api/tracks/:trackId/lyrics/index.get.ts`)
    - [ ] `POST /api/tracks/:trackId/lyrics/generate`:
        - [ ] Retrieves the audio file path for the given `trackId`.
        - [ ] **Step 1: Audio Transcription**
            - [ ] Implements logic to transcribe the audio file to get raw lyrics (ideally with timestamps).
            - [ ] Utilizes a chosen transcription service/model (e.g., Gemini audio models, AssemblyAI, local model).
            - [ ] Handles API key management securely if an external service is used.
        - [ ] **Step 2: Lyrics Grounding & Verification**
            - [ ] Implements a 'grounding/verification' process for the transcribed lyrics using Gemini's grounding feature (Google Search as a tool).
            - [ ] This involves a second call to the Gemini API (e.g., `verifyLyricsWithGrounding` function) with the transcribed lyrics, track title, and artist name, prompting the model to verify and correct the lyrics based on information retrieved from Google Search.
        - [ ] Defines a Zod schema for validating the structure of the *final processed* timestamped lyrics (e.g., array of objects with `time` and `text` fields).
        - [ ] Validates the final processed lyrics using the Zod schema.
        - [ ] Implements a retry mechanism for transcription and/or grounding steps if they fail.
        - [ ] If successful, ensures the final output is in the target JSON structure for `lyrics_json`.
        - [x] Saves the processed lyrics (and optionally `raw_llm_output`, `llm_model_used`, `source` indicating transcription/grounding) to the `lyrics` table, associating it with the `track_id` (handles insert/update on conflict).
    - [ ] `PUT /api/tracks/:trackId/lyrics`: Allows manual uploading or editing of lyrics.
        - [ ] Accepts lyrics in the defined JSON structure.
        - [ ] Updates the existing lyrics record or creates a new one for the track.
        - [ ] Sets `source` to 'manual_upload' or 'user_edited'.
    - [ ] `DELETE /api/tracks/:trackId/lyrics`: Deletes lyrics for a specific track.
- [ ] **Server-Side Logic & Configuration:**
    - [ ] Implement utility functions for: 
        - [ ] Audio transcription (interfacing with the chosen service/model).
        - [ ] Lyrics grounding and verification logic.
    - [ ] Add necessary configuration for the LLM API (key, endpoint) to server environment variables.
    - [~] Ensure proper error handling and logging for all API endpoints, transcription, and grounding interactions - Basic error handling in place.

## Phase 2: Frontend - UI/UX for Lyrics

- [ ] **Lyrics Display Modal:**
    - [ ] Create a new Vue component (e.g., `components/modals/lyrics-modal.vue` or `components/lyrics/lyrics-viewer-modal.vue`).
    - [ ] Modal should accept `trackId` as a prop.
    - [ ] On open, fetch lyrics using `GET /api/tracks/:trackId/lyrics`.
    - [ ] If lyrics exist, display them in a scrollable view.
    - [ ] If lyrics do not exist, display a message like "No lyrics found for this track." and a "Generate Lyrics" button.
    - [ ] **Generate Lyrics Flow:**
        - [ ] Clicking "Generate Lyrics" calls `POST /api/tracks/:trackId/lyrics/generate`.
        - [ ] Show a loading/processing state (e.g., spinner, progress message "Generating lyrics, this may take a moment...").
        - [ ] On success, refresh lyrics display with newly generated lyrics.
        - [ ] On failure (after retries), show an error message (e.g., "Failed to generate lyrics. Please try again later or add them manually.").
    - [ ] (Optional) Add a button to allow manual editing/pasting of lyrics, which would call `PUT /api/tracks/:trackId/lyrics`.
- [ ] **Integration with Player/Track View:**
    - [ ] Add a "View Lyrics" / "Karaoke" button/icon (e.g., microphone icon) to:
        - [ ] Track list items.
        - [ ] Player controls (for the currently playing track).
        - [ ] Album track list.
    - [ ] Clicking this button opens the `lyrics-modal` for the respective track.
- [ ] **Lyrics Synchronization (Karaoke Mode - Advanced):**
    - [ ] In the lyrics modal, if lyrics are present and audio is playing:
        - [ ] Parse the timestamped lyrics (e.g., `[{ "time": "00:01.23", "text": "lyric line" }, ...]`).
        - [ ] Listen to the audio player's current playback time updates.
        - [ ] Highlight the current lyric line(s) based on the playback time.
        - [ ] Ensure smooth scrolling to keep the active line in view.

## Phase 3: Documentation & Refinements

- [ ] Update backend API documentation (e.g., Swagger/OpenAPI if used) for new lyrics endpoints.
- [ ] Add frontend component documentation for the lyrics modal and any new UI elements.
- [ ] Write unit and integration tests for:
    - [ ] New API endpoints (lyrics CRUD, generation logic).
    - [ ] LLM interaction utilities.
    - [ ] Zod validation for lyrics.
    - [ ] Frontend lyrics modal component (fetching, display, generation trigger).
- [ ] Conduct user testing and gather feedback on the karaoke feature.
- [ ] Refine UI/UX based on feedback.
- [ ] Consider performance implications for LLM calls and lyrics synchronization.
