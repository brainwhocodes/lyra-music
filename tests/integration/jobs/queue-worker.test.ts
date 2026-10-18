import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { join } from 'node:path';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { db } from '~/server/db';
import { enqueueJob, requestJobCancel } from '~/server/jobs/queue';
import { processSingleJob } from '~/server/jobs/worker';
import { jobQueue, scanFiles, scanRuns } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { tmpdir } from 'node:os';
import { migrateTestDatabase } from '../../helpers/database';

vi.mock('~/server/services/scanner/ingestion', () => ({
  runLibraryIngestion: vi.fn().mockResolvedValue({
    scannedFiles: 2,
    addedTracks: 2,
    addedArtists: 1,
    addedAlbums: 1,
    skippedFiles: 0,
    errors: 0,
  }),
}));

describe('queue + worker scan integration', () => {
  beforeAll(async () => {
    migrateTestDatabase(db.$client);
  });
  afterAll(() => db.$client.close());

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

  it('allows a nested album directory within an approved music root', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'scan-nested-'));
    try {
      const albumPath = join(fixtureDir, 'Artist', 'Album');
      await mkdir(albumPath, { recursive: true });
      await writeFile(join(albumPath, 'one.mp3'), '1');
      const scanId = 'scan-nested';
      const queued = await enqueueJob({
        type: 'scan.directory',
        payload: { scanId, libraryId: 'lib-1', userId: 'u1', rootPath: albumPath, allowedRoots: [fixtureDir], processOnlyUnprocessed: false, options: {} },
      });
      await db.insert(scanRuns).values({ scanId, jobId: queued.jobId!, userId: 'u1', rootPath: albumPath, state: 'queued' });
      await processSingleJob();
      const [scan] = await db.select().from(scanRuns).where(eq(scanRuns.scanId, scanId));
      expect(scan.state).toBe('succeeded');
      expect(scan.filesPersisted).toBe(1);
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });

  it('rejects a sibling directory sharing the allowed root prefix', async () => {
    const fixtureDir = await mkdtemp(join(tmpdir(), 'scan-sibling-'));
    try {
      const allowed = join(fixtureDir, 'music');
      const sibling = join(fixtureDir, 'music-private');
      await mkdir(allowed);
      await mkdir(sibling);
      const scanId = 'scan-sibling';
      const queued = await enqueueJob({
        type: 'scan.directory',
        payload: { scanId, libraryId: 'lib-1', userId: 'u1', rootPath: sibling, allowedRoots: [allowed], processOnlyUnprocessed: false, options: {} },
      });
      await db.insert(scanRuns).values({ scanId, jobId: queued.jobId!, userId: 'u1', rootPath: sibling, state: 'queued' });
      await processSingleJob();
      const [scan] = await db.select().from(scanRuns).where(eq(scanRuns.scanId, scanId));
      expect(scan.state).not.toBe('succeeded');
      expect(scan.filesPersisted).toBe(0);
      const [job] = await db.select().from(jobQueue).where(eq(jobQueue.jobId, queued.jobId!));
      expect(job.lastError).toContain('outside allowed roots');
    } finally {
      await rm(fixtureDir, { recursive: true, force: true });
    }
  });
});
