import type { EnrichmentTask } from './scan-types';
import { db } from '~/server/db';
import { albums, artists } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { albumArtUtils } from './album-art-utils';

export class BackgroundProcessor {
  private taskQueue: EnrichmentTask[] = [];
  private isProcessing = false;
  private maxConcurrentTasks = 3;
  private processingTasks = new Set<Promise<void>>();

  /**
   * Adds a task to the background processing queue
   */
  addTask(task: EnrichmentTask): void {
    this.taskQueue.push(task);
    this.taskQueue.sort((a, b) => b.priority - a.priority); // Higher priority first
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Adds multiple tasks to the queue
   */
  addTasks(tasks: EnrichmentTask[]): void {
    this.taskQueue.push(...tasks);
    this.taskQueue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isProcessing) {
      this.startProcessing();
    }
  }

  /**
   * Starts the background processing loop
   */
  private async startProcessing(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    while (this.taskQueue.length > 0 || this.processingTasks.size > 0) {
      // Start new tasks up to the concurrency limit
      while (this.taskQueue.length > 0 && this.processingTasks.size < this.maxConcurrentTasks) {
        const task = this.taskQueue.shift()!;
        const taskPromise = this.processTask(task);
        this.processingTasks.add(taskPromise);
        
        // Remove from processing set when complete
        taskPromise.finally(() => {
          this.processingTasks.delete(taskPromise);
        });
      }
      
      // Wait for at least one task to complete before continuing
      if (this.processingTasks.size > 0) {
        await Promise.race(this.processingTasks);
      }
      
      // Small delay to prevent tight loop
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }

  /**
   * Processes a single enrichment task
   */
  private async processTask(task: EnrichmentTask): Promise<void> {
    try {
      switch (task.type) {
        case 'album-art':
          await this.processAlbumArtTask(task);
          break;
        case 'musicbrainz-data':
          await this.processMusicBrainzTask(task);
          break;
        case 'artist-images':
          await this.processArtistImagesTask(task);
          break;
        default:
          console.warn(`Unknown task type: ${task.type}`);
      }
    } catch (error) {
      console.error(`Error processing background task ${task.type}:`, error);
    }
  }

  /**
   * Processes album art download task
   */
  private async processAlbumArtTask(task: EnrichmentTask): Promise<void> {
    if (!task.albumId || !task.albumTitle || !task.artistName) {
      console.warn('Album art task missing required data');
      return;
    }

    try {
      const coverPath = await albumArtUtils.searchAndDownloadAlbumArt(
        task.albumTitle,
        task.artistName
      );

      if (coverPath) {
        await db
          .update(albums)
          .set({ 
            coverPath, 
            updatedAt: new Date().toISOString() 
          })
          .where(eq(albums.albumId, task.albumId));
        
        console.log(`Successfully downloaded album art for: ${task.albumTitle} by ${task.artistName}`);
      }
    } catch (error) {
      console.error(`Failed to download album art for ${task.albumTitle}:`, error);
    }
  }

  /**
   * Processes MusicBrainz data enrichment task
   */
  private async processMusicBrainzTask(task: EnrichmentTask): Promise<void> {
    if (!task.albumId || !task.albumTitle || !task.artistName) {
      console.warn('MusicBrainz task missing required data');
      return;
    }

    try {
      // Import MusicBrainz utilities
      const { searchReleaseByTitleAndArtist, getReleaseInfoWithTags } = await import('~/server/utils/musicbrainz');
      
      const releaseInfo = await searchReleaseByTitleAndArtist(task.albumTitle, task.artistName);
      
      if (releaseInfo && typeof releaseInfo === 'string') {
        const detailedInfo = await getReleaseInfoWithTags(releaseInfo);
        
        if (detailedInfo) {
          await db
            .update(albums)
            .set({
              musicbrainzReleaseId: releaseInfo,
              year: detailedInfo.date ? new Date(detailedInfo.date).getFullYear() : null,
              updatedAt: new Date().toISOString()
            })
            .where(eq(albums.albumId, task.albumId));
          
          console.log(`Successfully enriched MusicBrainz data for: ${task.albumTitle}`);
        }
      }
    } catch (error) {
      console.error(`Failed to enrich MusicBrainz data for ${task.albumTitle}:`, error);
    }
  }

  /**
   * Processes artist images download task
   */
  private async processArtistImagesTask(task: EnrichmentTask): Promise<void> {
    if (!task.artistId || !task.artistName) {
      console.warn('Artist images task missing required data');
      return;
    }

    try {
      // Import MusicBrainz utilities for artist search and image download
      const { searchArtistByName } = await import('~/server/utils/musicbrainz');
      const { albumArtUtils } = await import('~/server/utils/scanner/album-art-utils');
      
      // First, search for the artist on MusicBrainz
      const musicBrainzArtist = await searchArtistByName(task.artistName);
      
      if (musicBrainzArtist && musicBrainzArtist.id) {
        // Try to download artist image from MusicBrainz
        const imagePath = await albumArtUtils.downloadArtistImageFromMusicBrainz(musicBrainzArtist.id);
        
        if (imagePath) {
          // Update the artist record with the downloaded image path
          await db
            .update(artists)
            .set({
              artistImage: imagePath,
              musicbrainzArtistId: musicBrainzArtist.id,
              updatedAt: new Date().toISOString()
            })
            .where(eq(artists.artistId, task.artistId));
          
          console.log(`Successfully downloaded and updated artist image for: ${task.artistName}`);
        } else {
          // If no image found, still update the MusicBrainz ID for future reference
          await db
            .update(artists)
            .set({
              musicbrainzArtistId: musicBrainzArtist.id,
              updatedAt: new Date().toISOString()
            })
            .where(eq(artists.artistId, task.artistId));
          
          console.log(`No image found but updated MusicBrainz ID for artist: ${task.artistName}`);
        }
      } else {
        console.log(`No MusicBrainz match found for artist: ${task.artistName}`);
      }
    } catch (error) {
      console.error(`Failed to process artist image for ${task.artistName}:`, error);
    }
  }

  /**
   * Gets the current queue status
   */
  getQueueStatus(): {
    queueLength: number;
    isProcessing: boolean;
    activeTasks: number;
  } {
    return {
      queueLength: this.taskQueue.length,
      isProcessing: this.isProcessing,
      activeTasks: this.processingTasks.size
    };
  }

  /**
   * Clears all pending tasks
   */
  clearQueue(): void {
    this.taskQueue = [];
  }

  /**
   * Waits for all current tasks to complete
   */
  async waitForCompletion(): Promise<void> {
    while (this.isProcessing || this.processingTasks.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  /**
   * Creates album art tasks for multiple albums
   */
  static createAlbumArtTasks(
    albums: Array<{ albumId: string; title: string; artistName: string }>
  ): EnrichmentTask[] {
    return albums.map(album => ({
      type: 'album-art' as const,
      albumId: album.albumId,
      albumTitle: album.title,
      artistName: album.artistName,
      priority: 2
    }));
  }

  /**
   * Creates MusicBrainz enrichment tasks for multiple albums
   */
  static createMusicBrainzTasks(
    albums: Array<{ albumId: string; title: string; artistName: string }>
  ): EnrichmentTask[] {
    return albums.map(album => ({
      type: 'musicbrainz-data' as const,
      albumId: album.albumId,
      albumTitle: album.title,
      artistName: album.artistName,
      priority: 1
    }));
  }

  /**
   * Creates artist image tasks for multiple artists
   */
  static createArtistImageTasks(
    artists: Array<{ artistId: string; name: string }>
  ): EnrichmentTask[] {
    return artists.map(artist => ({
      type: 'artist-images' as const,
      artistId: artist.artistId,
      artistName: artist.name,
      priority: 3
    }));
  }
}

// Global background processor instance
let globalBackgroundProcessor: BackgroundProcessor | null = null;

/**
 * Gets or creates the global background processor instance
 */
export function getBackgroundProcessor(): BackgroundProcessor {
  if (!globalBackgroundProcessor) {
    globalBackgroundProcessor = new BackgroundProcessor();
  }
  return globalBackgroundProcessor;
}
