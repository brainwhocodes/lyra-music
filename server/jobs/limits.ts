export interface JobLimits {
  maxConcurrentJobs: number;
  perTypeConcurrency: Record<string, number>;
  maxDbBatchSize: number;
  maxFsConcurrency: number;
  maxScanDepth: number;
  maxFilesPerScan: number;
  maxJobRuntimeMs: number;
  queueMaxLength: number;
  queueMaxInflight: number;
  leaseDurationSeconds: number;
  pollIntervalMs: number;
}

function envNum(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getJobLimits(): JobLimits {
  return {
    maxConcurrentJobs: envNum('MAX_CONCURRENT_JOBS', 2),
    perTypeConcurrency: {
      'scan.directory': envNum('MAX_CONCURRENT_SCAN_JOBS', 1),
    },
    maxDbBatchSize: envNum('MAX_DB_BATCH_SIZE', 500),
    maxFsConcurrency: envNum('MAX_FS_CONCURRENCY', 8),
    maxScanDepth: envNum('MAX_SCAN_DEPTH', 32),
    maxFilesPerScan: envNum('MAX_FILES_PER_SCAN', 200000),
    maxJobRuntimeMs: envNum('MAX_JOB_RUNTIME_MS', 30 * 60 * 1000),
    queueMaxLength: envNum('QUEUE_MAX_LENGTH', 1000),
    queueMaxInflight: envNum('QUEUE_MAX_INFLIGHT', 8),
    leaseDurationSeconds: envNum('JOB_LEASE_DURATION_SECONDS', 45),
    pollIntervalMs: envNum('JOB_POLL_INTERVAL_MS', 750),
  };
}

export const limits = getJobLimits();
