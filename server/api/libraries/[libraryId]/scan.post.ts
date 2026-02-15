import { z } from 'zod';
import { enqueueScanForLibrary } from '~/server/services/scanner/enqueue';
import type { H3Event } from 'h3';

const paramsSchema = z.object({
  libraryId: z.string().min(1),
});

export default defineEventHandler(async (event: H3Event) => {
  const user = event.context.user;
  if (!user?.userId) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Authentication required.' });
  }

  const params = await getValidatedRouterParams(event, (raw) => paramsSchema.safeParse(raw));
  if (!params.success) {
    throw createError({ statusCode: 400, statusMessage: 'Bad Request: Invalid Library ID provided in URL.', data: params.error.format() });
  }

  const { scanId, jobId } = await enqueueScanForLibrary({
    libraryId: params.data.libraryId,
    processOnlyUnprocessed: true,
    options: {},
  }, user.userId);
  setResponseStatus(event, 202);
  return { message: 'Scan queued.', scanId, jobId };
});
