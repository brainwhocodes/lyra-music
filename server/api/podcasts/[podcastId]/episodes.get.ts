import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { podcasts } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

function parseEpisodes(xml: string) {
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  const items: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml))) {
    items.push(match[1]);
  }
  return items.map(block => {
    const title = block.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '';
    const pubDate = block.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1];
    const audio = block.match(/<enclosure[^>]*url="([^"]+)"[^>]*>/i)?.[1] ?? null;
    const desc = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? '';
    return { title, pubDate, audioUrl: audio, description: desc };
  });
}

export default defineEventHandler(async (event) => {
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
    const episodes = parseEpisodes(xml);
    return episodes;
  } catch (error) {
    console.error('Failed to fetch podcast feed:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch episodes' });
  }
});
