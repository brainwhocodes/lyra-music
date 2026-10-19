# Job Worker

This directory contains a DB-backed queue and worker for long-running background jobs.

## Run in development

```bash
pnpm worker
```

## Production recommendation

Run the worker as a separate process/container so scans cannot block Nitro request handling.

The entry point loads `.env` and starts the loop explicitly on Windows, macOS and
Linux. Use the same `DATABASE_URL` and filesystem access as the web server. Apply
`pnpm db:migrate` before starting a new installation. Stop the process with Ctrl+C.

The worker also schedules persisted personal recommendations on startup and every
minute, refreshing each account's snapshot every 24 hours. See
[`docs/daily-recommendations.md`](../../docs/daily-recommendations.md) for signals,
API freshness fields, cold starts, retries and local setup.

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
