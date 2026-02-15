# Data Integrity: Queue + Scan Pipeline

## Constraints
- `scan_files(scan_id, path)` is unique to guarantee idempotent retries and prevent duplicate rows.
- `scan_runs.job_id` references `job_queue.job_id` with cascade delete to keep queue/scan linkage consistent.

## Upsert semantics
- File rows are inserted in batches and updated on conflict (`size_bytes`, `mtime_ms`, `extension`, `updated_at`).
- This keeps rescans deterministic and safe under retries.

## Retry policy
- Queue retries transient failures with exponential backoff (`2^attempts`, capped at 60s).
- After `maxAttempts`, job becomes `failed` and `scan_runs.last_error` is recorded.

## Indexes
- Queue scheduling indexes:
  - `job_queue_state_run_after_idx`
  - `job_queue_type_state_run_after_idx`
- UI/status indexes:
  - `scan_runs_user_state_idx`
  - `scan_files_scan_id_idx`
