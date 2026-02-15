# Baseline: Nuxt/Nitro scan pipeline refactor

## Critical flows

1. **Auth boundary**
   - API routes mostly authenticate with `getUserFromEvent` before scan orchestration (`/api/scan/start`, `/api/scan/status`, `/api/scan/cancel`, `/api/libraries/:libraryId/scan`, `/api/settings/scan`).
2. **Scan enqueue + execution**
   - Handlers call `enqueueScanForLibrary`, which verifies library ownership, creates a `scan_runs` row, and enqueues `scan.directory` jobs.
   - Worker leases jobs and runs `runScanDirectoryJob`.
   - Scan job traverses filesystem (`walkDirectory`), batches discovered file metadata into `scan_files`, then runs legacy ingestion (`runLibraryIngestion` adapter into `server/utils/scanner`).
3. **Scan status + cancellation**
   - `/api/scan/status` joins `scan_runs` + `job_queue` and returns job progress.
   - `/api/scan/cancel` sets `cancel_requested` and runtime checks poll this flag.

## Hotspots (bugs/flakiness/perf)

1. **Path sandbox check was prefix-based**
   - `scan.ts` used `startsWith("${root}/")` semantics, which can incorrectly allow sibling paths with shared prefixes (e.g., `/library-copy` for allowed `/library`).
2. **Traversal brittle on permission/transient FS errors**
   - `walkDirectory` failed entire scans on `opendir`/`stat` errors rather than skipping bad nodes and continuing.
3. **Inconsistent scan observability for partial FS errors**
   - `scan_runs.errors`/`last_error` were not updated with traversal-level failures unless the whole job failed.
4. **Architecture drift risk**
   - API handlers are mostly thin, but scan path validation logic lived inline in runtime service and was not reusable/tested in isolation.

## Prioritized checklist

1. **Fix path containment root-cause bug with regression tests.**
2. **Make directory walk resilient to per-path failures; keep request/job bounded and continue processing.**
3. **Persist traversal error counts consistently in `scan_runs` progress/final state.**
4. **Extract shared path-safety logic into service helper and add unit tests.**
