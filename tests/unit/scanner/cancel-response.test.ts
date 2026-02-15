import { describe, expect, it } from 'vitest';
import { buildCancelResponse } from '~/server/services/scanner/cancel-response';

describe('buildCancelResponse', () => {
  it('returns cancelled=false when job is not cancellable', () => {
    expect(buildCancelResponse('scan-1', null)).toEqual({
      scanId: 'scan-1',
      cancelled: false,
      reason: 'not_cancellable',
    });
  });

  it('returns cancelled=true when cancellation was requested', () => {
    expect(buildCancelResponse('scan-1', { jobId: 'job-1', state: 'running' as const })).toEqual({
      scanId: 'scan-1',
      cancelled: true,
    });
  });
});
