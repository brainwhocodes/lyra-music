import cron from 'node-cron';
import { UpdateNewDiscoveriesJob } from './update-new-discoveries'; // Adjust path if necessary
import { DateTime } from 'luxon';
import { logger, patchConsole } from '~/server/utils/logger';

patchConsole();
logger.info(`[${DateTime.now().toISO()}] Initializing cron scheduler...`);

// Create an instance of the job
const updateNewDiscoveriesJob = new UpdateNewDiscoveriesJob();

// Schedule the job to run at the start of every hour
// Cron format: second (optional) minute hour day-of-month month day-of-week
cron.schedule('0 * * * *', async () => {
  const startTime = DateTime.now();
  logger.info(`[${startTime.toISO()}] Cron job '${updateNewDiscoveriesJob.name}' triggered by schedule.`);
  
  try {
    // We don't need the GutPunch JobResult structure here directly,
    // but the run method is designed to return it. We can log its output.
    const result = await updateNewDiscoveriesJob.run();
    const endTime = DateTime.now();
    logger.info(`[${endTime.toISO()}] Cron job '${updateNewDiscoveriesJob.name}' finished. Status: ${result.status}, Message: ${result.output?.message}`);
  } catch (error: any) {
    const endTime = DateTime.now();
    logger.error(`[${endTime.toISO()}] Cron job '${updateNewDiscoveriesJob.name}' failed with an unhandled error: ${error.message}`);
    if (error.stack) {
        logger.error(error.stack);
    }
  }

}, {
  timezone: "America/New_York" // Optional: specify your timezone, e.g., "America/New_York"
});

logger.info(`[${DateTime.now().toISO()}] Cron scheduler initialized. Job '${updateNewDiscoveriesJob.name}' is scheduled to run at the start of every hour.`);
logger.info('Scheduler is running. Press Ctrl+C to exit.');

// Keep the process alive (optional, depending on how you run it)
// process.stdin.resume();
