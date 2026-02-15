import { getUserFromEvent } from '~/server/utils/auth';
import { startScanSchema } from '~/server/services/scanner/schemas';
import { enqueueScanForLibrary } from '~/server/services/scanner/enqueue';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const body = await readValidatedBody(event, (raw) => startScanSchema.safeParse(raw));
  if (!body.success) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid scan payload', data: body.error.flatten() });
  }

  const { scanId, jobId } = await enqueueScanForLibrary(body.data, user.userId);
  setResponseStatus(event, 202);
  return { scanId, jobId };
});
