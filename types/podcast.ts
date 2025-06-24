/**
 * Represents a podcast subscription
 */
export interface Podcast {
  podcastId: string;
  feedUrl: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  author?: string;
  language?: string;
  website?: string;
  categories?: string[];
  explicit?: boolean;
  createdAt: string;
  updatedAt: string;
  subscribedAt?: string;
  lastFetchedAt?: string;
}

/**
 * Represents a podcast episode
 */
export interface PodcastEpisode {
  episodeId: string;
  podcastId: string;
  title: string;
  description?: string;
  pubDate?: string;
  audioUrl?: string | null;
  imageUrl?: string | null;
  duration?: number; // in seconds
  fileSize?: number; // in bytes
  explicit?: boolean;
  season?: number;
  episode?: number;
  guid?: string;
  createdAt: string;
  updatedAt: string;
  isPlayed?: boolean;
  playPosition?: number; // in seconds
}
