import { describe, expect, it } from 'vitest';
import { InflightLimiter } from '~/server/jobs/worker';

describe('InflightLimiter', () => {
  it('tracks global and per-type slots', () => {
    const limiter = new InflightLimiter();

    limiter.start('scan.directory');
    expect(limiter.count).toBe(1);

    limiter.finish('scan.directory');
    expect(limiter.count).toBe(0);
  });
});
