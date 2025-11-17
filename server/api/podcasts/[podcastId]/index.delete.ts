import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { podcastSubscriptions } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

/**
 * Unsubscribe from a podcast
 */
export default defineEventHandler(async (event): Promise<{ success: boolean }> => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const podcastId = event.context.params?.podcastId;
  if (!podcastId) {
    throw createError({ statusCode: 400, statusMessage: 'Podcast ID required' });
  }

  // Delete the subscription
  const result = await db
    .delete(podcastSubscriptions)
    .where(
      and(
        eq(podcastSubscriptions.podcastId, podcastId),
        eq(podcastSubscriptions.userId, user.userId)
      )
    )
    .run();

  // Check if anything was deleted
  // The result object structure depends on the database driver
  // For SQLite, we need to check changes property
  if (!result || (typeof result === 'object' && 'changes' in result && result.changes === 0)) {
    throw createError({ 
      statusCode: 404, 
      statusMessage: 'Subscription not found or already removed' 
    });
  }

  return { success: true };
});
