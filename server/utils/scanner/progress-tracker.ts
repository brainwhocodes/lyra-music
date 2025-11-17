import type { ScanProgress, ScanStats, ScanError, ScanSession } from './scan-types';
import { calculateEstimatedTimeRemaining } from './file-system-utils';

// In-memory store for active scan sessions
const activeScanSessions = new Map<string, ScanSession>();

export class ProgressTracker {
  private sessionId: string;
  private progress: ScanProgress;
  private onProgressUpdate?: (progress: ScanProgress) => void;

  constructor(
    sessionId: string,
    totalFiles: number,
    onProgressUpdate?: (progress: ScanProgress) => void
  ) {
    this.sessionId = sessionId;
    this.onProgressUpdate = onProgressUpdate;
    
    this.progress = {
      totalFiles,
      processedFiles: 0,
      currentPhase: 'initializing',
      estimatedTimeRemaining: null,
      startTime: new Date(),
      errors: [],
      stats: {
        scannedFiles: 0,
        addedTracks: 0,
        addedArtists: 0,
        addedAlbums: 0,
        skippedFiles: 0,
        errors: 0
      }
    };
  }

  /**
   * Updates the current processing phase
   */
  setPhase(phase: ScanProgress['currentPhase']): void {
    this.progress.currentPhase = phase;
    this.emitProgress();
  }

  /**
   * Updates the currently processing file
   */
  setCurrentFile(filePath: string): void {
    this.progress.currentFile = filePath;
    this.emitProgress();
  }

  /**
   * Increments processed files count and updates statistics
   */
  incrementProcessed(stats?: Partial<ScanStats>): void {
    this.progress.processedFiles++;
    
    if (stats) {
      if (stats.addedTracks) this.progress.stats.addedTracks += stats.addedTracks;
      if (stats.addedArtists) this.progress.stats.addedArtists += stats.addedArtists;
      if (stats.addedAlbums) this.progress.stats.addedAlbums += stats.addedAlbums;
      if (stats.skippedFiles) this.progress.stats.skippedFiles += stats.skippedFiles;
    }
    
    this.progress.stats.scannedFiles = this.progress.processedFiles;
    
    // Update estimated time remaining
    this.progress.estimatedTimeRemaining = calculateEstimatedTimeRemaining(
      this.progress.totalFiles,
      this.progress.processedFiles,
      this.progress.startTime
    );
    
    this.emitProgress();
  }

  /**
   * Adds an error to the progress tracking
   */
  addError(filePath: string, error: string): void {
    const scanError: ScanError = {
      filePath,
      error,
      timestamp: new Date()
    };
    
    this.progress.errors.push(scanError);
    this.progress.stats.errors++;
    this.emitProgress();
  }

  /**
   * Marks the scan as completed
   */
  complete(): void {
    this.progress.currentPhase = 'completed';
    this.progress.estimatedTimeRemaining = 0;
    this.emitProgress();
  }

  /**
   * Marks the scan as failed with error
   */
  error(errorMessage: string): void {
    this.progress.currentPhase = 'error';
    this.addError('SYSTEM', errorMessage);
    this.emitProgress();
  }

  /**
   * Gets the current progress
   */
  getProgress(): ScanProgress {
    return { ...this.progress };
  }

  /**
   * Gets completion percentage
   */
  getCompletionPercentage(): number {
    if (this.progress.totalFiles === 0) return 100;
    return Math.round((this.progress.processedFiles / this.progress.totalFiles) * 100);
  }

  /**
   * Gets elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return Date.now() - this.progress.startTime.getTime();
  }

  /**
   * Gets processing rate (files per second)
   */
  getProcessingRate(): number {
    const elapsedSeconds = this.getElapsedTime() / 1000;
    return elapsedSeconds > 0 ? this.progress.processedFiles / elapsedSeconds : 0;
  }

  /**
   * Emits progress update to registered callback
   */
  private emitProgress(): void {
    if (this.onProgressUpdate) {
      this.onProgressUpdate(this.progress);
    }
  }
}

/**
 * Creates a new scan session and returns its progress tracker
 */
export function createScanSession(
  userId: string,
  libraryId: string,
  libraryPath: string,
  totalFiles: number,
  onProgressUpdate?: (progress: ScanProgress) => void
): { sessionId: string; tracker: ProgressTracker } {
  const sessionId = `scan_${userId}_${libraryId}_${Date.now()}`;
  
  const tracker = new ProgressTracker(sessionId, totalFiles, onProgressUpdate);
  
  const session: ScanSession = {
    sessionId,
    userId,
    libraryId,
    libraryPath,
    startTime: new Date(),
    progress: tracker.getProgress(),
    isActive: true
  };
  
  activeScanSessions.set(sessionId, session);
  
  return { sessionId, tracker };
}

/**
 * Gets an active scan session by ID
 */
export function getScanSession(sessionId: string): ScanSession | null {
  return activeScanSessions.get(sessionId) || null;
}

/**
 * Gets all active scan sessions for a user
 */
export function getUserScanSessions(userId: string): ScanSession[] {
  const userSessions: ScanSession[] = [];
  for (const session of activeScanSessions.values()) {
    if (session.userId === userId && session.isActive) {
      userSessions.push(session);
    }
  }
  return userSessions;
}

/**
 * Completes and removes a scan session
 */
export function completeScanSession(sessionId: string): void {
  const session = activeScanSessions.get(sessionId);
  if (session) {
    session.isActive = false;
    // Keep session for a while for final progress queries, then remove
    setTimeout(() => {
      activeScanSessions.delete(sessionId);
    }, 60000); // Remove after 1 minute
  }
}

/**
 * Cleans up old inactive sessions
 */
export function cleanupOldSessions(): void {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const [sessionId, session] of activeScanSessions.entries()) {
    if (!session.isActive && session.startTime.getTime() < oneHourAgo) {
      activeScanSessions.delete(sessionId);
    }
  }
}

// Clean up old sessions every 30 minutes
setInterval(cleanupOldSessions, 30 * 60 * 1000);
