import { describe, expect, it } from 'vitest';
import { ScanBatchWriter } from '~/server/services/scanner/persist';

describe('ScanBatchWriter', () => {
  it('buffers entries before flush', () => {
    const writer = new ScanBatchWriter('scan-test', 2);
    writer.add({ path: '/tmp/a.mp3', sizeBytes: 1, mtimeMs: 1, extension: '.mp3' });
    expect(writer.size).toBe(1);
  });
});
