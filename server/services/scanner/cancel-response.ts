import type { requestJobCancel } from '~/server/jobs/queue';

export function buildCancelResponse(scanId: string, cancelRequest: Awaited<ReturnType<typeof requestJobCancel>>) {
  if (!cancelRequest) {
    return {
      scanId,
      cancelled: false,
      reason: 'not_cancellable',
    } as const;
  }

  return {
    scanId,
    cancelled: true,
  } as const;
}
