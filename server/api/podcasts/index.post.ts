import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '~/server/db';
import { podcasts, podcastSubscriptions } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';
import { v7 as uuidv7 } from 'uuid';
function parseFeedMeta(xml: string, feedUrl: string) {
  const title = xml.match(/<title>([^<]+)<\/title>/i)?.[1] ?? feedUrl;
  const desc = xml.match(/<description>([^<]*)<\/description>/i)?.[1] ?? '';
  const image = xml.match(/<itunes:image[^>]*href="([^"]+)"[^>]*>/i)?.[1] ?? null;
  return { title, description: desc, imageUrl: image };
}

interface SubscribeBody { feedUrl: string }

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readBody<SubscribeBody>(event);
  const feedUrl = body.feedUrl?.trim();
  if (!feedUrl) {
    throw createError({ statusCode: 400, statusMessage: 'feedUrl required' });
  }

  let podcast = await db
    .select()
    .from(podcasts)
    .where(eq(podcasts.feedUrl, feedUrl))
    .get();

  if (!podcast) {
    try {
      const xml = await $fetch<string>(feedUrl);
      const meta = parseFeedMeta(xml, feedUrl);
      podcast = {
        podcastId: uuidv7(),
        feedUrl,
        title: meta.title,
        description: meta.description,
        imageUrl: meta.imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.insert(podcasts).values(podcast);
    } catch (error) {
      console.error('Failed to parse podcast feed:', error);
      throw createError({ statusCode: 400, statusMessage: 'Invalid podcast feed' });
    }
  }

  const existing = await db
    .select()
    .from(podcastSubscriptions)
    .where(
      and(
        eq(podcastSubscriptions.userId, user.userId),
        eq(podcastSubscriptions.podcastId, podcast.podcastId)
      )
    )
    .get();

  if (!existing) {
    await db.insert(podcastSubscriptions).values({
      subscriptionId: uuidv7(),
      userId: user.userId,
      podcastId: podcast.podcastId,
      createdAt: new Date().toISOString(),
    });
  }

  return podcast;
});
