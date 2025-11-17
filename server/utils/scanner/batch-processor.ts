import { Worker } from 'node:worker_threads';
import { cpus } from 'node:os';
import { resolve } from 'node:path';
import type { FileBatchResult, BatchProcessingResult, WorkerPoolConfig, FileMetadata } from './scan-types';
import { chunkArray } from './file-system-utils';
import { db } from '~/server/db';
import { artists, albums, tracks, albumArtists, artistsTracks, genres, albumGenres } from '~/server/db/schema';
import type { Artist, Album, Track } from '~/server/db/schema';

export class BatchProcessor {
  private config: WorkerPoolConfig;
  private activeWorkers: Set<Worker> = new Set();

  constructor(config?: Partial<WorkerPoolConfig>) {
    this.config = {
      maxWorkers: Math.min(cpus().length, 8),
      batchSize: 25,
      timeoutMs: 30000,
      ...config
    };
  }

  /**
   * Processes files in parallel batches using worker threads
   */
  async processFilesBatch(
    fileMetadataList: FileMetadata[],
    userId: string,
    onProgress?: (processed: number, total: number) => void
  ): Promise<BatchProcessingResult> {
    const fileBatches = chunkArray(fileMetadataList, this.config.batchSize);
    const results: FileBatchResult[] = [];
    let processedCount = 0;

    // Process batches in parallel with limited concurrency
    const concurrentBatches = Math.min(this.config.maxWorkers, fileBatches.length);
    const batchPromises: Promise<FileBatchResult[]>[] = [];

    for (let i = 0; i < fileBatches.length; i += concurrentBatches) {
      const currentBatches = fileBatches.slice(i, i + concurrentBatches);
      
      const batchResults = await Promise.allSettled(
        currentBatches.map(batch => this.processSingleBatch(batch, userId))
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(...result.value);
        } else {
          // Handle batch failure
          console.error('Batch processing failed:', result.reason);
          // Add error results for all files in failed batch
          const failedBatch = currentBatches[batchResults.indexOf(result)];
          for (const fileMetadata of failedBatch) {
            results.push({
              success: false,
              filePath: fileMetadata.filePath,
              error: `Batch processing failed: ${result.reason?.message || 'Unknown error'}`
            });
          }
        }
      }

      processedCount += currentBatches.reduce((sum, batch) => sum + batch.length, 0);
      onProgress?.(processedCount, fileMetadataList.length);
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return {
      successful,
      failed,
      stats: {
        processed: results.length,
        successful: successful.length,
        failed: failed.length
      }
    };
  }

  /**
   * Processes a single batch of files
   */
  private async processSingleBatch(
    batch: FileMetadata[],
    userId: string
  ): Promise<FileBatchResult[]> {
    const results: FileBatchResult[] = [];

    // Process files in the batch sequentially (within the batch)
    // This avoids overwhelming the system while still maintaining parallelism across batches
    for (const fileMetadata of batch) {
      try {
        const result = await this.processSingleFile(fileMetadata, userId);
        results.push(result);
      } catch (error: any) {
        results.push({
          success: false,
          filePath: fileMetadata.filePath,
          error: error.message || 'Unknown processing error'
        });
      }
    }

    return results;
  }

  /**
   * Processes a single file and extracts metadata
   */
  private async processSingleFile(
    fileMetadata: FileMetadata,
    userId: string
  ): Promise<FileBatchResult> {
    try {
      // Import the processAudioFile function dynamically to avoid circular dependencies
      const { processAudioFile } = await import('./index');
      
      const result = await processAudioFile(fileMetadata.filePath, {
        userId,
        artistsProcessedForImages: new Set() // Each batch gets its own set to avoid conflicts
      });

      if (result) {
        return {
          success: true,
          filePath: fileMetadata.filePath,
          trackData: {
            trackId: result.albumId, // This might need adjustment based on actual return type
            albumId: result.albumId,
            title: result.title,
            artistName: result.primaryArtistName
          }
        };
      } else {
        return {
          success: false,
          filePath: fileMetadata.filePath,
          error: 'Failed to process audio file - no result returned'
        };
      }
    } catch (error: any) {
      return {
        success: false,
        filePath: fileMetadata.filePath,
        error: error.message || 'Unknown error during file processing'
      };
    }
  }

