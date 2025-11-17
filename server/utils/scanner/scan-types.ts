export interface ScanProgress {
  totalFiles: number;
  processedFiles: number;
  currentPhase: 'initializing' | 'scanning' | 'processing' | 'enriching' | 'completed' | 'error';
  estimatedTimeRemaining: number | null;
  startTime: Date;
  currentFile?: string;
  errors: ScanError[];
  stats: ScanStats;
}

export interface ScanError {
  filePath: string;
  error: string;
  timestamp: Date;
}

export interface ScanStats {
  scannedFiles: number;
  addedTracks: number;
  addedArtists: number;
  addedAlbums: number;
  skippedFiles: number;
  errors: number;
}

export interface FileBatchResult {
  success: boolean;
  filePath: string;
  trackData?: {
    trackId: string;
    albumId: string;
    title: string;
    artistName: string;
  };
  error?: string;
}

export interface BatchProcessingResult {
  successful: FileBatchResult[];
  failed: FileBatchResult[];
  stats: {
    processed: number;
    successful: number;
    failed: number;
  };
}

export interface FileMetadata {
  filePath: string;
  lastModified: Date;
  size: number;
  isChanged: boolean;
}

export interface EnrichmentTask {
  type: 'album-art' | 'musicbrainz-data' | 'artist-images';
  albumId?: string;
  artistId?: string;
  albumTitle?: string;
  artistName?: string;
  priority: number;
}

export interface WorkerPoolConfig {
  maxWorkers: number;
  batchSize: number;
  timeoutMs: number;
}

export interface ScanSession {
  sessionId: string;
  userId: string;
  libraryId: string;
  libraryPath: string;
  startTime: Date;
  progress: ScanProgress;
  isActive: boolean;
}
