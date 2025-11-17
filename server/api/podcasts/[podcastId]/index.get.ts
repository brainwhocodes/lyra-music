import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { podcasts, podcastSubscriptions } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

/**
 * Get detailed information about a specific podcast
 */
export default defineEventHandler(async (event): Promise<any> => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const podcastId = event.context.params?.podcastId;
  if (!podcastId) {
    throw createError({ statusCode: 400, statusMessage: 'Podcast ID required' });
  }

  // First check if the user is subscribed to this podcast
  const subscription = await db
    .select({
      podcastId: podcastSubscriptions.podcastId,
      createdAt: podcastSubscriptions.createdAt,
    })
    .from(podcastSubscriptions)
    .where(
      and(
        eq(podcastSubscriptions.podcastId, podcastId),
        eq(podcastSubscriptions.userId, user.userId)
      )
    )
    .get();

  if (!subscription) {
    throw createError({ statusCode: 403, statusMessage: 'Not subscribed to this podcast' });
  }

  // Get the podcast details
  const podcast = await db
    .select()
    .from(podcasts)
    .where(eq(podcasts.podcastId, podcastId))
    .get();

  if (!podcast) {
    throw createError({ statusCode: 404, statusMessage: 'Podcast not found' });
  }

  // Add subscription date to the podcast object
  return {
    ...podcast,
    subscribedAt: subscription.createdAt,
  };
});
