import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { db } from '~/server/db';
import { enqueueJob, requestJobCancel } from '~/server/jobs/queue';
import { processSingleJob } from '~/server/jobs/worker';
import { jobQueue, scanFiles, scanRuns } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { readFileSync } from 'node:fs';

vi.mock('~/server/utils/scanner', () => ({
  scanLibrary: vi.fn().mockResolvedValue({
    scannedFiles: 2,
    addedTracks: 2,
    addedArtists: 1,
    addedAlbums: 1,
    skippedFiles: 0,
    errors: 0,
  }),
}));

const root = fileURLToPath(new URL('../../../', import.meta.url));
const testDbPath = join(root, 'server', 'tests', 'integration', 'scanner', 'test-db.sqlite');

async function applyMigrations() {
  const conn = new Database(testDbPath);
  const migrationDir = join(root, 'server', 'db', 'migrations');
  const migrationFiles = (await readdir(migrationDir))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(join(migrationDir, file), 'utf8').replaceAll('--> statement-breakpoint', '');
    try { conn.exec(sql); } catch (error: any) { if (!String(error.message).includes('already exists')) throw error; }
  }
  conn.close();
}

describe('queue + worker scan integration', () => {
  beforeAll(async () => {
    await mkdir(dirname(testDbPath), { recursive: true });
    await applyMigrations();
  });

  beforeEach(async () => {
    await db.delete(scanFiles);
    await db.delete(scanRuns);
    await db.delete(jobQueue);
  });

  it('processes a queued scan and persists files', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'scan-fixture-'));
    try {
      await writeFile(join(fixtureDir, 'one.mp3'), '1');
      await writeFile(join(fixtureDir, 'two.flac'), '2');

      const scanId = 'scan-int-1';
      const queued = await enqueueJob({
        type: 'scan.directory',
        payload: { scanId, libraryId: 'lib-1', userId: 'u1', rootPath: fixtureDir, allowedRoots: [fixtureDir], processOnlyUnprocessed: false, options: {} },
      });
      expect(queued.queued).toBe(true);

      await db.insert(scanRuns).values({ scanId, jobId: queued.jobId!, userId: 'u1', rootPath: fixtureDir, state: 'queued' });

      await processSingleJob();

      const rows = await db.select().from(scanFiles).where(eq(scanFiles.scanId, scanId));
      expect(rows.length).toBe(2);

      const [scan] = await db.select().from(scanRuns).where(eq(scanRuns.scanId, scanId)).limit(1);
      expect(scan?.state).toBe('succeeded');
      expect(scan?.filesPersisted).toBe(2);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  it('cancellation marks run cancelled and stops work', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'scan-fixture-cancel-'));
    try {
      await writeFile(join(fixtureDir, 'one.mp3'), '1');
      const scanId = 'scan-int-cancel';
      const queued = await enqueueJob({
        type: 'scan.directory',
        payload: { scanId, libraryId: 'lib-1', userId: 'u1', rootPath: fixtureDir, allowedRoots: [fixtureDir], processOnlyUnprocessed: false, options: {} },
      });
      await db.insert(scanRuns).values({ scanId, jobId: queued.jobId!, userId: 'u1', rootPath: fixtureDir, state: 'queued' });
      await requestJobCancel(queued.jobId!);

      await processSingleJob();

      const [scan] = await db.select().from(scanRuns).where(eq(scanRuns.scanId, scanId)).limit(1);
      expect(scan?.state).toBe('cancelled');
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
