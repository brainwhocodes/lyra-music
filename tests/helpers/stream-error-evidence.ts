/** Account for individual decoder cleanup events, never URL-wide exceptions. */
export interface StreamRequestEvidence {
  url(): string;
  method(): string;
  failure(): { errorText: string } | null;
}

export function remainingStreamErrors<T extends StreamRequestEvidence>(
  errors: readonly string[], requests: readonly T[], failures: readonly T[], qualified: ReadonlySet<T>,
) {
  if (requests.some(request => !qualified.has(request))) throw new Error('Unqualified original-stream request');
  if ([...qualified].some(request => !requests.includes(request))) throw new Error('Evidence refers to an unobserved request');
  if (new Set(failures).size !== failures.length) throw new Error('Duplicate request failure event');
  const remaining = [...errors];
  for (const request of failures) {
    if (!qualified.has(request)) throw new Error('Unqualified original-stream abort');
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') throw new Error('Unexpected original-stream failure');
    const message = request.method() + ' ' + request.url() + ': net::ERR_ABORTED';
    const index = remaining.indexOf(message);
    if (index < 0) throw new Error('Failure event lacks its exact guard occurrence');
    remaining.splice(index, 1);
  }
  return remaining;
}
