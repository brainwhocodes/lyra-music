import { db, schema } from '../server/db'; // Import Drizzle db instance and schema
import { gte } from 'drizzle-orm';
import { updateUserNewDiscoveriesPlaylist, type PlaylistUpdateResult } from '../server/services/playlist-manager/new-discoveries-manager';
import { DateTime } from 'luxon';
import 'dotenv/config';
import type { Job, JobResult } from 'gut-punch'; // Assuming GutPunch types are still relevant for the interface
import { JobRunStatus } from 'gut-punch'; // Assuming GutPunch types are still relevant for the interface

export class UpdateNewDiscoveriesJob implements Job {
  public static readonly runInProcess: boolean = false;
  public readonly name: string = 'UpdateNewDiscoveriesJob';
  public readonly maxRetries: number = 3;
  public readonly reschedule: boolean = true;
  // Run every hour
  public readonly rescheduleIn: number = 60_000 * 60; // Reschedule in 1 hour

  public async run(params?: Record<string, unknown>): Promise<JobResult> {
    const jobStartTime = DateTime.now();
    console.log(`[${jobStartTime.toISO()}] Starting job: ${this.name}...`);

    // Drizzle db instance is imported, no need for manual connection setup or DATABASE_URL check here
    // as db instance should be pre-configured.

    let activeUsersFound = 0;
    let activeUsersProcessed = 0;
    let playlistsUpdated = 0;
    let playlistsFailed = 0;

    try {
      const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toISO();
      if (!thirtyDaysAgo) {
        const errorMessage = 'Failed to calculate thirtyDaysAgo timestamp.';
        console.error(errorMessage);
        return { status: JobRunStatus.Failed, output: { message: errorMessage } };
      }

      // Drizzle query to get active users
      const activeUsers = await db.select({
        // Drizzle maps these to snake_case columns like user_id, last_login_at
        userId: schema.users.userId,
        name: schema.users.name,
        lastLoginAt: schema.users.lastLoginAt, 
      })
      .from(schema.users)
      .where(gte(schema.users.lastLoginAt, thirtyDaysAgo));
      
      activeUsersFound = activeUsers.length;
      console.log(`Found ${activeUsersFound} active users (last login within 30 days).`);

      for (const user of activeUsers) {
        activeUsersProcessed++;
        // Ensure user.userId is not null or undefined before logging or using it.
        const currentUserId = user.userId;
        const currentUserName = user.name || 'Unknown User';
        console.log(`[${activeUsersProcessed}/${activeUsersFound}] Processing user: ${currentUserName} (ID: ${currentUserId})`);
        
        if (!currentUserId) {
            console.error(`Skipping user due to missing ID. Index: ${activeUsersProcessed -1}`);
            playlistsFailed++;
            continue;
        }

        // Pass the Drizzle db instance directly
        const result: PlaylistUpdateResult = await updateUserNewDiscoveriesPlaylist(db, currentUserId);
        
        if (result.success) {
          if (result.discoveryPlaylistId && result.trackCount && result.trackCount > 0) {
              console.log(`Successfully updated playlist ${result.discoveryPlaylistId} with ${result.trackCount} tracks for user ${currentUserId}.`);
              playlistsUpdated++;
          } else {
              console.log(`Playlist generated for user ${currentUserId}, but no new tracks were found or added. Message: ${result.message}`);
              playlistsUpdated++; 
          }
        } else {
          console.error(`Failed to update playlist for user ${currentUserId}. Error: ${result.message} - ${result.error || ''}`);
          playlistsFailed++;
        }
      }

      const jobEndTime = DateTime.now();
      const duration = jobEndTime.diff(jobStartTime, ['seconds', 'milliseconds']).toObject(); 
      const summaryMessage = `Job ${this.name} finished in ${duration.seconds ?? 0}.${String(duration.milliseconds || 0).padStart(3,'0')}s. Summary: Active users found: ${activeUsersFound}, Processed: ${activeUsersProcessed}, Playlists updated/generated: ${playlistsUpdated}, Failures: ${playlistsFailed}.`;
      console.log(`[${jobEndTime.toISO()}] ${summaryMessage}`);
      
      // No need to manually close db connection with Drizzle's shared instance

      if (playlistsFailed > 0 && playlistsFailed === activeUsersProcessed && activeUsersProcessed > 0) {
        return { status: JobRunStatus.Failed, output: { message: `All ${activeUsersProcessed} user playlist updates failed.` } };
      } else if (playlistsFailed > 0) {
        return { status: JobRunStatus.Success, output: { message: `Job completed with ${playlistsFailed} failures out of ${activeUsersProcessed} users. ${summaryMessage}` } };
      }
      return { status: JobRunStatus.Success, output: { message: summaryMessage } };

    } catch (error: any) {
      console.error(`Error during ${this.name} execution:`, error);
      return { status: JobRunStatus.Failed, output: { message: `Job execution failed: ${error.message}` } };
    } 
    // No finally block needed to close DB as it's managed by Drizzle's global instance
  }
}
