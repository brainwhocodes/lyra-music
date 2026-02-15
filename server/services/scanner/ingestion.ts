import type { ScanStats } from '~/server/utils/scanner/scan-types';

export interface LibraryIngestionInput {
  libraryId: string;
  libraryPath: string;
  userId: string;
  processOnlyUnprocessed: boolean;
}

/**
 * Adapter boundary between the new job pipeline and legacy ingestion logic.
 * Keeps scan job orchestration decoupled from scanner module internals.
 */
export async function runLibraryIngestion(input: LibraryIngestionInput): Promise<ScanStats> {
  const { scanLibrary } = await import('~/server/utils/scanner');
  return scanLibrary({
    libraryId: input.libraryId,
    libraryPath: input.libraryPath,
    userId: input.userId,
    processOnlyUnprocessed: input.processOnlyUnprocessed,
  });
}
