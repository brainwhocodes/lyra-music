import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { podcasts } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import type { PodcastEpisode } from '~/types/podcast';

/**
 * Parse podcast episodes from RSS XML
 * @param xml The podcast RSS feed XML content
 * @param podcastId The ID of the podcast
 * @returns Array of parsed podcast episodes
 */
function parseEpisodes(xml: string, podcastId: string): PodcastEpisode[] {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items: string[] = [];
  let match: RegExpExecArray | null;
  
  // Extract all item blocks
  while ((match = itemRegex.exec(xml))) {
    items.push(match[1]);
  }
  
  // Get podcast image URL from channel
  const channelImageUrl = xml.match(/<image>\s*<url>([^<]+)<\/url>/i)?.[1] ||
                         xml.match(/<itunes:image\s+href="([^"]+)"/i)?.[1];
  
  const now = new Date().toISOString();
  
  return items.map(block => {
    // Extract basic metadata
    const title = extractTag(block, 'title') || extractTag(block, 'h2') || 'Untitled Episode';
    const description = extractTag(block, 'description') || 
                       extractTag(block, 'itunes:summary') || 
                       '';
    const pubDate = extractTag(block, 'pubDate');
    
    // Extract audio file info
    const enclosureMatch = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*type="([^"]+)"[^>]*length="([^"]+)"/i);
    const audioUrl = enclosureMatch?.[1] || null; // Keep as null to match interface
    const fileSize = enclosureMatch?.[3] ? parseInt(enclosureMatch[3], 10) : undefined;
    
    // Extract iTunes specific tags
    const duration = parseDuration(extractTag(block, 'itunes:duration'));
    const imageUrl = extractTag(block, 'itunes:image', 'href') || channelImageUrl || null; // Ensure null not undefined
    const explicit = extractTag(block, 'itunes:explicit') === 'yes';
    const season = parseInt(extractTag(block, 'itunes:season') || '0', 10) || undefined;
    const episode = parseInt(extractTag(block, 'itunes:episode') || '0', 10) || undefined;
    
    // Extract GUID
    const guid = extractTag(block, 'guid') || audioUrl || '';
    
    // Generate a unique episode ID
    const episodeId = randomUUID();
    
    return {
      episodeId,
      podcastId,
      title,
      description,
      pubDate,
      audioUrl,
      imageUrl,
      duration,
      fileSize,
      explicit,
      season,
      episode,
      guid,
      createdAt: now,
      updatedAt: now,
      isPlayed: false,
      playPosition: 0
    };
  });
}

/**
 * Extract content from an XML tag
 * @param xml The XML string
 * @param tagName The name of the tag to extract
 * @param attribute Optional attribute to extract instead of tag content
 * @returns The extracted content or undefined
 */
function extractTag(xml: string, tagName: string, attribute?: string): string | undefined {
  if (attribute) {
    const regex = new RegExp(`<${tagName}[^>]*${attribute}="([^"]+)"[^>]*>`, 'i');
    return xml.match(regex)?.[1];
  } else {
    const regex = new RegExp(`<${tagName}>([^<]*)<\/${tagName}>`, 'i');
    return xml.match(regex)?.[1];
  }
}

/**
 * Parse duration string to seconds
 * @param duration Duration string (e.g. '1:30:45' or '5400')
 * @returns Duration in seconds or undefined
 */
function parseDuration(duration?: string): number | undefined {
  if (!duration) return undefined;
  
  // If it's just a number, assume it's seconds
  if (/^\d+$/.test(duration)) {
    return parseInt(duration, 10);
  }
  
  // If it's in format HH:MM:SS or MM:SS
  const parts = duration.split(':').map(part => parseInt(part, 10));
  
  if (parts.length === 3) {
    // HH:MM:SS
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // MM:SS
    return parts[0] * 60 + parts[1];
  }
  
  return undefined;
}

/**
 * Get episodes for a specific podcast
 */
export default defineEventHandler(async (event): Promise<PodcastEpisode[]> => {
  const podcastId = event.context.params?.podcastId;
  if (!podcastId) {
    throw createError({ statusCode: 400, statusMessage: 'Podcast ID required' });
  }

  const podcast = await db.select().from(podcasts).where(eq(podcasts.podcastId, podcastId)).get();
  if (!podcast) {
    throw createError({ statusCode: 404, statusMessage: 'Podcast not found' });
  }

  try {
    const xml = await $fetch<string>(podcast.feedUrl);
    const episodes = parseEpisodes(xml, podcastId);
    return episodes;
  } catch (error) {
    console.error('Failed to fetch podcast feed:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch episodes' });
  }
});
