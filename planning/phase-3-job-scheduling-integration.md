```markdown
# Phase 3: Job Scheduling Integration

## Job Definitions (`jobs/discovery-playlist-jobs.ts` or similar)

- [ ] **New Discoveries Job:**
  - [ ] Create a new job class `NewDiscoveriesPlaylistJob` (implementing `Job` interface from gut-punch).
    - `name`: e.g., "NewDiscoveriesPlaylistJob"
    - `maxRetries`: Define appropriate retry count.
    - `backoffStrategy`: Define strategy.
    - `reschedule`: `true`
    - `rescheduleIn`: Weekly interval (e.g., `7 * 24 * 60 * 60 * 1000` milliseconds).
  - [ ] Implement `run()` method:
    - Call `buildNewDiscoveriesPlaylist()` service from Phase 2.
    - Handle success/failure, return `JobResult`.

- [ ] **Similar to Artist Job:**
  - [ ] Create a new job class `SimilarToArtistPlaylistJob` (implementing `Job` interface).
    - `name`: e.g., "SimilarToArtistPlaylistJob"
    - `maxRetries`: Define.
    - `backoffStrategy`: Define.
    - `reschedule`: `true`
    - `rescheduleIn`: Daily interval (e.g., `24 * 60 * 60 * 1000` milliseconds).
  - [ ] Implement `run(params: { artistId: string }): Promise<JobResult>` method:
    - Get `artistId` from `params`.
    - Call `buildSimilarToArtistPlaylist(artistId)` service from Phase 2.
    - Handle success/failure, return `JobResult`.
    - *Comment: The actual rotation logic (which artist to pick next) will be handled by the scheduler or a managing service in Phase 5.*

## Job Registration (`server/plugins/scheduler.ts` or equivalent gut-punch setup)

- [ ] Register `NewDiscoveriesPlaylistJob` with the gut-punch scheduler.
- [ ] Register `SimilarToArtistPlaylistJob` with the gut-punch scheduler.

## Initial Seeding / Scheduling

- [ ] **New Discoveries:**
  - [ ] Ensure `NewDiscoveriesPlaylistJob` is scheduled to run on application startup if it hasn't run before or if its next run time is in the past.
    *This might involve checking the job's status/last run via gut-punch's API if available, or simply scheduling it.* 

- [ ] **Similar to Artist:**
  - [ ] Determine strategy for initial scheduling of `SimilarToArtistPlaylistJob` instances (see Phase 5 for rotation strategy). For now, ensure the job *can* be scheduled with an `artistId`.
  - *Comment: The scheduler plugin might need a mechanism to pick an artist and schedule this job daily. This will be fully defined in Phase 5.* 

```
