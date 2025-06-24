import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { podcasts, podcastSubscriptions } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const result = await db
    .select({
      podcastId: podcasts.podcastId,
      feedUrl: podcasts.feedUrl,
      title: podcasts.title,
      description: podcasts.description,
      imageUrl: podcasts.imageUrl,
      createdAt: podcasts.createdAt,
      updatedAt: podcasts.updatedAt,
      subscribedAt: podcastSubscriptions.createdAt,
    })
    .from(podcastSubscriptions)
    .leftJoin(podcasts, eq(podcastSubscriptions.podcastId, podcasts.podcastId))
    .where(eq(podcastSubscriptions.userId, user.userId))
    .all();

  return result;
});
