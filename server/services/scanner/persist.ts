import { db } from '~/server/db';
import { scanFiles } from '~/server/db/schema';
import { sql } from 'drizzle-orm';
import { limits } from '~/server/jobs/limits';
import type { WalkEntry } from './walk';

export class ScanBatchWriter {
  private readonly batchSize: number;
  private readonly scanId: string;
  private buffer: WalkEntry[] = [];
  private persisted = 0;
  private flushed = 0;

  constructor(scanId: string, batchSize = limits.maxDbBatchSize) {
    this.scanId = scanId;
    this.batchSize = Math.min(batchSize, limits.maxDbBatchSize);
  }

  add(entry: WalkEntry) {
    this.buffer.push(entry);
  }

  get size() {
    return this.buffer.length;
  }

  get stats() {
    return { persisted: this.persisted, batchesFlushed: this.flushed };
  }

  async flush() {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.batchSize);
    await db.insert(scanFiles).values(batch.map((entry) => ({
      scanId: this.scanId,
      path: entry.path,
      sizeBytes: entry.sizeBytes,
      mtimeMs: entry.mtimeMs,
      extension: entry.extension,
      updatedAt: new Date().toISOString(),
    }))).onConflictDoUpdate({
      target: [scanFiles.scanId, scanFiles.path],
      set: {
        sizeBytes: sql`excluded.size_bytes`,
        mtimeMs: sql`excluded.mtime_ms`,
        extension: sql`excluded.extension`,
        updatedAt: new Date().toISOString(),
      },
    });

    this.persisted += batch.length;
    this.flushed += 1;

    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
