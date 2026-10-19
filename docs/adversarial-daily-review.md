# Daily recommendation adversarial review

Reviewed the uncommitted daily snapshot, scheduling, play-record ownership, runtime configuration and ranking changes on 2026-10-18. Tests use migrated in-memory SQLite databases and synthetic vectors; this review did not mutate the listener's database, run a model, or restart the app.

## Findings fixed

1. **Delayed failures bypassed backoff.** `retryAfter` was set when a job was enqueued. If it waited more than an hour before exhausting its retries, the next request immediately created another job. The refresh service now measures terminal failure backoff from the job's final `updatedAt`. The scheduler applies the same rule before selecting its batch. A regression delays terminal failure by two hours, verifies a full subsequent hour of backoff, and confirms another account can still be queued.
2. **Old active jobs could starve unscheduled accounts.** Once the enqueue backoff expired, queued/running jobs reentered the first 100 due accounts every minute. The scheduler now excludes active pointers before its limit. A regression creates 101 queued accounts plus a running account, then proves the remaining account is scheduled exactly once after a two-hour backlog.
3. **Web and worker could disagree on their model.** Nuxt previously baked unprefixed `EMBEDDING_*` values into its runtime defaults at build time, while the independent worker read `NUXT_EMBEDDING_*`. Nuxt now has static embedding defaults with matching runtime overrides, and the documentation explicitly migrates obsolete unprefixed variables. A scheduler regression verifies custom runtime model, revision, dimensions and library limit enter job payloads. The generated local runtime script already supplies the required `NUXT_` aliases.
4. **Ranking held the SQLite write transaction for excessive time at the supported maximum.** Each candidate/seed pair re-normalized both vectors and allocated temporary arrays. Normalization is now reused across the profile and seeds, and performed once per candidate. Cosine scores, deterministic ties and nearest-seed explanations are preserved by tests. A local synthetic ranking benchmark with 25 seeds measured 403 ms → 50 ms at 2,000 tracks / 256 dimensions, and 10,620 ms → 578 ms at 20,000 tracks / 768 dimensions. These are single-run ranking-only measurements, not a whole-database latency guarantee.

## Verification

All 47 focused tests passed across daily snapshot lifecycle (12), play HTTP ownership/input checks (3), intelligence HTTP (13), queue/worker integration (4), and ranking/model boundaries (15).

The existing adversarial cases also cover another account's history, deleted/transferred/edited candidates, current-owned seed explanations, model changes, cancellation, superseded jobs, redelivery without timestamp advancement, failed refresh retention, cold starts and downtime catch-up. Snapshot ranking records store IDs, content hashes and scores; returned track details are reconstructed from the currently owned library.

The metrics remain counts of qualified recorded plays, not measured listening time or verified completions. Only owned, currently indexed tracks contribute to the semantic profile. Model quality and real-album end-to-end tests are separate checks.

## Nuxt MCP source

Read the official [Nuxt 3 runtime configuration documentation](https://nuxt.com/docs/3.x/guide/going-further/runtime-config) through `mcp__nuxt`. It documents matching `NUXT_` runtime overrides, warns against defaults sourced from differently named build-time environment variables, recommends `useRuntimeConfig(event)` in server routes, and explains that the built server does not automatically read `.env`. The intelligence HTTP boundary already uses `useRuntimeConfig(event)` and keeps model configuration private.
