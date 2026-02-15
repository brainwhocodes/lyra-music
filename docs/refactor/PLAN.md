# Refactor plan

## Phase 1: Baseline + guardrail design
- **Intent**: Document current scan flow and identify highest-risk correctness/perf bugs.
- **Files touched**: `docs/refactor/BASELINE.md`, `docs/refactor/PLAN.md`.
- **Risks**: None (docs-only).
- **Tests**: None.

## Phase 2: Root-cause path safety fix
- **Intent**: Replace prefix-based allowed-root checks with robust path-containment semantics.
- **Files touched**: `server/services/scanner/scan.ts`, `server/services/scanner/path-safety.ts`.
- **Risks**: Could block valid paths if containment logic is wrong; mitigate with focused unit tests.
- **Tests to add**:
  - Unit tests for containment helper.
  - Regression test proving sibling-prefix path is rejected.

## Phase 3: Resilient traversal + observability
- **Intent**: Prevent full scan failures from per-path filesystem errors while recording errors for visibility.
- **Files touched**: `server/services/scanner/walk.ts`, `server/services/scanner/scan.ts`.
- **Risks**: Might mask severe errors; mitigate by incrementing error counters and preserving last error.
- **Tests to add**:
  - Unit test that unreadable directory does not abort the entire walk.
  - Existing ingestion flow test remains green as behavior safety net.

## Phase 4: Verification
- **Intent**: Execute scanner-focused unit/integration tests and ensure no regressions.
- **Files touched**: tests only.
- **Risks**: Environment-specific FS permission behavior; keep test cleanup robust.
- **Tests to run**:
  - `vitest tests/unit/scanner/*.test.ts`
  - `vitest tests/integration/jobs/queue-worker.test.ts`
