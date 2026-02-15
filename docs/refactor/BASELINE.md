# Baseline: Directory Scanning + Ingestion Flow

## Entrypoints
- `server/api/libraries/[libraryId]/scan.post.ts` (fire-and-forget call to scanner from request handler).
- `server/api/settings/scan/index.post.ts` (multi-folder scan directly awaited in request handler).
- `server/utils/scanner/index.ts` (`scanLibrary` does traversal, metadata extraction, remote enrichment, and DB writes in one path).
- `server/utils/scanner/file-utils.ts` (`findAudioFiles` recursively reads directories and returns full array).
- `server/utils/scanner/progress-tracker.ts` (in-memory session tracking only).

## Current call graph (short)
1. HTTP scan route validates auth + folder.
2. Route calls `scanLibrary(...)`.
3. Scanner reads all file paths (`findAudioFiles`) into memory.
4. Scanner parses metadata/enrichment per file and performs DB writes via `db-operations`.
5. Route either blocks until completion (`settings/scan`) or returns while same process continues (`libraries/:id/scan`).

## Top 5 root-cause risks
1. **Heavy work on request thread**: scan work is initiated from API handlers and in one route directly awaited.
2. **Unbounded memory growth**: traversal accumulates full audio path list before processing.
3. **No durable queue/progress**: progress state is in-memory and lost on restart; no persisted cancellation state.
4. **Duplicate/fragmented scan orchestration**: multiple routes trigger scans with inconsistent behavior and retry/backpressure semantics.
5. **Resource spikes**: metadata extraction + DB writes happen in large loops without strict global job concurrency/backpressure controls.
