export interface Podcast {
  podcastId: string;
  feedUrl: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  subscribedAt?: string;
}

export interface PodcastEpisode {
  title: string;
  pubDate?: string;
  audioUrl?: string | null;
  description?: string;
}
