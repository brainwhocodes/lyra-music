import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const updateMock = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) }));
const selectMock = vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([{ cancelRequested: false }]) })) })) }));

vi.mock('~/server/db', () => ({
  db: {
    update: updateMock,
    select: selectMock,
  },
}));

vi.mock('~/server/jobs/queue', () => ({
  markJobProgress: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('~/server/services/scanner/persist', () => ({
  ScanBatchWriter: class {
    private entries: any[] = [];
    add(entry: any) { this.entries.push(entry); }
    get size() { return this.entries.length; }
    get stats() { return { persisted: this.entries.length, batchesFlushed: this.entries.length ? 1 : 0 }; }
    async flush() {}
    constructor(_scanId: string, _batch: number) {}
  },
}));

const runLibraryIngestionMock = vi.fn().mockResolvedValue({
  scannedFiles: 1,
  addedTracks: 1,
  addedArtists: 1,
  addedAlbums: 1,
  skippedFiles: 0,
  errors: 0,
});

vi.mock('~/server/services/scanner/ingestion', () => ({
  runLibraryIngestion: runLibraryIngestionMock,
}));

describe('runScanDirectoryJob ingestion flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('invokes scanLibrary ingestion before marking success', async () => {
    const { runScanDirectoryJob } = await import('~/server/services/scanner/scan');
    const root = await mkdtemp(join(tmpdir(), 'scan-job-handler-'));
    try {
      await writeFile(join(root, 'one.mp3'), '1');
      const result = await runScanDirectoryJob('job-1', {
        scanId: 'scan-1',
        libraryId: 'lib-1',
        userId: 'user-1',
        rootPath: root,
        allowedRoots: [root],
        processOnlyUnprocessed: true,
        options: {},
      }, async () => false);

      expect(runLibraryIngestionMock).toHaveBeenCalledWith({
        libraryId: 'lib-1',
        libraryPath: root,
        userId: 'user-1',
        processOnlyUnprocessed: true,
      });
      expect((result as any).ingestionStats.addedTracks).toBe(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects sibling paths that only match by prefix', async () => {
    const { runScanDirectoryJob } = await import('~/server/services/scanner/scan');
    const base = await mkdtemp(join(tmpdir(), 'scan-job-prefix-'));
    const allowed = join(base, 'library');
    const sibling = join(base, 'library-copy');

    try {
      await mkdir(allowed);
      await mkdir(sibling);
      await writeFile(join(sibling, 'one.mp3'), '1');

      await expect(runScanDirectoryJob('job-2', {
        scanId: 'scan-2',
        libraryId: 'lib-1',
        userId: 'user-1',
        rootPath: sibling,
        allowedRoots: [allowed],
        processOnlyUnprocessed: true,
        options: {},
      }, async () => false)).rejects.toThrow('outside allowed roots');
    } finally {
      await rm(base, { recursive: true, force: true });
    }
  });
});
