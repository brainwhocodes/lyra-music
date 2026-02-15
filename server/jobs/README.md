# Job Worker

This directory contains a DB-backed queue and worker for long-running background jobs.

## Run in development

```bash
pnpm tsx server/jobs/worker.ts
```

## Production recommendation

Run the worker as a separate process/container so scans cannot block Nitro request handling.

## Limits

The worker is guarded by environment-based limits in `server/jobs/limits.ts`:
- `MAX_CONCURRENT_JOBS`
- `MAX_CONCURRENT_SCAN_JOBS`
- `MAX_FS_CONCURRENCY`
- `MAX_DB_BATCH_SIZE`
- `MAX_SCAN_DEPTH`
- `MAX_FILES_PER_SCAN`
- `MAX_JOB_RUNTIME_MS`
- `QUEUE_MAX_LENGTH`
- `QUEUE_MAX_INFLIGHT`
