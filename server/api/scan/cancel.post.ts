import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUserFromEvent } from '~/server/utils/auth';
import { db } from '~/server/db';
import { scanRuns } from '~/server/db/schema';
import { requestJobCancel } from '~/server/jobs/queue';
import { buildCancelResponse } from '~/server/services/scanner/cancel-response';

const cancelSchema = z.object({ scanId: z.string().min(1) });

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readValidatedBody(event, (raw) => cancelSchema.safeParse(raw));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid cancel payload', data: body.error.flatten() });
  }

  const [scan] = await db.select({ jobId: scanRuns.jobId })
    .from(scanRuns)
    .where(and(eq(scanRuns.scanId, body.data.scanId), eq(scanRuns.userId, user.userId)))
    .limit(1);

  if (!scan) {
    throw createError({ statusCode: 404, statusMessage: 'Scan not found' });
  }

  const cancelRequest = await requestJobCancel(scan.jobId);
  return buildCancelResponse(body.data.scanId, cancelRequest);
});