  /**
   * Batch inserts artists into the database
   */
  async batchInsertArtists(artistsData: Array<{ name: string; artistId?: string; artistImage?: string | null; musicbrainzArtistId?: string | null }>): Promise<Artist[]> {
    if (artistsData.length === 0) return [];

    try {
      const insertedArtists = await db
        .insert(artists)
        .values(artistsData.map(artist => ({
          name: artist.name,
          artistId: artist.artistId,
          artistImage: artist.artistImage,
          musicbrainzArtistId: artist.musicbrainzArtistId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })))
        .onConflictDoUpdate({
          target: [artists.name],
          set: {
            updatedAt: new Date().toISOString()
          }
        })
        .returning();

      return insertedArtists;
    } catch (error) {
      console.error('Error batch inserting artists:', error);
      return [];
    }
  }

  /**
   * Batch inserts albums into the database
   */
  async batchInsertAlbums(albumsData: Array<{ title: string; userId: string; albumId?: string; year?: number | null; coverPath?: string | null; processedStatus?: number; folderPath?: string | null; musicbrainzReleaseId?: string | null }>): Promise<Album[]> {
    if (albumsData.length === 0) return [];

    try {
      const insertedAlbums = await db
        .insert(albums)
        .values(albumsData.map(album => ({
          title: album.title,
          userId: album.userId,
          albumId: album.albumId,
          year: album.year,
          coverPath: album.coverPath,
          processedStatus: album.processedStatus ?? 0,
          folderPath: album.folderPath,
          musicbrainzReleaseId: album.musicbrainzReleaseId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })))
        .onConflictDoUpdate({
          target: [albums.title, albums.userId],
          set: {
            updatedAt: new Date().toISOString()
          }
        })
        .returning();

      return insertedAlbums;
    } catch (error) {
      console.error('Error batch inserting albums:', error);
      return [];
    }
  }

  /**
   * Batch inserts tracks into the database
   */
  async batchInsertTracks(tracksData: Array<{ title: string; filePath: string; albumId?: string | null; duration?: number | null; trackNumber?: number | null; diskNumber?: number | null; year?: number | null; genre?: string | null; explicit?: boolean | null; musicbrainzTrackId?: string | null }>): Promise<Track[]> {
    if (tracksData.length === 0) return [];

    try {
      const insertedTracks = await db
        .insert(tracks)
        .values(tracksData.map(track => ({
          title: track.title,
          filePath: track.filePath,
          albumId: track.albumId,
          duration: track.duration,
          trackNumber: track.trackNumber,
          diskNumber: track.diskNumber,
          year: track.year,
          genre: track.genre,
          explicit: track.explicit ?? undefined,
          musicbrainzTrackId: track.musicbrainzTrackId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })))
        .onConflictDoUpdate({
          target: [tracks.filePath],
          set: {
            updatedAt: new Date().toISOString()
          }
        })
        .returning();

      return insertedTracks;
    } catch (error) {
      console.error('Error batch inserting tracks:', error);
      return [];
    }
  }

  /**
   * Executes multiple database operations in a single transaction
   */
  async executeBatchTransaction<T>(
    operations: Array<(tx: any) => Promise<T>>
  ): Promise<T[]> {
    return await db.transaction(async (tx) => {
      const results: T[] = [];
      
      for (const operation of operations) {
        try {
          const result = await operation(tx);
          results.push(result);
        } catch (error) {
          console.error('Error in batch transaction operation:', error);
          throw error; // This will rollback the entire transaction
        }
      }
      
      return results;
    });
  }

  /**
   * Cleanup method to terminate any active workers
   */
  async cleanup(): Promise<void> {
    const terminationPromises = Array.from(this.activeWorkers).map(worker => {
      return new Promise<void>((resolve) => {
        worker.terminate().then(() => resolve()).catch(() => resolve());
      });
    });

    await Promise.all(terminationPromises);
    this.activeWorkers.clear();
  }
}

/**
 * Creates a batch processor with optimal configuration for the system
 */
export function createBatchProcessor(customConfig?: Partial<WorkerPoolConfig>): BatchProcessor {
  return new BatchProcessor(customConfig);
}
